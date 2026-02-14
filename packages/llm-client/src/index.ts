import { analyzeBatch as analyzeBatchStub } from "@project-overload/evidence";
import {
  AnalystInputSchema,
  BatchAnalysisSchema,
  type AnalystInput,
  type BatchAnalysis
} from "@project-overload/shared";

export type LlmProvider = "stub" | "openai" | "openrouter";

export interface AnalystClient {
  provider: LlmProvider;
  analyzeBatch(input: AnalystInput): Promise<BatchAnalysis>;
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

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-5.2";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function createStubAnalystClient(): AnalystClient {
  return {
    provider: "stub",
    async analyzeBatch(input: AnalystInput): Promise<BatchAnalysis> {
      return analyzeBatchStub(input);
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

  if (options.provider === "openai") {
    if (!options.openaiApiKey) {
      return stub;
    }

    const remote = createRemoteClient({
      provider: "openai",
      timeoutMs,
      fetcher,
      requestFactory: (input) => buildOpenAiRequest(input, options)
    });

    return fallbackToStub ? wrapWithFallback(remote, stub) : remote;
  }

  if (options.provider === "openrouter") {
    if (!options.openrouterApiKey) {
      return stub;
    }

    const remote = createRemoteClient({
      provider: "openrouter",
      timeoutMs,
      fetcher,
      requestFactory: (input) => buildOpenRouterRequest(input, options)
    });

    return fallbackToStub ? wrapWithFallback(remote, stub) : remote;
  }

  return stub;
}

type RemoteClientOptions = {
  provider: Exclude<LlmProvider, "stub">;
  timeoutMs: number;
  fetcher: Fetcher;
  requestFactory: (input: AnalystInput) => ProviderRequest;
};

function createRemoteClient(options: RemoteClientOptions): AnalystClient {
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
      return parseBatchAnalysisPayload(payload);
    }
  };
}

function wrapWithFallback(remote: AnalystClient, fallback: AnalystClient): AnalystClient {
  return {
    provider: remote.provider,
    async analyzeBatch(input: AnalystInput): Promise<BatchAnalysis> {
      try {
        return await remote.analyzeBatch(input);
      } catch {
        return fallback.analyzeBatch(input);
      }
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
              if (!isRecord(entry)) {
                return null;
              }

              if (typeof entry.text === "string") {
                return entry.text;
              }

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

function buildOpenAiRequest(input: AnalystInput, options: CreateAnalystClientOptions): ProviderRequest {
  return {
    endpoint: "https://api.openai.com/v1/responses",
    headers: {
      Authorization: `Bearer ${options.openaiApiKey}`,
      "content-type": "application/json"
    },
    payload: {
      model: options.openaiModel ?? DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "text", text: analystSystemPrompt() }]
        },
        {
          role: "user",
          content: [{ type: "text", text: analystUserPrompt(input) }]
        }
      ],
      temperature: 0
    }
  };
}

function buildOpenRouterRequest(input: AnalystInput, options: CreateAnalystClientOptions): ProviderRequest {
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
        { role: "system", content: analystSystemPrompt() },
        { role: "user", content: analystUserPrompt(input) }
      ]
    }
  };
}

function analystSystemPrompt(): string {
  return [
    "You are a batch evidence analyst.",
    "Return strictly valid JSON matching this shape:",
    "{request_id, batch_index, total_batches, highlights[], risks[], recommendations[], confidence_score, appendix_refs[]}",
    "No markdown, no extra keys."
  ].join(" ");
}

function analystUserPrompt(input: AnalystInput): string {
  return `Analyze this batch input and return strict JSON only:\n${JSON.stringify(input)}`;
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