import { analyzeBatch as analyzeBatchStub } from "@project-overload/evidence";
import {
  AnalystInputSchema,
  BatchAnalysisSchema,
  MergedQueryPlanOutputSchema,
  PlannerExplorationSchema,
  PlannerOutputSchema,
  QueryStrategyOutputSchema,
  type AnalystInput,
  type BatchAnalysis,
  type MergedQueryPlanOutput,
  type PlannerExploration,
  type PlannerInput,
  type PlannerOutput,
  type SqlDialect,
  type QueryStrategyInput,
  type QueryStrategyOutput
} from "@project-overload/shared";
import { z } from "zod";

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
  planMergedQueries?(input: QueryStrategyInput): Promise<MergedQueryPlanOutput>;
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
  super_summary?: string;
  consultant_actions?: string[];
  metric_definitions?: Array<{
    metric_key: string;
    display_name: string;
    definition: string;
    filter_description?: string;
    filter_column?: string;
    filter_values?: string[];
    status?: string;
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

export type SuperSummaryInput = {
  title: string;
  audience: string;
  insight_mode: "business" | "data";
  per_question_summaries: Array<{
    question_id: string;
    question_text: string;
    findings: string[];
    drivers: string[];
    anomalies: string[];
    coverage_status: "complete" | "partial" | "insufficient";
    coverage_notes: string[];
    evidence_refs: string[];
    confidence_notes: string[];
  }>;
  analyses: Array<{
    question: string;
    highlights: string[];
    risks: string[];
    recommendations: string[];
    data_summary: string;
  }>;
  query_details: Array<{
    question_number: number;
    question: string;
    sql: string;
    row_count: number;
  }>;
  prepared_payloads: Array<{
    question_number: number;
    question: string;
    prepared_row_count: number;
    warnings: string[];
    validation_note: string;
  }>;
  catalog_summary: string;
  allow_query_planning?: boolean;
  context_query_results?: Array<{
    sql: string;
    row_count: number;
    sample_rows: Array<Record<string, unknown>>;
    error?: string;
  }>;
};

export type SuperSummaryOutput = {
  summary: string;
  issue_detected: boolean;
  intervention_actions: string[];
  context_queries: string[];
  notes: string[];
};

export interface SuperSummaryClient {
  provider: LlmProvider;
  summarize(input: SuperSummaryInput): Promise<SuperSummaryOutput>;
  drainUsageEvents?(): TokenUsageEvent[];
}

export interface PlannerClient {
  provider: LlmProvider;
  explore(input: PlannerInput): Promise<PlannerExploration>;
  plan(input: PlannerInput & { exploration_results: string }): Promise<PlannerOutput>;
  drainUsageEvents?(): TokenUsageEvent[];
}

const SuperSummaryOutputSchema = z.object({
  summary: z.string().min(1),
  issue_detected: z.boolean().default(false),
  intervention_actions: z.array(z.string().min(1)).max(8).default([]),
  context_queries: z.array(z.string().min(1)).max(2).default([]),
  notes: z.array(z.string().min(1)).max(8).default([])
});

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
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-opus-4-6";
const DEFAULT_SUPER_SUMMARY_OPENAI_MODEL = "gpt-5.2";
const DEFAULT_SUPER_SUMMARY_OPENROUTER_MODEL = "openai/gpt-5.2";
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
    if (isTestRuntime()) {
      console.log("[analyst] LLM_PROVIDER=stub in test runtime, using stub client");
      return createStubAnalystClient();
    }
    throw new Error("LLM_PROVIDER=stub is disabled in runtime for analyst client.");
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
  const fallbackToStub = options.fallbackToStub ?? isTestRuntime();
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubAnalystClient();
  const usageBuffer = createUsageEventBuffer();

  if (options.provider === "openai") {
    if (!options.openaiApiKey) {
      if (isTestRuntime()) {
        console.warn("[analyst] provider=openai but missing API key in test runtime, using stub");
        return stub;
      }
      throw new Error("OPENAI_API_KEY is required for analyst provider=openai.");
    }

    const remote = createRemoteAnalystClient({
      provider: "openai",
      timeoutMs,
      fetcher,
      requestFactory: (input) => buildOpenAiAnalystRequest(input, options),
      usageBuffer
    });

    console.log("[analyst] Created remote client (provider=openai, timeout=%dms, fallback=%s)", timeoutMs, fallbackToStub);
    return fallbackToStub ? wrapAnalystWithFallback(remote, stub) : remote;
  }

  if (options.provider === "openrouter") {
    if (!options.openrouterApiKey) {
      if (isTestRuntime()) {
        console.warn("[analyst] provider=openrouter but missing API key in test runtime, using stub");
        return stub;
      }
      throw new Error("OPENROUTER_API_KEY is required for analyst provider=openrouter.");
    }

    const remote = createRemoteAnalystClient({
      provider: "openrouter",
      timeoutMs,
      fetcher,
      requestFactory: (input) => buildOpenRouterAnalystRequest(input, options),
      usageBuffer
    });

    console.log("[analyst] Created remote client (provider=openrouter, model=%s, timeout=%dms, fallback=%s)", options.openrouterModel, timeoutMs, fallbackToStub);
    return fallbackToStub ? wrapAnalystWithFallback(remote, stub) : remote;
  }

  if (isTestRuntime()) {
    console.warn("[analyst] Unsupported provider=%s in test runtime, using stub", options.provider);
    return stub;
  }
  throw new Error(`Unsupported analyst provider: ${String(options.provider)}.`);
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
      } catch (error) {
        console.error("[analyst] LLM call failed, falling back to stub:", error instanceof Error ? error.message : error);
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

/** Parse scoped questions from report_goal text (format: Q1: question\n   Clarification: answer) */
function parseScopedQuestions(reportGoal: string): Array<{ question: string; answer: string }> {
  const results: Array<{ question: string; answer: string }> = [];
  const pattern = /Q\d+:\s*(.+?)(?:\n\s*Clarification:\s*(.+?))?(?=\nQ\d+:|$)/gs;
  let match;
  while ((match = pattern.exec(reportGoal)) !== null) {
    results.push({
      question: match[1].trim(),
      answer: (match[2] ?? "").trim()
    });
  }
  return results;
}

function toMergedPlanOutput(strategy: QueryStrategyOutput): MergedQueryPlanOutput {
  const groups = new Map<string, QueryStrategyOutput["queries"]>();
  const orderedKeys: string[] = [];

  for (const [index, query] of strategy.queries.entries()) {
    const key = query.group_id ? `group:${query.group_id}` : `single:${index}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      orderedKeys.push(key);
    }
    groups.get(key)!.push(query);
  }

  return MergedQueryPlanOutputSchema.parse({
    plan_id: `merged_plan_${Date.now()}`,
    questions: orderedKeys.map((key, index) => {
      const groupQueries = groups.get(key) ?? [];
      const first = groupQueries[0];
      const normalizedGroupId = first?.group_id && first.group_id.trim().length > 0
        ? first.group_id
        : `q${index + 1}_group`;

      return {
        question_id: `q${index + 1}`,
        question_number: index + 1,
        question_text: first?.question ?? `Question ${index + 1}`,
        clarifications_used: first?.purpose ? [first.purpose] : [],
        group_id: normalizedGroupId,
        query_blocks: groupQueries.map((query) => ({
          sql: query.sql,
          purpose: query.purpose,
          expected_rows: 50,
          joins_used: [],
          filters_used: []
        })),
        expected_output_columns: [],
        success_criteria: ["Query executes successfully within policy guardrails."]
      };
    })
  });
}

export function createStubQueryStrategistClient(): QueryStrategistClient {
  return {
    provider: "stub",
    async planQueries(input: QueryStrategyInput): Promise<QueryStrategyOutput> {
      const tables = input.allowed_relations.length > 0
        ? input.allowed_relations
        : ["public.unknown_table"];
      const mainTable = tables[0];
      const dimensions = input.dimension_ids.length > 0
        ? input.dimension_ids.map((d) => d.replace(/^dim_/, ""))
        : [];

      if (input.insight_mode === "data") {
        return {
          queries: [
            {
              question: "What is the data quality and completeness?",
              sql: `SELECT COUNT(*) AS total_rows, COUNT(DISTINCT *) AS distinct_rows FROM ${mainTable} LIMIT 50`,
              purpose: "Assess data completeness and row counts"
            }
          ]
        };
      }

      // Try to extract scoped questions from report_goal
      const scopedQuestions = parseScopedQuestions(input.report_goal);
      const queries: QueryStrategyOutput["queries"] = [];

      if (scopedQuestions.length > 0) {
        // Generate one aggregation query per scoped question
        for (let i = 0; i < scopedQuestions.length; i++) {
          const sq = scopedQuestions[i];
          const groupCols = dimensions.length > 0 ? dimensions.join(", ") : "*";
          const groupBy = dimensions.length > 0 ? `GROUP BY ${dimensions.join(", ")}` : "";
          queries.push({
            question: sq.question,
            sql: `SELECT ${groupCols}, COUNT(*) AS count FROM ${mainTable} ${groupBy} ORDER BY count DESC LIMIT 50`,
            purpose: sq.answer.length > 0 ? `Clarification: ${sq.answer}` : "Aggregated summary for scoped question",
            group_id: `scope_q${i + 1}`
          });
        }
      } else if (input.metric_ids.length > 0 || dimensions.length > 0) {
        // Fallback: generate aggregation queries based on metrics/dimensions
        if (input.metric_ids.length > 0) {
          const groupBy = dimensions.length > 0 ? `GROUP BY ${dimensions.join(", ")}` : "";
          const selectCols = dimensions.length > 0 ? `${dimensions.join(", ")}, ` : "";
          queries.push({
            question: `What are the key trends for ${input.metric_ids.join(", ")}?`,
            sql: `SELECT ${selectCols}COUNT(*) AS count FROM ${mainTable} ${groupBy} ORDER BY count DESC LIMIT 50`,
            purpose: "Summarized metric trends"
          });
        }
        if (dimensions.length > 0) {
          queries.push({
            question: `How do metrics break down by ${dimensions.join(", ")}?`,
            sql: `SELECT ${dimensions.join(", ")}, COUNT(*) AS count FROM ${mainTable} GROUP BY ${dimensions.join(", ")} ORDER BY count DESC LIMIT 50`,
            purpose: "Dimensional breakdown summary"
          });
        }
      }

      if (queries.length === 0) {
        queries.push({
          question: "What are the key business insights from this data?",
          sql: `SELECT COUNT(*) AS total_rows FROM ${mainTable} LIMIT 50`,
          purpose: "General business overview — aggregated summary"
        });
      }

      return { queries };
    },
    async planMergedQueries(input: QueryStrategyInput): Promise<MergedQueryPlanOutput> {
      const strategy = await createStubQueryStrategistClient().planQueries(input);
      return toMergedPlanOutput(strategy);
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
    if (isTestRuntime()) {
      console.log("[query-strategist] LLM_PROVIDER=stub in test runtime, using stub client");
      return createStubQueryStrategistClient();
    }
    throw new Error("LLM_PROVIDER=stub is disabled in runtime for query strategist.");
  }

  const options = resolveClientOptions({
    ...overrides,
    openrouterModel:
      overrides.openrouterModel ??
      process.env.QUERY_STRATEGIST_MODEL ??
      process.env.DATA_PREPARATION_MODEL ??
      process.env.MODEL_GPT ??
      "openai/gpt-5.2"
  });
  return createQueryStrategistClient(options);
}

export function createQueryStrategistClient(options: CreateAnalystClientOptions): QueryStrategistClient {
  const timeoutMs = (options.timeoutMs ?? DEFAULT_TIMEOUT_MS) * 2; // double timeout for query planning
  const fallbackToStub = options.fallbackToStub ?? isTestRuntime();
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

  const buildMergedRequest = (input: QueryStrategyInput): ProviderRequest => {
    return buildOpenRouterGenericRequest(
      mergedQueryPlannerSystemPrompt(input),
      mergedQueryPlannerUserPrompt(input),
      options
    );
  };

  if (options.provider !== "openrouter" || !options.openrouterApiKey) {
    if (isTestRuntime()) {
      console.warn(
        "[query-strategist] Missing openrouter config (provider=%s, hasKey=%s) in test runtime, using stub",
        options.provider,
        Boolean(options.openrouterApiKey)
      );
      return stub;
    }
    throw new Error("OPENROUTER_API_KEY is required for query strategist provider mode.");
  }

  console.log("[query-strategist] Created remote client (model=%s, timeout=%dms, fallback=%s)", options.openrouterModel, timeoutMs, fallbackToStub);

  const remote: QueryStrategistClient = {
    provider: "openrouter",
    async planQueries(input: QueryStrategyInput): Promise<QueryStrategyOutput> {
      console.log("[query-strategist] planQueries called, report_goal length=%d, scopeInGoal=%s",
        input.report_goal.length, input.report_goal.includes("SCOPED QUESTIONS"));
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
      const result = QueryStrategyOutputSchema.parse(parsed);
      console.log("[query-strategist] LLM returned %d queries: %s",
        result.queries.length,
        result.queries.map((q) => q.question).join(" | "));
      return result;
    },
    async planMergedQueries(input: QueryStrategyInput): Promise<MergedQueryPlanOutput> {
      const request = buildMergedRequest(input);
      const response = await fetchWithTimeout(fetcher, request.endpoint, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.payload)
      }, timeoutMs);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Merged query planner failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      recordUsageEventFromPayload(
        usageBuffer,
        payload,
        "openrouter",
        pickModelFromRequest(request),
        "query_planning_agent"
      );
      const text = extractTextPayload(payload);
      if (!text) {
        throw new Error("Unable to parse merged query planner response.");
      }
      const parsed = parseJsonObjectFromText(text);
      return MergedQueryPlanOutputSchema.parse(parsed);
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
      } catch (error) {
        console.error("[query-strategist] LLM call failed, falling back to stub:", error instanceof Error ? error.message : error);
        return fallback.planQueries(input);
      }
    },
    async planMergedQueries(input: QueryStrategyInput): Promise<MergedQueryPlanOutput> {
      if (!remote.planMergedQueries) {
        if (fallback.planMergedQueries) {
          return fallback.planMergedQueries(input);
        }
        const basic = await fallback.planQueries(input);
        return toMergedPlanOutput(basic);
      }

      try {
        return await remote.planMergedQueries(input);
      } catch (error) {
        console.error(
          "[query-planning-agent] merged planning failed, falling back:",
          error instanceof Error ? error.message : error
        );
        if (fallback.planMergedQueries) {
          return fallback.planMergedQueries(input);
        }
        const basic = await fallback.planQueries(input);
        return toMergedPlanOutput(basic);
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
      } catch (error) {
        console.error("[query-strategist] compileSql failed, falling back:", error instanceof Error ? error.message : error);
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
    ? "DATA QUALITY mode: Write aggregated queries to assess completeness, null rates, duplicate rates, value distributions, outliers, and anomalies. Use COUNT, COUNT(DISTINCT), AVG, MIN, MAX. GROUP BY dimension columns. LIMIT 50."
    : "BUSINESS INSIGHTS mode: Every query MUST return pre-aggregated summary data via GROUP BY. Return compact summary tables of ≤50 rows — never raw record dumps. Think: monthly totals, top-N by metric, breakdown by category/region/product. Use SUM, COUNT, AVG with GROUP BY. LIMIT 50 always.";

  // Dialect-specific syntax rules so the strategist writes executable SQL from the start
  const dialectSyntax: Record<string, string[]> = {
    postgres: [
      `═══ ${dialectUpper} SYNTAX (write executable ${dialectUpper} SQL) ═══`,
      "- Date grouping: TO_CHAR(DATE_TRUNC('month', col AT TIME ZONE 'UTC'), 'YYYY-MM-DD') — ALWAYS use this pattern to produce a plain date string without timezone shifts",
      "- Date extraction: EXTRACT(YEAR FROM col), EXTRACT(MONTH FROM col)",
      "- Type casting: col::type or CAST(col AS type)",
      "- String concat: 'a' || 'b'",
      "- Null handling: COALESCE(col, default)",
      "- Case-insensitive match: col ILIKE '%pattern%'",
      "- Current time: NOW(), CURRENT_DATE",
      "- Interval arithmetic: col + INTERVAL '30 days'",
      "- Boolean: TRUE / FALSE"
    ],
    mysql: [
      `═══ ${dialectUpper} SYNTAX (write executable ${dialectUpper} SQL) ═══`,
      "- Date grouping: DATE_FORMAT(col, '%Y-%m') — NEVER use DATE_TRUNC (it does not exist in MySQL)",
      "- Date extraction: YEAR(col), MONTH(col), DAY(col)",
      "- Type casting: CAST(col AS type) — NEVER use :: (not valid in MySQL)",
      "- String concat: CONCAT(a, b, c) — NEVER use || (it means OR in MySQL)",
      "- Null handling: IFNULL(col, default) or COALESCE(col, default)",
      "- Case-insensitive match: col LIKE '%pattern%' (case-insensitive by default)",
      "- Current time: NOW(), CURDATE()",
      "- Interval arithmetic: col + INTERVAL 30 DAY",
      "- Boolean: 1 / 0 (not TRUE/FALSE)",
      "- Reserved words must be backtick-escaped: `order`, `group`, `key`, `index`",
      "- GROUP BY must list all non-aggregated SELECT columns (strict mode)"
    ],
    snowflake: [
      `═══ ${dialectUpper} SYNTAX (write executable ${dialectUpper} SQL) ═══`,
      "- Date grouping: TO_CHAR(DATE_TRUNC('MONTH', col), 'YYYY-MM-DD') (granularity keyword in CAPS, use TO_CHAR to produce plain date string)",
      "- Date extraction: EXTRACT(YEAR FROM col), DATE_PART('month', col)",
      "- Type casting: col::type or CAST(col AS type)",
      "- String concat: 'a' || 'b' or CONCAT(a, b)",
      "- Null handling: COALESCE(col, default), NVL(col, default), IFNULL(col, default)",
      "- Case-insensitive match: col ILIKE '%pattern%'",
      "- Current time: CURRENT_TIMESTAMP(), CURRENT_DATE()",
      "- Window filter: QUALIFY ROW_NUMBER() OVER (...) = 1",
      "- Identifiers are uppercase by default; use double-quotes for case-sensitive names"
    ],
    bigquery: [
      `═══ ${dialectUpper} SYNTAX (write executable ${dialectUpper} SQL) ═══`,
      "- Date grouping: DATE_TRUNC(col, MONTH) — column comes FIRST, granularity second (opposite of Postgres!)",
      "- Date extraction: EXTRACT(YEAR FROM col), EXTRACT(MONTH FROM col)",
      "- Type casting: CAST(col AS type) or SAFE_CAST(col AS type) — NEVER use ::",
      "- String concat: CONCAT(a, b) — NEVER use ||",
      "- Null handling: IFNULL(col, default) or COALESCE(col, default)",
      "- Case-insensitive match: LOWER(col) LIKE '%pattern%'",
      "- Current time: CURRENT_TIMESTAMP(), CURRENT_DATE()",
      "- Types: INT64, FLOAT64, STRING, BOOL, DATE, TIMESTAMP (not INTEGER, TEXT, etc.)",
      "- Table references: `project.dataset.table` with backticks",
      "- No implicit type coercion — always CAST explicitly"
    ]
  };

  const syntaxRules = dialectSyntax[dialect] ?? [`═══ ${dialectUpper} SYNTAX ═══`, "Write valid " + dialectUpper + " SQL."];

  return [
    `You are an expert SQL data preparation strategist. You write EXECUTABLE ${dialectUpper} SQL.`,
    "Your job is to prepare COMPLETE, RICH datasets for an analyst to answer each business question.",
    "Data preparation is the MOST CRITICAL part of the pipeline — the analyst can only work with what you provide.",
    "",
    `MODE: ${mode}`,
    "",
    ...syntaxRules,
    "",
    "CRITICAL: Your SQL MUST be valid, executable " + dialectUpper + " syntax.",
    "Do NOT write generic/PostgreSQL-style SQL and expect it to be fixed later.",
    "Every function call, type cast, and operator must be correct for " + dialectUpper + ".",
    "",
    "═══ YOUR PRIMARY GOAL: THOROUGH DATA PREPARATION ═══",
    "For each business question, prepare exactly the data the analyst needs — no more, no less.",
    "Think of yourself as preparing a data packet for an analyst who has NO access to the database.",
    "The analyst will only see the rows your queries return — so make every query count.",
    "",
    "For EACH business question, assess its complexity and decide how many queries are appropriate:",
    "- Simple factual question? One well-crafted query is sufficient.",
    "- Needs both a trend AND a breakdown? Two queries with the same group_id.",
    "- Complex diagnostic needing multiple angles? Up to three queries with the same group_id.",
    "",
    "Don't over-fetch for simple questions, and don't under-prepare for complex ones.",
    "",
    "═══ DATA PREPARATION STRATEGY (group_id) ═══",
    "Every business question gets a unique group_id string. ALL queries for that question share the SAME group_id.",
    "Their results will be merged into ONE data packet sent to the analyst.",
    "",
    "Decide HOW MANY queries each question needs based on its complexity:",
    "",
    "1 QUERY — Simple, direct questions with a single answer:",
    "  'What was total revenue last month?' → one SUM query is enough",
    "  'How many active users do we have?' → one COUNT query is enough",
    "  'What is the average order value?' → one AVG query is enough",
    "",
    "2 QUERIES — Questions needing a trend PLUS a breakdown or comparison:",
    "  'How is revenue trending by category?' → Q1: monthly trend, Q2: category breakdown",
    "  'Which products are growing fastest?' → Q1: current period by product, Q2: prior period by product",
    "",
    "3 QUERIES — Complex diagnostic questions that need multiple angles:",
    "  'Why did revenue drop last quarter?' → Q1: monthly trend, Q2: category breakdown, Q3: prior year comparison",
    "  'What's driving customer churn?' → Q1: churn rates over time, Q2: churn by segment, Q3: retention cohort data",
    "",
    "USE YOUR JUDGMENT. A simple question needs 1 query — don't over-fetch.",
    "A complex diagnostic question may need 2-3 queries to give the analyst enough data.",
    "The goal is to provide exactly the data the analyst needs — no more, no less.",
    "",
    "IMPORTANT: Even with 1 query, you MUST assign a group_id. Every query needs a group_id.",
    "",
    "═══ CRITICAL: TABLE AND COLUMN NAMES ═══",
    "The DATABASE CATALOG section in the user message lists EVERY table and column available to you.",
    "You MUST use ONLY the exact table names and column names from that catalog — zero exceptions.",
    "- Always use fully-qualified table names: schema.table (e.g., public.orders, NOT just orders).",
    "- When using aliases, the column references must still match the catalog column names exactly.",
    "- NEVER invent, guess, or assume column names that are not listed in the catalog.",
    "- If the catalog shows 'order_date', do NOT write 'date', 'created_at', 'purchase_date', etc.",
    "- If the catalog shows 'amount', do NOT write 'total', 'revenue', 'price', etc.",
    "- If a column you need doesn't exist in the catalog, DO NOT use it. Adapt your query to use only available columns.",
    "- Double-check EVERY column name in your SQL against the catalog before returning.",
    "",
    "═══ QUERY RULES ═══",
    `- Each query MUST be exactly ONE valid ${dialectUpper} SELECT statement.`,
    "- NO semicolons, NO multiple statements, NO comments.",
    "- Every query MUST use GROUP BY and LIMIT ≤50. Raw row dumps (SELECT * or LIMIT 1000+) are FORBIDDEN.",
    "- Use SUM(), COUNT(), AVG(), percentile or window functions — always aggregate, never dump raw records.",
    "- Use JOINs across tables when it adds insight — but only join on columns that actually exist in the catalog.",
    "- When the goal mentions time comparisons (YoY, MoM, QoQ), use date/timestamp columns from the catalog.",
    "- Always add ORDER BY to make results meaningful (ORDER BY metric DESC for rankings, ORDER BY date for trends).",
    "- Use meaningful column aliases (AS revenue, AS order_count, AS month) so analysts can interpret results easily.",
    "- ALWAYS wrap DATE_TRUNC with TO_CHAR and AT TIME ZONE 'UTC' to produce plain date strings: TO_CHAR(DATE_TRUNC('month', col AT TIME ZONE 'UTC'), 'YYYY-MM-DD')",
    "",
    "═══ PLANNER INTEGRATION ═══",
    "If a PLANNER ANALYSIS section is provided, it contains real data discoveries from exploratory queries.",
    "ALWAYS use these discoveries to write better queries:",
    "- Use discovered distinct values for WHERE filters (e.g., status values: 'shipped', 'cancelled').",
    "- Use discovered date ranges to set appropriate time windows.",
    "- Use discovered cardinalities to set appropriate GROUP BY granularity.",
    "- If planner warns about nulls or empty columns, avoid those or handle with COALESCE.",
    "",
    "═══ QUESTION ISOLATION ═══",
    "- NEVER bundle two different business questions into one group_id.",
    "- Each business question gets its OWN unique group_id with 1-3 queries.",
    "- If SCOPED QUESTIONS are provided, generate EXACTLY that many group_ids. Do NOT add extra questions.",
    "- If the PLANNER ANALYSIS has N recommended approaches, generate exactly N questions.",
    "- The question field on all queries within a group MUST be the same string.",
    "- Use the EXACT columns and dimensions the user specified (e.g., if they said 'issue_type', use issue_type — not channel, not category).",
    "",
    "═══ METRIC DEFINITIONS ═══",
    "If METRIC DEFINITIONS are provided in the report context, use the EXACT formulas described.",
    "For example, if 'Total Revenue' is defined as 'SUM(order_amount) for completed orders',",
    "your SQL must use SUM(order_amount) with WHERE status = 'completed' (or equivalent).",
    "",
    "Return strictly valid JSON. No markdown, no extra keys.",
    '{"queries": [{"question":"...","sql":"...","purpose":"...","group_id":"..."}]}'
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
  parts.push("═══ DATA PREPARATION INSTRUCTIONS ═══");

  // When scoped questions are embedded in the report goal, instruct LLM to use them directly
  if (input.report_goal.includes("SCOPED QUESTIONS")) {
    parts.push("The report goal contains SCOPED QUESTIONS that were confirmed by the user.");
    parts.push("");
    parts.push("STRICT RULES FOR SCOPED QUESTIONS:");
    parts.push("1. Generate queries for EXACTLY the scoped questions — no more, no fewer.");
    parts.push("2. Do NOT add extra questions that the user did not ask for.");
    parts.push("3. Do NOT modify the intent of any scoped question (e.g., if the user asked for 'issue_type', query issue_type — not channel or category).");
    parts.push("4. Each scoped question (Q1, Q2, Q3, etc.) becomes one group_id with 1-3 SQL queries.");
    parts.push("5. Use the Clarification text to guide the specific SQL filters, aggregations, time windows, and column choices.");
    parts.push("6. The 'question' field in your output must closely match the scoped question text.");
    parts.push("7. If there are 3 scoped questions, return exactly 3 group_ids. If 5, return exactly 5. Never more.");
  } else {
    parts.push("Generate 2-4 business questions from the report goal.");
  }
  parts.push("For each question, decide how many SQL queries it needs (1, 2, or 3) based on complexity.");
  parts.push("Simple questions need just 1 query. Complex diagnostic questions may need 2-3.");
  parts.push("Think like a data engineer preparing complete datasets for an analyst who cannot query the database.");
  parts.push("Every query MUST use GROUP BY and LIMIT ≤50. Never return raw row dumps.");
  parts.push("Assign a unique group_id to EVERY query. Queries for the same question share the same group_id.");
  parts.push("Return JSON only.");

  return parts.join("\n");
}

function mergedQueryPlannerSystemPrompt(input: QueryStrategyInput): string {
  const dialect = normalizeSqlDialect(input.sql_dialect).toUpperCase();
  return [
    `You are the Query Planning Agent for ${dialect}.`,
    "You own planning + SQL generation per scoped question.",
    "Use catalog summary, planner context, metric definitions, and clarifications to produce executable SQL blocks.",
    "Return strict JSON only with this contract:",
    '{"plan_id":"...","questions":[{"question_id":"q1","question_number":1,"question_text":"...","clarifications_used":["..."],"group_id":"grp_q1","query_blocks":[{"sql":"SELECT ...","purpose":"...","expected_rows":50,"joins_used":["..."],"filters_used":["..."]}],"expected_output_columns":["..."],"success_criteria":["..."]}]}',
    "",
    "Hard rules:",
    "- Every question must have its own group_id.",
    "- query_blocks must contain at least one SELECT-only SQL statement.",
    "- Use only allowlisted tables and schemas from input.",
    "- Do not merge multiple user questions into one question entry.",
    "- Keep SQL aggregation-first and bounded with LIMIT <= 200."
  ].join("\n");
}

function mergedQueryPlannerUserPrompt(input: QueryStrategyInput): string {
  return [
    `AUDIENCE: ${input.audience}`,
    `INSIGHT_MODE: ${input.insight_mode}`,
    `SQL_DIALECT: ${normalizeSqlDialect(input.sql_dialect)}`,
    "",
    `ALLOWED_RELATIONS: ${input.allowed_relations.join(", ") || "(none)"}`,
    "",
    "CATALOG_SUMMARY:",
    input.catalog_summary,
    "",
    "PLANNER_CONTEXT:",
    input.planner_context && input.planner_context.trim().length > 0 ? input.planner_context : "(none)",
    "",
    "REPORT_GOAL_WITH_SCOPED_QUESTIONS:",
    input.report_goal
  ].join("\n");
}

function dialectCompilerSystemPrompt(dialect: SqlDialect): string {
  const dialectGuides: Record<string, string[]> = {
    postgres: [
      "TARGET: PostgreSQL",
      "- Date grouping: TO_CHAR(DATE_TRUNC('month', col AT TIME ZONE 'UTC'), 'YYYY-MM-DD') — always use AT TIME ZONE 'UTC' and TO_CHAR to avoid timezone shifts",
      "- col::type for type casting (also CAST(col AS type))",
      "- String concatenation with || operator",
      "- ILIKE for case-insensitive string matching",
      "- EXTRACT(EPOCH FROM interval) for interval math",
      "- NOW() for current timestamp, CURRENT_DATE for current date",
      "- String functions: LENGTH(), LOWER(), UPPER(), TRIM(), SUBSTRING()",
      "- Array support: ANY(), array_agg()",
      "- Window functions fully supported: ROW_NUMBER(), RANK(), LAG(), LEAD()",
      "- Boolean type: TRUE/FALSE (not 1/0)",
      "- LIMIT N OFFSET M syntax"
    ],
    mysql: [
      "TARGET: MySQL",
      "- DATE_FORMAT(col, '%Y-%m') for date grouping, NOT DATE_TRUNC",
      "- YEAR(col), MONTH(col), DAY(col) for date extraction",
      "- CAST(col AS type) for type casting — no :: operator",
      "- CONCAT(a, b, c) for string concatenation — no || operator",
      "- LIKE for pattern matching (case-insensitive by default with utf8_general_ci)",
      "- NOW() for current timestamp, CURDATE() for current date",
      "- IFNULL() instead of COALESCE() (COALESCE also works but IFNULL is idiomatic)",
      "- String functions: CHAR_LENGTH(), LOWER(), UPPER(), TRIM(), SUBSTRING()",
      "- GROUP BY must include all non-aggregated columns (strict mode)",
      "- LIMIT N syntax (OFFSET requires ORDER BY)",
      "- Use backticks for reserved word escaping: `order`, `group`",
      "- No BOOLEAN type: use TINYINT(1), compare with 1/0 not TRUE/FALSE"
    ],
    snowflake: [
      "TARGET: Snowflake",
      "- DATE_TRUNC('MONTH', col) for date grouping (keyword in caps)",
      "- col::type or CAST(col AS type) for type casting",
      "- String concatenation with || operator",
      "- ILIKE for case-insensitive matching",
      "- Identifiers are UPPERCASE by default — use double quotes for case-sensitive names",
      "- CURRENT_TIMESTAMP() for current timestamp",
      "- FLATTEN() for semi-structured data",
      "- TRY_CAST() for safe casting that returns NULL on failure",
      "- QUALIFY clause for window function filtering",
      "- LIMIT N syntax",
      "- String functions: LENGTH(), LOWER(), UPPER(), TRIM(), SUBSTR()"
    ],
    bigquery: [
      "TARGET: BigQuery",
      "- DATE_TRUNC(col, MONTH) for date grouping — note column comes FIRST",
      "- EXTRACT(MONTH FROM col) for date extraction",
      "- CAST(col AS type) for type casting — no :: operator",
      "- CONCAT(a, b) for string concatenation — no || operator",
      "- Use backticks for project.dataset.table references: `project.dataset.table`",
      "- CURRENT_TIMESTAMP() for current timestamp, CURRENT_DATE() for current date",
      "- IFNULL() or COALESCE() for null handling",
      "- SAFE_CAST() for safe casting that returns NULL on failure",
      "- STRING_AGG() instead of array_agg()",
      "- LIMIT N syntax (no OFFSET without ORDER BY)",
      "- INT64, FLOAT64, STRING, BOOL, DATE, TIMESTAMP types",
      "- No implicit type coercion — always CAST explicitly"
    ]
  };

  const guide = dialectGuides[dialect] ?? [`TARGET: ${dialect.toUpperCase()}`];

  return [
    `You are an expert SQL dialect compiler. Your job is to produce CORRECT, EXECUTABLE ${dialect.toUpperCase()} SQL.`,
    "Convert or repair the source SQL to the target dialect while preserving the exact business intent.",
    "",
    "═══ DIALECT-SPECIFIC RULES ═══",
    ...guide,
    "",
    "═══ COMPILATION RULES ═══",
    "1. FUNCTION MAPPING: Replace functions that don't exist in the target dialect with equivalents.",
    "   - DATE_TRUNC in PostgreSQL → DATE_FORMAT in MySQL, DATE_TRUNC (different arg order) in BigQuery",
    "   - :: casting in PostgreSQL → CAST() in MySQL/BigQuery",
    "   - || concatenation in PostgreSQL → CONCAT() in MySQL/BigQuery",
    "2. TYPE MAPPING: Convert types to target dialect equivalents.",
    "   - PostgreSQL NUMERIC → MySQL DECIMAL, BigQuery NUMERIC",
    "   - PostgreSQL TEXT → MySQL VARCHAR(65535), BigQuery STRING",
    "3. IDENTIFIER QUOTING: Use the correct quoting for the target dialect.",
    "   - PostgreSQL: double quotes (\"column\")",
    "   - MySQL: backticks (`column`)",
    "   - BigQuery: backticks for tables (`project.dataset.table`)",
    "4. PRESERVE the business logic, all column aliases, GROUP BY, ORDER BY, LIMIT, and WHERE clauses.",
    "5. Use ONLY the provided allowlisted schemas/tables — do NOT rename tables.",
    "",
    "═══ HARD CONSTRAINTS ═══",
    "- Output exactly one SELECT statement (or WITH ... SELECT).",
    "- No semicolons.",
    "- No comments.",
    "- No write operations, DDL, or COPY.",
    "",
    "Return strict JSON only:",
    '{"sql":"SELECT ...","rationale":"short note on what was changed for dialect compatibility"}'
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
    if (isTestRuntime()) {
      console.log("[planner] LLM_PROVIDER=stub in test runtime, using stub client");
      return createStubPlannerClient();
    }
    throw new Error("LLM_PROVIDER=stub is disabled in runtime for planner.");
  }

  const options = resolveClientOptions({
    ...overrides,
    openrouterModel:
      overrides.openrouterModel ??
      process.env.DATA_PREPARATION_MODEL ??
      process.env.QUERY_STRATEGIST_MODEL ??
      process.env.MODEL_GPT ??
      "anthropic/claude-sonnet-4-6"
  });
  return createPlannerClient(options);
}

export function createPlannerClient(options: CreateAnalystClientOptions): PlannerClient {
  const timeoutMs = (options.timeoutMs ?? DEFAULT_TIMEOUT_MS) * 2; // double timeout for planning
  const fallbackToStub = options.fallbackToStub ?? isTestRuntime();
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubPlannerClient();
  const usageBuffer = createUsageEventBuffer();

  if (options.provider !== "openrouter" || !options.openrouterApiKey) {
    if (isTestRuntime()) {
      console.warn(
        "[planner] Missing openrouter config (provider=%s, hasKey=%s) in test runtime, using stub",
        options.provider,
        Boolean(options.openrouterApiKey)
      );
      return stub;
    }
    throw new Error("OPENROUTER_API_KEY is required for planner provider mode.");
  }

  console.log("[planner] Created remote client (model=%s, timeout=%dms, fallback=%s)", options.openrouterModel, timeoutMs, fallbackToStub);

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
      } catch (error) {
        console.error("[planner] explore failed, falling back to stub:", error instanceof Error ? error.message : error);
        return fallback.explore(input);
      }
    },
    async plan(input: PlannerInput & { exploration_results: string }): Promise<PlannerOutput> {
      try {
        return await remote.plan(input);
      } catch (error) {
        console.error("[planner] plan failed, falling back to stub:", error instanceof Error ? error.message : error);
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
    "You are a data exploration planner for a SQL database.",
    "Given a user's analysis goal and the database catalog, generate 3-6 lightweight",
    "exploratory SQL queries to understand the data BEFORE writing the main analysis queries.",
    "",
    "Your discoveries will directly inform the Query Strategist, so focus on learning:",
    "- What distinct values exist in key categorical columns (status, type, category fields)",
    "- What date ranges the data covers (critical for time-based analysis)",
    "- Table sizes and cardinalities (to judge data volume)",
    "- Sample rows (to understand data format and relationships)",
    "",
    "QUERY TYPES (use a mix relevant to the goal):",
    '- "distinct": SELECT DISTINCT column_name FROM schema.table ORDER BY 1 LIMIT 50',
    "  Use for: categorical columns, status fields, types, categories — helps the strategist write correct WHERE filters",
    '- "count": SELECT COUNT(*) AS total_rows, COUNT(DISTINCT col) AS unique_values FROM schema.table LIMIT 1',
    "  Use for: table sizes, cardinality — helps judge data volume",
    '- "sample": SELECT * FROM schema.table LIMIT 5',
    "  Use for: understanding row shape, data format, example values, and column relationships",
    '- "range": SELECT MIN(col) AS min_val, MAX(col) AS max_val FROM schema.table LIMIT 1',
    "  Use for: date ranges, numeric ranges — critical for setting time windows in analysis queries",
    '- "schema": SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=\'...\' AND table_name=\'...\' LIMIT 50',
    "  Use for: confirming column types when catalog seems ambiguous",
    "",
    "RULES:",
    "- Use ONLY tables and columns from the provided catalog — never guess column names.",
    "- Always use fully-qualified table names: schema.table.",
    "- Every query MUST be a single SELECT with LIMIT.",
    "- Keep queries fast: no JOINs, no subqueries, no complex aggregations.",
    "- Focus on columns relevant to the user's goal.",
    "- ALWAYS include at least one 'range' query on date/timestamp columns — this is essential.",
    "- ALWAYS include at least one 'distinct' query on key categorical columns.",
    "- Prioritize: date columns (range), status/type columns (distinct), key measures (count/range).",
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
    "   Be PRECISE: include actual values (e.g., 'status values: shipped, cancelled, refunded', 'date range: 2023-01-15 to 2024-12-31').",
    "2. recommended_approaches: 2-4 specific analysis questions with SQL approaches.",
    "   Each approach MUST include: concrete column names, specific JOIN conditions with ON clauses,",
    "   exact filter values from discoveries, and suggested aggregation functions.",
    "   Write approaches as if giving instructions to a SQL developer — not vague descriptions.",
    "3. data_warnings: Any issues found — high null rates, empty tables, unexpected values, low cardinality.",
    "   Include the actual numbers (e.g., '45% null rate in customer_email column').",
    "4. plan_summary: A 2-3 sentence human-readable summary of the plan for the user.",
    "",
    "CRITICAL RULES:",
    "- Base your plan ENTIRELY on what the exploratory data shows — not assumptions.",
    "- Reference actual column values you discovered (e.g., \"status has values: shipped, cancelled, refunded\").",
    "- Your recommended approaches should include specific column names, JOIN conditions, and filter values.",
    "- The Query Strategist will use your output to write the final SQL, so be as precise and concrete as possible.",
    "- If an exploratory query failed with an error, note it in data_warnings and avoid that table/column.",
    "- Include date ranges in your discoveries so the strategist can write correct time filters.",
    "- If the user goal involves trends or comparisons, suggest specific time groupings (monthly, weekly, quarterly).",
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
    if (isTestRuntime()) {
      console.log("[report-composer] LLM_PROVIDER=stub in test runtime, using stub client");
      return createStubReportComposerClient();
    }
    throw new Error("LLM_PROVIDER=stub is disabled in runtime for report composer.");
  }

  const options = resolveClientOptions(overrides);
  return createReportComposerClient(options);
}

export function createReportComposerClient(options: CreateAnalystClientOptions): ReportComposerClient {
  const timeoutMs = (options.timeoutMs ?? DEFAULT_TIMEOUT_MS) * 2;
  const fallbackToStub = options.fallbackToStub ?? isTestRuntime();
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubReportComposerClient();
  const usageBuffer = createUsageEventBuffer();

  if (options.provider !== "openrouter" || !options.openrouterApiKey) {
    if (isTestRuntime()) {
      console.warn(
        "[report-composer] Missing openrouter config (provider=%s, hasKey=%s) in test runtime, using stub",
        options.provider,
        Boolean(options.openrouterApiKey)
      );
      return stub;
    }
    throw new Error("OPENROUTER_API_KEY is required for report composer provider mode.");
  }

  console.log("[report-composer] Created remote client (model=%s, timeout=%dms, fallback=%s)", options.openrouterModel, timeoutMs, fallbackToStub);

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
      } catch (error) {
        console.error("[report-composer] LLM call failed, falling back to stub:", error instanceof Error ? error.message : error);
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

// ---------------------------------------------------------------------------
// Super Summary Client
// ---------------------------------------------------------------------------

export function createStubSuperSummaryClient(): SuperSummaryClient {
  return {
    provider: "stub",
    async summarize(input: SuperSummaryInput): Promise<SuperSummaryOutput> {
      const allHighlights = input.per_question_summaries.flatMap((a) => a.findings).slice(0, 3);
      const allRisks = input.per_question_summaries.flatMap((a) => a.anomalies).slice(0, 3);
      const allActions = input.per_question_summaries.flatMap((a) => a.drivers).slice(0, 4);
      const summary = allHighlights.length > 0
        ? allHighlights.map((line) => `- ${line}`).join("\n")
        : "No material findings were available from the current analysis payload.";

      return {
        summary,
        issue_detected: allRisks.length > 0,
        intervention_actions: allRisks.length > 0 ? allActions : [],
        context_queries: [],
        notes: allRisks.length > 0 ? ["Issue signals detected from analysis risks."] : []
      };
    },
    drainUsageEvents() {
      return [];
    }
  };
}

export function createSuperSummaryClientFromEnv(
  overrides: Partial<CreateAnalystClientOptions> = {}
): SuperSummaryClient {
  const provider = parseProvider(overrides.provider ?? process.env.LLM_PROVIDER);
  if (provider === "stub") {
    if (isTestRuntime()) {
      console.log("[super-summary] LLM_PROVIDER=stub in test runtime, using stub client");
      return createStubSuperSummaryClient();
    }
    throw new Error("LLM_PROVIDER=stub is disabled in runtime for super summary.");
  }

  const options = resolveClientOptions({
    ...overrides,
    openaiModel:
      overrides.openaiModel ??
      process.env.SUPER_SUMMARY_MODEL ??
      process.env.OPENAI_SUPER_SUMMARY_MODEL ??
      DEFAULT_SUPER_SUMMARY_OPENAI_MODEL,
    openrouterModel:
      overrides.openrouterModel ??
      process.env.SUPER_SUMMARY_MODEL ??
      process.env.OPENROUTER_SUPER_SUMMARY_MODEL ??
      DEFAULT_SUPER_SUMMARY_OPENROUTER_MODEL
  });
  return createSuperSummaryClient(options);
}

export function createSuperSummaryClient(options: CreateAnalystClientOptions): SuperSummaryClient {
  const timeoutMs = (options.timeoutMs ?? DEFAULT_TIMEOUT_MS) * 2;
  const fallbackToStub = options.fallbackToStub ?? isTestRuntime();
  const fetcher = options.fetcher ?? fetch;
  const stub = createStubSuperSummaryClient();
  const usageBuffer = createUsageEventBuffer();

  if (options.provider === "openai") {
    if (!options.openaiApiKey) {
      if (isTestRuntime()) {
        console.warn("[super-summary] provider=openai but missing API key in test runtime, using stub");
        return stub;
      }
      throw new Error("OPENAI_API_KEY is required for super summary provider=openai.");
    }

    const remote: SuperSummaryClient = {
      provider: "openai",
      async summarize(input: SuperSummaryInput): Promise<SuperSummaryOutput> {
        const request = {
          endpoint: "https://api.openai.com/v1/responses",
          headers: {
            Authorization: `Bearer ${options.openaiApiKey}`,
            "content-type": "application/json"
          },
          payload: {
            model: options.openaiModel ?? DEFAULT_SUPER_SUMMARY_OPENAI_MODEL,
            input: [
              { role: "system", content: [{ type: "text", text: superSummarySystemPrompt(input) }] },
              { role: "user", content: [{ type: "text", text: superSummaryUserPrompt(input) }] }
            ],
            temperature: 0
          }
        } satisfies ProviderRequest;

        const response = await fetchWithTimeout(fetcher, request.endpoint, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.payload)
        }, timeoutMs);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Super summary failed (${response.status}): ${text}`);
        }

        const payload = (await response.json()) as unknown;
        recordUsageEventFromPayload(
          usageBuffer,
          payload,
          "openai",
          pickModelFromRequest(request),
          "super_summary"
        );
        return parseSuperSummaryPayload(payload);
      },
      drainUsageEvents() {
        return usageBuffer.drain();
      }
    };

    console.log("[super-summary] Created remote client (provider=openai, model=%s, timeout=%dms, fallback=%s)", options.openaiModel ?? DEFAULT_SUPER_SUMMARY_OPENAI_MODEL, timeoutMs, fallbackToStub);
    return fallbackToStub ? wrapSuperSummaryWithFallback(remote, stub) : remote;
  }

  if (options.provider === "openrouter") {
    if (!options.openrouterApiKey) {
      if (isTestRuntime()) {
        console.warn("[super-summary] provider=openrouter but missing API key in test runtime, using stub");
        return stub;
      }
      throw new Error("OPENROUTER_API_KEY is required for super summary provider=openrouter.");
    }

    const remote: SuperSummaryClient = {
      provider: "openrouter",
      async summarize(input: SuperSummaryInput): Promise<SuperSummaryOutput> {
        const request = buildOpenRouterGenericRequest(
          superSummarySystemPrompt(input),
          superSummaryUserPrompt(input),
          options
        );
        const response = await fetchWithTimeout(fetcher, request.endpoint, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.payload)
        }, timeoutMs);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Super summary failed (${response.status}): ${text}`);
        }

        const payload = (await response.json()) as unknown;
        recordUsageEventFromPayload(
          usageBuffer,
          payload,
          "openrouter",
          pickModelFromRequest(request),
          "super_summary"
        );
        return parseSuperSummaryPayload(payload);
      },
      drainUsageEvents() {
        return usageBuffer.drain();
      }
    };

    console.log("[super-summary] Created remote client (provider=openrouter, model=%s, timeout=%dms, fallback=%s)", options.openrouterModel ?? DEFAULT_SUPER_SUMMARY_OPENROUTER_MODEL, timeoutMs, fallbackToStub);
    return fallbackToStub ? wrapSuperSummaryWithFallback(remote, stub) : remote;
  }

  if (isTestRuntime()) {
    console.warn("[super-summary] Unsupported provider=%s in test runtime, using stub", options.provider);
    return stub;
  }
  throw new Error(`Unsupported super summary provider: ${String(options.provider)}.`);
}

function wrapSuperSummaryWithFallback(
  remote: SuperSummaryClient,
  fallback: SuperSummaryClient
): SuperSummaryClient {
  return {
    provider: remote.provider,
    async summarize(input: SuperSummaryInput): Promise<SuperSummaryOutput> {
      try {
        return await remote.summarize(input);
      } catch (error) {
        console.error("[super-summary] LLM call failed, falling back to stub:", error instanceof Error ? error.message : error);
        return fallback.summarize(input);
      }
    },
    drainUsageEvents() {
      const remoteEvents = remote.drainUsageEvents ? remote.drainUsageEvents() : [];
      const fallbackEvents = fallback.drainUsageEvents ? fallback.drainUsageEvents() : [];
      return [...remoteEvents, ...fallbackEvents];
    }
  };
}

function parseSuperSummaryPayload(payload: unknown): SuperSummaryOutput {
  const direct = SuperSummaryOutputSchema.safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  const text = extractTextPayload(payload);
  if (!text) {
    throw new Error("Unable to parse super summary response.");
  }
  return SuperSummaryOutputSchema.parse(parseJsonObjectFromText(text));
}

function superSummarySystemPrompt(input: SuperSummaryInput): string {
  const allowQueryPlanning = input.allow_query_planning ?? false;
  return [
    "You are a top-tier strategy consultant writing an executive synthesis for a report pipeline.",
    "Ground every statement in provided evidence. No speculation. No invented metrics.",
    "Your output is consumed by a downstream HTML report renderer.",
    "",
    "Rules:",
    "- Keep the summary concise and executive-friendly.",
    "- Focus only on the scoped questions already analyzed.",
    "- If issues are detected (material risks, missing coverage, or quality warnings), set issue_detected=true and provide intervention_actions.",
    "- If no issues are detected, set issue_detected=false and intervention_actions=[].",
    "- Do not mention confidence scores or internal model behavior.",
    allowQueryPlanning
      ? "- You may request up to 2 additional SQL context queries in context_queries. They must be single SELECT statements with LIMIT <= 50."
      : "- context_queries must be an empty array.",
    "",
    "Return strict JSON only:",
    '{"summary":"...", "issue_detected": true, "intervention_actions":["..."], "context_queries":["SELECT ... LIMIT 50"], "notes":["..."]}'
  ].join("\n");
}

function superSummaryUserPrompt(input: SuperSummaryInput): string {
  const perQuestion = input.per_question_summaries
    .map((summary, index) => [
      `Q${index + 1} (${summary.question_id}): ${summary.question_text}`,
      `Findings: ${summary.findings.join("; ") || "None"}`,
      `Drivers: ${summary.drivers.join("; ") || "None"}`,
      `Anomalies: ${summary.anomalies.join("; ") || "None"}`,
      `Coverage: ${summary.coverage_status}`,
      `Coverage notes: ${summary.coverage_notes.join("; ") || "None"}`,
      `Evidence refs: ${summary.evidence_refs.join(", ") || "None"}`
    ].join("\n"))
    .join("\n\n");

  const analyses = input.analyses
    .map((analysis, index) => [
      `Q${index + 1}: ${analysis.question}`,
      `Highlights: ${analysis.highlights.join("; ") || "None"}`,
      `Risks: ${analysis.risks.join("; ") || "None"}`,
      `Recommendations: ${analysis.recommendations.join("; ") || "None"}`,
      `Data summary: ${analysis.data_summary}`
    ].join("\n"))
    .join("\n\n");

  const queryDetails = input.query_details
    .map((detail) => `Q${detail.question_number} (${detail.row_count} rows): ${detail.sql}`)
    .join("\n");

  const payloadCoverage = input.prepared_payloads
    .map((payload) => `Q${payload.question_number}: rows=${payload.prepared_row_count}; warnings=${payload.warnings.join(" | ") || "none"}; validation=${payload.validation_note}`)
    .join("\n");

  const contextResults = (input.context_query_results ?? [])
    .map((result, index) => [
      `Context query ${index + 1}: ${result.sql}`,
      result.error ? `Error: ${result.error}` : `Rows: ${result.row_count}`,
      `Sample: ${JSON.stringify(result.sample_rows.slice(0, 3))}`
    ].join("\n"))
    .join("\n\n");

  return [
    `Report title: ${input.title}`,
    `Audience: ${input.audience}`,
    `Mode: ${input.insight_mode}`,
    "",
    "Per-question analysis summaries (primary source):",
    perQuestion || "No per-question summaries provided.",
    "",
    "Analyzed sections:",
    analyses,
    "",
    "Preparation/query coverage:",
    payloadCoverage || "No payload coverage provided.",
    "",
    "Executed strategy queries:",
    queryDetails || "No query details provided.",
    "",
    "Catalog summary:",
    input.catalog_summary || "No catalog summary provided.",
    input.context_query_results && input.context_query_results.length > 0
      ? `\nAdditional context query results:\n${contextResults}`
      : "",
    "",
    `allow_query_planning: ${input.allow_query_planning ? "true" : "false"}`
  ].join("\n");
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
    "- Use a clean, modern design with a professional color scheme (blues, grays, whites).",
    "- Include inline SVG charts where data supports it (bar charts, simple line charts, pie charts). Make charts proportionally sized and well-labeled.",
    "- Use HTML tables with good styling for data breakdowns — alternating row colors, proper alignment, bold headers.",
    "- Make it visually appealing — use cards with subtle shadows, rounded corners, clean typography.",
    "- Each analysis section should have: a clear heading, a key finding callout box (highlighted), and supporting data in tables or charts.",
    "- Include an EXECUTIVE SUMMARY section at the top with the 2-3 most important takeaways as bold callout cards.",
    "- If super_summary is provided, render it near the top as 'Executive Super Summary'.",
    "- End with a clear 'Recommended Actions' section with numbered, prioritized actions.",
    "- If consultant_actions is present, render it as 'AI Recommended Actions for Intervention'.",
    "- If consultant_actions is empty, do not fabricate intervention actions.",
    "- Add a 'Metric Definitions' section when metric_definitions are provided — use a clean reference table format.",
    "- Use the system font stack (system-ui, -apple-system, sans-serif) for clean rendering.",
    "- The report must be printable and look good as a PDF — avoid dark backgrounds, use @media print friendly styles.",
    "- Do NOT mention confidence scores, confidence thresholds, or confidence percentages in customer-facing content.",
    "- Do NOT use any external dependencies (no CDN links, no JavaScript libraries).",
    "- All numbers should be properly formatted (commas for thousands, 2 decimal places for currency/percentages).",
    "- Return ONLY the HTML document, no markdown fences or explanations."
  ].join("\n");
}

function reportComposerUserPrompt(input: ReportComposerInput): string {
  const metricDefinitions = (input.metric_definitions ?? [])
    .map((metric, index) => {
      let line = `${index + 1}. ${metric.display_name} (${metric.metric_key}): ${metric.definition}`;
      if ((metric.filter_description ?? "").length > 0) {
        line += `\n   intent: ${metric.filter_description}`;
      }
      if ((metric.filter_column ?? "").length > 0 && (metric.filter_values ?? []).length > 0) {
        const escaped = (metric.filter_values ?? []).map((v) => `'${v.replace(/'/g, "''")}'`);
        line += ` [auto-filter: WHERE ${metric.filter_column} IN (${escaped.join(", ")})]`;
      }
      if (metric.status) {
        line += ` [status: ${metric.status}]`;
      }
      return line;
    })
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
    `Executive super summary: ${input.super_summary && input.super_summary.trim().length > 0 ? input.super_summary : "None"}`,
    `AI recommended actions for intervention: ${(input.consultant_actions ?? []).length > 0 ? (input.consultant_actions ?? []).join("; ") : "None"}`,
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
  const superSummarySection =
    input.super_summary && input.super_summary.trim().length > 0
      ? `<section class="analysis-card"><h2>Executive Super Summary</h2><p>${escapeHtml(input.super_summary.trim()).replace(/\n/g, "<br/>")}</p></section>`
      : "";
  const consultantActionsSection =
    (input.consultant_actions ?? []).length > 0
      ? `<section class="analysis-card"><h2>AI Recommended Actions for Intervention</h2><ol>${(input.consultant_actions ?? []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol></section>`
      : "";

  const metricDefinitions = (input.metric_definitions ?? [])
    .map((metric) => {
      let filterNote = "";
      if ((metric.filter_column ?? "").length > 0 && (metric.filter_values ?? []).length > 0) {
        filterNote = `<span class="metric-source">filter: ${escapeHtml(metric.filter_column!)} IN (${(metric.filter_values ?? []).map((v) => escapeHtml(v)).join(", ")})</span>`;
      } else if ((metric.filter_description ?? "").length > 0) {
        filterNote = `<span class="metric-source">filter: ${escapeHtml(metric.filter_description!)}</span>`;
      }
      const statusBadge = metric.status ? ` <span class="metric-source">[${escapeHtml(metric.status)}]</span>` : "";
      return `<li><strong>${escapeHtml(metric.display_name)}</strong>: ${escapeHtml(metric.definition)} ${filterNote}${statusBadge}</li>`;
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
  ${superSummarySection}
  ${consultantActionsSection}
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
    ? "This is a DATA QUALITY analysis. Focus on: null values, missing data, inconsistencies, suspicious patterns, data type issues, outliers, and recommendations for data cleanup. Treat the data critically. Quantify issues (e.g., '23% of rows have null email')."
    : "This is a BUSINESS analysis. The data is trustworthy. Focus on: trends, comparisons, notable changes, business implications, and actionable recommendations. Think like a senior business analyst presenting to executives. Always include specific numbers and percentages.";

  return [
    "You are a senior data analyst. Analyze the provided dataset and return structured, evidence-based findings.",
    "",
    modeGuidance,
    questionContext,
    "Stay strictly within the scoped question and timeframe. Do not expand to extra periods, segments, or hypotheses.",
    "If coverage is partial or data is missing, explicitly state that gap instead of inferring unseen values.",
    "Do not introduce external benchmarks, causes, or interventions unless they are directly supported by the provided evidence.",
    "",
    "ANALYSIS QUALITY STANDARDS:",
    "- Every highlight MUST include a specific number, percentage, or comparison from the data.",
    "- BAD: 'Revenue is growing' → GOOD: 'Revenue grew 23% from $1.2M to $1.5M between Q3 and Q4'",
    "- BAD: 'Some products sell more' → GOOD: 'Top 3 products account for 67% of total revenue ($890K)'",
    "- When analyzing trends, calculate period-over-period changes with actual values.",
    "- When analyzing distributions, include top/bottom values and their proportions.",
    "- If the data has time dimensions, identify the direction of change (growing, declining, stable).",
    "",
    "COMBINED DATA NOTE: If the rows contain a '_source_query' field, the data was merged from multiple SQL queries. Use this field to understand which rows came from which query and cross-reference the datasets in your analysis.",
    "DATA CONTEXT NOTE: If a DATA CONTEXT section is provided in the user message, treat it as authoritative pre-computed aggregates. Use the monthly totals to identify trends, the column statistics to understand distributions, and the preparation notes/warnings to calibrate your confidence. The sample rows are representative examples; the DATA CONTEXT captures the full dataset's shape.",
    "",
    "Return strictly valid JSON matching this shape:",
    '{"request_id": "...", "batch_index": 0, "total_batches": 1, "highlights": ["..."], "risks": ["..."], "recommendations": ["..."], "confidence_score": 0.85, "appendix_refs": ["..."], "additional_query_requests": [{"reason":"...", "question":"...", "required_fields":["..."]}]}',
    "",
    "- highlights: The most important findings with specific numbers (3-5 items). Each highlight should be a complete insight, not a vague observation.",
    "- risks: Issues, concerns, or negative trends with quantified impact where possible (1-3 items).",
    "- recommendations: Specific, actionable next steps tied to the findings (2-4 items). Each should clearly state what to do and why.",
    "- confidence_score: 0.0-1.0 based on data quality, coverage, and sample size. Score below 0.7 if data has significant gaps or the sample is too small to draw conclusions.",
    "- appendix_refs: Reference identifiers for any data tables or charts that support the findings.",
    "- additional_query_requests: optional (0-2). Use only when crucial evidence is missing to answer the scoped question. Each request must be precise and scoped to the same question/timeline.",
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
    parts.push("Use these pre-computed statistics as your primary data source. They cover the FULL dataset.");
    parts.push(input.data_context);
    parts.push("═══ END DATA CONTEXT ═══");
  }

  parts.push("", "═══ SAMPLE ROWS (up to 30) ═══", rowPreview);

  if (packet.row_count > 30) {
    parts.push(`... and ${packet.row_count - 30} more rows in the full dataset. Base your analysis on DATA CONTEXT aggregates, not just these samples.`);
  }

  parts.push("", "Analyze the data thoroughly. Include specific numbers and percentages in every finding. Return JSON only.");
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

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
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


