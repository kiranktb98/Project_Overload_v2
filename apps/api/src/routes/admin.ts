import type { FastifyInstance, FastifyRequest } from "fastify";
import type { MetadataStore, PlatformUserRecord } from "../store";
import { resolveRequestContext } from "../security/request-context";
import { fetchOpenRouterBalance } from "../services/openrouter-balance";

const CONNECTION_STATE_KEY = "runtime_connection_v1";

export function registerAdminRoutes(app: FastifyInstance, store: MetadataStore): void {
  app.get("/admin/overview", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }

    const [accounts, users, contracts, runs, schedules, connections, balance] = await Promise.all([
      store.listCustomerAccounts(),
      store.listPlatformUsers(),
      store.listAllReportContracts(),
      store.listAllReportRuns(),
      store.listAllScheduledReportProfiles(),
      store.listSystemStatesByKey(CONNECTION_STATE_KEY),
      fetchOpenRouterBalance()
    ]);

    return reply.code(200).send({
      overview: {
        customers: accounts.length,
        active_customers: accounts.filter((entry) => entry.status === "active").length,
        users: users.length,
        active_users: users.filter((entry) => entry.is_active).length,
        connections: connections.length,
        report_contracts: contracts.length,
        report_runs: runs.length,
        failed_runs: runs.filter((entry) => entry.status === "failed").length,
        active_schedules: schedules.filter((entry) => entry.status === "active").length,
        paused_schedules: schedules.filter((entry) => entry.status === "paused").length
      },
      openrouter_balance: balance
    });
  });

  app.get("/admin/customers", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    const accounts = await store.listCustomerAccounts();
    const users = await store.listPlatformUsers();
    const contracts = await store.listAllReportContracts();
    const schedules = await store.listAllScheduledReportProfiles();

    return reply.code(200).send({
      items: accounts.map((account) => ({
        ...account,
        user_count: users.filter((user) => user.tenant_id === account.tenant_id && user.role === "customer").length,
        contract_count: contracts.filter((contract) => (contract.tenant_id ?? "default") === account.tenant_id).length,
        schedule_count: schedules.filter((schedule) => (schedule.tenant_id ?? "default") === account.tenant_id).length
      }))
    });
  });

  app.get("/admin/users", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    return reply.code(200).send({
      items: await store.listPlatformUsers()
    });
  });

  app.get("/admin/connections", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }

    const states = await store.listSystemStatesByKey(CONNECTION_STATE_KEY);
    return reply.code(200).send({
      items: states.map((entry) => {
        const payload = entry.payload ?? {};
        const allowlistedRelations = Array.isArray(payload.allowed_relations)
          ? payload.allowed_relations.filter((value): value is string => typeof value === "string")
          : [];
        return {
          tenant_id: entry.tenant_id,
          name: typeof payload.name === "string" ? payload.name : "Connected source",
          provider: typeof payload.provider === "string" ? payload.provider : "unknown",
          database: typeof payload.database === "string" ? payload.database : null,
          allowlist_count: allowlistedRelations.length,
          connected_at: typeof payload.connected_at === "string" ? payload.connected_at : null,
          updated_at: entry.updated_at
        };
      })
    });
  });

  app.get("/admin/reports", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    const [contracts, runs] = await Promise.all([
      store.listAllReportContracts(),
      store.listAllReportRuns()
    ]);

    return reply.code(200).send({
      items: contracts.map((contract) => {
        const contractRuns = runs.filter((run) => run.contract_id === contract.id);
        const latestRun = contractRuns
          .slice()
          .sort(
            (left, right) =>
              Date.parse(right.finished_at ?? right.started_at) - Date.parse(left.finished_at ?? left.started_at)
          )[0] ?? null;
        return {
          id: contract.id,
          tenant_id: contract.tenant_id ?? "default",
          name: contract.name,
          audience: contract.audience,
          lifecycle_status: contract.lifecycle_status ?? "draft",
          run_count: contractRuns.length,
          latest_run_id: latestRun?.id ?? null,
          latest_run_status: latestRun?.status ?? null,
          latest_run_at: latestRun?.finished_at ?? latestRun?.started_at ?? null
        };
      })
    });
  });

  app.get("/admin/schedules", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }

    const profiles = await store.listAllScheduledReportProfiles();
    return reply.code(200).send({
      items: profiles.map((profile) => ({
        contract_id: profile.contract_id,
        profile_id: profile.id,
        tenant_id: profile.tenant_id ?? "default",
        report_title: profile.report_title,
        status: profile.status,
        frequency: profile.frequency,
        timezone: profile.timezone,
        local_run_time: `${String(profile.hour_local).padStart(2, "0")}:${String(profile.minute_local).padStart(2, "0")}`,
        schedule_cron: profile.schedule_cron,
        next_run_at: profile.status === "active" ? computeNextScheduledRunIso(profile.schedule_cron, profile.timezone) : null,
        question_count: profile.question_execution_plan.length,
        updated_at: profile.updated_at ?? profile.created_at ?? null
      }))
    });
  });

  app.get("/admin/billing", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    const accounts = await store.listCustomerAccounts();
    return reply.code(200).send({
      items: accounts.map((account) => ({
        tenant_id: account.tenant_id,
        name: account.name,
        plan_tier: account.plan_tier,
        billing_status: account.billing_status,
        renewal_date: account.renewal_date,
        entitlements: account.entitlements
      }))
    });
  });
}

