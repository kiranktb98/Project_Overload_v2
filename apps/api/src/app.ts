import Fastify from "fastify";
import type { FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { createDataPlaneFromEnv, type DataPlane } from "@project-overload/dataplane";
import {
  createAnalystClientFromEnv,
  createBusinessCaseClientFromEnv,
  createForecastAnalystClientFromEnv,
  createPlannerClientFromEnv,
  createQueryStrategistClientFromEnv,
  createReportClarificationClientFromEnv,
  createReportComposerClientFromEnv,
  type AnalystClient,
  type BusinessCaseClient,
  type PlannerClient,
  type QueryStrategistClient,
  type ReportClarificationClient,
  type ReportComposerClient
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
import { UserConnectionRegistry, userContextStorage } from "./dataplane/user-connection-registry";
import { validateApiAuth } from "./security/request-context";

export type ApiDependencies = {
  store: MetadataStore;
  data_plane: DataPlane;
  analyst_client: AnalystClient;
  forecast_client: AnalystClient;
  business_case_client: BusinessCaseClient;
  query_strategist: QueryStrategistClient;
  report_qa_client: ReportClarificationClient;
  report_composer: ReportComposerClient;
  planner_client: PlannerClient;
  connection_manager: RuntimeConnectionManager;
  connection_registry: UserConnectionRegistry;
};

function parseTimeoutMs(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

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
  const registryOptions = {
    fallback_row_provider: localRowProviderRuntime.row_provider,
    fallback_source: localRowProviderRuntime.source as "synthetic" | "postgres" | undefined,
    default_timeout_ms: parseTimeoutMs(process.env.DEFAULT_QUERY_TIMEOUT_MS, 900_000, 1_000, 3_600_000),
    default_limit: Number.parseInt(process.env.DEFAULT_QUERY_ROW_LIMIT ?? "200", 10),
    state_store: store
  };
  const connectionRegistry =
    options.connection_registry ??
    new UserConnectionRegistry(registryOptions);
  await connectionRegistry.initFromEnv();

  // Legacy single-manager for tests that inject connection_manager directly
  const connectionManager =
    options.connection_manager ??
    connectionRegistry.getOrCreate("default");
  void connectionManager;

  const dataPlane =
    options.data_plane ??
    createDataPlaneFromEnv({
      local_stub_options: {
        row_provider: (sql) => connectionRegistry.rowProvider(sql)
      }
    });
  const analystClient = options.analyst_client ?? createAnalystClientFromEnv();
  const forecastClient = options.forecast_client ?? createForecastAnalystClientFromEnv();
  const businessCaseClient = options.business_case_client ?? createBusinessCaseClientFromEnv();
  const queryStrategist = options.query_strategist ?? createQueryStrategistClientFromEnv();
  const reportQaClient = options.report_qa_client ?? createReportClarificationClientFromEnv();
  const reportComposer = options.report_composer ?? createReportComposerClientFromEnv();
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

  // Thread user identity into AsyncLocalStorage for per-user connection resolution
  app.addHook("preHandler", async (request: FastifyRequest) => {
    const uiUser = (request.headers["x-ui-user"] as string | undefined)?.trim();
    if (uiUser) {
      userContextStorage.enterWith({ user_id: uiUser });
    }
  });

  app.get("/health", async () => ({ status: "ok", service: "api" }));

  registerSemanticRoutes(app, store);
  registerContractRoutes(
    app,
    store,
    dataPlane,
    analystClient,
    forecastClient,
    businessCaseClient,
    queryStrategist,
    reportQaClient,
    reportComposer,
    plannerClient,
    connectionRegistry
  );
  registerConnectionRoutes(app, connectionRegistry);
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
    await connectionRegistry.closeAll();
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
