import { analyzeBatch as analyzeBatchStub } from "@project-overload/evidence";
import {
  AnalystInputSchema,
  BatchAnalysisSchema,
  PlannerExplorationSchema,
  PlannerOutputSchema,
  QueryStrategyOutputSchema,
  type AnalystInput,
  type BatchAnalysis,
  type PlannerExploration,
  type PlannerInput,
  type PlannerOutput,
  type SqlDialect,
  type QueryStrategyInput,
  type QueryStrategyOutput
} from "@project-overload/shared";

export type LlmProvider = "stub" | "openai" | "openrouter";

export type TokenUsageEvent = {
  agent: string;
  provider: Exclude<LlmProvider, "stub">;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  at: string;
};

export interface AnalystClient {
  provider: LlmProvider;
  analyzeBatch(input: AnalystInput): Promise<BatchAnalysis>;
  drainUsageEvents?(): TokenUsageEvent[];
}

export interface QueryStrategistClient {
  provider: LlmProvider;
  planQueries(input: QueryStrategyInput): Promise<QueryStrategyOutput>;
  compileSql?(
    input: {
      sql: string;
      dialect: SqlDialect;
      allowed_relations: string[];
      allowed_schemas: string[];
      catalog_summary?: string;
      question?: string;
    }
  ): Promise<{ sql: string; rationale: string }>;
  drainUsageEvents?(): TokenUsageEvent[];
}

export type ReportComposerInput = {
  title: string;
  audience: string;
  insight_mode: "business" | "data";
  metric_definitions?: Array<{
    metric_key: string;
    display_name: string;
    definition: string;
    source_type?: "column" | "derived";
    source_columns?: string[];
  }>;
  analyses: Array<{
    question: string;
    highlights: string[];
    risks: string[];
    recommendations: string[];
    data_summary: string;
  }>;
  catalog_summary: string;
};

export interface ReportComposerClient {
  provider: LlmProvider;
  composeReport(input: ReportComposerInput): Promise<string>;
  drainUsageEvents?(): TokenUsageEvent[];
}

export interface PlannerClient {
  provider: LlmProvider;
  explore(input: PlannerInput): Promise<PlannerExploration>;
  plan(input: PlannerInput & { exploration_results: string }): Promise<PlannerOutput>;
  drainUsageEvents?(): TokenUsageEvent[];
}

export type Fetcher = typeof fetch;

export type CreateAnalystClientOptions = {
  provider: LlmProvider;
  openaiApiKey?: string;
  openrouterApiKey?: string;
  openrouterBaseUrl?: string;
  openrouterAppName?: string;
  openrouterAppUrl?: string;
  openaiModel?: string;
  openrouterModel?: string;
  timeoutMs?: number;
  fallbackToStub?: boolean;
  fetcher?: Fetcher;
};

type ProviderRequest = {
  endpoint: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
};

type UsageEventBuffer = {
  push(event: TokenUsageEvent): void;
  drain(): TokenUsageEvent[];
};

const DEFAULT_TIMEOUT_MS = 900_000;
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// ---------------------------------------------------------------------------
// Analyst Client
// ---------------------------------------------------------------------------

export function createStubAnalystClient(): AnalystClient {
  return {
    provider: "stub",
    async analyzeBatch(input: AnalystInput): Promise<BatchAnalysis> {
      return analyzeBatchStub(input);
    },
    drainUsageEvents() {
      return [];
    }
  };
}

export function createAnalystClientFromEnv(overrides: Partial<CreateAnalystClientOptions> = {}): AnalystClient {
  const provider = parseProvider(overrides.provider ?? process.env.LLM_PROVIDER);

  if (provider === "stub") {
    return createStubAnalystClient();
  }

  const timeoutFromEnv = Number.parseInt(
    process.env.LLM_TIMEOUT_MS ?? process.env.DEFAULT_QUERY_TIMEOUT_MS ?? "",
    10
  );

  const options: CreateAnalystClientOptions = {
    provider,
    openaiApiKey: overrides.openaiApiKey ?? process.env.OPENAI_API_KEY,
    openrouterApiKey: overrides.openrouterApiKey ?? process.env.OPENROUTER_API_KEY,
    openrouterBaseUrl: overrides.openrouterBaseUrl ?? process.env.OPENROUTER_BASE_URL,
    openrouterAppName: overrides.openrouterAppName ?? process.env.OPENROUTER_APP_NAME,
    openrouterAppUrl: overrides.openrouterAppUrl ?? process.env.OPENROUTER_APP_URL,
    openaiModel: overrides.openaiModel ?? process.env.OPENAI_MODEL,
    openrouterModel: overrides.openrouterModel ?? process.env.MODEL_GPT,
    timeoutMs: overrides.timeoutMs ?? (Number.isNaN(timeoutFromEnv) ? undefined : timeoutFromEnv),
    fallbackToStub: overrides.fallbackToStub,
    fetcher: overrides.fetcher
  };

  return createAnalystClient(options);
}

export function createAnalystClient(options: CreateAnalystClientOptions): AnalystClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fallbackToStub = options.fallbackToStub ?? true;
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubAnalystClient();
  const usageBuffer = createUsageEventBuffer();

  if (options.provider === "openai") {
    if (!options.openaiApiKey) {
      return stub;
    }

    const remote = createRemoteAnalystClient({
      provider: "openai",
      timeoutMs,
      fetcher,
      requestFactory: (input) => buildOpenAiAnalystRequest(input, options),
      usageBuffer
    });

    return fallbackToStub ? wrapAnalystWithFallback(remote, stub) : remote;
  }

  if (options.provider === "openrouter") {
    if (!options.openrouterApiKey) {
      return stub;
    }

    const remote = createRemoteAnalystClient({
      provider: "openrouter",
      timeoutMs,
      fetcher,
      requestFactory: (input) => buildOpenRouterAnalystRequest(input, options),
      usageBuffer
    });

    return fallbackToStub ? wrapAnalystWithFallback(remote, stub) : remote;
  }

  return stub;
}

type RemoteAnalystClientOptions = {
  provider: Exclude<LlmProvider, "stub">;
  timeoutMs: number;
  fetcher: Fetcher;
  requestFactory: (input: AnalystInput) => ProviderRequest;
  usageBuffer: UsageEventBuffer;
};

