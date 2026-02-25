import { z } from "zod";

export type QueryRouterProvider = "stub" | "openai" | "openrouter";

export type QueryRoutingInput = {
  message: string;
  now_iso: string;
  sql_dialect?: SqlDialect;
  business_context?: string;
  catalog_summary: string;
  allowed_relations: string[];
  allowed_schemas: string[];
  report_draft: {
    name: string;
    audience: string;
    timezone: string;
    insight_mode: "business" | "data";
    metric_ids: string[];
    dimension_ids: string[];
  };
  conversation_history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export type QueryRoutingDecision = {
  route: "single_query" | "deep_analysis" | "none";
  sql?: string;
  reason: string;
  confidence: number;
};

export type SqlDialect = "postgres" | "mysql" | "snowflake" | "bigquery";

export type DialectCompileInput = {
  sql: string;
  dialect: SqlDialect;
  user_message: string;
  allowed_relations: string[];
  allowed_schemas: string[];
  catalog_summary: string;
};

export type DialectCompileOutput = {
  sql: string;
  rationale: string;
};

export type SingleQueryNarrationInput = {
  user_message: string;
  query_id: string;
  result_summary: string;
  method_summary: string;
  row_count: number;
  elapsed_ms: number;
  warnings: string[];
  tables: string[];
  joins: string[];
  filters: string[];
  rows_preview: Array<Record<string, unknown>>;
};

export type ScopeClarificationInput = {
  user_message: string;
  mode: "single_query" | "deep_analysis";
  now_iso: string;
  business_context?: string;
  catalog_summary: string;
  allowed_relations: string[];
  allowed_schemas: string[];
  draft_metrics: string[];
  draft_dimensions: string[];
  conversation_history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export type ScopeClarificationOutput = {
  questions: Array<{
    question_number: number;
    question: string;
    clarification: string;
  }>;
};

export type ScopeAnswerResolutionInput = {
  user_message: string;
  now_iso: string;
  scope_questions: Array<{
    question_number: number;
    question: string;
    clarification: string;
    answer?: string | null;
  }>;
  conversation_history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export type ScopeAnswerResolutionOutput = {
  assignments: Array<{
    question_number: number;
    answer: string;
  }>;
  unresolved_question_numbers: number[];
};

export type MetricDefinitionInput = {
  user_message: string;
  mode: "single_query" | "deep_analysis";
  now_iso: string;
  sql?: string;
  business_context?: string;
  catalog_summary: string;
  allowed_relations: string[];
  allowed_schemas: string[];
  conversation_history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export type MetricDefinitionOutput = {
  metrics: Array<{
    metric_key: string;
    display_name: string;
    definition: string;
    source_type: "column" | "derived";
    source_columns: string[];
    requires_confirmation: boolean;
    confirmation_question?: string;
  }>;
};

export interface QueryRouterClient {
  provider: QueryRouterProvider;
  mode: "provider" | "deterministic";
  decide(input: QueryRoutingInput): Promise<QueryRoutingDecision>;
  compile_sql?(input: DialectCompileInput): Promise<DialectCompileOutput>;
  narrate_single_query?(input: SingleQueryNarrationInput): Promise<string>;
  scope_clarifications?(input: ScopeClarificationInput): Promise<ScopeClarificationOutput>;
  resolve_scope_answers?(input: ScopeAnswerResolutionInput): Promise<ScopeAnswerResolutionOutput>;
  propose_metrics?(input: MetricDefinitionInput): Promise<MetricDefinitionOutput>;
}

type CreateQueryRouterClientOptions = {
  provider?: QueryRouterProvider;
  enabled?: boolean;
  openrouter_api_key?: string;
  openrouter_base_url?: string;
  openrouter_app_name?: string;
  openrouter_app_url?: string;
  openrouter_model?: string;
  timeout_ms?: number;
  fetch_impl?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 900_000;
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-opus-4-6";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const QueryRoutingDecisionSchema = z
  .object({
    route: z.enum(["single_query", "deep_analysis", "none"]),
    sql: z.string().optional(),
    reason: z.string().min(1).default("No routing reason provided."),
    confidence: z.number().min(0).max(1).default(0.5)
  })
  .superRefine((value, context) => {
    if (value.route === "single_query") {
      if (!value.sql || value.sql.trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "single_query route requires sql"
        });
      }
    }
  });

const DialectCompileOutputSchema = z.object({
  sql: z.string().min(1),
  rationale: z.string().min(1).default("Dialect compiler normalized SQL.")
});

const ScopeClarificationOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        question_number: z.number().int().min(1),
        question: z.string().min(1),
        clarification: z.string().min(1)
      })
    )
    .max(8)
    .default([])
});

