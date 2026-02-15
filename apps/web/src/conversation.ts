import type { ChatHistoryTurn, ChatState } from "./chat";

export type ConversationProvider = "stub" | "openai" | "openrouter";

export type ConversationTurnInput = {
  user_message: string;
  deterministic_response: string;
  state: ChatState;
  history: ChatHistoryTurn[];
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
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-5.2";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function createPassthroughConversationClient(): ConversationClient {
  return {
    provider: "stub",
    mode: "deterministic",
    async respond(input: ConversationTurnInput): Promise<string> {
      return input.deterministic_response;
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
          content: [{ type: "text", text: conversationalSystemPrompt() }]
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
        { role: "system", content: conversationalSystemPrompt() },
        { role: "user", content: conversationalUserPrompt(input) }
      ]
    }
  };
}

function conversationalSystemPrompt(): string {
  return [
    "You are a friendly, knowledgeable report assistant working inside Project Overload.",
    "Your job is to help users build, run, and understand their report contracts.",
    "Rewrite the deterministic assistant response to sound warm, natural, and human - like a helpful colleague, not a robot.",
    "Use casual but professional language. Be concise. Avoid bullet-point lists unless the data calls for it.",
    "CRITICAL RULES:",
    "- Never invent data, metrics, numbers, IDs, links, or outcomes that aren't in the deterministic response.",
    "- Preserve all run IDs, download URLs, field names, and technical constraints exactly as given.",
    "- If showing analysis results, keep the structure clear but make the language natural.",
    "- Keep responses short - usually 2-4 sentences unless sharing detailed analysis.",
    "Return plain text only."
  ].join(" ");
}

function conversationalUserPrompt(input: ConversationTurnInput): string {
  const stateSnapshot = {
    draft: {
      name: input.state.draft.name,
      audience: input.state.draft.audience,
      timezone: input.state.draft.timezone,
      schedule_cron: input.state.draft.schedule_cron,
      metric_ids: input.state.draft.metric_ids,
      dimension_ids: input.state.draft.dimension_ids
    },
    contract_id: input.state.contract_id,
    last_run_id: input.state.last_run_id,
    has_exec_brief: input.state.last_exec_brief !== null
  };

  const history = serializeHistory(input.history);

  return [
    "Conversation context:",
    history.length > 0 ? history : "(no prior turns)",
    "",
    "Latest user message:",
    input.user_message,
    "",
    "Deterministic assistant response (must stay semantically true):",
    input.deterministic_response,
    "",
    "Current chat state:",
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
