import type { ChatHistoryTurn, ChatState } from "./chat";
import {
  ConversationOrchestratorDecisionSchema,
  type ConversationOrchestratorDecision
} from "@project-overload/shared";

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
  /** Structured context from action execution to keep responses grounded in actual run state. */
  action_context: string;
  state: ChatState;
  history: ChatHistoryTurn[];
  catalog_summary?: string;
  business_context?: string;
  retrieved_context?: Array<{ source: string; label: string; text: string }>;
};

export type ConversationOrchestratorInput = {
  user_message: string;
  state: ChatState;
  history: ChatHistoryTurn[];
  catalog_summary?: string;
  business_context?: string;
  retrieved_context?: Array<{ source: string; label: string; text: string }>;
};

type RetrievalSource =
  | "user_message"
  | "history"
  | "scope_question"
  | "pending_input"
  | "question_registry"
  | "single_query_log"
  | "prepared_payload"
  | "planner_summary"
  | "preparation_summary"
  | "business_context"
  | "catalog_summary"
  | "draft_state";

type RetrievalChunk = {
  source: RetrievalSource;
  label: string;
  text: string;
};

type ScoredRetrievalChunk = RetrievalChunk & {
  score: number;
};

export interface ConversationClient {
  provider: ConversationProvider;
  mode: "provider";
  respond(input: ConversationTurnInput): Promise<ConversationResponse>;
  orchestrateTurn?(input: ConversationOrchestratorInput): Promise<ConversationOrchestratorDecision>;
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
  rag_level?: 1 | 2;
  rag_candidate_limit?: number;
  rag_final_limit?: number;
  openrouter_embedding_model?: string;
  openrouter_rerank_model?: string;
  timeout_ms?: number;
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
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-5.2";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const DEFAULT_OPENROUTER_RERANK_MODEL = "openai/gpt-4.1-mini";

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

export function createPassthroughConversationClient(): ConversationClient {
  return {
    provider: "stub",
    mode: "provider",
    async respond(input: ConversationTurnInput): Promise<ConversationResponse> {
      return { message: input.action_context };
    },
    async nameConversation(input: ConversationTitleInput): Promise<ConversationTitleResponse> {
      return { title: buildDeterministicConversationTitle(input.first_user_messages) };
    },
    async orchestrateTurn(input: ConversationOrchestratorInput): Promise<ConversationOrchestratorDecision> {
      const pendingInputs = extractPendingInputsFromState(input.state);
      return ConversationOrchestratorDecisionSchema.parse({
        intent_parts: [
          {
            type: "other",
            text: input.user_message
          }
        ],
        resolved_scope_answers: [],
        new_scope_questions: [],
        follow_up_requests: [],
        pending_inputs: pendingInputs,
        next_owner: pendingInputs.length > 0 ? "wait_for_user" : "conversation_orchestrator",
        tool_calls: [],
        state_updates: {
          mark_scope_complete: false,
          append_new_questions: false,
          clear_pending_inputs: false,
          summary: pendingInputs.length > 0
            ? "Pending clarifications remain before planning."
            : "Stub orchestrator passthrough."
        }
      });
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
      : parseBoolean(process.env.WEB_CHAT_REQUIRE_PROVIDER ?? "true");

  const timeoutFromEnv = Number.parseInt(process.env.LLM_TIMEOUT_MS ?? "", 10);
  const ragLevelEnv = Number.parseInt(process.env.WEB_RAG_LEVEL ?? "", 10);
  const ragCandidateLimitEnv = Number.parseInt(process.env.WEB_RAG_CANDIDATE_LIMIT ?? "", 10);
  const ragFinalLimitEnv = Number.parseInt(process.env.WEB_RAG_FINAL_LIMIT ?? "", 10);
  const defaultRagLevel: 1 | 2 = isTestRuntime() ? 1 : 2;
  const ragLevel = clampRagLevel(overrides.rag_level ?? (Number.isNaN(ragLevelEnv) ? defaultRagLevel : ragLevelEnv));
  const ragCandidateLimit = clampRagCount(
    overrides.rag_candidate_limit ?? (Number.isNaN(ragCandidateLimitEnv) ? 24 : ragCandidateLimitEnv),
    8,
    64,
    24
  );
  const ragFinalLimit = clampRagCount(
    overrides.rag_final_limit ?? (Number.isNaN(ragFinalLimitEnv) ? 16 : ragFinalLimitEnv),
    4,
    32,
    16
  );

  const options: CreateConversationClientOptions = {
    provider,
    openai_api_key: overrides.openai_api_key ?? process.env.OPENAI_API_KEY,
    openrouter_api_key: overrides.openrouter_api_key ?? process.env.OPENROUTER_API_KEY,
    openrouter_base_url: overrides.openrouter_base_url ?? process.env.OPENROUTER_BASE_URL,
    openrouter_app_name: overrides.openrouter_app_name ?? process.env.OPENROUTER_APP_NAME,
    openrouter_app_url: overrides.openrouter_app_url ?? process.env.OPENROUTER_APP_URL,
    openai_model: overrides.openai_model ?? process.env.OPENAI_MODEL,
    openrouter_model: overrides.openrouter_model ?? process.env.CONVERSATION_MODEL ?? process.env.MODEL_GPT,
    rag_level: ragLevel,
    rag_candidate_limit: ragCandidateLimit,
    rag_final_limit: ragFinalLimit,
    openrouter_embedding_model:
      overrides.openrouter_embedding_model ?? process.env.OPENROUTER_EMBEDDING_MODEL,
    openrouter_rerank_model:
      overrides.openrouter_rerank_model ?? process.env.OPENROUTER_RERANK_MODEL,
    timeout_ms: overrides.timeout_ms ?? (Number.isNaN(timeoutFromEnv) ? undefined : timeoutFromEnv),
    require_provider: requireProvider,
    fetch_impl: overrides.fetch_impl
  };

  return createConversationClient(options);
}

export function createConversationClient(options: CreateConversationClientOptions): ConversationClient {
  const provider = options.provider ?? "openrouter";
  const timeoutMs = options.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const requireProvider = options.require_provider ?? false;
  const fetcher = options.fetch_impl ?? fetch;
  const runtimeDefaultRagLevel: 1 | 2 = isTestRuntime() ? 1 : 2;

  if (provider === "stub") {
    throw new Error("LLM provider 'stub' is disabled in runtime. Set LLM_PROVIDER=openrouter or openai.");
  }

  if (provider === "openai") {
    if (!options.openai_api_key) {
      throw new Error(
        requireProvider
          ? "WEB_CHAT_REQUIRE_PROVIDER is true but OPENAI_API_KEY is missing."
          : "OPENAI_API_KEY is missing for provider=openai."
      );
    }

    return createRemoteConversationClient({
      provider,
      fetcher,
      timeout_ms: timeoutMs,
      request_factory: (input) => buildOpenAiRequest(input, options),
      rag_level: options.rag_level ?? runtimeDefaultRagLevel,
      rag_candidate_limit: options.rag_candidate_limit ?? 24,
      rag_final_limit: options.rag_final_limit ?? 16
    });
  }

  if (!options.openrouter_api_key) {
    throw new Error(
      requireProvider
        ? "WEB_CHAT_REQUIRE_PROVIDER is true but OPENROUTER_API_KEY is missing."
        : "OPENROUTER_API_KEY is missing for provider=openrouter."
    );
  }

  return createRemoteConversationClient({
    provider: "openrouter",
    fetcher,
    timeout_ms: timeoutMs,
    request_factory: (input) => buildOpenRouterRequest(input, options),
    rag_level: options.rag_level ?? runtimeDefaultRagLevel,
    rag_candidate_limit: options.rag_candidate_limit ?? 24,
    rag_final_limit: options.rag_final_limit ?? 16,
    openrouter_api_key: options.openrouter_api_key,
    openrouter_base_url: options.openrouter_base_url ?? DEFAULT_OPENROUTER_BASE_URL,
    openrouter_app_name: options.openrouter_app_name,
    openrouter_app_url: options.openrouter_app_url,
    openrouter_embedding_model:
      options.openrouter_embedding_model ?? DEFAULT_OPENROUTER_EMBEDDING_MODEL,
    openrouter_rerank_model:
      options.openrouter_rerank_model ?? DEFAULT_OPENROUTER_RERANK_MODEL
  });
}

type RemoteConversationClientOptions = {
  provider: "openai" | "openrouter";
  fetcher: Fetcher;
  timeout_ms: number;
  request_factory: (input: ConversationTurnInput) => ProviderRequest;
  rag_level: 1 | 2;
  rag_candidate_limit: number;
  rag_final_limit: number;
  openrouter_api_key?: string;
  openrouter_base_url?: string;
  openrouter_app_name?: string;
  openrouter_app_url?: string;
  openrouter_embedding_model?: string;
  openrouter_rerank_model?: string;
};

function createRemoteConversationClient(
  options: RemoteConversationClientOptions
): ConversationClient {
  async function requestText(input: ConversationTurnInput): Promise<string> {
    const retrievedContext = await resolveRetrievedContextForTurn(input, options, "chat");
    const request = options.request_factory({
      ...input,
      retrieved_context: retrievedContext
    });

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
    },
    async orchestrateTurn(input: ConversationOrchestratorInput): Promise<ConversationOrchestratorDecision> {
      const orchestrationTurn: ConversationTurnInput = {
        user_message: input.user_message,
        action_context: "",
        state: input.state,
        history: input.history,
        catalog_summary: input.catalog_summary,
        business_context: input.business_context,
        retrieved_context: input.retrieved_context
      };
      const retrievedContext = await resolveRetrievedContextForTurn(
        orchestrationTurn,
        options,
        "orchestrator"
      );
      const orchestrationWithContext: ConversationTurnInput = {
        ...orchestrationTurn,
        retrieved_context: retrievedContext
      };
      const request = options.request_factory(orchestrationWithContext);
      request.payload = withOrchestratorPayload(request.payload, orchestrationWithContext);

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
        throw new Error(`${options.provider} orchestrator request failed (${response.status}): ${text}`);
      }

      const payload = (await response.json()) as unknown;
      const textPayload = extractTextPayload(payload);
      if (!textPayload) {
        throw new Error("Unable to parse provider orchestrator response.");
      }

      console.log("[orchestrator] raw text (first 500 chars):", textPayload.slice(0, 500));
      const parsed = parseJsonObjectFromText(textPayload);
      const normalized = normalizeOrchestratorDecisionPayload(parsed, input.user_message);
      return ConversationOrchestratorDecisionSchema.parse(normalized);
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
    "If the user asks multiple analysis questions, break them into numbered items (Q1, Q2, Q3). Each question must be ATOMIC — one clear analytical ask.",
    "NEVER combine a trend + comparison into one question. NEVER combine a breakdown + correlation into one question.",
    "Example: 'refund trend over 4 months and compare latest 2 vs prior 2' → Q1: monthly refund trend (4 months), Q2: 2-month comparison (latest vs prior).",
    "Do not blend multiple questions into one plan explanation. Confirm each question's timeline and comparison logic separately before execution.",
    "The user can add new questions, modify existing ones, or change direction at ANY point during scoping. Always respect their latest instruction.",
    "",
    "SCOPE CLARIFICATION STYLE (CRITICAL):",
    "When presenting scope clarifications, NEVER ask the user to reply with numbered answers like 'Q1: ... Q2: ...'.",
    "Instead, present the clarifications naturally and let the user answer however they want — in a single sentence, bullet points, or conversational text.",
    "You should map their natural language answers to the right scope questions.",
    "If the user says 'confirm all', 'ok with everything', 'defaults are fine', 'yes to all', or similar — accept all proposed defaults.",
    "Always suggest 1-2 additional questions that could add value based on the available data and business context.",
    "The user can add new questions at any time during clarification just by asking.",
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
  const retrievedContext =
    input.retrieved_context ?? buildRetrievedContextForTurn(input, { max_chunks: 14 });

  return [
    "Conversation history:",
    history.length > 0 ? history : "(new conversation)",
    "",
    "RETRIEVED_CONTEXT_FOR_THIS_TURN:",
    retrievedContext.length > 0
      ? JSON.stringify(retrievedContext, null, 2)
      : "(none)",
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

function withOrchestratorPayload(
  providerPayload: Record<string, unknown>,
  input: ConversationTurnInput
): Record<string, unknown> {
  const system = orchestrationSystemPrompt(input);
  const user = orchestrationUserPrompt(input);

  if (Array.isArray(providerPayload.input)) {
    return {
      ...providerPayload,
      input: [
        {
          role: "system",
          content: [{ type: "text", text: system }]
        },
        {
          role: "user",
          content: [{ type: "text", text: user }]
        }
      ],
      temperature: 0
    };
  }

  if (Array.isArray(providerPayload.messages)) {
    return {
      ...providerPayload,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    };
  }

  return providerPayload;
}

function orchestrationSystemPrompt(input: ConversationTurnInput): string {
  const nowUtcIso = new Date().toISOString();
  return [
    "You are the Conversation Orchestrator for Project Overload.",
    `CURRENT UTC DATE/TIME: ${nowUtcIso}`,
    `Report timezone: ${input.state.draft.timezone || "UTC"}`,
    "Treat CURRENT UTC DATE/TIME as 'today' for relative windows unless the user explicitly anchors a date.",
    "Decide the next owner/tool call for this turn and return STRICT JSON.",
    "You must process mixed intent in one message: new questions + clarifications + follow-ups can coexist.",
    "Never use context from other conversations.",
    "Use only this chat's structured state and recent turns.",
    "Use RETRIEVED_CONTEXT_FOR_THIS_TURN as the primary grounding context for this decision.",
    "If a follow-up requires new data, emit it as a new scoped question (do not overwrite prior questions).",
    "",
    "THREE-WAY ROUTING (CRITICAL):",
    "You MUST route every user message to exactly one of these three workflows:",
    "",
    "Route 1 — single_query_agent (DEFAULT for most questions):",
    "  ANY factual question answerable with ONE SQL query. This is the DEFAULT route.",
    "  When in doubt between single_query_agent and query_planning_agent, ALWAYS choose single_query_agent.",
    "  Examples: 'total sales for Feb 2026', 'top 10 customers', 'how many refunds last month',",
    "           'average order value by city', 'show me the top 10 customers',",
    "           'sales for december 2025', 'split by order status', 'break it down by city',",
    "           'what was the revenue last quarter', 'count of orders by category'",
    "  Follow-ups on single query results (e.g. 'split by status', 'break it down', 'filter by X',",
    "    'what about by city', 'exclude cancelled') are ALSO single_query_agent.",
    "  Set next_owner='single_query_agent'. MUST NOT create new_scope_questions or pending_inputs.",
    "",
    "  MULTI-PART SINGLE QUERY MESSAGES:",
    "  When a user message contains MULTIPLE distinct parts (e.g. 'include paid and shipped. Also break down by top 3 cities'),",
    "  create SEPARATE intent_parts for each part with the CORRECT type:",
    "    - If the user is ANSWERING a previous clarification question, tag that part as type='clarification_answer'.",
    "      Example: 'give me delivered shipped and paid' when answering 'which statuses?' → type='clarification_answer'",
    "    - Any ADDITIONAL asks beyond the clarification answer should be type='follow_up_request' or type='new_question'.",
    "      Example: 'but can you break it down for top 3 cities' → type='follow_up_request'",
    "  The system will execute the clarification answer (completing the original query) FIRST,",
    "  then confirm before running any follow-up asks.",
    "  Each intent_part.text should be a self-contained description of that specific part.",
    "  IMPORTANT: If there are 3 or more distinct NEW asks (not counting clarification answers), the system will automatically escalate to deep diagnostic mode.",
    "",
    "Route 2 — data_architect_agent:",
    "  Questions ABOUT the data itself: schema, tables, columns, data availability, analytical advice.",
    "  Examples: 'what tables are available?', 'what columns does orders have?',",
    "           'until when is data available?', 'which table should I use for churn analysis?',",
    "           'how should I analyze refund trends?', 'can you create a view for X?',",
    "           'if I want to add a new table what columns should I consider?',",
    "           'what is the best way to query refund data?'",
    "  Set next_owner='data_architect_agent'. MUST NOT create new_scope_questions or pending_inputs.",
    "",
    "Route 3 — query_planning_agent (deep diagnostics):",
    "  ONLY for complex multi-part analysis that EXPLICITLY needs multiple queries, trends with comparisons,",
    "  or when the user EXPLICITLY requests 'deep analysis', 'detailed report', 'comprehensive analysis',",
    "  'deep diagnostics', 'full report', or similar phrases indicating they want a multi-query diagnostic report.",
    "  Examples: 'give me a comprehensive refund analysis with trends and comparisons',",
    "           'I want a detailed diagnostic report on sales performance',",
    "           'compare Q1 vs Q2 sales performance across regions with trend analysis',",
    "           'deep dive into customer churn drivers'",
    "  Do NOT route here for simple questions like 'sales for december' or 'split by status' — those are single_query_agent.",
    "  Set next_owner='query_planning_agent'. Create new_scope_questions as needed.",
    "",
    "ESCALATION PROTECTION:",
    "  NEVER auto-escalate from single_query_agent to query_planning_agent.",
    "  After a single query result, follow-up questions like 'split by X', 'break down by Y',",
    "  'exclude Z', 'what about by city' are ALL single_query_agent — NOT deep diagnostics.",
    "  Only switch to query_planning_agent if the user EXPLICITLY asks for deep analysis/report.",
    "",
    "QUERY CONTEXT AWARENESS:",
    "  The STRUCTURED_STATE includes recent_single_queries with the actual SQL that was executed.",
    "  When the user asks about a previous query result (e.g. 'is this only paid sales?',",
    "  'what filters were used?', 'does this include cancelled orders?'), route to data_architect_agent",
    "  which can give a DEFINITIVE answer based on the actual SQL. NEVER say 'it would only be X if...'",
    "  — look at the SQL and tell the user exactly what was queried.",
    "",
    "Route to wait_for_user for greetings, chitchat, or when awaiting user input on scope questions.",
    "",
    "MID-CONVERSATION SWITCHING:",
    "Route each message independently based on its CURRENT intent, regardless of previous workflow.",
    "A user may ask a data architect question, then a single query, then request deep analysis — all in one chat.",
    "Always route based on what the user is asking NOW.",
    "",
    "QUESTION DECOMPOSITION (for deep analysis only):",
    "Every scope question must be ATOMIC — one clear analytical ask per question.",
    "If the user's message contains multiple analytical asks, SPLIT them into separate new_scope_questions.",
    "Example: user says '4-month refund trend + compare latest 2 months vs prior 2 months'",
    "  → Q1: 'What is the monthly refund trend over the past 4 months (refund count and refund value per month)?'",
    "  → Q2: 'How do refunds in the most recent 2 months compare to the prior 2 months (count, value, and % change)?'",
    "NEVER combine a trend question with a comparison question. NEVER combine a breakdown with a correlation question.",
    "Each question should be answerable by a single focused SQL query or small group of related queries.",
    "",
    "QUESTION FORMATTING:",
    "ALWAYS rephrase the user's words into a clean analytical question ending with '?'.",
    "Never copy raw user text into question_text.",
    "",
    "SCOPE MODIFICATIONS:",
    "When the user modifies existing questions (e.g. 'use refund value instead of order count for Q1'), emit resolved_scope_answers with the updated parameters — do NOT create a duplicate question.",
    "When the user adds NEW questions during clarification, emit them as new_scope_questions alongside any resolved_scope_answers.",
    "When the user wants to REPLACE or REMOVE a question, use resolved_scope_answers to update the answer to reflect the change.",
    "The user can change direction at ANY point — always respect their latest instruction even if it contradicts earlier scope.",
    "",
    "NATURAL ANSWER PARSING (CRITICAL):",
    "Users will answer scope clarifications in natural language — NOT in numbered `Q1: ... Q2: ...` format.",
    "You MUST extract answers from conversational text. Examples:",
    "  - User: 'last 4 complete months, exclude cancelled orders, top 10 is fine' → map each clause to the relevant scope question.",
    "  - User: 'confirm all' / 'ok with everything' / 'defaults are fine' / 'yes to all' → confirm ALL pending scope items with their proposed defaults.",
    "  - User: 'yes but change Q3 to use refund value instead' → confirm all except Q3, which gets the updated answer.",
    "CRITICAL: Proposed defaults are NOT confirmed answers.",
    "Only emit resolved_scope_answers when the user explicitly confirms or provides an answer for that question.",
    "Never auto-fill unresolved items simply because a default exists.",
    "When the user gives a blanket confirmation ('confirm all', 'looks good', 'ok with everything', 'yes to all', 'defaults are fine'),",
    "  emit resolved_scope_answers for EVERY unanswered scope question with the proposed default as the answer.",
    "If the user has NOT confirmed all pending items, keep unresolved items unresolved and request only those missing confirmations.",
    "Do not set state_updates.mark_scope_complete=true unless every pending scope item is resolved.",
    "NEVER ask the user to reply with numbered answers. NEVER suggest a format like `1) ... 2) ... 3) ...`.",
    "Accept answers in any conversational form and map them to the right scope questions.",
    "",
    "SAVED METRIC DEFINITIONS (CRITICAL — READ BEFORE GENERATING QUESTIONS):",
    "The user prompt may include RELEVANT_METRIC_DEFINITIONS_FROM_DB_FOR_THIS_USER with metric formulas loaded from DB.",
    "When ANY scope question or clarification references a metric that exists in RELEVANT_METRIC_DEFINITIONS_FROM_DB_FOR_THIS_USER,",
    "you MUST use the EXACT definition from that saved entry. NEVER invent your own formula.",
    "Example: if RELEVANT_METRIC_DEFINITIONS_FROM_DB_FOR_THIS_USER contains {metric_key:'refund_rate', definition:'refunded revenue / total revenue'},",
    "then every mention of 'refund rate' in scope questions MUST use 'refunded revenue / total revenue' — NOT 'refunded orders / total orders' or any other formula.",
    "Include the saved definition in the clarification field so the user can see it: 'Using saved metric: Refund Rate = refunded revenue / total revenue'.",
    "",
    "QUESTION SUGGESTIONS:",
    "You MAY add up to 1 suggested question on the first deep-analysis scope turn if it adds clear value.",
    "Do NOT add suggested questions during ongoing clarification unless the user explicitly asks for additional ideas.",
    "Prefix suggested question_text with '[Suggested] '.",
    "The user can accept, modify, or ignore suggested questions.",
    "",
    "Prefer safe default assumptions first (timeline anchor, top-N, standard metric formula) and propose them explicitly.",
    "Do NOT treat defaults as confirmed unless the user confirms them.",
    "Only ask pending_inputs when ambiguity would materially change the answer.",
    "If pending scope items remain, keep next_owner=wait_for_user and include pending_inputs.",
    "",
    "Output schema:",
    '{"intent_parts":[{"type":"new_question|clarification_answer|follow_up_request|duplicate|chitchat|other","text":"...","question_ref":"Q1?"}],"resolved_scope_answers":[{"question_number":1,"answer":"..."}],"new_scope_questions":[{"question_text":"...","clarification":"...","reason":"..."}],"follow_up_requests":[{"question_text":"...","requires_new_data":true,"grounded_in_existing_payload":false,"referenced_question_ids":["q1"]}],"pending_inputs":[{"input_key":"...","prompt":"...","reason":"...","question_number":1}],"next_owner":"conversation_orchestrator|single_query_agent|data_architect_agent|query_planning_agent|data_prep_orchestrator|batch_analyst|super_summary|report_composer|qa|wait_for_user","tool_calls":[{"tool_name":"...","reason":"...","payload":{}}],"state_updates":{"mark_scope_complete":false,"append_new_questions":false,"clear_pending_inputs":false,"summary":"..."}}',
    "",
    `Current timezone: ${input.state.draft.timezone || "UTC"}`,
    "Only ask pending_inputs when ambiguity is high-impact and cannot be safely handled with standard assumptions.",
    "",
    "REMINDER: For query_planning_agent routes, new_scope_questions MUST include [Suggested] questions. Output ONLY the JSON object — no markdown, no explanation."
  ].join("\n");
}

function orchestrationUserPrompt(input: ConversationTurnInput): string {
  const recentHistory = serializeHistory(input.history);
  const retrievedContext =
    input.retrieved_context ?? buildRetrievedContextForTurn(input, { max_chunks: 16 });
  const relevantMetricDefinitions = selectRelevantMetricDefinitions(
    input.state.metric_definitions ?? [],
    input.user_message,
    input.history
  );
  const scopeQuestions = input.state.scope_questions
    .map((entry) => ({
      question_number: entry.question_number,
      question: entry.question,
      clarification: entry.clarification,
      answer: entry.answer ?? null
    }))
    .slice(-20);

  return [
    "USER_MESSAGE:",
    input.user_message,
    "",
    "RELEVANT_METRIC_DEFINITIONS_FROM_DB_FOR_THIS_USER:",
    relevantMetricDefinitions.length > 0
      ? JSON.stringify(relevantMetricDefinitions, null, 2)
      : "(none matched in this turn)",
    "",
    "RECENT_CHAT_HISTORY:",
    recentHistory.length > 0 ? recentHistory : "(empty)",
    "",
    "RETRIEVED_CONTEXT_FOR_THIS_TURN:",
    retrievedContext.length > 0
      ? JSON.stringify(retrievedContext, null, 2)
      : "(none)",
    "",
    "STRUCTURED_STATE:",
    JSON.stringify(
      {
        draft: {
          name: input.state.draft.name,
          audience: input.state.draft.audience,
          timezone: input.state.draft.timezone,
          insight_mode: input.state.draft.insight_mode,
          metric_ids: input.state.draft.metric_ids,
          dimension_ids: input.state.draft.dimension_ids,
          allowed_relations: input.state.draft.allowed_relations,
          allowed_schemas: input.state.draft.allowed_schemas
        },
        scope_questions: scopeQuestions,
        pending_flags: {
          scope_clarification_pending: input.state.scope_clarification_pending,
          prep_pending: input.state.prep_pending,
          scope_pending: input.state.scope_pending
        },
        question_registry: input.state.question_registry ?? [],
        pending_inputs: input.state.pending_inputs ?? [],
        last_orchestrator_decision: input.state.last_orchestrator_decision ?? null,
        recent_single_queries: (input.state.single_query_log ?? [])
          .slice(-3)
          .map((entry: { query_id: string; question: string; governed_sql: string; row_count: number }) => ({
            query_id: entry.query_id,
            question: entry.question,
            sql_executed: entry.governed_sql,
            row_count: entry.row_count
          }))
      },
      null,
      2
    ),
    "",
    "BUSINESS_CONTEXT:",
    input.business_context && input.business_context.trim().length > 0 ? input.business_context : "(none)",
    "",
    "CATALOG_SUMMARY:",
    input.catalog_summary && input.catalog_summary.trim().length > 0 ? input.catalog_summary : "(none)"
  ].join("\n");
}

async function resolveRetrievedContextForTurn(
  input: ConversationTurnInput,
  options: Pick<
    RemoteConversationClientOptions,
    | "provider"
    | "rag_level"
    | "rag_candidate_limit"
    | "rag_final_limit"
    | "openrouter_api_key"
    | "openrouter_base_url"
    | "openrouter_app_name"
    | "openrouter_app_url"
    | "openrouter_embedding_model"
    | "openrouter_rerank_model"
    | "fetcher"
    | "timeout_ms"
  >,
  mode: "chat" | "orchestrator"
): Promise<Array<{ source: string; label: string; text: string }>> {
  const candidateLimit = Math.max(options.rag_candidate_limit, options.rag_final_limit);
  const lexicalCandidates = buildRetrievedContextForTurn(input, { max_chunks: candidateLimit });
  const externalCandidates = (input.retrieved_context ?? [])
    .map((entry) => ({
      source: String(entry.source ?? "").trim(),
      label: String(entry.label ?? "").trim(),
      text: String(entry.text ?? "").trim()
    }))
    .filter((entry) => entry.source.length > 0 && entry.label.length > 0 && entry.text.length > 0)
    .map((entry) => ({
      source: entry.source,
      label: entry.label,
      text: trimChunkText(entry.text, 360)
    }));
  const candidates = dedupeRetrievedChunks([...externalCandidates, ...lexicalCandidates]).slice(
    0,
    candidateLimit
  );

  if (
    options.rag_level < 2 ||
    candidates.length <= 2 ||
    options.provider !== "openrouter" ||
    !options.openrouter_api_key
  ) {
    return candidates.slice(0, options.rag_final_limit);
  }

  try {
    const semanticCandidates = await rerankRetrievedContextWithOpenRouter(
      candidates,
      input.user_message,
      options,
      mode
    );
    return semanticCandidates.slice(0, options.rag_final_limit);
  } catch (error) {
    console.warn("[rag-lv2] semantic rerank failed, falling back to lexical:", error);
    return candidates.slice(0, options.rag_final_limit);
  }
}

async function rerankRetrievedContextWithOpenRouter(
  candidates: Array<{ source: string; label: string; text: string }>,
  query: string,
  options: Pick<
    RemoteConversationClientOptions,
    | "openrouter_api_key"
    | "openrouter_base_url"
    | "openrouter_app_name"
    | "openrouter_app_url"
    | "openrouter_embedding_model"
    | "openrouter_rerank_model"
    | "fetcher"
    | "timeout_ms"
  >,
  mode: "chat" | "orchestrator"
): Promise<Array<{ source: string; label: string; text: string }>> {
  const endpointBase = (options.openrouter_base_url ?? DEFAULT_OPENROUTER_BASE_URL).replace(/\/$/, "");
  const embeddingModel = options.openrouter_embedding_model ?? DEFAULT_OPENROUTER_EMBEDDING_MODEL;
  const rerankModel = options.openrouter_rerank_model ?? DEFAULT_OPENROUTER_RERANK_MODEL;
  const headers = buildOpenRouterHeaders({
    openrouter_api_key: options.openrouter_api_key,
    openrouter_app_name: options.openrouter_app_name,
    openrouter_app_url: options.openrouter_app_url
  });

  const embeddingInputs = [query, ...candidates.map((chunk) => chunk.text)];
  const embeddings = await fetchOpenRouterEmbeddings(
    options.fetcher,
    `${endpointBase}/embeddings`,
    headers,
    embeddingModel,
    embeddingInputs,
    options.timeout_ms
  );
  if (embeddings.length !== embeddingInputs.length) {
    return candidates;
  }

  const queryEmbedding = embeddings[0];
  const scored = candidates
    .map((chunk, index) => ({
      chunk,
      cosine: cosineSimilarity(queryEmbedding, embeddings[index + 1])
    }))
    .sort((a, b) => b.cosine - a.cosine);

  const topForRerank = scored.slice(0, Math.min(14, scored.length));
  if (topForRerank.length <= 1) {
    return topForRerank.map((entry) => entry.chunk);
  }

  const rerankSelection = await fetchOpenRouterRerankSelection(
    options.fetcher,
    `${endpointBase}/chat/completions`,
    headers,
    rerankModel,
    query,
    topForRerank,
    mode,
    options.timeout_ms
  );
  if (rerankSelection.length === 0) {
    return topForRerank.map((entry) => entry.chunk);
  }

  const byLabel = new Map(topForRerank.map((entry) => [entry.chunk.label, entry.chunk]));
  const selected: Array<{ source: string; label: string; text: string }> = [];
  const seen = new Set<string>();
  for (const label of rerankSelection) {
    const chunk = byLabel.get(label);
    if (!chunk) {
      continue;
    }
    if (seen.has(chunk.label)) {
      continue;
    }
    seen.add(chunk.label);
    selected.push(chunk);
  }
  for (const entry of topForRerank) {
    if (selected.length >= topForRerank.length) {
      break;
    }
    if (seen.has(entry.chunk.label)) {
      continue;
    }
    seen.add(entry.chunk.label);
    selected.push(entry.chunk);
  }
  return selected;
}

function buildOpenRouterHeaders(input: {
  openrouter_api_key?: string;
  openrouter_app_name?: string;
  openrouter_app_url?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.openrouter_api_key ?? ""}`,
    "content-type": "application/json"
  };
  if (input.openrouter_app_name) {
    headers["X-Title"] = input.openrouter_app_name;
  }
  if (input.openrouter_app_url) {
    headers["HTTP-Referer"] = input.openrouter_app_url;
  }
  return headers;
}

async function fetchOpenRouterEmbeddings(
  fetcher: Fetcher,
  endpoint: string,
  headers: Record<string, string>,
  model: string,
  input: string[],
  timeoutMs: number
): Promise<number[][]> {
  const response = await fetchWithTimeout(
    fetcher,
    endpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        input
      })
    },
    timeoutMs
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter embeddings failed (${response.status}): ${body}`);
  }
  const payload = (await response.json()) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("OpenRouter embeddings response missing data array.");
  }
  const vectors = payload.data
    .map((entry) => {
      if (!isRecord(entry) || !Array.isArray(entry.embedding)) {
        return null;
      }
      const values = entry.embedding
        .map((value) => (typeof value === "number" ? value : Number.NaN))
        .filter((value) => Number.isFinite(value));
      return values.length > 0 ? values : null;
    })
    .filter((entry): entry is number[] => Array.isArray(entry));
  return vectors;
}

async function fetchOpenRouterRerankSelection(
  fetcher: Fetcher,
  endpoint: string,
  headers: Record<string, string>,
  model: string,
  query: string,
  candidates: Array<{ chunk: { source: string; label: string; text: string }; cosine: number }>,
  mode: "chat" | "orchestrator",
  timeoutMs: number
): Promise<string[]> {
  const systemPrompt = [
    "You are a retrieval reranker for Project Overload.",
    "Select the most relevant chunks for the user query.",
    `Mode: ${mode}.`,
    "Return STRICT JSON only: {\"keep_labels\":[\"label1\",\"label2\",...]}",
    "Do not include explanations."
  ].join("\n");
  const userPrompt = JSON.stringify(
    {
      query,
      candidates: candidates.map((entry) => ({
        label: entry.chunk.label,
        source: entry.chunk.source,
        semantic_similarity: Number(entry.cosine.toFixed(6)),
        text: trimChunkText(entry.chunk.text, 280)
      })),
      keep_count: Math.min(10, candidates.length)
    },
    null,
    2
  );

  const response = await fetchWithTimeout(
    fetcher,
    endpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    },
    timeoutMs
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter rerank failed (${response.status}): ${body}`);
  }
  const payload = (await response.json()) as unknown;
  const text = extractTextPayload(payload);
  if (!text) {
    return [];
  }
  const parsed = parseJsonObjectFromText(text);
  if (!isRecord(parsed) || !Array.isArray(parsed.keep_labels)) {
    return [];
  }
  return parsed.keep_labels
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < length; index += 1) {
    const valueA = a[index];
    const valueB = b[index];
    dot += valueA * valueB;
    magA += valueA * valueA;
    magB += valueB * valueB;
  }
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function buildRetrievedContextForTurn(
  input: ConversationTurnInput,
  options?: { max_chunks?: number }
): Array<{ source: string; label: string; text: string }> {
  const maxChunks = Math.max(4, Math.min(options?.max_chunks ?? 12, 24));
  const chunks = buildRetrievalChunks(input);
  if (chunks.length === 0) {
    return [];
  }

  const queryText = [
    input.user_message,
    ...input.state.pending_inputs.map((entry) => entry.prompt),
    ...input.state.scope_questions.map((entry) => `${entry.question} ${entry.clarification}`)
  ]
    .join("\n")
    .trim();
  const queryTokens = tokenizeForRetrieval(queryText);

  const scored = chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreRetrievalChunk(chunk, queryTokens)
    }))
    .sort((a, b) => b.score - a.score);

  const selected: ScoredRetrievalChunk[] = [];
  const seenText = new Set<string>();
  for (const chunk of scored) {
    if (selected.length >= maxChunks) {
      break;
    }
    const normalized = normalizeForDedup(chunk.text);
    if (normalized.length === 0 || seenText.has(normalized)) {
      continue;
    }
    seenText.add(normalized);
    selected.push(chunk);
  }

  return selected.map((chunk) => ({
    source: chunk.source,
    label: chunk.label,
    text: trimChunkText(chunk.text, 360)
  }));
}

function buildRetrievalChunks(input: ConversationTurnInput): RetrievalChunk[] {
  const chunks: RetrievalChunk[] = [];
  const pushChunk = (source: RetrievalSource, label: string, text: string | null | undefined): void => {
    if (typeof text !== "string") {
      return;
    }
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length === 0) {
      return;
    }
    chunks.push({
      source,
      label,
      text: trimChunkText(normalized, 520)
    });
  };

  pushChunk("user_message", "Current user request", input.user_message);

  input.history.slice(-20).forEach((turn, index) => {
    const offset = input.history.length - Math.min(input.history.length, 20) + index + 1;
    pushChunk("history", `History #${offset} (${turn.role})`, turn.content);
  });