const MetricDefinitionOutputSchema = z.object({
  metrics: z
    .array(
      z.object({
        metric_key: z.string().min(1),
        display_name: z.string().min(1),
        definition: z.string().min(1),
        source_type: z.enum(["column", "derived"]).default("derived"),
        source_columns: z.array(z.string().min(1)).default([]),
        requires_confirmation: z.boolean().default(false),
        confirmation_question: z.string().optional()
      })
    )
    .max(8)
    .default([])
});

const ScopeAnswerResolutionOutputSchema = z.object({
  assignments: z
    .array(
      z.object({
        question_number: z.number().int().min(1),
        answer: z.string().min(1)
      })
    )
    .max(12)
    .default([]),
  unresolved_question_numbers: z.array(z.number().int().min(1)).max(12).default([])
});

export function createNoopQueryRouterClient(): QueryRouterClient {
  return {
    provider: "stub",
    mode: "deterministic",
    async decide() {
      return {
        route: "none",
        reason: "LLM query router disabled.",
        confidence: 1
      };
    }
  };
}

export function createQueryRouterClientFromEnv(
  overrides: Partial<CreateQueryRouterClientOptions> = {}
): QueryRouterClient {
  const provider = parseProvider(overrides.provider ?? process.env.LLM_PROVIDER);
  const enabled =
    typeof overrides.enabled === "boolean"
      ? overrides.enabled
      : parseBoolean(process.env.WEB_CHAT_LLM_QUERY_ROUTER ?? "true");
  const timeoutFromEnv = Number.parseInt(
    process.env.WEB_QUERY_ROUTER_TIMEOUT_MS ??
      process.env.LLM_TIMEOUT_MS ??
      process.env.DEFAULT_QUERY_TIMEOUT_MS ??
      "",
    10
  );

  const options: CreateQueryRouterClientOptions = {
    provider,
    enabled,
    openrouter_api_key: overrides.openrouter_api_key ?? process.env.OPENROUTER_API_KEY,
    openrouter_base_url: overrides.openrouter_base_url ?? process.env.OPENROUTER_BASE_URL,
    openrouter_app_name: overrides.openrouter_app_name ?? process.env.OPENROUTER_APP_NAME,
    openrouter_app_url: overrides.openrouter_app_url ?? process.env.OPENROUTER_APP_URL,
    openrouter_model:
      overrides.openrouter_model ??
      process.env.SINGLE_QUERY_MODEL ??
      process.env.MODEL_GPT ??
      DEFAULT_OPENROUTER_MODEL,
    timeout_ms: overrides.timeout_ms ?? (Number.isNaN(timeoutFromEnv) ? undefined : timeoutFromEnv),
    fetch_impl: overrides.fetch_impl
  };

  return createQueryRouterClient(options);
}