function createRemoteAnalystClient(options: RemoteAnalystClientOptions): AnalystClient {
  return {
    provider: options.provider,
    async analyzeBatch(input: AnalystInput): Promise<BatchAnalysis> {
      const validatedInput = AnalystInputSchema.parse(input);
      const request = options.requestFactory(validatedInput);

      const response = await fetchWithTimeout(
        options.fetcher,
        request.endpoint,
        {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.payload)
        },
        options.timeoutMs
      );

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`${options.provider} request failed (${response.status}): ${responseText}`);
      }

      const payload = (await response.json()) as unknown;
      recordUsageEventFromPayload(
        options.usageBuffer,
        payload,
        options.provider,
        pickModelFromRequest(request),
        "batch_analyst"
      );
      return parseBatchAnalysisPayload(payload);
    },
    drainUsageEvents() {
      return options.usageBuffer.drain();
    }
  };
}

function wrapAnalystWithFallback(remote: AnalystClient, fallback: AnalystClient): AnalystClient {
  return {
    provider: remote.provider,
    async analyzeBatch(input: AnalystInput): Promise<BatchAnalysis> {
      try {
        return await remote.analyzeBatch(input);
      } catch {
        return fallback.analyzeBatch(input);
      }
    },
    drainUsageEvents() {
      const remoteEvents = remote.drainUsageEvents ? remote.drainUsageEvents() : [];
      const fallbackEvents = fallback.drainUsageEvents ? fallback.drainUsageEvents() : [];
      return [...remoteEvents, ...fallbackEvents];
    }
  };
}

function parseBatchAnalysisPayload(payload: unknown): BatchAnalysis {
  const direct = BatchAnalysisSchema.safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  const textPayload = extractTextPayload(payload);
  if (!textPayload) {
    throw new Error("Unable to parse provider response as BatchAnalysis JSON.");
  }

  const parsedTextPayload = parseJsonObjectFromText(textPayload);
  return BatchAnalysisSchema.parse(parsedTextPayload);
}

// ---------------------------------------------------------------------------
// Query Strategist Client
// ---------------------------------------------------------------------------

export function createStubQueryStrategistClient(): QueryStrategistClient {
  return {
    provider: "stub",
    async planQueries(input: QueryStrategyInput): Promise<QueryStrategyOutput> {
      const tables = input.allowed_relations.length > 0
        ? input.allowed_relations
        : ["public.unknown_table"];
      const mainTable = tables[0];

      if (input.insight_mode === "data") {
        return {
          queries: [
            {
              question: "What is the data quality and completeness?",
              sql: `SELECT * FROM ${mainTable} LIMIT 200`,
              purpose: "Assess data completeness, null rates, and value distributions"
            }
          ]
        };
      }

      const queries: QueryStrategyOutput["queries"] = [];

      if (input.metric_ids.length > 0 && input.dimension_ids.length > 0) {
        // Case 1 demo: group metric + dimension queries for combined analysis
        queries.push({
          question: `What are the key trends for ${input.metric_ids.join(", ")}?`,
          sql: `SELECT * FROM ${mainTable} LIMIT 200`,
          purpose: "Identify primary metric trends and patterns",
          group_id: "overview"
        });
        queries.push({
          question: `How do metrics break down by ${input.dimension_ids.join(", ")}?`,
          sql: `SELECT * FROM ${mainTable} LIMIT 200`,
          purpose: "Analyze dimensional breakdown",
          group_id: "overview"
        });
      } else {
        // Case 2: standalone queries
        if (input.metric_ids.length > 0) {
          queries.push({
            question: `What are the key trends for ${input.metric_ids.join(", ")}?`,
            sql: `SELECT * FROM ${mainTable} LIMIT 200`,
            purpose: "Identify primary metric trends and patterns"
          });
        }

        if (input.dimension_ids.length > 0) {
          queries.push({
            question: `How do metrics break down by ${input.dimension_ids.join(", ")}?`,
            sql: `SELECT * FROM ${mainTable} LIMIT 200`,
            purpose: "Analyze dimensional breakdown"
          });
        }
      }

      if (queries.length === 0) {
        queries.push({
          question: "What are the key business insights from this data?",
          sql: `SELECT * FROM ${mainTable} LIMIT 200`,
          purpose: "General business overview"
        });
      }

      return { queries };
    },
    async compileSql(input): Promise<{ sql: string; rationale: string }> {
      return {
        sql: normalizeSingleSelectStatement(input.sql),
        rationale: `Stub compiler passthrough for ${input.dialect} dialect.`
      };
    },
    drainUsageEvents() {
      return [];
    }
  };
}

export function createQueryStrategistClientFromEnv(
  overrides: Partial<CreateAnalystClientOptions> = {}
): QueryStrategistClient {
  const provider = parseProvider(overrides.provider ?? process.env.LLM_PROVIDER);
  if (provider === "stub") {
    return createStubQueryStrategistClient();
  }

  const options = resolveClientOptions({
    ...overrides,
    openrouterModel:
      overrides.openrouterModel ??
      process.env.QUERY_STRATEGIST_MODEL ??
      process.env.DATA_PREPARATION_MODEL ??
      "anthropic/claude-sonnet-4.6"
  });
  return createQueryStrategistClient(options);
}

export function createQueryStrategistClient(options: CreateAnalystClientOptions): QueryStrategistClient {
  const timeoutMs = (options.timeoutMs ?? DEFAULT_TIMEOUT_MS) * 2; // double timeout for query planning
  const fallbackToStub = options.fallbackToStub ?? true;
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubQueryStrategistClient();
  const usageBuffer = createUsageEventBuffer();

  const buildRequest = (input: QueryStrategyInput): ProviderRequest => {
    return buildOpenRouterGenericRequest(
      queryStrategistSystemPrompt(input),
      queryStrategistUserPrompt(input),
      options
    );
  };

  if (options.provider !== "openrouter" || !options.openrouterApiKey) {
    return stub;
  }

  const remote: QueryStrategistClient = {
    provider: "openrouter",
    async planQueries(input: QueryStrategyInput): Promise<QueryStrategyOutput> {
      const request = buildRequest(input);
      const response = await fetchWithTimeout(fetcher, request.endpoint, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.payload)
      }, timeoutMs);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Query strategist failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      recordUsageEventFromPayload(
        usageBuffer,
        payload,
        "openrouter",
        pickModelFromRequest(request),
        "query_strategist"
      );
      const text = extractTextPayload(payload);
      if (!text) throw new Error("Unable to parse query strategist response.");
      const parsed = parseJsonObjectFromText(text);
      return QueryStrategyOutputSchema.parse(parsed);
    },
    async compileSql(input): Promise<{ sql: string; rationale: string }> {
      const request = buildOpenRouterGenericRequest(
        dialectCompilerSystemPrompt(input.dialect),
        dialectCompilerUserPrompt(input),
        options
      );

      const response = await fetchWithTimeout(fetcher, request.endpoint, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.payload)
      }, timeoutMs);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Dialect compiler failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      recordUsageEventFromPayload(
        usageBuffer,
        payload,
        "openrouter",
        pickModelFromRequest(request),
        "sql_dialect_compiler"
      );
      const text = extractTextPayload(payload);
      if (!text) {
        throw new Error("Unable to parse dialect compiler response.");
      }

      try {
        const parsed = parseJsonObjectFromText(text);
        return parseDialectCompileOutput(parsed);
      } catch {
        const sql = normalizeSingleSelectStatement(text);
        if (!/^\s*(select|with)\b/i.test(sql)) {
          throw new Error("Dialect compiler response did not contain valid SQL.");
        }
        return {
          sql,
          rationale: `Compiled SQL for ${input.dialect} dialect.`
        };
      }
    },
    drainUsageEvents() {
      return usageBuffer.drain();
    }
  };

  return fallbackToStub ? wrapStrategistWithFallback(remote, stub) : remote;
}