async function requireAdminUser(store: MetadataStore, request: FastifyRequest): Promise<PlatformUserRecord | null> {
  const context = resolveRequestContext(request);
  const username = readHeaderValue(request.headers["x-ui-user"]);
  if (!username) {
    return null;
  }
  const user = await store.getPlatformUserByUsername(username, context);
  if (!user || !user.is_active || user.role !== "admin") {
    return null;
  }
  return user;
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

function computeNextScheduledRunIso(cron: string, timezone: string): string | null {
  try {
    return computeNextRunUtc(cron, timezone, new Date()).toISOString();
  } catch {
    return null;
  }
}

function computeNextRunUtc(cron: string, timezone: string, from: Date): Date {
  new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  const [minuteField, hourField, dayField, monthField, weekDayField] = cron.trim().split(/\s+/);
  const matchers = {
    minute: compileFieldMatcher(minuteField, 0, 59),
    hour: compileFieldMatcher(hourField, 0, 23),
    dayOfMonth: compileFieldMatcher(dayField, 1, 31),
    month: compileFieldMatcher(monthField, 1, 12),
    dayOfWeek: compileFieldMatcher(weekDayField, 0, 6)
  };
  const candidate = new Date(from.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  for (let step = 0; step < 60 * 24 * 366; step += 1) {
    const parts = getZonedParts(candidate, timezone);
    if (
      matchers.minute(parts.minute) &&
      matchers.hour(parts.hour) &&
      matchers.dayOfMonth(parts.dayOfMonth) &&
      matchers.month(parts.month) &&
      matchers.dayOfWeek(parts.dayOfWeek)
    ) {
      return new Date(candidate.getTime());
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error("Unable to compute next run within one year.");
}

function compileFieldMatcher(field: string, min: number, max: number): (value: number) => boolean {
  const values = new Set<number>();
  for (const segment of field.split(",")) {
    const trimmed = segment.trim();
    if (trimmed === "*") {
      for (let value = min; value <= max; value += 1) values.add(value);
      continue;
    }
    if (trimmed.startsWith("*/")) {
      const step = Number.parseInt(trimmed.slice(2), 10);
      if (!Number.isFinite(step) || step <= 0) throw new Error(`Invalid cron segment: ${trimmed}`);
      for (let value = min; value <= max; value += step) values.add(value);
      continue;
    }
    if (trimmed.includes("-")) {
      const [startRaw, endRaw] = trimmed.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        throw new Error(`Invalid cron segment: ${trimmed}`);
      }
      for (let value = start; value <= end; value += 1) {
        if (value >= min && value <= max) values.add(value);
      }
      continue;
    }
    const exact = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(exact) || exact < min || exact > max) {
      throw new Error(`Invalid cron segment: ${trimmed}`);
    }
    values.add(exact);
  }
  return (value: number) => values.has(value);
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((entry) => entry.type === type);
    if (!part) throw new Error(`Missing datetime part: ${type}`);
    return part.value;
  };
  const weekDayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    minute: Number.parseInt(get("minute"), 10),
    hour: Number.parseInt(get("hour"), 10),
    dayOfMonth: Number.parseInt(get("day"), 10),
    month: Number.parseInt(get("month"), 10),
    dayOfWeek: weekDayMap[get("weekday")]
  };
}