export function createQueryRouterClient(options: CreateQueryRouterClientOptions): QueryRouterClient {
  const provider = options.provider ?? "stub";
  const enabled = options.enabled ?? true;

  if (!enabled || provider !== "openrouter" || !options.openrouter_api_key) {
    return createNoopQueryRouterClient();
  }

  const fetcher = options.fetch_impl ?? fetch;
  const timeoutMs = options.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = (options.openrouter_base_url ?? DEFAULT_OPENROUTER_BASE_URL).replace(/\/$/, "");
  const model = options.openrouter_model ?? DEFAULT_OPENROUTER_MODEL;

  return {
    provider: "openrouter",
    mode: "provider",
    async decide(input: QueryRoutingInput): Promise<QueryRoutingDecision> {
      try {
        const response = await fetchWithTimeout(
          fetcher,
          `${baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Authorization: `Bearer ${options.openrouter_api_key}`,
              ...(options.openrouter_app_name ? { "X-Title": options.openrouter_app_name } : {}),
              ...(options.openrouter_app_url ? { "HTTP-Referer": options.openrouter_app_url } : {})
            },
            body: JSON.stringify({
              model,
              temperature: 0,
              messages: [
                { role: "system", content: queryRouterSystemPrompt() },
                { role: "user", content: queryRouterUserPrompt(input) }
              ]
            })
          },
          timeoutMs
        );

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`query router failed (${response.status}): ${body}`);
        }

        const payload = (await response.json()) as unknown;
        const text = extractTextPayload(payload);
        if (!text) {
          throw new Error("unable to parse query router response text");
        }

        const parsed = parseJsonObjectFromText(text);
        return QueryRoutingDecisionSchema.parse(parsed);
      } catch {
        return {
          route: "none",
          reason: "Router fallback: unable to produce a safe LLM routing decision.",
          confidence: 0
        };
      }
    },
    async compile_sql(input: DialectCompileInput): Promise<DialectCompileOutput> {
      const response = await fetchWithTimeout(
        fetcher,
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${options.openrouter_api_key}`,
            ...(options.openrouter_app_name ? { "X-Title": options.openrouter_app_name } : {}),
            ...(options.openrouter_app_url ? { "HTTP-Referer": options.openrouter_app_url } : {})
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            messages: [
              { role: "system", content: dialectCompilerSystemPrompt(input.dialect) },
              { role: "user", content: dialectCompilerUserPrompt(input) }
            ]
          })
        },
        timeoutMs
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`dialect compiler failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractTextPayload(payload);
      if (!text) {
        throw new Error("unable to parse dialect compiler response text");
      }

      try {
        const parsed = parseJsonObjectFromText(text);
        return DialectCompileOutputSchema.parse(parsed);
      } catch {
        const sql = normalizeSingleSelectSql(text);
        if (!/^\s*(select|with)\b/i.test(sql)) {
          throw new Error("dialect compiler response did not include a valid SELECT statement");
        }
        return {
          sql,
          rationale: `Compiled SQL for ${input.dialect} dialect.`
        };
      }
    },
    async narrate_single_query(input: SingleQueryNarrationInput): Promise<string> {
      const response = await fetchWithTimeout(
        fetcher,
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${options.openrouter_api_key}`,
            ...(options.openrouter_app_name ? { "X-Title": options.openrouter_app_name } : {}),
            ...(options.openrouter_app_url ? { "HTTP-Referer": options.openrouter_app_url } : {})
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
              { role: "system", content: singleQueryNarratorSystemPrompt() },
              { role: "user", content: singleQueryNarratorUserPrompt(input) }
            ]
          })
        },
        timeoutMs
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`single-query narrator failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractTextPayload(payload);
      if (!text || text.trim().length === 0) {
        throw new Error("single-query narrator returned empty text");
      }

      return text.trim();
    },
    async scope_clarifications(input: ScopeClarificationInput): Promise<ScopeClarificationOutput> {
      const response = await fetchWithTimeout(
        fetcher,
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${options.openrouter_api_key}`,
            ...(options.openrouter_app_name ? { "X-Title": options.openrouter_app_name } : {}),
            ...(options.openrouter_app_url ? { "HTTP-Referer": options.openrouter_app_url } : {})
          },
          body: JSON.stringify({
            model,
            temperature: 0.15,
            messages: [
              { role: "system", content: scopeClarificationSystemPrompt(input.mode) },
              { role: "user", content: scopeClarificationUserPrompt(input) }
            ]
          })
        },
        timeoutMs
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`scope clarification failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractTextPayload(payload);
      if (!text) {
        throw new Error("scope clarification returned empty response");
      }

      const parsed = parseJsonObjectFromText(text);
      return ScopeClarificationOutputSchema.parse(parsed);
    },
    async resolve_scope_answers(input: ScopeAnswerResolutionInput): Promise<ScopeAnswerResolutionOutput> {
      const response = await fetchWithTimeout(
        fetcher,
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${options.openrouter_api_key}`,
            ...(options.openrouter_app_name ? { "X-Title": options.openrouter_app_name } : {}),
            ...(options.openrouter_app_url ? { "HTTP-Referer": options.openrouter_app_url } : {})
          },
          body: JSON.stringify({
            model,
            temperature: 0.05,
            messages: [
              { role: "system", content: scopeAnswerResolutionSystemPrompt() },
              { role: "user", content: scopeAnswerResolutionUserPrompt(input) }
            ]
          })
        },
        timeoutMs
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`scope answer resolution failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractTextPayload(payload);
      if (!text) {
        throw new Error("scope answer resolution returned empty response");
      }

      const parsed = parseJsonObjectFromText(text);
      return ScopeAnswerResolutionOutputSchema.parse(parsed);
    },
    async propose_metrics(input: MetricDefinitionInput): Promise<MetricDefinitionOutput> {
      const response = await fetchWithTimeout(
        fetcher,
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${options.openrouter_api_key}`,
            ...(options.openrouter_app_name ? { "X-Title": options.openrouter_app_name } : {}),
            ...(options.openrouter_app_url ? { "HTTP-Referer": options.openrouter_app_url } : {})
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            messages: [
              { role: "system", content: metricDefinitionSystemPrompt(input.mode) },
              { role: "user", content: metricDefinitionUserPrompt(input) }
            ]
          })
        },
        timeoutMs
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`metric definition failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractTextPayload(payload);
      if (!text) {
        throw new Error("metric definition returned empty response");
      }

      const parsed = parseJsonObjectFromText(text);
      return MetricDefinitionOutputSchema.parse(parsed);
    }
  };
}

function queryRouterSystemPrompt(): string {
  return [
    "You are a routing and SQL drafting agent for a SQL analytics assistant.",
    "Use the SQL_DIALECT value provided in user context when drafting SQL.",
    "Decide if the user message should be handled as:",
    "1) single_query: answerable with ONE safe SELECT query — a simple, focused question about one metric, one list, or one count",
    "2) deep_analysis: requires multiple questions, comparisons, trend analysis, diagnostics, root cause analysis, or produces a multi-section report",
    "3) none: no execution route (chit-chat, greetings, off-topic, or insufficient context to execute)",
    "",
    "═══ ROUTING DECISION GUIDE ═══",
    "",
    "Route to SINGLE_QUERY when the user asks:",
    "- One specific number: 'How many orders last month?', 'What is our total revenue?'",
    "- One list/ranking: 'Top 10 products by revenue', 'Show me all active customers'",
    "- One aggregation: 'Average order value this quarter'",
    "- One simple breakdown: 'Revenue by region' (single GROUP BY, one metric)",
    "",
    "Route to DEEP_ANALYSIS when the user asks:",
    "- Multiple questions in one message: 'Show revenue trends AND top products AND customer retention'",
    "- Comparisons across time: 'Compare this quarter vs last quarter', 'YoY growth analysis'",
    "- Root cause or diagnostic: 'Why did revenue drop?', 'What's driving the increase?'",
    "- Comprehensive reports: 'Give me a full business overview', 'Analyze our sales performance'",
    "- Questions with 'analyze', 'report', 'deep dive', 'comprehensive', 'breakdown across multiple dimensions'",
    "- Anything that would need 2+ separate SQL queries to answer properly",
    "",
    "Route to NONE when:",
    "- The message is a greeting, small talk, or off-topic",
    "- There is no database context or the user hasn't specified what to analyze",
    "- The message is about configuration, not analysis (e.g., 'change my timezone')",
    "",
    "Hard rules for single_query SQL:",
    "- Return exactly one SELECT statement in the sql field.",
    "- Use ONLY tables and columns from the provided CATALOG_SUMMARY — never invent column names.",
    "- Always use fully-qualified table names (schema.table).",
    "- Prefer aggregated outputs (GROUP BY + aggregate functions) over raw row dumps.",
    "- Always include LIMIT (≤200 for listings, ≤50 for aggregations).",
    "- No semicolons, no comments, no write operations.",
    "",
    "Return strict JSON only with this shape:",
    "{\"route\":\"single_query|deep_analysis|none\",\"sql\":\"optional — required only for single_query\",\"reason\":\"brief explanation of routing choice\",\"confidence\":0.0}",
    "No markdown and no extra keys."
  ].join("\n");
}

function queryRouterUserPrompt(input: QueryRoutingInput): string {
  const history = input.conversation_history
    .slice(-8)
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");

  return [
    `CURRENT_UTC: ${input.now_iso}`,
    `SQL_DIALECT: ${input.sql_dialect ?? "postgres"}`,
    `USER_MESSAGE: ${input.message}`,
    "",
    "DRAFT_CONTEXT:",
    JSON.stringify(input.report_draft),
    "",
    `ALLOWED_RELATIONS: ${input.allowed_relations.join(", ") || "(none)"}`,
    `ALLOWED_SCHEMAS: ${input.allowed_schemas.join(", ") || "(none)"}`,
    "",
    "BUSINESS_CONTEXT:",
    input.business_context && input.business_context.trim().length > 0 ? input.business_context : "(none)",
    "",
    "CATALOG_SUMMARY:",
    input.catalog_summary,
    "",
    "RECENT_CONVERSATION:",
    history.length > 0 ? history : "(empty)"
  ].join("\n");
}

function dialectCompilerSystemPrompt(dialect: SqlDialect): string {
  const dialectGuides: Record<string, string> = {
    postgres: "PostgreSQL: DATE_TRUNC('month',col) for dates, :: for casting, || for concat, ILIKE for case-insensitive match, NOW(), LIMIT N.",
    mysql: "MySQL: DATE_FORMAT(col,'%Y-%m') for dates (NOT DATE_TRUNC), CAST() for types (no ::), CONCAT() for strings (no ||), backticks for reserved words, IFNULL(), NOW(), LIMIT N.",
    snowflake: "Snowflake: DATE_TRUNC('MONTH',col), :: or CAST() for types, || for concat, ILIKE, QUALIFY for window filters, identifiers uppercase by default.",
    bigquery: "BigQuery: DATE_TRUNC(col,MONTH) (col first!), CAST() for types (no ::), CONCAT() for strings (no ||), backticks for table refs, SAFE_CAST(), INT64/FLOAT64/STRING types."
  };

  return [
    `You are an expert SQL dialect compiler for ${dialect.toUpperCase()}.`,
    "Convert or repair source SQL to the target dialect while preserving the exact business intent.",
    "",
    dialectGuides[dialect] ?? "",
    "",
    "Key transformations to check:",
    "- Replace DATE_TRUNC/DATE_FORMAT with the correct target function and argument order.",
    "- Replace :: type casts with CAST() if target doesn't support ::.",
    "- Replace || string concat with CONCAT() if target requires it.",
    "- Convert type names (TEXT→STRING, NUMERIC→DECIMAL, etc.).",
    "- Preserve all column aliases, GROUP BY, ORDER BY, LIMIT, and WHERE clauses.",
    "",
    "Hard constraints:",
    "- Exactly one SELECT statement (or WITH ... SELECT).",
    "- No semicolons, no comments, no write operations or DDL.",
    "- Use only provided allowlisted schemas/tables.",
    "",
    "Return strict JSON only:",
    '{"sql":"SELECT ...","rationale":"short note on dialect changes made"}'
  ].join("\n");
}

function dialectCompilerUserPrompt(input: DialectCompileInput): string {
  return [
    `TARGET_DIALECT: ${input.dialect}`,
    `USER_MESSAGE: ${input.user_message}`,
    `ALLOWED_RELATIONS: ${input.allowed_relations.join(", ") || "(none)"}`,
    `ALLOWED_SCHEMAS: ${input.allowed_schemas.join(", ") || "(none)"}`,
    "",
    "CATALOG_SUMMARY:",
    input.catalog_summary && input.catalog_summary.trim().length > 0 ? input.catalog_summary : "(none)",
    "",
    "SOURCE_SQL:",
    input.sql
  ].join("\n");
}

function singleQueryNarratorSystemPrompt(): string {
  return [
    "You are a grounded analytics narrator.",
    "Rewrite executed single-query output into natural language for a business user.",
    "Do not show SQL.",
    "Do not invent numbers, filters, joins, or assumptions.",
    "Use only facts from the input JSON.",
    "Keep it concise (3-6 short sentences).",
    "Include:",
    "- what was computed",
    "- scope/filters in plain English",
    "- whether joins were used",
    "- final result",
    "- any warnings if present."
  ].join("\n");
}

function singleQueryNarratorUserPrompt(input: SingleQueryNarrationInput): string {
  return [
    "Summarize this executed query result for the user.",
    "Return plain text only.",
    "",
    "INPUT_JSON:",
    JSON.stringify(input)
  ].join("\n");
}

function scopeClarificationSystemPrompt(mode: ScopeClarificationInput["mode"]): string {
  return [
    "You are a senior analytics scoping assistant.",
    `Mode: ${mode}.`,
    "",
    "STEP 1 — DECOMPOSE: Break the user request into distinct sub-analyses.",
    "A complex request like 'refund trend + city comparison + support ticket analysis' has 3+ sub-analyses.",
    "Each sub-analysis becomes its own scoped question.",
    "",
    "STEP 2 — CLARIFY: For each sub-analysis, write ONE conversational clarifying question that:",
    "- Confirms the exact metric formula, aggregation method, or filter logic",
    "- Nails down comparison windows, time boundaries, ranking cutoffs, or join logic",
    "- Is specific and natural, not generic or template-like",
    "",
    "Rules:",
    "- Generate one question per sub-analysis — do NOT skip any, even if details seem explicit.",
    "- Always confirm formulas (e.g. 'refund rate = refunded orders / total orders × 100?').",
    "- Always confirm comparison boundaries (e.g. 'past 2 months vs prior 2 months — which exact months?').",
    "- Always confirm ranking/cutoff criteria (e.g. 'top N cities — all or a specific cutoff?').",
    "- Look at the FULL conversation history, not just the latest message. The user's original",
    "  request may contain multiple analysis topics. Cover ALL of them — do not drop any.",
    "- If the conversation already discussed analysis angles (e.g. refund trends, city rankings,",
    "  support tickets), generate clarifying questions for EACH angle mentioned.",
    "- Maximum 6 questions.",
    "- Return strict JSON only:",
    '  {"questions":[{"question_number":1,"question":"...","clarification":"..."}]}',
    "  No markdown and no extra keys."
  ].join("\n");
}

function scopeClarificationUserPrompt(input: ScopeClarificationInput): string {
  const history = input.conversation_history
    .slice(-8)
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");

  // Extract the earliest user message from history as the original analysis request.
  // The latest USER_MESSAGE may be a follow-up, so we need both.
  const userMessages = input.conversation_history
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content);
  const originalRequest = userMessages.length > 0 ? userMessages[0] : input.user_message;

  return [
    `CURRENT_UTC: ${input.now_iso}`,
    `MODE: ${input.mode}`,
    "",
    "ORIGINAL_ANALYSIS_REQUEST (this is what the user ORIGINALLY asked for — cover ALL topics from this):",
    originalRequest,
    "",
    "LATEST_USER_MESSAGE:",
    input.user_message,
    "",
    `DRAFT_METRICS: ${input.draft_metrics.join(", ") || "(none)"}`,
    `DRAFT_DIMENSIONS: ${input.draft_dimensions.join(", ") || "(none)"}`,
    `ALLOWED_RELATIONS: ${input.allowed_relations.join(", ") || "(none)"}`,
    `ALLOWED_SCHEMAS: ${input.allowed_schemas.join(", ") || "(none)"}`,
    "",
    "BUSINESS_CONTEXT:",
    input.business_context && input.business_context.trim().length > 0 ? input.business_context : "(none)",
    "",
    "CATALOG_SUMMARY:",
    input.catalog_summary,
    "",
    "RECENT_CONVERSATION:",
    history.length > 0 ? history : "(empty)"
  ].join("\n");
}

function scopeAnswerResolutionSystemPrompt(): string {
  return [
    "You are a scope-answer reconciliation assistant.",
    "Map the latest user reply to the pending scoped questions.",
    "The user can answer one, many, or all questions in one message.",
    "",
    "Matching rules:",
    "- Use explicit references (Q1, Q2, 'for question 1') AND implicit intent.",
    "- Users often answer conversationally — 'Yes for Q1, thats how you compute it. Q2 use the same window' answers BOTH questions.",
    "- If the user says 'yes', 'confirm', 'correct', 'thats right' about a question's proposed approach, extract that as confirmation of the approach described in the clarification.",
    "- Be AGGRESSIVE about matching. If the user's reply contains enough context to resolve a question, assign it even if the reference is indirect.",
    "- Only leave a question unresolved if the user truly did not address it at all.",
    "- Keep extracted answers concise and execution-ready.",
    "",
    "Return strict JSON only:",
    '{"assignments":[{"question_number":1,"answer":"..."}],"unresolved_question_numbers":[2,3]}',
    "No markdown and no extra keys."
  ].join("\n");
}

function scopeAnswerResolutionUserPrompt(input: ScopeAnswerResolutionInput): string {
  const history = input.conversation_history
    .slice(-10)
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");
  const questions = input.scope_questions
    .map((entry) => ({
      question_number: entry.question_number,
      question: entry.question,
      clarification: entry.clarification,
      existing_answer: entry.answer ?? null
    }))
    .map((entry) => JSON.stringify(entry))
    .join("\n");

  return [
    `CURRENT_UTC: ${input.now_iso}`,
    "PENDING_SCOPE_QUESTIONS_JSONL:",
    questions.length > 0 ? questions : "(none)",
    "",
    `USER_REPLY: ${input.user_message}`,
    "",
    "RECENT_CONVERSATION:",
    history.length > 0 ? history : "(empty)"
  ].join("\n");
}

function metricDefinitionSystemPrompt(mode: MetricDefinitionInput["mode"]): string {
  return [
    "You are a metric-definition guardrail agent for a governed analytics product.",
    `Mode: ${mode}.`,
    "Return ONLY metrics that are truly ambiguous and need explicit business confirmation before execution.",
    "Do not create metric variants (M1/M2/M3) for timeline windows, trend slices, or comparison periods.",
    "If the request can be satisfied with straightforward aggregates on known columns, return metrics: [].",
    "Mark requires_confirmation=true only when the metric definition is materially ambiguous (for example denominator, status inclusion, or formula intent).",
    "If metric can map directly to one clear column aggregate (e.g., SUM(order_amount)), requires_confirmation must be false.",
    "Return at most 2 metrics.",
    "For requires_confirmation=true, include confirmation_question written in natural language.",
    "Return strict JSON only:",
    '{"metrics":[{"metric_key":"...","display_name":"...","definition":"...","source_type":"column|derived","source_columns":["..."],"requires_confirmation":true,"confirmation_question":"..."}]}',
    "No markdown and no extra keys."
  ].join("\n");
}

function metricDefinitionUserPrompt(input: MetricDefinitionInput): string {
  const history = input.conversation_history
    .slice(-8)
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");

  return [
    `CURRENT_UTC: ${input.now_iso}`,
    `MODE: ${input.mode}`,
    `USER_MESSAGE: ${input.user_message}`,
    `SQL_DRAFT: ${input.sql ?? "(none)"}`,
    `ALLOWED_RELATIONS: ${input.allowed_relations.join(", ") || "(none)"}`,
    `ALLOWED_SCHEMAS: ${input.allowed_schemas.join(", ") || "(none)"}`,
    "",
    "BUSINESS_CONTEXT:",
    input.business_context && input.business_context.trim().length > 0 ? input.business_context : "(none)",
    "",
    "CATALOG_SUMMARY:",
    input.catalog_summary,
    "",
    "RECENT_CONVERSATION:",
    history.length > 0 ? history : "(empty)"
  ].join("\n");
}

function parseProvider(rawProvider: string | QueryRouterProvider | undefined): QueryRouterProvider {
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

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

async function fetchWithTimeout(
  fetcher: typeof fetch,
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

function extractTextPayload(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) {
    return null;
  }

  const content = first.message.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const chunks = content
      .map((entry) => {
        if (!isRecord(entry)) {
          return null;
        }
        return typeof entry.text === "string" ? entry.text : null;
      })
      .filter((value): value is string => value !== null);
    if (chunks.length > 0) {
      return chunks.join("\n");
    }
  }

  return null;
}

function parseJsonObjectFromText(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const open = trimmed.indexOf("{");
  const close = trimmed.lastIndexOf("}");
  if (open === -1 || close === -1 || close <= open) {
    throw new Error("no JSON object found");
  }

  return JSON.parse(trimmed.slice(open, close + 1));
}

function normalizeSingleSelectSql(text: string): string {
  const fenced = text.match(/```(?:sql)?\s*\n?([\s\S]*?)```/i);
  const extracted = fenced ? fenced[1] : text;
  const firstStatement = extracted
    .split(";")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)[0];
  return (firstStatement ?? extracted).trim().replace(/;+\s*$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
