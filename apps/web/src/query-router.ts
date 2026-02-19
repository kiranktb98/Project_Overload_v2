import { z } from "zod";

export type QueryRouterProvider = "stub" | "openai" | "openrouter";

export type QueryRoutingInput = {
  message: string;
  now_iso: string;
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

export interface QueryRouterClient {
  provider: QueryRouterProvider;
  mode: "provider" | "deterministic";
  decide(input: QueryRoutingInput): Promise<QueryRoutingDecision>;
  narrate_single_query?(input: SingleQueryNarrationInput): Promise<string>;
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

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";
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
    timeout_ms: overrides.timeout_ms,
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
    }
  };
}

function queryRouterSystemPrompt(): string {
  return [
    "You are a routing and SQL drafting agent for a PostgreSQL analytics assistant.",
    "Decide if the user message should be handled as:",
    "1) single_query: answerable with ONE safe SELECT query",
    "2) deep_analysis: requires multiple questions, comparisons, diagnostics, or multiple queries",
    "3) none: no execution route (chit-chat or insufficient context).",
    "",
    "Hard rules for single_query:",
    "- Return exactly one SELECT statement in sql.",
    "- No semicolons.",
    "- No comments.",
    "- No write operations.",
    "- Use ONLY tables/columns from provided catalog.",
    "- Prefer aggregated outputs over raw row dumps.",
    "",
    "Routing guidance:",
    "- Route to deep_analysis when question asks multiple asks/comparisons/trend + drivers/causes/top issues.",
    "- Route to single_query when user asks one concrete metric/number/list that one SQL can answer.",
    "",
    "Return strict JSON only with this shape:",
    "{\"route\":\"single_query|deep_analysis|none\",\"sql\":\"optional\",\"reason\":\"...\",\"confidence\":0.0}",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