  input.state.scope_questions.slice(-20).forEach((entry) => {
    pushChunk(
      "scope_question",
      `Scope Q${entry.question_number}`,
      [
        `Question: ${entry.question}`,
        `Clarification: ${entry.clarification}`,
        entry.answer ? `Answer: ${entry.answer}` : "Answer: (pending)"
      ].join(" | ")
    );
  });

  input.state.pending_inputs.slice(-12).forEach((entry) => {
    pushChunk(
      "pending_input",
      `Pending input${entry.question_number ? ` Q${entry.question_number}` : ""}`,
      `${entry.prompt}${entry.reason ? ` | Reason: ${entry.reason}` : ""}`
    );
  });

  input.state.question_registry.slice(-20).forEach((entry) => {
    pushChunk(
      "question_registry",
      `Registry Q${entry.question_number}`,
      [
        `Question: ${entry.question_text}`,
        `Status: ${entry.status}`,
        `Scope clarified: ${entry.scope_clarified ? "yes" : "no"}`,
        entry.clarification_needed ? `Needs: ${entry.clarification_needed}` : "",
        entry.clarification_answer ? `Answer: ${entry.clarification_answer}` : ""
      ]
        .filter((value) => value.length > 0)
        .join(" | ")
    );
  });

  input.state.single_query_log.slice(-10).forEach((entry) => {
    pushChunk(
      "single_query_log",
      `Single query ${entry.query_id}`,
      [
        `Question: ${entry.question}`,
        `Rows: ${entry.row_count}`,
        `Elapsed: ${entry.elapsed_ms}ms`,
        `SQL: ${entry.governed_sql}`
      ].join(" | ")
    );
  });