function wrapStrategistWithFallback(
  remote: QueryStrategistClient,
  fallback: QueryStrategistClient
): QueryStrategistClient {
  return {
    provider: remote.provider,
    async planQueries(input: QueryStrategyInput): Promise<QueryStrategyOutput> {
      try {
        return await remote.planQueries(input);
      } catch {
        return fallback.planQueries(input);
      }
    },
    async compileSql(input): Promise<{ sql: string; rationale: string }> {
      if (!remote.compileSql) {
        return fallback.compileSql
          ? fallback.compileSql(input)
          : {
              sql: normalizeSingleSelectStatement(input.sql),
              rationale: "Dialect compiler unavailable; using original SQL."
            };
      }

      try {
        return await remote.compileSql(input);
      } catch {
        if (fallback.compileSql) {
          return fallback.compileSql(input);
        }

        return {
          sql: normalizeSingleSelectStatement(input.sql),
          rationale: "Dialect compiler fallback passthrough."
        };
      }
    },
    drainUsageEvents() {
      const remoteEvents = remote.drainUsageEvents ? remote.drainUsageEvents() : [];
      const fallbackEvents = fallback.drainUsageEvents ? fallback.drainUsageEvents() : [];
      return [...remoteEvents, ...fallbackEvents];
    }
  };
}

function queryStrategistSystemPrompt(input: QueryStrategyInput): string {
  const dialect = normalizeSqlDialect(input.sql_dialect);
  const dialectUpper = dialect.toUpperCase();
  const mode = input.insight_mode === "data"
    ? "DATA QUALITY mode: Write aggregated queries to assess completeness, null rates, duplicate rates, value distributions, outliers, and anomalies. Use COUNT, COUNT(DISTINCT), AVG. GROUP BY dimension columns. LIMIT 50."
    : "BUSINESS INSIGHTS mode: Every query MUST return pre-aggregated summary data via GROUP BY. Return compact summary tables of ≤50 rows — never raw record dumps. Think: monthly totals, top-N by metric, breakdown by city/product/channel. Use SUM, COUNT, AVG with GROUP BY. LIMIT 50 always.";

  return [
    `You are a SQL query strategist for a ${dialectUpper} database.`,
    "Your job is to generate one focused SQL query PER distinct business question that the user's report needs to answer.",
    "",
    `MODE: ${mode}`,
    "",
    "═══ CRITICAL: TABLE AND COLUMN NAMES ═══",
    "The DATABASE CATALOG section in the user message lists EVERY table and column available to you.",
    "You MUST use ONLY the exact table names and column names from that catalog.",
    "- Always use fully-qualified table names: schema.table (e.g., public.orders, NOT just orders).",
    "- When using aliases, the column references must still match the catalog column names exactly.",
    "- NEVER invent, guess, or assume column names that are not listed in the catalog.",
    "- If the catalog shows 'order_date', do NOT write 'date', 'created_at', 'purchase_date', etc.",
    "- If the catalog shows 'amount', do NOT write 'total', 'revenue', 'price', etc.",
    "- If a column you want doesn't exist in the catalog, DO NOT use it. Adapt your query to use only available columns.",
    "",
    "EXAMPLE — Given catalog:",
    "  TABLE: public.orders",
    "    - id : integer",
    "    - customer_id : integer",
    "    - order_date : date",
    "    - total_amount : numeric",
    "    - status : text",
    "",
    "CORRECT: SELECT DATE_TRUNC('month', order_date) AS month, COUNT(*) AS order_count, SUM(total_amount) AS revenue FROM public.orders WHERE status = 'completed' GROUP BY 1 ORDER BY 1 LIMIT 50",
    "WRONG:   SELECT * FROM orders WHERE created_at > '2024-01-01' LIMIT 200",
    "  (wrong because: 'created_at' doesn't exist, 'orders' not fully qualified, SELECT * returns raw rows)",
    "",
    "═══ QUERY RULES ═══",
    `- Each query MUST be exactly ONE valid ${dialectUpper} SELECT statement.`,
    "- NO semicolons, NO multiple statements.",
    "- Every query MUST use GROUP BY and LIMIT ≤50. Raw row dumps (SELECT * or unfiltered LIMIT 1000+) are forbidden.",
    "- Use SUM(), COUNT(), AVG(), percentile or window functions — always aggregate, never dump raw records.",
    "- Each query answers exactly ONE distinct business question.",
    "- Use JOINs across tables when it adds insight — but only join on columns that actually exist.",
    "- When the goal mentions time comparisons (YoY, MoM, QoQ), use date/timestamp columns from the catalog.",
    "- If the goal says 'last N months vs previous N months', include date window filters and GROUP BY month.",
    "",
    "QUESTION ISOLATION (CRITICAL):",
    "- One query per question. NEVER bundle two business questions into one SQL statement.",
    "- NEVER use group_id. Every query in the output must be independent with no group_id field.",
    "- If the PLANNER ANALYSIS has N recommended approaches, generate exactly N queries.",
    "- Preserve question order based on user intent (Q1 first, Q2 second, etc.).",
    "",
    "Return strictly valid JSON:",
    '{"queries": [{"question": "...", "sql": "SELECT col, SUM(val) FROM schema.table GROUP BY col ORDER BY 2 DESC LIMIT 50", "purpose": "..."}]}',
    "No markdown, no extra keys, no group_id field."
  ].join("\n");
}

