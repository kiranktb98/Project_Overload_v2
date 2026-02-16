import type { ChatHistoryTurn, ChatState } from "./chat";

export type ConversationProvider = "stub" | "openai" | "openrouter";

export type ConversationTurnInput = {
  user_message: string;
  /** Structured context from action execution — serves as fallback response if LLM is unavailable. */
  action_context: string;
  state: ChatState;
  history: ChatHistoryTurn[];
  catalog_summary?: string;
  business_context?: string;
};

export interface ConversationClient {
  provider: ConversationProvider;
  mode: "provider" | "deterministic";
  respond(input: ConversationTurnInput): Promise<string>;
}

type Fetcher = typeof fetch;

export type CreateConversationClientOptions = {
  provider?: ConversationProvider;
  openai_api_key?: string;
  openrouter_api_key?: string;
  openrouter_base_url?: string;
  openrouter_app_name?: string;
  openrouter_app_url?: string;
  openai_model?: string;
  openrouter_model?: string;
  timeout_ms?: number;
  fallback_to_deterministic?: boolean;
  require_provider?: boolean;
  fetch_impl?: Fetcher;
};

type ProviderRequest = {
  endpoint: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
};

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function createPassthroughConversationClient(): ConversationClient {
  return {
    provider: "stub",
    mode: "deterministic",
    async respond(input: ConversationTurnInput): Promise<string> {
      return input.action_context;
    }
  };
}

export function createConversationClientFromEnv(
  overrides: Partial<CreateConversationClientOptions> = {}
): ConversationClient {
  const provider = parseProvider(overrides.provider ?? process.env.LLM_PROVIDER);
  const requireProvider =
    typeof overrides.require_provider === "boolean"
      ? overrides.require_provider
      : parseBoolean(process.env.WEB_CHAT_REQUIRE_PROVIDER ?? "false");
  const fallbackToDeterministic =
    typeof overrides.fallback_to_deterministic === "boolean"
      ? overrides.fallback_to_deterministic
      : parseBoolean(process.env.WEB_CHAT_FALLBACK_TO_DETERMINISTIC ?? "true");

  const timeoutFromEnv = Number.parseInt(process.env.LLM_TIMEOUT_MS ?? "", 10);

  const options: CreateConversationClientOptions = {
    provider,
    openai_api_key: overrides.openai_api_key ?? process.env.OPENAI_API_KEY,
    openrouter_api_key: overrides.openrouter_api_key ?? process.env.OPENROUTER_API_KEY,
    openrouter_base_url: overrides.openrouter_base_url ?? process.env.OPENROUTER_BASE_URL,
    openrouter_app_name: overrides.openrouter_app_name ?? process.env.OPENROUTER_APP_NAME,
    openrouter_app_url: overrides.openrouter_app_url ?? process.env.OPENROUTER_APP_URL,
    openai_model: overrides.openai_model ?? process.env.OPENAI_MODEL,
    openrouter_model: overrides.openrouter_model ?? process.env.MODEL_GPT,
    timeout_ms: overrides.timeout_ms ?? (Number.isNaN(timeoutFromEnv) ? undefined : timeoutFromEnv),
    fallback_to_deterministic: fallbackToDeterministic,
    require_provider: requireProvider,
    fetch_impl: overrides.fetch_impl
  };

  return createConversationClient(options);
}

export function createConversationClient(options: CreateConversationClientOptions): ConversationClient {
  const provider = options.provider ?? "stub";
  const timeoutMs = options.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const fallback = options.fallback_to_deterministic ?? true;
  const requireProvider = options.require_provider ?? false;
  const fetcher = options.fetch_impl ?? fetch;
  const passthrough = createPassthroughConversationClient();

  if (provider === "stub") {
    return passthrough;
  }

  if (provider === "openai") {
    if (!options.openai_api_key) {
      if (requireProvider) {
        throw new Error("WEB_CHAT_REQUIRE_PROVIDER is true but OPENAI_API_KEY is missing.");
      }
      return passthrough;
    }

    const remote = createRemoteConversationClient({
      provider,
      fetcher,
      timeout_ms: timeoutMs,
      request_factory: (input) => buildOpenAiRequest(input, options)
    });

    return fallback ? withDeterministicFallback(remote, passthrough) : remote;
  }

  if (!options.openrouter_api_key) {
    if (requireProvider) {
      throw new Error("WEB_CHAT_REQUIRE_PROVIDER is true but OPENROUTER_API_KEY is missing.");
    }
    return passthrough;
  }

  const remote = createRemoteConversationClient({
    provider: "openrouter",
    fetcher,
    timeout_ms: timeoutMs,
    request_factory: (input) => buildOpenRouterRequest(input, options)
  });

  return fallback ? withDeterministicFallback(remote, passthrough) : remote;
}

