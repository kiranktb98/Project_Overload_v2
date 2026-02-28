import Fastify from "fastify";
import type { FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { createDataPlaneFromEnv, type DataPlane } from "@project-overload/dataplane";
import {
  createAnalystClientFromEnv,
  createPlannerClientFromEnv,
  createQueryStrategistClientFromEnv,
  createReportComposerClientFromEnv,
  createSuperSummaryClientFromEnv,
  type AnalystClient,
  type PlannerClient,
  type QueryStrategistClient,
  type ReportComposerClient,
  type SuperSummaryClient
} from "@project-overload/llm-client";
import { SqlGuardError } from "@project-overload/sql-guard";
import { createMetadataStoreFromEnv, type MetadataStore } from "./store";
import { registerSemanticRoutes } from "./routes/semantic";
import { registerContractRoutes } from "./routes/contracts";
import { createLocalRowProviderFromEnv } from "./dataplane/local-row-provider";
import { registerConnectionRoutes } from "./routes/connections";
import { registerUiRoutes } from "./routes/ui";
import { registerConfigRoutes } from "./routes/config";
import { RuntimeConnectionManager } from "./dataplane/connection-manager";
import { validateApiAuth } from "./security/request-context";

export type ApiDependencies = {
  store: MetadataStore;
  data_plane: DataPlane;
  analyst_client: AnalystClient;
  query_strategist: QueryStrategistClient;
  report_composer: ReportComposerClient;
  super_summary_client: SuperSummaryClient;
  planner_client: PlannerClient;
  connection_manager: RuntimeConnectionManager;
};

export async function buildApiApp(options: Partial<ApiDependencies> = {}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      const rawBody = (typeof body === "string" ? body : body.toString("utf8")).trim();

      if (rawBody.length === 0) {
        done(null, {});
        return;
      }

      try {
        done(null, JSON.parse(rawBody));
      } catch (error) {
        done(error as Error);
      }
    }
  );

  const store = options.store ?? (await createMetadataStoreFromEnv());
  const localRowProviderRuntime = createLocalRowProviderFromEnv();
  const connectionManager =
    options.connection_manager ??
    new RuntimeConnectionManager({
      fallback_row_provider: localRowProviderRuntime.row_provider,
      fallback_source: localRowProviderRuntime.source,
      default_timeout_ms: Number.parseInt(process.env.DEFAULT_QUERY_TIMEOUT_MS ?? "900000", 10),
      default_limit: Number.parseInt(process.env.DEFAULT_QUERY_ROW_LIMIT ?? "200", 10),
      state_store: store
    });
  await connectionManager.initFromEnv();

  const dataPlane =
    options.data_plane ??
    createDataPlaneFromEnv({
      local_stub_options: {
        row_provider: (sql) => connectionManager.rowProvider(sql)
      }
    });
  const analystClient = options.analyst_client ?? createAnalystClientFromEnv();
  const queryStrategist = options.query_strategist ?? createQueryStrategistClientFromEnv();
  const reportComposer = options.report_composer ?? createReportComposerClientFromEnv();
  const superSummaryClient = options.super_summary_client ?? createSuperSummaryClientFromEnv();
  const plannerClient = options.planner_client ?? createPlannerClientFromEnv();

  const configuredRateLimit = Number.parseInt(process.env.RATE_LIMIT_RPM ?? "0", 10);
  const rateLimiter =
    Number.isFinite(configuredRateLimit) && configuredRateLimit > 0
      ? createRateLimiter({
          window_ms: 60_000,
          max_requests: configuredRateLimit
        })
      : null;

  if (rateLimiter) {
    app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.url === "/health") return;
      const ip = request.ip || "unknown";
      if (!rateLimiter.check(ip)) {
        return reply.code(429).send({ message: "Too many requests. Please slow down." });
      }
    });
  }

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === "/health") {
      return;
    }

    const auth = validateApiAuth(request);
    if (!auth.ok) {
      return reply.code(401).send({ message: auth.message });
    }
  });

  app.get("/health", async () => ({ status: "ok", service: "api" }));

  registerSemanticRoutes(app, store);
  registerContractRoutes(
    app,
    store,
    dataPlane,
    analystClient,
    queryStrategist,
    reportComposer,
    superSummaryClient,
    plannerClient,
    connectionManager
  );
  registerConnectionRoutes(app, connectionManager);
  registerConfigRoutes(app, store);
  registerUiRoutes(app, store);

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: "Validation failed",
        issues: error.issues
      });
    }

    if (error instanceof SqlGuardError) {
      return reply.code(400).send({ message: error.message });
    }

    if (error instanceof Error) {
      return reply.code(500).send({ message: error.message });
    }

    return reply.code(500).send({ message: "Unknown error" });
  });

  app.addHook("onClose", async () => {
    if (rateLimiter) {
      rateLimiter.destroy();
    }
    await store.close();
    await connectionManager.close();
    await localRowProviderRuntime.close();
  });

  return app;
}

type RateLimiterOptions = {
  window_ms: number;
  max_requests: number;
};

function createRateLimiter(options: RateLimiterOptions) {
  const hits = new Map<string, number[]>();
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - options.window_ms;
    for (const [key, timestamps] of hits) {
      const valid = timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, options.window_ms);

  return {
    check(key: string): boolean {
      const now = Date.now();
      const cutoff = now - options.window_ms;
      const existing = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (existing.length >= options.max_requests) {
        return false;
      }
      existing.push(now);
      hits.set(key, existing);
      return true;
    },
    destroy() {
      clearInterval(cleanup);
      hits.clear();
    }
  };
}
