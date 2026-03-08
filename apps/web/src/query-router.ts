import { z } from "zod";

export type QueryRouterProvider = "openai" | "openrouter";

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
  confirmed_metric_definitions?: Array<{
    metric_key: string;
    display_name: string;
    definition: string;
  }>;
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
  existing_metric_definitions?: Array<{
    metric_key: string;
    display_name: string;
    definition: string;
  }>;
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

export type DataArchitectInput = {
  message: string;
  catalog_summary: string;
  business_context: string;
  probe_result?: string | null;
  conversation_history: Array<{ role: string; content: string }>;
  recent_query_context?: Array<{
    query_id: string;
    question: string;
    sql_executed: string;
    row_count: number;
  }>;
};

export interface QueryRouterClient {
  provider: QueryRouterProvider;
  mode: "provider";
  decide(input: QueryRoutingInput): Promise<QueryRoutingDecision>;
  compile_sql?(input: DialectCompileInput): Promise<DialectCompileOutput>;
  narrate_single_query?(input: SingleQueryNarrationInput): Promise<string>;
  answer_data_question?(input: DataArchitectInput): Promise<string>;
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
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-opus-4.6";
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

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

export function createNoopQueryRouterClient(): QueryRouterClient {
  return {
    provider: "openrouter",
    mode: "provider",
    async decide() {
      return {
        route: "none",
        reason: "LLM query router unavailable in test runtime.",
        confidence: 0
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

  const selectedModel = resolveQueryAgentModel(
    overrides.openrouter_model ??
      process.env.SINGLE_QUERY_MODEL ??
      process.env.MODEL_GPT ??
      DEFAULT_OPENROUTER_MODEL
  );

  const options: CreateQueryRouterClientOptions = {
    provider,
    enabled,
    openrouter_api_key: overrides.openrouter_api_key ?? process.env.OPENROUTER_API_KEY,
    openrouter_base_url: overrides.openrouter_base_url ?? process.env.OPENROUTER_BASE_URL,
    openrouter_app_name: overrides.openrouter_app_name ?? process.env.OPENROUTER_APP_NAME,
    openrouter_app_url: overrides.openrouter_app_url ?? process.env.OPENROUTER_APP_URL,
    openrouter_model: selectedModel,
    timeout_ms: overrides.timeout_ms ?? (Number.isNaN(timeoutFromEnv) ? undefined : timeoutFromEnv),
    fetch_impl: overrides.fetch_impl
  };

  return createQueryRouterClient(options);
}

function resolveQueryAgentModel(candidate: string | undefined): string {
  const normalized = (candidate ?? "").trim();
  if (normalized.length === 0) {
    return DEFAULT_OPENROUTER_MODEL;
  }
  return normalized;
}

export function createQueryRouterClient(options: CreateQueryRouterClientOptions): QueryRouterClient {
  const provider = options.provider ?? "openrouter";
  const enabled = options.enabled ?? true;

  if (!enabled) {
    if (isTestRuntime()) {
      return createNoopQueryRouterClient();
    }
    throw new Error("WEB_CHAT_LLM_QUERY_ROUTER is false. Query router requires live LLM provider mode.");
  }

  if (provider !== "openrouter") {
    if (isTestRuntime()) {
      return createNoopQueryRouterClient();
    }
    throw new Error(`Unsupported query router provider: ${provider}. Use provider=openrouter.`);
  }

  if (!options.openrouter_api_key) {
    if (isTestRuntime()) {
      return createNoopQueryRouterClient();
    }
    throw new Error("OPENROUTER_API_KEY is required for query router provider mode.");
  }

  const fetcher = options.fetch_impl ?? fetch;
  const timeoutMs = options.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = (options.openrouter_base_url ?? DEFAULT_OPENROUTER_BASE_URL).replace(/\/$/, "");
  const model = options.openrouter_model ?? DEFAULT_OPENROUTER_MODEL;

  return {
    provider: "openrouter",
    mode: "provider",
    async decide(input: QueryRoutingInput): Promise<QueryRoutingDecision> {
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
    async answer_data_question(input: DataArchitectInput): Promise<string> {
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
              { role: "system", content: dataArchitectSystemPrompt() },
              { role: "user", content: dataArchitectUserPrompt(input) }
            ]
          })
        },
        timeoutMs
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`data-architect failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractTextPayload(payload);
      if (!text || text.trim().length === 0) {
        throw new Error("data-architect returned empty text");
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
    .slice(-20)
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
  const dialectGuides: Record<string, string[]> = {
    postgres: [
      "═══ POSTGRESQL SYNTAX RULES ═══",
      "Date grouping: TO_CHAR(DATE_TRUNC('month', col), 'YYYY-MM') or DATE_TRUNC('month', col)::date",
      "Date extraction: EXTRACT(YEAR FROM col), EXTRACT(MONTH FROM col)",
      "Casting: col::type (e.g., col::numeric, col::text) or CAST(col AS type)",
      "String concat: || operator (e.g., first_name || ' ' || last_name)",
      "Case-insensitive match: ILIKE",
      "Null handling: COALESCE(col, default)",
      "Current time: NOW(), CURRENT_DATE, CURRENT_TIMESTAMP",
      "Limit: LIMIT N",
      "Boolean: TRUE/FALSE (not 1/0)",
      "String quoting: single quotes only for strings, double quotes for identifiers",
      "Common aggregates: SUM(), COUNT(), AVG(), MIN(), MAX(), COUNT(DISTINCT col)",
      "Window functions: ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)",
      "IMPORTANT: Do NOT use DATE_FORMAT() — that is MySQL. Use TO_CHAR() or DATE_TRUNC() in PostgreSQL.",
      "IMPORTANT: Do NOT use IFNULL() — that is MySQL. Use COALESCE() in PostgreSQL.",
      "IMPORTANT: Do NOT use backticks — PostgreSQL uses double quotes for identifiers."
    ],
    mysql: [
      "═══ MYSQL SYNTAX RULES ═══",
      "Date grouping: DATE_FORMAT(col, '%Y-%m') — NEVER use DATE_TRUNC (does not exist in MySQL)",
      "Date extraction: YEAR(col), MONTH(col), DAY(col)",
      "Casting: CAST(col AS type) — no :: operator",
      "String concat: CONCAT(a, b) — no || operator for concat",
      "Case-insensitive match: LIKE (MySQL is case-insensitive by default with utf8_general_ci)",
      "Null handling: IFNULL(col, default) or COALESCE(col, default)",
      "Current time: NOW(), CURDATE(), CURRENT_TIMESTAMP",
      "Limit: LIMIT N",
      "Identifiers: backticks for reserved words (`order`, `group`)",
      "IMPORTANT: Do NOT use DATE_TRUNC() — that is PostgreSQL. Use DATE_FORMAT() in MySQL.",
      "IMPORTANT: Do NOT use :: for casting — use CAST() in MySQL.",
      "IMPORTANT: Do NOT use || for string concat — use CONCAT() in MySQL."
    ],
    snowflake: [
      "═══ SNOWFLAKE SYNTAX RULES ═══",
      "Date grouping: DATE_TRUNC('MONTH', col)",
      "Casting: :: or CAST() both work (e.g., col::NUMBER, CAST(col AS VARCHAR))",
      "String concat: || operator",
      "Case-insensitive match: ILIKE",
      "Null handling: COALESCE(), NVL(), IFNULL()",
      "Identifiers: uppercase by default, double quotes for case-sensitive",
      "Window functions: QUALIFY for filtering window results directly",
      "IMPORTANT: Snowflake identifiers are case-insensitive and stored as UPPERCASE."
    ],
    bigquery: [
      "═══ BIGQUERY SYNTAX RULES ═══",
      "Date grouping: DATE_TRUNC(col, MONTH) — column FIRST, then interval",
      "Casting: CAST(col AS type), SAFE_CAST() — no :: operator",
      "String concat: CONCAT(a, b) — no || operator",
      "Types: INT64, FLOAT64, STRING, BOOL, DATE, TIMESTAMP",
      "Table references: backticks for project.dataset.table",
      "Null handling: COALESCE(), IFNULL()",
      "IMPORTANT: BigQuery DATE_TRUNC argument order is (column, part) NOT (part, column).",
      "IMPORTANT: Do NOT use :: for casting — use CAST() or SAFE_CAST() in BigQuery."
    ]
  };

  const guide = dialectGuides[dialect] ?? [`Write valid ${dialect.toUpperCase()} SQL.`];

  return [
    `You are an expert SQL dialect compiler for ${dialect.toUpperCase()}.`,
    "Your job is to COMPILE source SQL into valid, executable ${dialect.toUpperCase()} SQL.",
    "",
    "COMPILATION RULES:",
    "1. Preserve the EXACT business intent, filters, aggregations, joins, aliases, GROUP BY, ORDER BY, and LIMIT.",
    "2. Only change dialect-specific syntax (date functions, casting, string ops, identifier quoting).",
    "3. Do NOT add, remove, or modify any WHERE conditions, JOIN conditions, or column selections.",
    "4. Do NOT add columns, remove columns, or change column aliases.",
    "5. Do NOT change the business logic — only adapt the SQL syntax for the target dialect.",
    "",
    ...guide,
    "",
    "VALIDATION CHECKLIST (verify before returning):",
    "- All table/column names match the CATALOG_SUMMARY exactly (fully qualified: schema.table).",
    "- All date functions use the correct dialect syntax and argument order.",
    "- All type casts use the correct dialect operator (:: vs CAST).",
    "- All string operations use the correct dialect function (|| vs CONCAT).",
    "- The SQL is a single SELECT or WITH...SELECT statement.",
    "- No semicolons, no comments, no write operations.",
    "",
    "If the source SQL is ALREADY valid for the target dialect, return it unchanged.",
    "",
    "Return strict JSON only:",
    '{"sql":"SELECT ...","rationale":"short note on changes made (or \'no changes needed\')"}'
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
    "- final result.",
    "Do NOT mention warnings, dialect adaptations, or implementation details.",
    "Only mention data quality issues if they materially affect the result (e.g. missing rows, null values)."
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

function dataArchitectSystemPrompt(): string {
  return [
    "You are a Data Architect assistant for an analytics platform.",
    "You help users understand the database schema, available tables, columns, data availability,",
    "and provide advice on analytical approaches, queries, views, and table design.",
    "",
    "Your capabilities:",
    "- Describe available tables, their columns, data types, and relationships",
    "- Explain what data is available and its time range (using probe results when provided)",
    "- Recommend which tables/columns to use for specific analyses",
    "- Suggest SQL queries, views, or table designs",
    "- Advise on analytical approaches and best practices",
    "- Answer questions about data quality, cardinality, and coverage",
    "- Answer questions about previously executed queries by examining the actual SQL",
    "",
    "Rules:",
    "- Use ONLY information from the CATALOG_SUMMARY provided. Do NOT invent tables or columns.",
    "- If probe query results are provided, use them for precise answers (e.g., exact date ranges).",
    "- Keep answers clear and actionable. Use bullet points for lists.",
    "- When suggesting SQL, use the tables and columns from the catalog.",
    "- If the user asks about something not in the catalog, say so clearly.",
    "- When the user asks about a previously executed query (e.g. 'is this only paid?', 'what filters?'),",
    "  look at RECENTLY_EXECUTED_QUERIES and give a DEFINITIVE answer based on the actual SQL.",
    "  NEVER be uncertain about what you just ran — read the SQL WHERE clause and state the facts.",
    "- Be conversational but precise. Don't over-explain obvious things.",
    "- When listing tables, include row count estimates and brief descriptions when available."
  ].join("\n");
}

function dataArchitectUserPrompt(input: DataArchitectInput): string {
  const parts: string[] = [
    "USER_QUESTION:",
    input.message,
    "",
    "CATALOG_SUMMARY:",
    input.catalog_summary || "(no catalog available)",
    "",
    "BUSINESS_CONTEXT:",
    input.business_context || "(none provided)"
  ];

  if (input.probe_result) {
    parts.push("", "PROBE_QUERY_RESULT (live data from the database):", input.probe_result);
  }

  if (input.recent_query_context && input.recent_query_context.length > 0) {
    parts.push(
      "",
      "RECENTLY_EXECUTED_QUERIES (actual SQL that was run — use these to answer questions about previous results):",
      JSON.stringify(input.recent_query_context, null, 2)
    );
  }

  if (input.conversation_history.length > 0) {
    parts.push(
      "",
      "RECENT_CONVERSATION:",
      input.conversation_history
        .slice(-10)
        .map((turn) => `${turn.role}: ${turn.content}`)
        .join("\n")
    );
  }

  parts.push(
    "",
    "Answer the user's question about the data based on the catalog and any probe results above.",
    "If the user asks about a previous query result (e.g. 'is this only paid sales?', 'what filters were used?'),",
    "look at RECENTLY_EXECUTED_QUERIES to see the actual SQL and give a DEFINITIVE answer.",
    "NEVER say 'it would only be X if...' — check the SQL and state exactly what was queried."
  );
  return parts.join("\n");
}

function scopeClarificationSystemPrompt(mode: ScopeClarificationInput["mode"]): string {
  const deepMode = mode === "deep_analysis";
  return [
    "You are a senior analytics scoping assistant.",
    `Mode: ${mode}.`,
    "",
    "STEP 1 - DECOMPOSE: Break the user request into distinct sub-analyses.",
    "A complex request like 'refund trend + city comparison + support ticket analysis' has 3+ sub-analyses.",
    "Each sub-analysis becomes its own scoped question.",
    "",
    "STEP 2 - ASSUME BY DEFAULT: apply safe, common assumptions first (timeline anchor, refund status, top-N, join preference).",
    "Only ask a clarification when execution would materially change and you cannot safely proceed.",
    "",
    "Rules:",
    "- Do not ask generic confirmation questions.",
    "- Prefer explicit assumptions and proceed.",
    deepMode
      ? "- For deep_analysis, return 3-4 core scoped questions derived from the user request."
      : "- For single_query, return at most 1 scoped clarification question when required.",
    deepMode
      ? "- For deep_analysis, add 1-2 smart suggested questions that improve decision quality (clearly label them with '[Suggested]')."
      : "- If the single query is already clear, return zero clarification questions.",
    deepMode
      ? "- Total deep_analysis questions should usually be 4-6."
      : "- Keep single-query clarifications minimal.",
    "- Look at the FULL conversation history, not just the latest message. The user's original",
    "  request may contain multiple analysis topics. Cover ALL of them - do not drop any.",
    "- If the conversation already discussed analysis angles (e.g. refund trends, city rankings,",
    "  support tickets), generate scoped questions for EACH angle mentioned.",
    "",
    "QUESTION QUALITY (CRITICAL):",
    "- Every question MUST be specific and self-contained. NEVER generate vague questions like 'What are the top cities?' without specifying the metric and time range.",
    "- BAD: 'What are the top cities?' — too vague, no metric or timeframe.",
    "- GOOD: 'Which cities have the highest refund rate (using the saved refund-rate formula) over the past 4 months?'",
    "- NEVER generate two questions that cover the same analytical ask. If one question is a more specific version of another, keep ONLY the specific one.",
    "- NEVER merge labels or asks into one item (for example Q4+Q5 or Q3/Q4). Emit one atomic question per item.",
    "- Each question should reference actual table names, column names, or metric names from the CATALOG_SUMMARY when available.",
    "- Use the BUSINESS_CONTEXT to inform what metrics and dimensions are relevant.",
    "- If a metric appears in CONFIRMED_METRIC_DEFINITIONS, you MUST use that exact formula and MUST NOT substitute your own.",
    "",
    "- Return strict JSON only:",
    '  {"questions":[{"question_number":1,"question":"...","clarification":"..."}]}',
    "  No markdown and no extra keys."
  ].join("\n");
}

function scopeClarificationUserPrompt(input: ScopeClarificationInput): string {
  const history = input.conversation_history
    .slice(-20)
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
    "CONFIRMED_METRIC_DEFINITIONS (use these exact definitions — do NOT invent your own):",
    input.confirmed_metric_definitions && input.confirmed_metric_definitions.length > 0
      ? input.confirmed_metric_definitions.map((m) => `  - ${m.display_name} (${m.metric_key}): ${m.definition}`).join("\n")
      : "(none)",
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
    "- Users answer naturally — they will NOT use numbered format. Map conversational clauses to the right questions.",
    "- Example: 'last 4 complete months, exclude cancelled, top 10 is fine' — each clause maps to a different question.",
    "- If the user says 'yes', 'confirm', 'correct', 'thats right' about a question's proposed approach, extract that as confirmation of the approach described in the clarification.",
    "- BLANKET CONFIRMATIONS: If the user says 'confirm all', 'ok with everything', 'yes to all', 'defaults are fine', 'all good' — assign confirmation to ALL pending questions.",
    "- Be precise, not aggressive: only assign when the user's message contains direct evidence for that question.",
    "- Do NOT infer answers for unaddressed questions. If unclear, keep unresolved.",
    "- If the message adds a new question/follow-up ask, do not treat that ask as an answer to existing clarification items.",
    "- If one clause could map to multiple pending questions, map it only when the user explicitly indicates 'same for all' or equivalent intent.",
    "- Keep extracted answers concise and execution-ready.",
    "",
    "Return strict JSON only:",
    '{"assignments":[{"question_number":1,"answer":"..."}],"unresolved_question_numbers":[2,3]}',
    "No markdown and no extra keys."
  ].join("\n");
}

function scopeAnswerResolutionUserPrompt(input: ScopeAnswerResolutionInput): string {
  const history = input.conversation_history
    .slice(-20)
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
    .slice(-20)
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
    "EXISTING_METRIC_DEFINITIONS (already confirmed — reuse these exact definitions, do NOT redefine them):",
    input.existing_metric_definitions && input.existing_metric_definitions.length > 0
      ? input.existing_metric_definitions.map((m) => `  - ${m.display_name} (${m.metric_key}): ${m.definition}`).join("\n")
      : "(none)",
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
    return "openrouter";
  }

  const normalized = String(rawProvider).toLowerCase();
  if (normalized === "openai") {
    return "openai";
  }
  if (normalized === "openrouter") {
    return "openrouter";
  }
  return "openrouter";
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
