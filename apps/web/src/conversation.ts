import type { ChatHistoryTurn, ChatState } from "./chat";

export type ConversationProvider = "stub" | "openai" | "openrouter";

export type DraftUpdates = {
  name?: string;
  audience?: string;
  timezone?: string;
  schedule_cron?: string | null;
  sql_template?: string;
  metric_ids?: string[];
  dimension_ids?: string[];
  allowed_relations?: string[];
  allowed_schemas?: string[];
  insight_mode?: "business" | "data";
};

export type ConversationResponse = {
  message: string;
  draft_updates?: DraftUpdates;
};

export type ConversationTitleInput = {
  first_user_messages: string[];
  catalog_summary?: string;
  business_context?: string;
};

export type ConversationTitleResponse = {
  title: string;
};

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
  respond(input: ConversationTurnInput): Promise<ConversationResponse>;
  nameConversation?(input: ConversationTitleInput): Promise<ConversationTitleResponse>;
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

const DEFAULT_TIMEOUT_MS = 900_000;
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function createPassthroughConversationClient(): ConversationClient {
  return {
    provider: "stub",
    mode: "deterministic",
    async respond(input: ConversationTurnInput): Promise<ConversationResponse> {
      return { message: input.action_context };
    },
    async nameConversation(input: ConversationTitleInput): Promise<ConversationTitleResponse> {
      return { title: buildDeterministicConversationTitle(input.first_user_messages) };
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
  async function requestText(input: ConversationTurnInput): Promise<string> {
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

  return {
    provider: options.provider,
    mode: "provider",
    async respond(input: ConversationTurnInput): Promise<ConversationResponse> {
      const textPayload = await requestText(input);
      return parseLlmResponse(textPayload);
    },
    async nameConversation(input: ConversationTitleInput): Promise<ConversationTitleResponse> {
      const titleTurn: ConversationTurnInput = {
        user_message: "",
        action_context: "",
        state: createTitleStateSkeleton(),
        history: [],
        catalog_summary: input.catalog_summary,
        business_context: input.business_context
      };

      const request = options.request_factory(titleTurn);
      request.payload = withTitleNamingPayload(request.payload, input.first_user_messages);

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
        throw new Error(`${options.provider} title request failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      const textPayload = extractTextPayload(payload);
      if (!textPayload) {
        throw new Error("Unable to parse provider title response.");
      }

      return { title: sanitizeConversationTitle(textPayload) };
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
    async respond(input: ConversationTurnInput): Promise<ConversationResponse> {
      try {
        return await remote.respond(input);
      } catch {
        return fallback.respond(input);
      }
    },
    async nameConversation(input: ConversationTitleInput): Promise<ConversationTitleResponse> {
      if (!remote.nameConversation || !fallback.nameConversation) {
        return { title: buildDeterministicConversationTitle(input.first_user_messages) };
      }
      try {
        return await remote.nameConversation(input);
      } catch {
        return fallback.nameConversation(input);
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
  const nowUtcIso = new Date().toISOString();
  const lines = [
    `CURRENT UTC DATE/TIME: ${nowUtcIso}`,
    `Report timezone: ${input.state.draft.timezone || "UTC"}`,
    "Treat CURRENT UTC DATE/TIME as 'today' for relative ranges unless the user gives an explicit anchor date.",
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
    "PRE-ANALYSIS CONVERSATION (VERY IMPORTANT):",
    "When the user asks for a report or analysis, DO NOT immediately suggest running it. Instead, have a thorough conversation (5-15 messages) to nail down exactly what they need. Work through these topics naturally over multiple turns:",
    "1. WHAT to analyze: Which metrics, dimensions, and data points matter? Suggest options from the catalog.",
    "2. TIME SCOPE: What date range? Last 30 days, this quarter, this year? Confirm which date/timestamp columns to use.",
    "3. COMPARISONS: Should we compare against a previous period? QoQ, YoY, MoM? Compare regions, channels, segments? Suggest relevant comparisons based on the data shape.",
    "4. CONTROL SETS: Any parallel data to pull alongside? Benchmarks, industry averages, targets? Any dimensions to split by?",
    "5. FOCUS AREAS: What's the user most concerned about? Revenue trends? Data quality? Anomaly detection? Operational efficiency?",
    "6. AUDIENCE: Who will read this? Infer from the conversation — don't ask directly.",
    "Don't ask all of these at once. Bring them up naturally across multiple messages as the conversation evolves. Be a thoughtful collaborator, not a checklist.",
    "Only when scope is clearly defined and the user signals approval should you suggest moving to execution using the button flow.",
    "NEVER proactively suggest running until you've discussed at least the time scope and comparison approach.",
    "If the user asks multiple analysis questions, break them into numbered items (Q1, Q2, Q3). Keep planning and discussion isolated question-by-question.",
    "Do not blend multiple questions into one plan explanation. Confirm each question's timeline and comparison logic separately before execution.",
    "",
    "HOW THE SYSTEM WORKS:",
    "The system detects actions from the user's message (save, run, query, draft updates) and executes them automatically.",
    "The ACTION CONTEXT in the user prompt shows what happened. Incorporate results naturally — don't repeat raw IDs or JSON, interpret them for the user.",
    "When ACTION CONTEXT includes data-preparation warnings/notes, explicitly explain each issue, what auto-correction ran, and the exact validation evidence (expected vs observed months, missing months, monthly totals preview).",
    "Do not use vague phrasing like 'minor hiccup'; be concrete and traceable.",
    "Treat ACTION CONTEXT as execution truth. If it says no action was executed, never claim a query or report is running or completed.",
    "Execution is decision-driven. When ACTION CONTEXT shows a pending decision, acknowledge the wait state and do not tell the user to click buttons or type command words.",
    "Data preparation and analysis run question-by-question behind the scenes. Reflect that clearly in your responses when relevant.",
    "If no action was taken, you're just having a conversation. Answer naturally using the catalog and business context below.",
    "",
    "SCOPE CONFIRMATION SIGNAL (critical):",
    "- When you have finished confirming the report scope and the user should proceed to data preparation,",
    "  you MUST include the exact phrase 'scope is locked' in your response — the interface uses this to",
    "  display the action button. Without it, the button will not appear.",
    "  Example ending: 'Scope is locked — here is the confirmed plan: ...'",
    "",
    "BUTTON NAMES (never invent names that differ from these):",
    "- When data preparation is pending: button is 'Run Data Preparation'.",
    "- When analysis run is pending (after prep completes): button is 'Finish scoping and run analysis'.",
    "- IMPORTANT: When any pending decision is active, do NOT name any button — they are already visible to the user. Just describe what will happen next.",
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
    "",
    "DRAFT UPDATE PROTOCOL:",
    "After your conversational reply, you MAY optionally append a structured draft update block.",
    "Use it ONLY when you have genuinely resolved a draft field from the conversation — not on every turn.",
    "Do NOT use it for greetings, questions, or exploratory discussion.",
    "Do NOT invent table or column names. Only use qualified table names (schema.table) and column names from the DATABASE CATALOG above.",
    "",
    "Format (append AFTER your reply text, separated by a blank line):",
    "<<<DRAFT_UPDATES>>>",
    '{"metric_ids":["metric_refunds"],"dimension_ids":["product_category"],"allowed_relations":["public.orders"]}',
    "<<<END_DRAFT_UPDATES>>>",
    "",
    "Supported fields: name, audience, timezone, schedule_cron (cron string or null), sql_template (SELECT only), metric_ids (array), dimension_ids (array), allowed_relations (array of schema.table), allowed_schemas (array), insight_mode (\"business\" or \"data\").",
    "Only include fields that genuinely changed based on the conversation. Omit unchanged fields.",
    "When you update allowed_relations, derive allowed_schemas from the schema prefix of each relation automatically.",
    "The structured block is machine-parsed and hidden from the user — your conversational reply above it is all they see.",
    "",
    "SCHEDULING:",
    "When the user asks to schedule, automate, or set up recurring runs of this report:",
    "1. Confirm your understanding: what frequency (weekly/monthly/quarterly), what day/time, timezone.",
    "2. Ask about KPI thresholds if the user mentions alerts (e.g. 'alert me if revenue drops below $1M').",
    "3. End your response with a <<<SCHEDULE_PARAMS>>> block (after your reply text):",
    "<<<SCHEDULE_PARAMS>>>",
    '{"frequency":"weekly","day_of_week":1,"hour_utc":9,"minute_utc":0,"timezone":"UTC","kpi_watchlist":[{"metric_key":"revenue","display_name":"Revenue","threshold_value":1000000,"direction":"below","alert_message":"Revenue dropped below $1M"}]}',
    "<<<END_SCHEDULE_PARAMS>>>",
    "",
    "Fields: frequency (weekly|monthly|quarterly), day_of_week (0=Sun...6=Sat, weekly only), day_of_month (1-28, monthly/quarterly), hour_utc (0-23), minute_utc (0-59), timezone (IANA string), kpi_watchlist (array, may be empty).",
    "Do NOT say 'I have scheduled it' — the user will confirm with a button. Only describe what you understood and present the <<<SCHEDULE_PARAMS>>> block."
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
      allowed_relations: input.state.draft.allowed_relations,
      allowed_schemas: input.state.draft.allowed_schemas,
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
      what_to_do: input.state.last_exec_brief.what_to_do
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

function withTitleNamingPayload(
  providerPayload: Record<string, unknown>,
  firstUserMessages: string[]
): Record<string, unknown> {
  const cleanedMessages = firstUserMessages
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 2);

  const titlePrompt = titleNamingPrompt(cleanedMessages);

  if (Array.isArray(providerPayload.input)) {
    return {
      ...providerPayload,
      input: [
        {
          role: "system",
          content: [{ type: "text", text: titleNamingSystemPrompt() }]
        },
        {
          role: "user",
          content: [{ type: "text", text: titlePrompt }]
        }
      ],
      temperature: 0
    };
  }

  if (Array.isArray(providerPayload.messages)) {
    return {
      ...providerPayload,
      messages: [
        { role: "system", content: titleNamingSystemPrompt() },
        { role: "user", content: titlePrompt }
      ],
      temperature: 0
    };
  }

  return providerPayload;
}

function titleNamingSystemPrompt(): string {
  return [
    "You are the chat naming agent for Project Overload.",
    "Generate a concise conversation title from the first one or two user messages.",
    "Rules:",
    "- Return only the title text.",
    "- 2 to 6 words.",
    "- No quotes, markdown, emoji, or punctuation at the end.",
    "- Use clear business language."
  ].join("\n");
}

function titleNamingPrompt(messages: string[]): string {
  if (messages.length === 0) {
    return "User messages:\n1) (none)";
  }

  return [
    "User messages:",
    ...messages.map((entry, index) => `${index + 1}) ${entry}`),
    "Return only the title."
  ].join("\n");
}

function sanitizeConversationTitle(raw: string): string {
  const normalized = raw
    .replace(/[\r\n]+/g, " ")
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length === 0) {
    return "New Chat";
  }

  const capped = normalized.slice(0, 64).trim();
  if (capped.length === 0) {
    return "New Chat";
  }

  return capped;
}

function createTitleStateSkeleton() {
  return {
    draft: {
      name: "",
      audience: "Executive",
      timezone: "UTC",
      schedule_cron: null,
      sql_template: "SELECT * FROM analytics.sales",
      metric_ids: ["metric_revenue"],
      dimension_ids: ["region"],
      allowed_relations: ["analytics.sales"],
      allowed_schemas: ["analytics"],
      insight_mode: "business" as const
    },
    contract_id: null,
    last_run_id: null,
    last_query_id: null,
    last_exec_brief: null,
    conversation_history: [],
    prep_pending: false,
    prep_complete: false,
    scope_pending: false,
    metric_definitions: [],
    pending_metric_confirmations: [],
    pending_metric_resume_message: null,
    pending_metric_resume_mode: null,
    scope_clarification_pending: false,
    scope_source_prompt: null,
    scope_questions: [],
    pending_query_sql: null,
    pending_query_limit: null,
    pending_single_query_request: null,
    last_single_query_snapshot: null,
    single_query_log: [],
    planner_summary: null,
    preparation_summary: null,
    prepared_payloads: [],
    awaiting_pdf_confirmation: false,
    awaiting_post_run_refinement: false,
    refinement_active: false,
    refinement_questions_remaining: 0,
    awaiting_save_confirmation: false,
    awaiting_schedule_confirmation: false,
    awaiting_schedule_mode_selection: false,
    schedule_mode_pending: null,
    schedule_day_kind: null,
    awaiting_custom_day_input: false,
    schedule_pending: false,
    pending_schedule: null,
    last_concise_summary: null,
    pending_run_id: null,
    last_token_usage: null
  };
}

export function buildDeterministicConversationTitle(firstUserMessages: string[]): string {
  const joined = firstUserMessages
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 2)
    .join(" ");

  if (joined.length === 0) {
    return "New Chat";
  }

  const cleaned = joined
    .replace(/[\r\n]+/g, " ")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) {
    return "New Chat";
  }

  const words = cleaned.split(" ").slice(0, 6);
  const title = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .trim();

  return title.length > 0 ? title : "New Chat";
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

const DRAFT_OPEN_FENCE = "<<<DRAFT_UPDATES>>>";
const DRAFT_CLOSE_FENCE = "<<<END_DRAFT_UPDATES>>>";

export function parseLlmResponse(raw: string): ConversationResponse {
  const fenceStart = raw.indexOf(DRAFT_OPEN_FENCE);
  if (fenceStart === -1) {
    return { message: raw };
  }

  const message = raw.slice(0, fenceStart).trim();
  const after = raw.slice(fenceStart + DRAFT_OPEN_FENCE.length);
  const fenceEnd = after.indexOf(DRAFT_CLOSE_FENCE);

  if (fenceEnd === -1) {
    return { message: raw.replace(DRAFT_OPEN_FENCE, "").trim() };
  }

  const jsonStr = after.slice(0, fenceEnd).trim();

  try {
    const rawUpdates = JSON.parse(jsonStr) as unknown;
    const draft_updates = validateDraftUpdates(rawUpdates);
    return { message: message.length > 0 ? message : "Draft updated.", draft_updates };
  } catch {
    return { message: message.length > 0 ? message : raw.replace(DRAFT_OPEN_FENCE, "").replace(DRAFT_CLOSE_FENCE, "").replace(jsonStr, "").trim() };
  }
}

export function validateDraftUpdates(raw: unknown): DraftUpdates | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }

  const obj = raw as Record<string, unknown>;
  const updates: DraftUpdates = {};
  let hasUpdates = false;

  if (typeof obj.name === "string" && obj.name.trim().length > 0) {
    updates.name = obj.name.trim();
    hasUpdates = true;
  }

  if (typeof obj.audience === "string" && obj.audience.trim().length > 0) {
    updates.audience = obj.audience.trim();
    hasUpdates = true;
  }

  if (typeof obj.timezone === "string" && obj.timezone.trim().length > 0) {
    updates.timezone = obj.timezone.trim();
    hasUpdates = true;
  }

  if ("schedule_cron" in obj) {
    if (obj.schedule_cron === null) {
      updates.schedule_cron = null;
      hasUpdates = true;
    } else if (typeof obj.schedule_cron === "string") {
      updates.schedule_cron = obj.schedule_cron;
      hasUpdates = true;
    }
  }

  if (typeof obj.sql_template === "string" && /^\s*(select|with)\b/i.test(obj.sql_template)) {
    updates.sql_template = obj.sql_template.trim();
    hasUpdates = true;
  }

  for (const arrField of ["metric_ids", "dimension_ids", "allowed_relations", "allowed_schemas"] as const) {
    if (Array.isArray(obj[arrField]) && (obj[arrField] as unknown[]).every((x) => typeof x === "string")) {
      const cleaned = (obj[arrField] as string[]).map((s) => s.trim()).filter((s) => s.length > 0);
      if (cleaned.length > 0) {
        updates[arrField] = cleaned;
        hasUpdates = true;
      }
    }
  }

  if (obj.insight_mode === "business" || obj.insight_mode === "data") {
    updates.insight_mode = obj.insight_mode;
    hasUpdates = true;
  }

  return hasUpdates ? updates : undefined;
}