function queryStrategistUserPrompt(input: QueryStrategyInput): string {
  const parts: string[] = [];
  const dialect = normalizeSqlDialect(input.sql_dialect);

  // Catalog FIRST — most important context
  parts.push("═══ DATABASE CATALOG (use ONLY these tables and columns) ═══");
  parts.push(input.catalog_summary);
  parts.push("");

  // Allowed tables as a reference checklist
  if (input.allowed_relations.length > 0) {
    parts.push(`Allowed tables (fully qualified): ${input.allowed_relations.join(", ")}`);
    parts.push("");
  }

  // Planner context — data-informed discoveries from exploratory queries
  if (input.planner_context) {
    parts.push("═══ PLANNER ANALYSIS (from exploratory data queries) ═══");
    parts.push("The planner has already explored the data and discovered the following.");
    parts.push("Use these discoveries to write more accurate queries with correct column values and filters.");
    parts.push(input.planner_context);
    parts.push("");
  }

  // Report context
  parts.push("═══ REPORT CONTEXT ═══");
  parts.push(`Goal: ${input.report_goal}`);
  parts.push(`Audience: ${input.audience}`);
  parts.push(`Insight mode: ${input.insight_mode}`);
  parts.push(`SQL dialect: ${dialect}`);

  if (input.metric_ids.length > 0) {
    parts.push(`Key metrics to focus on: ${input.metric_ids.join(", ")}`);
  }
  if (input.dimension_ids.length > 0) {
    parts.push(`Dimensions to break down by: ${input.dimension_ids.join(", ")}`);
  }

  parts.push("");
  parts.push("Generate one aggregated GROUP BY query per distinct business question (max 4 queries total).");
  parts.push("Each query MUST use GROUP BY and LIMIT ≤50. Never return raw row dumps. Return JSON only.");

  return parts.join("\n");
}

function dialectCompilerSystemPrompt(dialect: SqlDialect): string {
  return [
    `You are a strict SQL dialect compiler for ${dialect.toUpperCase()}.`,
    "Convert or repair the source SQL to the target dialect while preserving business intent.",
    "",
    "Hard constraints:",
    "- Exactly one SELECT statement (or WITH ... SELECT).",
    "- No semicolons.",
    "- No comments.",
    "- No write operations.",
    "- No DDL or COPY.",
    "- Use only provided allowlisted schemas/tables.",
    "",
    "Return strict JSON only:",
    '{"sql":"SELECT ...","rationale":"short compilation note"}'
  ].join("\n");
}

function dialectCompilerUserPrompt(input: {
  sql: string;
  dialect: SqlDialect;
  allowed_relations: string[];
  allowed_schemas: string[];
  catalog_summary?: string;
  question?: string;
}): string {
  return [
    `TARGET_DIALECT: ${normalizeSqlDialect(input.dialect)}`,
    input.question ? `QUESTION: ${input.question}` : "",
    `ALLOWED_RELATIONS: ${input.allowed_relations.join(", ") || "(none)"}`,
    `ALLOWED_SCHEMAS: ${input.allowed_schemas.join(", ") || "(none)"}`,
    "",
    "CATALOG_SUMMARY:",
    input.catalog_summary && input.catalog_summary.trim().length > 0
      ? input.catalog_summary
      : "(none)",
    "",
    "SOURCE_SQL:",
    input.sql
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Planner Client
// ---------------------------------------------------------------------------

export function createStubPlannerClient(): PlannerClient {
  return {
    provider: "stub",
    async explore(input: PlannerInput): Promise<PlannerExploration> {
      const firstTable = input.allowed_relations[0] ?? "public.unknown_table";
      return {
        queries: [
          { purpose: "Sample rows", sql: `SELECT * FROM ${firstTable} LIMIT 5`, query_type: "sample" as const },
          { purpose: "Row count", sql: `SELECT COUNT(*) AS cnt FROM ${firstTable} LIMIT 1`, query_type: "count" as const }
        ]
      };
    },
    async plan(input: PlannerInput & { exploration_results: string }): Promise<PlannerOutput> {
      return {
        data_discoveries: [
          { table: input.allowed_relations[0] ?? "unknown", column: "*", finding: "Stub planner: no real data explored." }
        ],
        recommended_approaches: [
          { question: input.user_goal, approach: "Direct query against available tables", key_columns: [], relevant_tables: input.allowed_relations }
        ],
        data_warnings: [],
        plan_summary: `Planning for: ${input.user_goal}. Using tables: ${input.allowed_relations.join(", ")}.`
      };
    },
    drainUsageEvents() {
      return [];
    }
  };
}

export function createPlannerClientFromEnv(
  overrides: Partial<CreateAnalystClientOptions> = {}
): PlannerClient {
  const provider = parseProvider(overrides.provider ?? process.env.LLM_PROVIDER);
  if (provider === "stub") {
    return createStubPlannerClient();
  }

  const options = resolveClientOptions({
    ...overrides,
    openrouterModel:
      overrides.openrouterModel ??
      process.env.DATA_PREPARATION_MODEL ??
      process.env.QUERY_STRATEGIST_MODEL ??
      "anthropic/claude-sonnet-4.6"
  });
  return createPlannerClient(options);
}

export function createPlannerClient(options: CreateAnalystClientOptions): PlannerClient {
  const timeoutMs = (options.timeoutMs ?? DEFAULT_TIMEOUT_MS) * 2; // double timeout for planning
  const fallbackToStub = options.fallbackToStub ?? true;
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubPlannerClient();
  const usageBuffer = createUsageEventBuffer();

  if (options.provider !== "openrouter" || !options.openrouterApiKey) {
    return stub;
  }

  const remote: PlannerClient = {
    provider: "openrouter",
    async explore(input: PlannerInput): Promise<PlannerExploration> {
      const request = buildOpenRouterGenericRequest(
        plannerExploreSystemPrompt(),
        plannerExploreUserPrompt(input),
        options
      );

      const response = await fetchWithTimeout(fetcher, request.endpoint, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.payload)
      }, timeoutMs);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Planner explore failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      recordUsageEventFromPayload(
        usageBuffer,
        payload,
        "openrouter",
        pickModelFromRequest(request),
        "planner_explore"
      );
      const text = extractTextPayload(payload);
      if (!text) throw new Error("Unable to parse planner explore response.");
      const parsed = parseJsonObjectFromText(text);
      return PlannerExplorationSchema.parse(parsed);
    },

    async plan(input: PlannerInput & { exploration_results: string }): Promise<PlannerOutput> {
      const request = buildOpenRouterGenericRequest(
        plannerPlanSystemPrompt(),
        plannerPlanUserPrompt(input),
        options
      );

      const response = await fetchWithTimeout(fetcher, request.endpoint, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.payload)
      }, timeoutMs);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Planner plan failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      recordUsageEventFromPayload(
        usageBuffer,
        payload,
        "openrouter",
        pickModelFromRequest(request),
        "planner_plan"
      );
      const text = extractTextPayload(payload);
      if (!text) throw new Error("Unable to parse planner plan response.");
      const parsed = parseJsonObjectFromText(text);
      return PlannerOutputSchema.parse(parsed);
    },
    drainUsageEvents() {
      return usageBuffer.drain();
    }
  };

  return fallbackToStub ? wrapPlannerWithFallback(remote, stub) : remote;
}