  input.state.prepared_payloads.slice(-12).forEach((payload, index) => {
    const monthlyRows =
      payload.validation?.monthly_row_counts
        ?.slice(0, 6)
        .map((entry) => `${entry.month}:${entry.row_count}`)
        .join(", ") ?? "";
    const monthlyTotals =
      payload.validation?.monthly_metric_totals
        ?.slice(0, 6)
        .map((entry) => `${entry.month}:${entry.total}`)
        .join(", ") ?? "";
    pushChunk(
      "prepared_payload",
      `Prepared payload ${payload.question_number ? `Q${payload.question_number}` : index + 1}`,
      [
        `Question: ${payload.question}`,
        `Purpose: ${payload.purpose}`,
        `Prepared rows: ${payload.prepared_row_count}`,
        payload.group_id ? `Group: ${payload.group_id}` : "",
        payload.preparation_notes.length > 0 ? `Notes: ${payload.preparation_notes.join("; ")}` : "",
        payload.warnings.length > 0 ? `Warnings: ${payload.warnings.join("; ")}` : "",
        monthlyRows ? `Monthly rows: ${monthlyRows}` : "",
        monthlyTotals ? `Monthly totals: ${monthlyTotals}` : ""
      ]
        .filter((value) => value.length > 0)
        .join(" | ")
    );
  });

