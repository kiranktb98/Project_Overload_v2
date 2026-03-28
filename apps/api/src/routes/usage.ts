import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MetadataStore } from "../store";
import { resolveRequestContext } from "../security/request-context";
import { fetchOpenRouterBalance } from "../services/openrouter-balance";
import type { UserConnectionRegistry } from "../dataplane/user-connection-registry";

const QueryLogSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  row_count: z.number().int().min(0).optional().default(0),
  execution_ms: z.number().int().min(0).optional().default(0),
  status: z.string().default("unknown")
});

export function registerUsageRoutes(
  app: FastifyInstance,
  store: MetadataStore,
  connectionRegistry: UserConnectionRegistry
): void {
  app.get("/usage/summary", async (request, reply) => {
    const context = resolveRequestContext(request);
    const runs = await gatherTenantRuns(store, context.tenant_id);
    const schedules = await store.listScheduledReportProfiles(context);
    const users = await store.listPlatformUsers(context);

    const username = readHeaderValue(request.headers["x-ui-user"]);
    const queryLogs = username ? connectionRegistry.getOrCreate(username).getQueryLogs() : [];
    const normalizedLogs = queryLogs
      .map((entry) => QueryLogSchema.safeParse(entry))
      .filter((entry): entry is { success: true; data: z.infer<typeof QueryLogSchema> } => entry.success)
      .map((entry) => entry.data);

    const totalQueries = normalizedLogs.length;
    const okQueries = normalizedLogs.filter((entry) => String(entry.status).toLowerCase() === "ok").length;
    const avgRows =
      totalQueries === 0
        ? 0
        : normalizedLogs.reduce((sum, entry) => sum + entry.row_count, 0) / totalQueries;
    const avgLatency =
      totalQueries === 0
        ? 0
        : normalizedLogs.reduce((sum, entry) => sum + entry.execution_ms, 0) / totalQueries;

    const manualRuns = runs.filter((run) => run.trigger === "manual").length;
    const scheduledRuns = runs.filter((run) => run.trigger === "scheduled").length;
    const succeededRuns = runs.filter((run) => run.status === "succeeded").length;
    const failedRuns = runs.filter((run) => run.status === "failed");
    const avgRunDurationMs =
      runs.length === 0
        ? 0
        : runs.reduce((sum, run) => sum + calculateRunDurationMs(run), 0) / runs.length;

    const cadenceCounts = schedules.reduce<Record<string, number>>((acc, schedule) => {
      acc[schedule.frequency] = (acc[schedule.frequency] ?? 0) + 1;
      return acc;
    }, {});
    const timezoneCounts = schedules.reduce<Record<string, number>>((acc, schedule) => {
      acc[schedule.timezone] = (acc[schedule.timezone] ?? 0) + 1;
      return acc;
    }, {});

    return reply.code(200).send({
      summary: {
        governed_queries: {
          total: totalQueries,
          success_rate: totalQueries === 0 ? 0 : okQueries / totalQueries,
          average_rows: avgRows,
          average_latency_ms: avgLatency
        },
        reports: {
          total_runs: runs.length,
          manual_runs: manualRuns,
          scheduled_runs: scheduledRuns,
          success_rate: runs.length === 0 ? 0 : succeededRuns / runs.length,
          average_duration_ms: avgRunDurationMs,
          recent_failed_runs: failedRuns
            .sort(
              (left, right) =>
                Date.parse(right.finished_at ?? right.started_at) - Date.parse(left.finished_at ?? left.started_at)
            )
            .slice(0, 5)
            .map((run) => ({
              id: run.id,
              contract_id: run.contract_id,
              started_at: run.started_at,
              finished_at: run.finished_at,
              trigger: run.trigger
            }))
        },
        schedules: {
          active: schedules.filter((entry) => entry.status === "active").length,
          paused: schedules.filter((entry) => entry.status === "paused").length,
          by_frequency: cadenceCounts,
          by_timezone: timezoneCounts
        },
        users: {
          total: users.length,
          active: users.filter((entry) => entry.is_active).length,
          most_recent_login_at: users
            .map((entry) => entry.last_login_at)
            .filter((entry): entry is string => typeof entry === "string")
            .sort()
            .reverse()[0] ?? null
        }
      }
    });
  });

  app.get("/usage/activity", async (request, reply) => {
    const context = resolveRequestContext(request);
    const runs = await gatherTenantRuns(store, context.tenant_id);
    const username = readHeaderValue(request.headers["x-ui-user"]);
    const queryLogs = username ? connectionRegistry.getOrCreate(username).getQueryLogs() : [];

    return reply.code(200).send({
      queries: queryLogs
        .slice()
        .reverse()
        .slice(0, 50),
      runs: runs
        .slice()
        .sort(
          (left, right) =>
            Date.parse(right.finished_at ?? right.started_at) - Date.parse(left.finished_at ?? left.started_at)
        )
        .slice(0, 25)
        .map((run) => ({
          id: run.id,
          contract_id: run.contract_id,
          status: run.status,
          trigger: run.trigger,
          started_at: run.started_at,
          finished_at: run.finished_at
        }))
    });
  });

  app.get("/usage/ai", async (request, reply) => {
    const context = resolveRequestContext(request);
    const runs = await gatherTenantRuns(store, context.tenant_id);
    const allAgents: Record<string, { input_tokens: number; output_tokens: number; total_tokens: number }> = {};
    const allModels: Record<string, { input_tokens: number; output_tokens: number; total_tokens: number }> = {};
    let totalInput = 0;
    let totalOutput = 0;
    let totalTokens = 0;

    const last24hCutoff = Date.now() - 24 * 60 * 60 * 1000;
    const last7dCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let last24hTokens = 0;
    let last7dTokens = 0;

    for (const run of runs) {
      if (!run.token_usage) {
        continue;
      }
      totalInput += run.token_usage.input_tokens;
      totalOutput += run.token_usage.output_tokens;
      totalTokens += run.token_usage.total_tokens;
      const runTimestamp = Date.parse(run.finished_at ?? run.started_at);
      if (Number.isFinite(runTimestamp) && runTimestamp >= last24hCutoff) {
        last24hTokens += run.token_usage.total_tokens;
      }
      if (Number.isFinite(runTimestamp) && runTimestamp >= last7dCutoff) {
        last7dTokens += run.token_usage.total_tokens;
      }
      for (const [agent, usage] of Object.entries(run.token_usage.by_agent)) {
        const current = allAgents[agent] ?? {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0
        };
        current.input_tokens += usage.input_tokens;
        current.output_tokens += usage.output_tokens;
        current.total_tokens += usage.total_tokens;
        allAgents[agent] = current;
      }
      for (const [model, usage] of Object.entries(run.token_usage.by_model ?? {})) {
        const current = allModels[model] ?? {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0
        };
        current.input_tokens += usage.input_tokens;
        current.output_tokens += usage.output_tokens;
        current.total_tokens += usage.total_tokens;
        allModels[model] = current;
      }
    }

    const balance = await fetchOpenRouterBalance();

    return reply.code(200).send({
      balance,
      usage: {
        input_tokens: totalInput,
        output_tokens: totalOutput,
        total_tokens: totalTokens,
        last_24h_tokens: last24hTokens,
        last_7d_tokens: last7dTokens,
        by_agent: allAgents,
        by_model: allModels
      }
    });
  });
}

async function gatherTenantRuns(store: MetadataStore, tenantId: string) {
  const contracts = await store.listReportContracts({ tenant_id: tenantId });
  const runs = await Promise.all(
    contracts.map((contract) => store.listReportRuns(contract.id, { tenant_id: tenantId }))
  );
  return runs.flat();
}

function calculateRunDurationMs(run: {
  started_at: string;
  finished_at: string | null;
}): number {
  const started = Date.parse(run.started_at);
  const finished = Date.parse(run.finished_at ?? run.started_at);
  if (!Number.isFinite(started) || !Number.isFinite(finished)) {
    return 0;
  }
  return Math.max(0, finished - started);
}

function readHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const trimmed = entry.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}