function wrapPlannerWithFallback(
  remote: PlannerClient,
  fallback: PlannerClient
): PlannerClient {
  return {
    provider: remote.provider,
    async explore(input: PlannerInput): Promise<PlannerExploration> {
      try {
        return await remote.explore(input);
      } catch {
        return fallback.explore(input);
      }
    },
    async plan(input: PlannerInput & { exploration_results: string }): Promise<PlannerOutput> {
      try {
        return await remote.plan(input);
      } catch {
        return fallback.plan(input);
      }
    },
    drainUsageEvents() {
      const remoteEvents = remote.drainUsageEvents ? remote.drainUsageEvents() : [];
      const fallbackEvents = fallback.drainUsageEvents ? fallback.drainUsageEvents() : [];
      return [...remoteEvents, ...fallbackEvents];
    }
  };
}

function plannerExploreSystemPrompt(): string {
  return [
    "You are a data exploration planner for a PostgreSQL database.",
    "Given a user's analysis goal and the database catalog, generate 3-6 lightweight",
    "exploratory SQL queries to understand the data BEFORE writing the main analysis queries.",
    "",
    "QUERY TYPES (use a mix relevant to the goal):",
    '- "distinct": SELECT DISTINCT column_name FROM schema.table LIMIT 50',
    "  Use for: categorical columns, status fields, types, categories",
    '- "count": SELECT COUNT(*), COUNT(DISTINCT col) FROM schema.table LIMIT 1',
    "  Use for: table sizes, cardinality",
    '- "sample": SELECT * FROM schema.table LIMIT 5',
    "  Use for: understanding row shape, data format, example values",
    '- "range": SELECT MIN(col), MAX(col) FROM schema.table LIMIT 1',
    "  Use for: date ranges, numeric ranges, time boundaries",
    '- "schema": SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=\'...\' AND table_name=\'...\' LIMIT 50',
    "  Use for: confirming column types when catalog seems ambiguous",
    "",
    "RULES:",
    "- Use ONLY tables and columns from the provided catalog.",
    "- Always use fully-qualified table names: schema.table.",
    "- Every query MUST be a single SELECT with LIMIT.",
    "- Keep queries fast: no JOINs, no subqueries, no complex aggregations.",
    "- Focus on columns relevant to the user's goal.",
    "- Prioritize: status/type columns (DISTINCT), date columns (range), key measures (count/range).",
    "",
    "Return strictly valid JSON:",
    '{"queries": [{"purpose": "...", "sql": "SELECT ...", "query_type": "distinct|count|sample|range|schema"}]}',
    "No markdown, no extra keys."
  ].join("\n");
}

function plannerExploreUserPrompt(input: PlannerInput): string {
  const parts: string[] = [];

  parts.push("═══ DATABASE CATALOG ═══");
  parts.push(input.catalog_summary);
  parts.push("");

  if (input.allowed_relations.length > 0) {
    parts.push(`Allowed tables: ${input.allowed_relations.join(", ")}`);
    parts.push("");
  }

  parts.push(`USER GOAL: ${input.user_goal}`);
  parts.push(`AUDIENCE: ${input.audience}`);
  parts.push(`MODE: ${input.insight_mode}`);
  parts.push("");
  parts.push("Generate 3-6 fast exploratory queries to understand this data. Return JSON only.");

  return parts.join("\n");
}

function plannerPlanSystemPrompt(): string {
  return [
    "You are a data analysis planner. You have just explored a database and received results",
    "from exploratory queries. Based on what you learned, produce a concrete analysis plan.",
    "",
    "Your output must include:",
    "1. data_discoveries: What you learned about the data — distinct values found, date ranges,",
    "   row counts, null rates, cardinalities. Each discovery references a specific table.column.",
    "2. recommended_approaches: 2-4 specific analysis questions with SQL approaches.",
    "   Include concrete column names, JOIN conditions, filter values based on what you discovered.",
    "3. data_warnings: Any issues found — high null rates, empty tables, unexpected values, low cardinality.",
    "4. plan_summary: A 2-3 sentence human-readable summary of the plan for the user.",
    "",
    "CRITICAL RULES:",
    "- Base your plan ENTIRELY on what the exploratory data shows — not assumptions.",
    "- Reference actual column values you discovered (e.g., \"status has values: shipped, cancelled, refunded\").",
    "- Your recommended approaches should include specific column names, JOIN conditions, and filter values.",
    "- The Query Strategist will use your output to write the final SQL, so be precise and concrete.",
    "- If an exploratory query failed with an error, note it in data_warnings and avoid that table/column.",
    "",
    "Return strictly valid JSON:",
    '{"data_discoveries": [{"table":"...","column":"...","finding":"..."}], "recommended_approaches": [{"question":"...","approach":"...","key_columns":["..."],"relevant_tables":["..."]}], "data_warnings": ["..."], "plan_summary": "..."}',
    "No markdown, no extra keys."
  ].join("\n");
}