  pushChunk("planner_summary", "Planner summary", input.state.planner_summary);
  pushChunk("preparation_summary", "Preparation summary", input.state.preparation_summary);
  pushChunk("business_context", "Business context", input.business_context);
  pushChunk("catalog_summary", "Catalog summary", input.catalog_summary);

  pushChunk(
    "draft_state",
    "Draft state",
    JSON.stringify(
      {
        name: input.state.draft.name,
        audience: input.state.draft.audience,
        timezone: input.state.draft.timezone,
        insight_mode: input.state.draft.insight_mode,
        metrics: input.state.draft.metric_ids,
        dimensions: input.state.draft.dimension_ids,
        allowed_relations: input.state.draft.allowed_relations
      },
      null,
      0
    )
  );

  return chunks;
}

function scoreRetrievalChunk(chunk: RetrievalChunk, queryTokens: Set<string>): number {
  const baseBySource: Record<RetrievalSource, number> = {
    user_message: 6,
    scope_question: 5,
    pending_input: 5,
    question_registry: 4,
    prepared_payload: 4,
    single_query_log: 3,
    planner_summary: 3,
    preparation_summary: 3,
    history: 2,
    business_context: 2,
    catalog_summary: 2,
    draft_state: 1
  };

  const tokenHits = overlapCount(tokenizeForRetrieval(chunk.text), queryTokens);
  const labelHits = overlapCount(tokenizeForRetrieval(chunk.label), queryTokens);
  const lexicalScore = tokenHits * 1.8 + labelHits * 1.2;
  return baseBySource[chunk.source] + lexicalScore;
}