type RemoteConversationClientOptions = {
  provider: "openai" | "openrouter";
  fetcher: Fetcher;
  timeout_ms: number;
  request_factory: (input: ConversationTurnInput) => ProviderRequest;
};

function createRemoteConversationClient(
  options: RemoteConversationClientOptions
): ConversationClient {
  return {
    provider: options.provider,
    mode: "provider",
    async respond(input: ConversationTurnInput): Promise<string> {
      const request = options.request_factory(input);

      const response = await fetchWithTimeout(
        options.fetcher,
        request.endpoint,
        {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.payload)
        },
        options.timeout_ms
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${options.provider} chat request failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      const textPayload = extractTextPayload(payload);
      if (!textPayload) {
        throw new Error("Unable to parse provider response text.");
      }

      return textPayload.trim();
    }
  };
}

function withDeterministicFallback(
  remote: ConversationClient,
  fallback: ConversationClient
): ConversationClient {
  return {
    provider: remote.provider,
    mode: remote.mode,
    async respond(input: ConversationTurnInput): Promise<string> {
      try {
        return await remote.respond(input);
      } catch {
        return fallback.respond(input);
      }
    }
  };
}

function buildOpenAiRequest(
  input: ConversationTurnInput,
  options: CreateConversationClientOptions
): ProviderRequest {
  return {
    endpoint: "https://api.openai.com/v1/responses",
    headers: {
      Authorization: `Bearer ${options.openai_api_key}`,
      "content-type": "application/json"
    },
    payload: {
      model: options.openai_model ?? DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "text", text: conversationalSystemPrompt(input) }]
        },
        {
          role: "user",
          content: [{ type: "text", text: conversationalUserPrompt(input) }]
        }
      ],
      temperature: 0.3
    }
  };
}