function plannerPlanUserPrompt(input: PlannerInput & { exploration_results: string }): string {
  const parts: string[] = [];

  parts.push("═══ DATABASE CATALOG ═══");
  parts.push(input.catalog_summary);
  parts.push("");

  parts.push(`USER GOAL: ${input.user_goal}`);
  parts.push(`AUDIENCE: ${input.audience}`);
  parts.push(`MODE: ${input.insight_mode}`);
  parts.push("");

  parts.push("═══ EXPLORATION RESULTS ═══");
  parts.push(input.exploration_results);
  parts.push("");

  parts.push("Based on what you now know about the data, create a concrete analysis plan. Return JSON only.");

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Report Composer Client
// ---------------------------------------------------------------------------

export function createStubReportComposerClient(): ReportComposerClient {
  return {
    provider: "stub",
    async composeReport(input: ReportComposerInput): Promise<string> {
      return renderStubReportHtml(input);
    },
    drainUsageEvents() {
      return [];
    }
  };
}

export function createReportComposerClientFromEnv(
  overrides: Partial<CreateAnalystClientOptions> = {}
): ReportComposerClient {
  const provider = parseProvider(overrides.provider ?? process.env.LLM_PROVIDER);
  if (provider === "stub") {
    return createStubReportComposerClient();
  }

  const options = resolveClientOptions(overrides);
  return createReportComposerClient(options);
}

export function createReportComposerClient(options: CreateAnalystClientOptions): ReportComposerClient {
  const timeoutMs = (options.timeoutMs ?? DEFAULT_TIMEOUT_MS) * 2;
  const fallbackToStub = options.fallbackToStub ?? true;
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubReportComposerClient();
  const usageBuffer = createUsageEventBuffer();

  if (options.provider !== "openrouter" || !options.openrouterApiKey) {
    return stub;
  }

  const remote: ReportComposerClient = {
    provider: "openrouter",
    async composeReport(input: ReportComposerInput): Promise<string> {
      const request = buildOpenRouterGenericRequest(
        reportComposerSystemPrompt(input),
        reportComposerUserPrompt(input),
        options
      );

      const response = await fetchWithTimeout(fetcher, request.endpoint, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.payload)
      }, timeoutMs);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Report composer failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      recordUsageEventFromPayload(
        usageBuffer,
        payload,
        "openrouter",
        pickModelFromRequest(request),
        "report_composer"
      );
      const text = extractTextPayload(payload);
      if (!text) throw new Error("Unable to parse report composer response.");

      // The LLM returns HTML — extract it if wrapped in markdown code fences
      return extractHtmlFromResponse(text);
    },
    drainUsageEvents() {
      return usageBuffer.drain();
    }
  };

  return fallbackToStub ? wrapComposerWithFallback(remote, stub) : remote;
}

function wrapComposerWithFallback(
  remote: ReportComposerClient,
  fallback: ReportComposerClient
): ReportComposerClient {
  return {
    provider: remote.provider,
    async composeReport(input: ReportComposerInput): Promise<string> {
      try {
        return await remote.composeReport(input);
      } catch {
        return fallback.composeReport(input);
      }
    },
    drainUsageEvents() {
      const remoteEvents = remote.drainUsageEvents ? remote.drainUsageEvents() : [];
      const fallbackEvents = fallback.drainUsageEvents ? fallback.drainUsageEvents() : [];
      return [...remoteEvents, ...fallbackEvents];
    }
  };
}

function reportComposerSystemPrompt(input: ReportComposerInput): string {
  const modeGuidance = input.insight_mode === "data"
    ? "This is a DATA QUALITY report. Focus on data issues, completeness, anomalies, and recommendations for fixing them. Use tables showing null rates, distribution charts, and data quality scores."
    : "This is a BUSINESS INSIGHTS report. Focus on trends, opportunities, risks, and actionable recommendations. Use charts for trends, tables for breakdowns, and clear executive-friendly language.";

  return [
    "You are an expert report designer. Generate a complete, self-contained HTML document for a professional executive report.",
    "",
    modeGuidance,
    "",
    "DESIGN RULES:",
    "- Return a COMPLETE HTML document with <!doctype html>, <head> with embedded CSS, and <body>.",
    "- Use a clean, modern design with a professional color scheme.",
    "- Include inline SVG charts where data supports it (bar charts, simple line charts, pie charts).",
    "- Use HTML tables with good styling for data breakdowns.",
    "- Make it visually appealing — use cards, subtle borders, clean typography.",
    "- Each analysis section should have a clear heading, key finding callout, and supporting data.",
    "- Include a summary section at the top with the most important 2-3 takeaways.",
    "- End with a clear 'Recommended Actions' section.",
    "- Add a 'Metric Definitions' section when metric_definitions are provided.",
    "- Use the Sora or system font stack for clean rendering.",
    "- The report must be printable and look good as a PDF.",
    "- Do NOT mention confidence scores, confidence thresholds, or confidence percentages in customer-facing content.",
    "- Do NOT use any external dependencies (no CDN links, no JavaScript).",
    "- Return ONLY the HTML document, no markdown fences or explanations."
  ].join("\n");
}

function reportComposerUserPrompt(input: ReportComposerInput): string {
  const metricDefinitions = (input.metric_definitions ?? [])
    .map(
      (metric, index) =>
        `${index + 1}. ${metric.display_name} (${metric.metric_key}): ${metric.definition}` +
        ((metric.source_columns ?? []).length > 0
          ? ` [columns: ${(metric.source_columns ?? []).join(", ")}]`
          : "")
    )
    .join("\n");

  const sections = input.analyses.map((a, i) => [
    `--- Analysis ${i + 1}: ${a.question} ---`,
    `Key findings: ${a.highlights.join("; ") || "None"}`,
    `Risks: ${a.risks.join("; ") || "None"}`,
    `Recommendations: ${a.recommendations.join("; ") || "None"}`,
    `Data summary: ${a.data_summary}`
  ].join("\n")).join("\n\n");

  return [
    `Report title: ${input.title}`,
    `Audience: ${input.audience}`,
    `Report type: ${input.insight_mode === "data" ? "Data Quality Assessment" : "Business Insights Report"}`,
    "",
    "METRIC DEFINITIONS:",
    metricDefinitions.length > 0 ? metricDefinitions : "(none provided)",
    "",
    "ANALYSIS RESULTS:",
    sections,
    "",
    "Generate the complete HTML report document."
  ].join("\n");
}