function tokenizeForRetrieval(value: string): Set<string> {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "what",
    "when",
    "where",
    "which",
    "into",
    "your",
    "their",
    "have",
    "has",
    "will",
    "over",
    "under",
    "past",
    "last",
    "show",
    "give",
    "need",
    "want",
    "should",
    "about",
    "across"
  ]);
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
  return new Set(tokens);
}

function overlapCount(values: Set<string>, query: Set<string>): number {
  if (values.size === 0 || query.size === 0) {
    return 0;
  }
  let count = 0;
  for (const value of values) {
    if (query.has(value)) {
      count += 1;
    }
  }
  return count;
}

function normalizeForDedup(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function trimChunkText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  const trimmed = value.slice(0, maxLength - 1).trimEnd();
  return `${trimmed}…`;
}

function dedupeRetrievedChunks(
  chunks: Array<{ source: string; label: string; text: string }>
): Array<{ source: string; label: string; text: string }> {
  const seen = new Set<string>();
  const next: Array<{ source: string; label: string; text: string }> = [];
  for (const chunk of chunks) {
    const key = `${chunk.source}::${normalizeForDedup(chunk.label)}::${normalizeForDedup(chunk.text)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(chunk);
  }
  return next;
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
    scope_finalized: false,
    metric_definitions: [],
    pending_metric_confirmations: [],
    pending_metric_resume_message: null,
    pending_metric_resume_mode: null,
    scope_clarification_pending: false,
    scope_business_context: null,
    scope_source_prompt: null,
    scope_questions: [],
    pending_query_sql: null,
    pending_query_limit: null,
    pending_single_query_request: null,
    pending_followup_asks: [],
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
    last_token_usage: null,
    orchestrator_context_version: 1,
    orchestrator_summary: null,
    last_orchestrator_decision: null,
    pending_inputs: [],
    question_registry: []
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

function clampRagLevel(value: number): 1 | 2 {
  return value >= 2 ? 2 : 1;
}

function clampRagCount(
  value: number,
  minValue: number,
  maxValue: number,
  fallback: number
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.trunc(value);
  if (rounded < minValue) {
    return minValue;
  }
  if (rounded > maxValue) {
    return maxValue;
  }
  return rounded;
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
  const recent = history.slice(-20);
  if (recent.length === 0) {
    return "";
  }

  return recent
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");
}

function parseJsonObjectFromText(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const open = trimmed.indexOf("{");
  const close = trimmed.lastIndexOf("}");
  if (open === -1 || close === -1 || close <= open) {
    throw new Error("No JSON object found in model output.");
  }
  return JSON.parse(trimmed.slice(open, close + 1));
}

const ORCHESTRATOR_INTENT_TYPES = new Set([
  "new_question",
  "clarification_answer",
  "follow_up_request",
  "duplicate",
  "chitchat",
  "other"
]);

const ORCHESTRATOR_NEXT_OWNERS = new Set([
  "conversation_orchestrator",
  "single_query_agent",
  "data_architect_agent",
  "query_planning_agent",
  "data_prep_orchestrator",
  "batch_analyst",
  "super_summary",
  "report_composer",
  "qa",
  "wait_for_user"
]);

const QUESTION_REGISTRY_STATUSES = new Set([
  "open",
  "scoped",
  "prepared",
  "analyzed",
  "complete"
]);

function normalizeOrchestratorDecisionPayload(raw: unknown, userMessage: string): Record<string, unknown> {
  const root = unwrapOrchestratorPayload(raw);

  const pendingInputs = toArray(root.pending_inputs).map(normalizePendingInput).filter(isRecord);
  const intentParts = toArray(root.intent_parts)
    .map((entry, index) => normalizeIntentPart(entry, userMessage, index))
    .filter(isRecord);

  const resolvedScopeAnswers = toArray(root.resolved_scope_answers)
    .map(normalizeResolvedScopeAnswer)
    .filter(isRecord);

  const newScopeQuestions = toArray(root.new_scope_questions)
    .map(normalizeNewScopeQuestion)
    .filter(isRecord);

  const followUpRequests = toArray(root.follow_up_requests)
    .map(normalizeFollowUpRequest)
    .filter(isRecord);

  const toolCalls = toArray(root.tool_calls).map(normalizeToolCall).filter(isRecord);
  const stateUpdates = normalizeStateUpdates(root.state_updates);

  return {
    intent_parts: intentParts,
    resolved_scope_answers: resolvedScopeAnswers,
    new_scope_questions: newScopeQuestions,
    follow_up_requests: followUpRequests,
    pending_inputs: pendingInputs,
    next_owner: normalizeNextOwner(root.next_owner, pendingInputs.length > 0),
    tool_calls: toolCalls,
    state_updates: stateUpdates
  };
}

function unwrapOrchestratorPayload(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    return {};
  }

  const candidateKeys = ["decision", "orchestrator_decision", "result", "output", "data"];
  for (const key of candidateKeys) {
    const value = raw[key];
    if (isRecord(value)) {
      return value;
    }
  }

  return raw;
}

function normalizeIntentPart(
  value: unknown,
  userMessage: string,
  index: number
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const text =
    toNonEmptyString(value.text) ??
    toNonEmptyString(value.question_text) ??
    toNonEmptyString(value.question) ??
    (index === 0 ? toNonEmptyString(userMessage) : undefined);
  if (!text) {
    return null;
  }

  const normalized: Record<string, unknown> = {
    type: normalizeIntentType(value.type),
    text
  };

  const partId = toNonEmptyString(value.part_id);
  if (partId) {
    normalized.part_id = partId;
  }

  const questionRef =
    toNonEmptyString(value.question_ref) ??
    toNonEmptyString(value.questionRef) ??
    toNonEmptyString(value.question_id);
  if (questionRef) {
    normalized.question_ref = questionRef;
  }

  return normalized;
}

function normalizeResolvedScopeAnswer(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const questionNumber =
    toPositiveInt(value.question_number) ??
    toPositiveInt(value.questionNumber) ??
    toPositiveInt(value.q);
  const answer = toNonEmptyString(value.answer) ?? toNonEmptyString(value.text);
  if (!questionNumber || !answer) {
    return null;
  }

  const normalized: Record<string, unknown> = {
    question_number: questionNumber,
    answer
  };

  const sourcePartId =
    toNonEmptyString(value.source_part_id) ?? toNonEmptyString(value.sourcePartId);
  if (sourcePartId) {
    normalized.source_part_id = sourcePartId;
  }

  return normalized;
}

function normalizeNewScopeQuestion(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const questionText =
    toNonEmptyString(value.question_text) ??
    toNonEmptyString(value.question) ??
    toNonEmptyString(value.text);
  if (!questionText) {
    return null;
  }

  const clarification =
    toNonEmptyString(value.clarification) ??
    toNonEmptyString(value.prompt) ??
    "Confirm the exact scope and filters for this question.";

  const normalized: Record<string, unknown> = {
    question_text: questionText,
    clarification
  };

  const reason = toNonEmptyString(value.reason);
  if (reason) {
    normalized.reason = reason;
  }

  return normalized;
}

function normalizeFollowUpRequest(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const questionText =
    toNonEmptyString(value.question_text) ??
    toNonEmptyString(value.question) ??
    toNonEmptyString(value.text);
  if (!questionText) {
    return null;
  }

  return {
    question_text: questionText,
    requires_new_data: toBoolean(value.requires_new_data),
    grounded_in_existing_payload: toBoolean(value.grounded_in_existing_payload),
    referenced_question_ids: toStringArray(value.referenced_question_ids)
  };
}

function normalizePendingInput(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const inputKey = toNonEmptyString(value.input_key) ?? toNonEmptyString(value.key);
  const prompt =
    toNonEmptyString(value.prompt) ?? toNonEmptyString(value.question) ?? toNonEmptyString(value.text);
  if (!inputKey || !prompt) {
    return null;
  }

  const normalized: Record<string, unknown> = {
    input_key: inputKey,
    prompt
  };

  const reason = toNonEmptyString(value.reason);
  if (reason) {
    normalized.reason = reason;
  }

  const questionNumber =
    toPositiveInt(value.question_number) ??
    toPositiveInt(value.questionNumber) ??
    toPositiveInt(value.q);
  if (questionNumber) {
    normalized.question_number = questionNumber;
  }

  return normalized;
}

function normalizeToolCall(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const toolName = toNonEmptyString(value.tool_name) ?? toNonEmptyString(value.toolName);
  if (!toolName) {
    return null;
  }

  const normalized: Record<string, unknown> = {
    tool_name: toolName,
    payload: isRecord(value.payload) ? value.payload : {}
  };

  const reason = toNonEmptyString(value.reason);
  if (reason) {
    normalized.reason = reason;
  }

  return normalized;
}

function normalizeStateUpdates(value: unknown): Record<string, unknown> {
  const updates = isRecord(value) ? value : {};
  const summaryRaw = updates.summary;
  const summary =
    summaryRaw === null ? null : toNonEmptyString(summaryRaw) ?? null;

  const questionRegistryUpdates = toArray(updates.question_registry_updates)
    .map(normalizeQuestionRegistryUpdate)
    .filter(isRecord);

  return {
    mark_scope_complete: toBoolean(updates.mark_scope_complete),
    append_new_questions: toBoolean(updates.append_new_questions),
    clear_pending_inputs: toBoolean(updates.clear_pending_inputs),
    summary,
    question_registry_updates: questionRegistryUpdates
  };
}

function normalizeQuestionRegistryUpdate(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const questionNumber =
    toPositiveInt(value.question_number) ?? toPositiveInt(value.questionNumber);
  if (!questionNumber) {
    return null;
  }

  const normalized: Record<string, unknown> = {
    question_number: questionNumber,
    status: normalizeQuestionRegistryStatus(value.status)
  };

  const questionId = toNonEmptyString(value.question_id) ?? toNonEmptyString(value.questionId);
  if (questionId) {
    normalized.question_id = questionId;
  }

  return normalized;
}

function normalizeIntentType(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (ORCHESTRATOR_INTENT_TYPES.has(normalized)) {
    return normalized;
  }
  return "other";
}

function normalizeNextOwner(value: unknown, hasPendingInputs: boolean): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (ORCHESTRATOR_NEXT_OWNERS.has(normalized)) {
    return normalized;
  }
  return hasPendingInputs ? "wait_for_user" : "conversation_orchestrator";
}

function normalizeQuestionRegistryStatus(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (QUESTION_REGISTRY_STATUSES.has(normalized)) {
    return normalized;
  }
  return "open";
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  return false;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toPositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const intValue = Math.trunc(value);
    return intValue > 0 ? intValue : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const direct = Number.parseInt(trimmed, 10);
    if (Number.isFinite(direct) && direct > 0) {
      return direct;
    }
    const match = trimmed.match(/\d+/);
    if (match) {
      const fromMatch = Number.parseInt(match[0], 10);
      return Number.isFinite(fromMatch) && fromMatch > 0 ? fromMatch : undefined;
    }
  }
  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => toNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function selectRelevantMetricDefinitions(
  metricDefinitions: Array<{ metric_key: string; display_name: string; definition: string }>,
  userMessage: string,
  history: ChatHistoryTurn[]
): Array<{ metric_key: string; display_name: string; definition: string }> {
  if (!Array.isArray(metricDefinitions) || metricDefinitions.length === 0) {
    return [];
  }

  const recentHistory = history
    .slice(-20)
    .map((entry) => entry.content)
    .join("\n");
  const haystack = `${userMessage}\n${recentHistory}`.toLowerCase();

  const matched = metricDefinitions.filter((entry) => {
    const phrases = collectMetricMatchPhrases(entry);
    if (phrases.some((phrase) => phrase.length > 0 && haystack.includes(phrase))) {
      return true;
    }
    const tokenSet = new Set(
      phrases
        .flatMap((phrase) => phrase.split(/\s+/))
        .map((token) => token.trim())
        .filter((token) => token.length >= 4)
    );
    if (tokenSet.size === 0) {
      return false;
    }
    const hitCount = Array.from(tokenSet).filter((token) => haystack.includes(token)).length;
    return hitCount >= Math.min(2, tokenSet.size);
  });

  return matched.slice(0, 8).map((entry) => ({
    metric_key: entry.metric_key,
    display_name: entry.display_name,
    definition: entry.definition
  }));
}

function collectMetricMatchPhrases(entry: {
  metric_key: string;
  display_name: string;
  definition: string;
}): string[] {
  const normalize = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const keyPhrase = normalize(entry.metric_key);
  const displayPhrase = normalize(entry.display_name);
  const phrases = new Set<string>();
  if (keyPhrase.length > 0) {
    phrases.add(keyPhrase);
  }
  if (displayPhrase.length > 0) {
    phrases.add(displayPhrase);
  }
  if (/\brefund\b/.test(`${keyPhrase} ${displayPhrase}`) && /\brate\b/.test(`${keyPhrase} ${displayPhrase}`)) {
    phrases.add("refund rate");
    phrases.add("refund-rate");
    phrases.add("refunded rate");
  }
  const definitionTokens = normalize(entry.definition)
    .split(/\s+/)
    .filter((token) => token.length >= 5);
  if (definitionTokens.length > 0) {
    phrases.add(definitionTokens.slice(0, 3).join(" "));
  }
  return Array.from(phrases).filter((phrase) => phrase.length > 0);
}

function extractPendingInputsFromState(state: ChatState): Array<{
  input_key: string;
  prompt: string;
  reason?: string;
  question_number?: number;
}> {
  const pending = state.scope_questions
    .filter((entry) => !entry.answer || entry.answer.trim().length === 0)
    .map((entry) => ({
      input_key: `q${entry.question_number}`,
      prompt: entry.clarification || entry.question,
      reason: "scope_clarification",
      question_number: entry.question_number
    }));
  return pending.slice(0, 8);
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