function buildOpenRouterRequest(
  input: ConversationTurnInput,
  options: CreateConversationClientOptions
): ProviderRequest {
  const baseUrl = (options.openrouter_base_url ?? DEFAULT_OPENROUTER_BASE_URL).replace(/\/$/, "");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.openrouter_api_key}`,
    "content-type": "application/json"
  };

  if (options.openrouter_app_name) {
    headers["X-Title"] = options.openrouter_app_name;
  }

  if (options.openrouter_app_url) {
    headers["HTTP-Referer"] = options.openrouter_app_url;
  }

  return {
    endpoint: `${baseUrl}/chat/completions`,
    headers,
    payload: {
      model: options.openrouter_model ?? DEFAULT_OPENROUTER_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: conversationalSystemPrompt(input) },
        { role: "user", content: conversationalUserPrompt(input) }
      ]
    }
  };
}

function conversationalSystemPrompt(input: ConversationTurnInput): string {
  const lines = [
    "You are a data insights agent inside Project Overload — a smart, knowledgeable colleague who helps everyone in the organization understand their data and build reports.",
    "",
    "PERSONALITY & TONE:",
    "- Adapt to whoever you're talking to. Strategic and high-level for executives, tactical and detailed for analysts or ops people.",
    "- Be warm and professional — like a data-savvy colleague, not a chatbot or a form wizard.",
    "- Be concise. 2-4 sentences typical. Expand when sharing analysis, data descriptions, or multiple insights.",
    "- Support brainstorming and open-ended exploration. Engage with half-formed ideas.",
    "- Only mention data patterns when they're relevant to what the user is asking about. Don't volunteer unsolicited analysis.",
    "",
    "WHAT YOU CAN DO:",
    "- Explore the database: describe tables, columns, data types, sample values, row counts.",
    "- Suggest reports and analyses based on the actual data available.",
    "- Help build report contracts: the system auto-detects report parameters (audience, metrics, dimensions, schedule, SQL) from natural conversation.",
    "- Answer business questions using the connected data.",
    "- Run safe read-only SQL queries when asked.",
    "- Execute reports and generate PDF downloads with executive-level analysis.",
    "- Switch between two insight modes:",
    "  * Business Insights: trends, opportunities, risks, actionable recommendations. Treats data as trustworthy.",
    "  * Data Quality: data completeness, anomalies, null rates, issues to fix. Treats data critically.",
    "- When the user asks for a report or analysis, check which insight mode they want. If unclear, briefly mention both options (\"Would you like business insights or a data quality check?\"). The user can say 'data insights' or 'business insights' to switch.",
    "",
    "HOW THE SYSTEM WORKS:",
    "The system detects actions from the user's message (save, run, query, draft updates) and executes them automatically.",
    "The ACTION CONTEXT in the user prompt shows what happened. Incorporate results naturally — don't repeat raw IDs or JSON, interpret them for the user.",
    "If no action was taken, you're just having a conversation. Answer naturally using the catalog and business context below.",
    "",
    "CRITICAL RULES:",
    "- NEVER ask \"who is the audience?\" or \"what format do you want?\" — infer the audience and style from conversation context. If someone talks like a CEO, the report is for executives. If they're drilling into operational details, it's for managers or analysts.",
    "- Reference actual table names, column names, and data types from the catalog.",
    "- Never invent tables, columns, or data that aren't in the catalog.",
    "- If no database is connected or the catalog is empty, suggest visiting /connect.",
    "- Don't push the user into a rigid workflow. Let the conversation flow naturally.",
    "- For greetings (hi, hello, hey), respond warmly and briefly. Don't assume they want a specific report or analysis — just say hello back and let them lead.",
    "- When draft fields get updated automatically, acknowledge the changes casually (\"Got it, I'll focus on revenue by region\") — don't list them like form fields.",
    "- Preserve all run IDs, contract IDs, and download URLs exactly when relaying action results.",
    "- Return plain text only."
  ];

  if (input.business_context) {
    lines.push("", "BUSINESS CONTEXT (what this organization does):", input.business_context);
  }

  if (input.catalog_summary) {
    lines.push("", "DATABASE CATALOG (the user's actual connected data):", input.catalog_summary);
  }

  const currentMode = input.state.draft.insight_mode === "data" ? "Data Quality" : "Business Insights";
  lines.push("", `CURRENT INSIGHT MODE: ${currentMode}`);

  return lines.join("\n");
}

function conversationalUserPrompt(input: ConversationTurnInput): string {
  const stateSnapshot: Record<string, unknown> = {
    draft: {
      name: input.state.draft.name,
      audience: input.state.draft.audience,
      timezone: input.state.draft.timezone,
      schedule_cron: input.state.draft.schedule_cron,
      metric_ids: input.state.draft.metric_ids,
      dimension_ids: input.state.draft.dimension_ids,
      insight_mode: input.state.draft.insight_mode
    },
    contract_id: input.state.contract_id,
    last_run_id: input.state.last_run_id
  };

  if (input.state.last_exec_brief) {
    stateSnapshot.last_analysis = {
      what_changed: input.state.last_exec_brief.what_changed,
      why: input.state.last_exec_brief.why,
      so_what: input.state.last_exec_brief.so_what,
      what_to_do: input.state.last_exec_brief.what_to_do,
      confidence: input.state.last_exec_brief.confidence.score
    };
  }

  const history = serializeHistory(input.history);

  return [
    "Conversation history:",
    history.length > 0 ? history : "(new conversation)",
    "",
    "User message:",
    input.user_message,
    "",
    "Action context (what the system executed in response):",
    input.action_context,
    "",
    "Current report draft state:",
    JSON.stringify(stateSnapshot)
  ].join("\n");
}

function parseProvider(rawProvider: string | ConversationProvider | undefined): ConversationProvider {
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
  if (!isRecord(first)) {
    return null;
  }

  const message = first.message;
  if (!isRecord(message)) {
    return null;
  }

  const content = message.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const chunks = content
      .map((entry) => {
        if (!isRecord(entry)) {
          return null;
        }

        if (typeof entry.text === "string") {
          return entry.text;
        }

        return null;
      })
      .filter((value): value is string => value !== null);

    if (chunks.length > 0) {
      return chunks.join("\n");
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function serializeHistory(history: ChatHistoryTurn[]): string {
  const recent = history.slice(-8);
  if (recent.length === 0) {
    return "";
  }

  return recent
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");
}