function renderStubReportHtml(input: ReportComposerInput): string {
  const metricDefinitions = (input.metric_definitions ?? [])
    .map((metric) => {
      const sourceColumns = (metric.source_columns ?? []).length > 0
        ? `<span class="metric-source">source: ${(metric.source_columns ?? []).map((column) => escapeHtml(column)).join(", ")}</span>`
        : `<span class="metric-source">source: derived</span>`;
      return `<li><strong>${escapeHtml(metric.display_name)}</strong>: ${escapeHtml(metric.definition)} ${sourceColumns}</li>`;
    })
    .join("");

  const analysisHtml = input.analyses.map((a) => {
    const highlights = a.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("");
    const risks = a.risks.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    const recs = a.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    return `
    <section class="analysis-card">
      <h2>${escapeHtml(a.question)}</h2>
      ${highlights.length > 0 ? `<h3>Key Findings</h3><ul>${highlights}</ul>` : ""}
      ${risks.length > 0 ? `<h3>Risks</h3><ul>${risks}</ul>` : ""}
      ${recs.length > 0 ? `<h3>Recommendations</h3><ul>${recs}</ul>` : ""}
      <p class="data-note">${escapeHtml(a.data_summary)}</p>
    </section>`;
  }).join("\n");

  const typeLabel = input.insight_mode === "data" ? "Data Quality Assessment" : "Business Insights Report";

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(input.title)}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#1f2937;background:#f8fafc}
  .header{text-align:center;margin-bottom:32px;padding:24px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;border-radius:12px}
  .header h1{margin:0 0 4px;font-size:1.5rem}
  .header p{margin:0;opacity:0.85;font-size:0.9rem}
  .analysis-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:16px}
  .analysis-card h2{margin:0 0 12px;font-size:1.1rem;color:#0f172a}
  .analysis-card h3{margin:14px 0 6px;font-size:0.9rem;color:#475569}
  .analysis-card ul{padding-left:18px;margin:4px 0}
  .analysis-card li{margin-bottom:4px;font-size:0.88rem;line-height:1.5}
  .data-note{font-size:0.8rem;color:#64748b;margin-top:12px;padding:8px;background:#f1f5f9;border-radius:6px}
  .metric-definitions{background:#fff;border:1px solid #dbeafe;border-radius:10px;padding:18px;margin-bottom:16px}
  .metric-definitions h2{margin:0 0 10px;font-size:1rem;color:#1e3a8a}
  .metric-definitions li{margin-bottom:6px;line-height:1.45}
  .metric-source{color:#64748b;font-size:0.8rem}
</style></head><body>
  <div class="header">
    <h1>${escapeHtml(input.title)}</h1>
    <p>${escapeHtml(typeLabel)} | ${escapeHtml(input.audience)} audience</p>
  </div>
  ${metricDefinitions.length > 0 ? `<section class="metric-definitions"><h2>Metric Definitions</h2><ul>${metricDefinitions}</ul></section>` : ""}
  ${analysisHtml}
</body></html>`;
}

function extractHtmlFromResponse(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:html)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // If it starts with <!doctype or <html, it's raw HTML
  const trimmed = text.trim();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) return trimmed;

  return trimmed;
}

// ---------------------------------------------------------------------------
// Analyst Prompts (insight-mode-aware)
// ---------------------------------------------------------------------------

function analystSystemPrompt(input: AnalystInput): string {
  const questionContext = input.question
    ? `Focus your analysis on answering this specific question: "${input.question}"`
    : "Provide a general analysis of the data.";

  const modeGuidance = input.insight_mode === "data"
    ? "This is a DATA QUALITY analysis. Focus on: null values, missing data, inconsistencies, suspicious patterns, data type issues, outliers, and recommendations for data cleanup. Treat the data critically."
    : "This is a BUSINESS analysis. The data is trustworthy. Focus on: trends, comparisons, notable changes, business implications, and actionable recommendations. Think like a business analyst presenting to the audience.";

  return [
    "You are a data analyst. Analyze the provided dataset and return structured findings.",
    "",
    modeGuidance,
    questionContext,
    "",
    "COMBINED DATA NOTE: If the rows contain a '_source_query' field, the data was merged from multiple SQL queries. Use this field to understand which rows came from which query and cross-reference the datasets in your analysis.",
    "DATA CONTEXT NOTE: If a DATA CONTEXT section is provided in the user message, treat it as authoritative pre-computed aggregates. Use the monthly totals to identify trends, the column statistics to understand distributions, and the preparation notes/warnings to calibrate your confidence. The sample rows are representative examples; the DATA CONTEXT captures the full dataset's shape.",
    "",
    "Return strictly valid JSON matching this shape:",
    '{"request_id": "...", "batch_index": 0, "total_batches": 1, "highlights": ["..."], "risks": ["..."], "recommendations": ["..."], "confidence_score": 0.85, "appendix_refs": ["..."]}',
    "",
    "- highlights: The most important findings (3-5 items).",
    "- risks: Issues, concerns, or negative trends (1-3 items).",
    "- recommendations: Specific actionable next steps (2-4 items).",
    "- confidence_score: 0.0-1.0 based on data quality and coverage. Be rigorous and evidence-based.",
    "No markdown, no extra keys."
  ].join("\n");
}

function analystUserPrompt(input: AnalystInput): string {
  const packet = input.evidence_packet;
  const rowPreview = packet.rows.slice(0, 30)
    .map((r) => JSON.stringify(r)).join("\n");
  const allColumns = packet.rows.length > 0 ? Object.keys(packet.rows[0]) : [];

  const parts = [
    `request_id: ${input.request_id}`,
    `batch_index: ${input.batch_index}`,
    `total_batches: ${input.total_batches}`,
    `row_count: ${packet.row_count}`,
    `columns: ${allColumns.join(", ")}`,
    `word_budget: ${input.summary_word_budget}`
  ];

  if (input.question) {
    parts.push(`question: ${input.question}`);
  }

  if (input.data_context && input.data_context.trim().length > 0) {
    parts.push("", "═══ DATA CONTEXT (authoritative pre-computed aggregates) ═══");
    parts.push(input.data_context);
    parts.push("═══ END DATA CONTEXT ═══");
  }

  parts.push("", "Sample rows (up to 30):", rowPreview);

  if (packet.row_count > 30) {
    parts.push(`... and ${packet.row_count - 30} more rows (aggregated statistics above reflect the full dataset).`);
  }

  parts.push("", "Analyze and return JSON only.");
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Shared Request Builders
// ---------------------------------------------------------------------------

function buildOpenAiAnalystRequest(input: AnalystInput, options: CreateAnalystClientOptions): ProviderRequest {
  return {
    endpoint: "https://api.openai.com/v1/responses",
    headers: {
      Authorization: `Bearer ${options.openaiApiKey}`,
      "content-type": "application/json"
    },
    payload: {
      model: options.openaiModel ?? DEFAULT_OPENAI_MODEL,
      input: [
        { role: "system", content: [{ type: "text", text: analystSystemPrompt(input) }] },
        { role: "user", content: [{ type: "text", text: analystUserPrompt(input) }] }
      ],
      temperature: 0
    }
  };
}

function buildOpenRouterAnalystRequest(input: AnalystInput, options: CreateAnalystClientOptions): ProviderRequest {
  return buildOpenRouterGenericRequest(
    analystSystemPrompt(input),
    analystUserPrompt(input),
    options
  );
}

function buildOpenRouterGenericRequest(
  systemPrompt: string,
  userPrompt: string,
  options: CreateAnalystClientOptions
): ProviderRequest {
  const baseUrl = (options.openrouterBaseUrl ?? DEFAULT_OPENROUTER_BASE_URL).replace(/\/$/, "");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.openrouterApiKey}`,
    "content-type": "application/json"
  };

  if (options.openrouterAppName) {
    headers["X-Title"] = options.openrouterAppName;
  }

  if (options.openrouterAppUrl) {
    headers["HTTP-Referer"] = options.openrouterAppUrl;
  }

  return {
    endpoint: `${baseUrl}/chat/completions`,
    headers,
    payload: {
      model: options.openrouterModel ?? DEFAULT_OPENROUTER_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    }
  };
}

function resolveClientOptions(overrides: Partial<CreateAnalystClientOptions>): CreateAnalystClientOptions {
  const timeoutFromEnv = Number.parseInt(
    process.env.LLM_TIMEOUT_MS ?? process.env.DEFAULT_QUERY_TIMEOUT_MS ?? "",
    10
  );

  return {
    provider: parseProvider(overrides.provider ?? process.env.LLM_PROVIDER),
    openaiApiKey: overrides.openaiApiKey ?? process.env.OPENAI_API_KEY,
    openrouterApiKey: overrides.openrouterApiKey ?? process.env.OPENROUTER_API_KEY,
    openrouterBaseUrl: overrides.openrouterBaseUrl ?? process.env.OPENROUTER_BASE_URL,
    openrouterAppName: overrides.openrouterAppName ?? process.env.OPENROUTER_APP_NAME,
    openrouterAppUrl: overrides.openrouterAppUrl ?? process.env.OPENROUTER_APP_URL,
    openaiModel: overrides.openaiModel ?? process.env.OPENAI_MODEL,
    openrouterModel: overrides.openrouterModel ?? process.env.MODEL_GPT,
    timeoutMs: overrides.timeoutMs ?? (Number.isNaN(timeoutFromEnv) ? undefined : timeoutFromEnv),
    fallbackToStub: overrides.fallbackToStub,
    fetcher: overrides.fetcher
  };
}

// ---------------------------------------------------------------------------
// Usage Tracking
// ---------------------------------------------------------------------------

function createUsageEventBuffer(): UsageEventBuffer {
  const events: TokenUsageEvent[] = [];
  return {
    push(event: TokenUsageEvent) {
      events.push(event);
    },
    drain() {
      const snapshot = [...events];
      events.length = 0;
      return snapshot;
    }
  };
}

function recordUsageEventFromPayload(
  buffer: UsageEventBuffer,
  payload: unknown,
  provider: Exclude<LlmProvider, "stub">,
  model: string,
  agent: string
): void {
  const usage = parseUsageFromPayload(payload);
  if (!usage) {
    return;
  }

  buffer.push({
    agent,
    provider,
    model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
    at: new Date().toISOString()
  });
}

function parseUsageFromPayload(payload: unknown): {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
} | null {
  if (!isRecord(payload)) {
    return null;
  }

  const usage = payload.usage;
  if (!isRecord(usage)) {
    return null;
  }

  const input = toSafeNonNegativeInt(
    usage.input_tokens ??
      usage.prompt_tokens ??
      usage.promptTokens ??
      usage.inputTokens
  );
  const output = toSafeNonNegativeInt(
    usage.output_tokens ??
      usage.completion_tokens ??
      usage.completionTokens ??
      usage.outputTokens
  );
  const totalCandidate = usage.total_tokens ?? usage.totalTokens;
  const total = toSafeNonNegativeInt(
    totalCandidate === undefined || totalCandidate === null ? input + output : totalCandidate
  );

  if (input === 0 && output === 0 && total === 0) {
    return null;
  }

  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: total > 0 ? total : input + output
  };
}

function toSafeNonNegativeInt(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return Math.trunc(parsed);
}

function pickModelFromRequest(request: ProviderRequest): string {
  const model = request.payload.model;
  if (typeof model === "string" && model.trim().length > 0) {
    return model;
  }

  return "unknown";
}

// ---------------------------------------------------------------------------
// Shared Utilities
// ---------------------------------------------------------------------------

function extractTextPayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const choices = payload.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];

    if (isRecord(first)) {
      const message = first.message;
      if (isRecord(message)) {
        const content = message.content;
        if (typeof content === "string") {
          return content;
        }

        if (Array.isArray(content)) {
          const textChunks = content
            .map((entry) => {
              if (!isRecord(entry)) return null;
              if (typeof entry.text === "string") return entry.text;
              return null;
            })
            .filter((value): value is string => value !== null);

          if (textChunks.length > 0) {
            return textChunks.join("\n");
          }
        }
      }
    }
  }

  return null;
}

function parseJsonObjectFromText(text: string): Record<string, unknown> {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const extracted = extractFirstJsonObject(trimmed);
    if (!extracted) {
      throw new Error("Provider text response did not contain a valid JSON object.");
    }

    return JSON.parse(extracted) as Record<string, unknown>;
  }
}

function parseDialectCompileOutput(value: unknown): { sql: string; rationale: string } {
  if (!isRecord(value)) {
    throw new Error("Dialect compiler output must be an object.");
  }

  const sql = typeof value.sql === "string" ? value.sql.trim() : "";
  if (sql.length === 0) {
    throw new Error("Dialect compiler output missing sql.");
  }

  const rationale =
    typeof value.rationale === "string" && value.rationale.trim().length > 0
      ? value.rationale.trim()
      : "Dialect compiler normalized SQL for execution.";

  return { sql, rationale };
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function normalizeSqlDialect(value: SqlDialect | string | undefined): SqlDialect {
  if (!value) {
    return "postgres";
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "mysql") {
    return "mysql";
  }
  if (normalized === "snowflake") {
    return "snowflake";
  }
  if (normalized === "bigquery") {
    return "bigquery";
  }
  return "postgres";
}

function normalizeSingleSelectStatement(sql: string): string {
  const fenced = sql.match(/```(?:sql)?\s*\n?([\s\S]*?)```/i);
  const extracted = fenced ? fenced[1] : sql;
  const firstStatement = extracted
    .split(";")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)[0];

  const normalized = (firstStatement ?? extracted).trim();
  return normalized.replace(/;+\s*$/g, "");
}

function parseProvider(rawProvider: string | LlmProvider | undefined): LlmProvider {
  if (!rawProvider) {
    return "stub";
  }

  const normalized = String(rawProvider).toLowerCase();

  if (normalized === "openai") {
    return "openai";
  }

  if (normalized === "openrouter") {
    return "openrouter";
  }

  return "stub";
}

async function fetchWithTimeout(
  fetcher: Fetcher,
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetcher(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


