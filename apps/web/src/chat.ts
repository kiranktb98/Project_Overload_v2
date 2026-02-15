import { randomUUID } from "node:crypto";
import {
  ExecBriefSchema,
  ReportContractSchema
} from "@project-overload/shared";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 15000;

export const ChatDraftSchema = z.object({
  name: z.string(),
  audience: z.string(),
  timezone: z.string(),
  schedule_cron: z.string().nullable(),
  sql_template: z.string(),
  metric_ids: z.array(z.string()),
  dimension_ids: z.array(z.string()),
  allowed_relations: z.array(z.string()),
  allowed_schemas: z.array(z.string())
});

export const ChatHistoryTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1),
  at: z.string().datetime().optional()
});

export const ChatStateSchema = z.object({
  draft: ChatDraftSchema,
  contract_id: z.string().nullable(),
  last_run_id: z.string().nullable(),
  last_exec_brief: ExecBriefSchema.nullable(),
  conversation_history: z.array(ChatHistoryTurnSchema).max(40).default([])
});

export const ChatTurnRequestSchema = z.object({
  message: z.string().trim().min(1),
  state: z.unknown().optional()
});

export type ChatDraft = z.infer<typeof ChatDraftSchema>;
export type ChatHistoryTurn = z.infer<typeof ChatHistoryTurnSchema>;
export type ChatState = z.infer<typeof ChatStateSchema>;

export type ChatTurnResponse = {
  assistant_message: string;
  state: ChatState;
  pdf_download_url?: string;
};

type ReportContractRecord = z.output<typeof ReportContractSchema>;
type ExecBriefRecord = z.output<typeof ExecBriefSchema>;
type ConnectionContextRecord = z.output<typeof ConnectionContextSchema>;
type SafeQueryResponseRecord = z.output<typeof SafeQueryResponseSchema>;

export type CreateWebApiClientOptions = {
  base_url: string;
  fetch_impl?: typeof fetch;
};

export interface WebApiClient {
  createContract(payload: ReportContractRecord): Promise<ReportContractRecord>;
  listContracts(): Promise<ReportContractRecord[]>;
  runContract(contractId: string): Promise<{
    run_id: string;
    exec_brief: ExecBriefRecord;
    pdf_path?: string;
  }>;
  downloadRunPdf(runId: string): Promise<Response>;
  getConnectionContext(): Promise<ConnectionContextRecord>;
  runSafeQuery(sql: string, limit?: number): Promise<SafeQueryResponseRecord>;
}

const RunContractResponseSchema = z.object({
  run_id: z.string().min(1),
  exec_brief: ExecBriefSchema,
  pdf_path: z.string().min(1).optional()
});

const ConnectionContextSchema = z.object({
  connected: z.boolean(),
  name: z.string().nullable().optional(),
  database: z.string().nullable().optional(),
  connected_at: z.string().nullable().optional(),
  allowed_relations: z.array(z.string()).default([]),
  allowed_schemas: z.array(z.string()).default([]),
  available_relations: z.array(z.string()).default([]),
  source: z.enum(["runtime", "env", "fallback", "none"]).optional()
});

const SafeQueryResponseSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  row_count: z.number().int().min(0),
  governed_sql: z.string().min(1),
  warnings: z.array(z.string()).default([])
});

const DEFAULT_DRAFT: ChatDraft = {
  name: "",
  audience: "Executive",
  timezone: "UTC",
  schedule_cron: null,
  sql_template: "SELECT * FROM analytics.sales",
  metric_ids: ["metric_revenue"],
  dimension_ids: ["region"],
  allowed_relations: ["analytics.sales"],
  allowed_schemas: ["analytics"]
};

const HELP_TEXT = [
  "Here's what I can do:\n",
  "To build a report, just tell me who it's for and what you want to track. For example:",
  '  "I need a weekly revenue report for the CEO, broken down by region"',
  "",
  "You can also tweak things step by step:",
  "  set name: Weekly CEO report",
  "  set audience: CEO",
  "  set timezone: Asia/Kolkata",
  "  set schedule: 0 18 * * 5",
  "  set sql: SELECT region, SUM(amount) AS revenue FROM analytics.sales GROUP BY region",
  "",
  "Other things I can help with:",
  "  preview      - see the current draft",
  "  save         - save the contract",
  "  run          - save and execute now",
  "  list tables  - see connected database tables",
  "  query: SELECT ... - run a safe read-only query"
].join("\n");

export const MAX_CONVERSATION_TURNS = 12;

export function createInitialChatState(): ChatState {
  return {
    draft: {
      ...DEFAULT_DRAFT,
      metric_ids: [...DEFAULT_DRAFT.metric_ids],
      dimension_ids: [...DEFAULT_DRAFT.dimension_ids],
      allowed_relations: [...DEFAULT_DRAFT.allowed_relations],
      allowed_schemas: [...DEFAULT_DRAFT.allowed_schemas]
    },
    contract_id: null,
    last_run_id: null,
    last_exec_brief: null,
    conversation_history: []
  };
}

export function parseChatState(value: unknown): ChatState {
  const parsed = ChatStateSchema.safeParse(value);
  if (!parsed.success) {
    return createInitialChatState();
  }

  return {
    draft: {
      ...parsed.data.draft,
      metric_ids: [...parsed.data.draft.metric_ids],
      dimension_ids: [...parsed.data.draft.dimension_ids],
      allowed_relations: [...parsed.data.draft.allowed_relations],
      allowed_schemas: [...parsed.data.draft.allowed_schemas]
    },
    contract_id: parsed.data.contract_id,
    last_run_id: parsed.data.last_run_id,
    last_exec_brief: parsed.data.last_exec_brief,
    conversation_history: [...parsed.data.conversation_history]
  };
}

export function appendConversationTurn(
  state: ChatState,
  userMessage: string,
  assistantMessage: string
): ChatState {
  const next = parseChatState(state);
  const now = new Date().toISOString();
  const entries: ChatHistoryTurn[] = [];

  if (userMessage.trim().length > 0) {
    entries.push({
      role: "user",
      content: userMessage.trim(),
      at: now
    });
  }

  if (assistantMessage.trim().length > 0) {
    entries.push({
      role: "assistant",
      content: assistantMessage.trim(),
      at: now
    });
  }

  const maxEntries = MAX_CONVERSATION_TURNS * 2;
  next.conversation_history = [...next.conversation_history, ...entries].slice(-maxEntries);
  return next;
}

export function createWebApiClient(options: CreateWebApiClientOptions): WebApiClient {
  const fetcher = options.fetch_impl ?? fetch;
  const baseUrl = options.base_url.replace(/\/+$/, "");

  return {
    async createContract(payload) {
      const response = await fetcher(`${baseUrl}/report-contracts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      return parseJsonResponse(response, ReportContractSchema);
    },
    async listContracts() {
      const response = await fetcher(`${baseUrl}/report-contracts`, {
        method: "GET"
      });

      return parseJsonResponse(response, z.array(ReportContractSchema));
    },
    async runContract(contractId) {
      const response = await fetcher(`${baseUrl}/report-contracts/${encodeURIComponent(contractId)}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });

      return parseJsonResponse(response, RunContractResponseSchema);
    },
    async downloadRunPdf(runId) {
      const response = await fetcher(`${baseUrl}/report-runs/${encodeURIComponent(runId)}/pdf`, {
        method: "GET"
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text.length > 0 ? text : `Failed to download PDF (${response.status})`);
      }

      return response;
    },
    async getConnectionContext() {
      const response = await fetcher(`${baseUrl}/connections/active`, {
        method: "GET"
      });

      return parseJsonResponse(response, ConnectionContextSchema);
    },
    async runSafeQuery(sql, limit) {
      const response = await fetcher(`${baseUrl}/connections/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sql,
          limit
        })
      });

      return parseJsonResponse(response, SafeQueryResponseSchema);
    }
  };
}

export async function handleChatTurn(input: {
  message: string;
  state: ChatState;
  api_client: WebApiClient;
}): Promise<ChatTurnResponse> {
  const rawMessage = input.message.trim();
  const command = rawMessage.toLowerCase();
  let nextState = parseChatState(input.state);
  const conversational = answerConversationalPrompt(command, nextState);
  if (conversational) {
    return conversational;
  }

  if (command === "help" || command === "/help" || command === "?") {
    return { assistant_message: HELP_TEXT, state: nextState };
  }

  if (command === "preview" || command === "/preview") {
    return { assistant_message: renderPreview(nextState), state: nextState };
  }

  if (asksToUseConnectedTables(command)) {
    return syncConnectedTables(nextState, input.api_client);
  }

  if (asksForConnectedTables(command)) {
    const context = await input.api_client.getConnectionContext();
    return {
      assistant_message: renderConnectedTables(context),
      state: nextState
    };
  }

  if (command === "list tables" || command === "show tables" || command === "tables") {
    const context = await input.api_client.getConnectionContext();
    return {
      assistant_message: renderConnectedTables(context),
      state: nextState
    };
  }

  if (command === "use connected tables" || command === "sync connected tables") {
    return syncConnectedTables(nextState, input.api_client);
  }

  const queryCommand = parseQueryCommand(rawMessage);
  if (queryCommand) {
    const result = await input.api_client.runSafeQuery(queryCommand.sql, queryCommand.limit);
    return {
      assistant_message: renderSafeQueryResult(result),
      state: nextState
    };
  }

  if (command === "list contracts" || command === "list") {
    const contracts = await input.api_client.listContracts();
    return {
      assistant_message: renderContractList(contracts),
      state: nextState
    };
  }

  if (command === "save") {
    const saved = await saveContract(nextState, input.api_client);
    return saved;
  }

  if (command === "run") {
    const runResult = await runContract(nextState, input.api_client);
    return runResult;
  }

  if (asksForMissingDetails(command)) {
    return {
      assistant_message: renderMissingDetails(nextState),
      state: nextState
    };
  }

  const setCommand = parseSetCommand(rawMessage);
  if (setCommand) {
    const applied = applySetCommand(nextState, setCommand.field, setCommand.value);
    if (!applied.updated) {
      return {
        assistant_message:
          "Unknown field for set command. Supported fields: name, audience, timezone, schedule, sql, metrics, dimensions, relations, schemas.",
        state: nextState
      };
    }

    nextState = applied.state;
    return {
      assistant_message: `Got it, ${setCommand.field} updated.\n${renderDraftChecklist(nextState)}`,
      state: nextState
    };
  }

  const natural = applyNaturalLanguageDraftUpdates(rawMessage, nextState);
  if (natural.updated_fields.length > 0) {
    nextState = natural.state;

    const action = detectConversationalAction(command);
    if (action === "run") {
      return runWithValidation(nextState, input.api_client);
    }

    if (action === "save") {
      return saveWithValidation(nextState, input.api_client);
    }

    if (action === "preview") {
      return {
        assistant_message: renderPreview(nextState),
        state: nextState
      };
    }

    if (action === "list") {
      const contracts = await input.api_client.listContracts();
      return {
        assistant_message: renderContractList(contracts),
        state: nextState
      };
    }

    return {
      assistant_message: `Updated ${natural.updated_fields.join(", ")}.\n${renderDraftChecklist(nextState)}`,
      state: nextState
    };
  }

  const inferred = inferSimpleIntent(rawMessage, nextState);
  if (inferred) {
    return inferred;
  }

  const action = detectConversationalAction(command);
  if (action === "run") {
    return runWithValidation(nextState, input.api_client);
  }

  if (action === "save") {
    return saveWithValidation(nextState, input.api_client);
  }

  if (action === "preview") {
    return {
      assistant_message: renderPreview(nextState),
      state: nextState
    };
  }

  if (action === "list") {
    const contracts = await input.api_client.listContracts();
    return {
      assistant_message: renderContractList(contracts),
      state: nextState
    };
  }

  if (expressesReportIntent(command)) {
    return {
      assistant_message: renderReportDiscoveryPrompt(nextState),
      state: nextState
    };
  }

  return {
    assistant_message: renderOpenEndedFallback(nextState),
    state: nextState
  };
}

function parseSetCommand(raw: string): { field: string; value: string } | null {
  const match = raw.match(/^(?:\/?set\s+)?([a-z_ ]+)\s*[:=]\s*(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    field: match[1].trim().toLowerCase().replace(/\s+/g, "_"),
    value: match[2].trim()
  };
}

function parseQueryCommand(raw: string): { sql: string; limit?: number } | null {
  const match = raw.match(/^(?:\/?query|\/?sql|\/?run query)\s*[:=]\s*([\s\S]+)$/i);
  if (!match) {
    return null;
  }

  const sql = match[1].trim();
  if (sql.length === 0) {
    return null;
  }

  return {
    sql
  };
}

function applySetCommand(state: ChatState, field: string, value: string): { state: ChatState; updated: boolean } {
  const next = parseChatState(state);

  switch (field) {
    case "name":
      next.draft.name = value;
      next.contract_id = null;
      return { state: next, updated: true };
    case "audience":
      next.draft.audience = value;
      next.contract_id = null;
      return { state: next, updated: true };
    case "timezone":
      next.draft.timezone = value;
      next.contract_id = null;
      return { state: next, updated: true };
    case "schedule":
    case "schedule_cron":
      next.draft.schedule_cron = value.toLowerCase() === "none" ? null : value;
      next.contract_id = null;
      return { state: next, updated: true };
    case "sql":
    case "sql_template":
      next.draft.sql_template = value;
      next.contract_id = null;
      return { state: next, updated: true };
    case "metrics":
    case "metric_ids":
      next.draft.metric_ids = parseCsv(value);
      next.contract_id = null;
      return { state: next, updated: true };
    case "dimensions":
    case "dimension_ids":
      next.draft.dimension_ids = parseCsv(value);
      next.contract_id = null;
      return { state: next, updated: true };
    case "relations":
    case "allowed_relations":
      next.draft.allowed_relations = parseCsv(value);
      next.contract_id = null;
      return { state: next, updated: true };
    case "schemas":
    case "allowed_schemas":
      next.draft.allowed_schemas = parseCsv(value);
      next.contract_id = null;
      return { state: next, updated: true };
    default:
      return { state: next, updated: false };
  }
}

function parseCsv(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
    )
  );
}

function inferSimpleIntent(message: string, state: ChatState): ChatTurnResponse | null {
  const lowered = message.toLowerCase();
  const nextState = parseChatState(state);

  if (lowered.includes("weekly") && nextState.draft.schedule_cron === null) {
    nextState.draft.schedule_cron = "0 18 * * 5";
    return {
      assistant_message:
        "I've set this up as a weekly report (Fridays at 18:00). You can adjust the timezone with \"set timezone: Asia/Kolkata\" or similar.",
      state: nextState
    };
  }

  if (lowered.includes("ceo") && !lowered.includes("name") && nextState.draft.audience === "Executive") {
    nextState.draft.audience = "CEO";
    return {
      assistant_message: "Audience set to CEO. What should we call this report? And what's the key metric you want to track?",
      state: nextState
    };
  }

  if (lowered.startsWith("create ") || lowered.startsWith("new report")) {
    const guessedName = message.replace(/^(create|new report)\s*/i, "").trim();
    if (guessedName.length > 0) {
      nextState.draft.name = guessedName;
      nextState.contract_id = null;
      return {
        assistant_message: `Named it "${guessedName}".\n${renderDraftChecklist(nextState)}`,
        state: nextState
      };
    }
  }

  return null;
}

async function saveContract(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const contract = buildContractPayload(state);
  const created = await apiClient.createContract(contract);
  const nextState = parseChatState(state);
  nextState.contract_id = created.id;

  return {
    assistant_message: `Got it - "${created.name}" is saved (ID: ${created.id}). Say "run" whenever you're ready to execute it.`,
    state: nextState
  };
}

async function saveWithValidation(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const missing = getMissingDraftFields(state);
  if (missing.length > 0) {
    return {
      assistant_message: `Almost there! I just need: ${missing.join(", ")}.\nFor example: "Call it ${suggestReportName(state)}"`,
      state
    };
  }

  return saveContract(state, apiClient);
}

async function runContract(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  let nextState = parseChatState(state);
  let preface = "";

  if (!nextState.contract_id) {
    const saved = await saveContract(nextState, apiClient);
    nextState = saved.state;
    preface = `${saved.assistant_message}\n\n`;
  }

  if (!nextState.contract_id) {
    throw new Error("Contract save failed before run.");
  }

  const run = await apiClient.runContract(nextState.contract_id);
  nextState.last_run_id = run.run_id;
  nextState.last_exec_brief = run.exec_brief;
  const pdfDownloadUrl = `/api/runs/${run.run_id}/pdf`;

  return {
    assistant_message: `${preface}Done! Here's what I found:\n\n${renderExecBrief(run.exec_brief)}\n\nYou can download the full PDF report below.`,
    state: nextState,
    pdf_download_url: pdfDownloadUrl
  };
}

async function runWithValidation(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const missing = getMissingDraftFields(state);
  if (missing.length > 0) {
    return {
      assistant_message: `I'm ready to run it - just need: ${missing.join(", ")}.\nFor example: "Call it ${suggestReportName(state)}"`,
      state
    };
  }

  return runContract(state, apiClient);
}

function buildContractPayload(state: ChatState): ReportContractRecord {
  const draft = state.draft;
  const name = draft.name.trim();
  if (name.length === 0) {
    throw new Error("Set contract name first: set name: <value>");
  }

  const sql = draft.sql_template.trim();
  if (!/^\s*select\b/i.test(sql)) {
    throw new Error("SQL must be SELECT-only. Update with: set sql: SELECT ...");
  }

  const allowedRelations = draft.allowed_relations.length > 0 ? draft.allowed_relations : ["analytics.sales"];
  const allowedSchemas = draft.allowed_schemas.length > 0 ? draft.allowed_schemas : deriveSchemas(allowedRelations);

  return ReportContractSchema.parse({
    id: state.contract_id ?? `contract_${randomUUID()}`,
    name,
    audience: draft.audience.trim().length > 0 ? draft.audience.trim() : "Executive",
    timezone: draft.timezone.trim().length > 0 ? draft.timezone.trim() : "UTC",
    schedule_cron: draft.schedule_cron,
    sql_template: sql,
    metric_ids: draft.metric_ids,
    dimension_ids: draft.dimension_ids,
    guardrails: {
      evidence_row_cap: 200,
      max_batches: 5,
      allowed_relations: allowedRelations,
      allowed_schemas: allowedSchemas,
      timeout_ms: DEFAULT_TIMEOUT_MS,
      deny_write: true
    }
  });
}

function deriveSchemas(relations: string[]): string[] {
  const schemas = relations
    .map((relation) => relation.split(".")[0]?.trim())
    .filter((value): value is string => Boolean(value));

  if (schemas.length === 0) {
    return ["analytics"];
  }

  return Array.from(new Set(schemas));
}

function renderPreview(state: ChatState): string {
  const draft = state.draft;
  const preview = {
    ...draft,
    contract_id: state.contract_id,
    last_run_id: state.last_run_id,
    has_exec_brief: state.last_exec_brief !== null
  };

  return `Current draft\n${JSON.stringify(preview, null, 2)}\n\n${renderDraftChecklist(state)}`;
}

function renderDraftChecklist(state: ChatState): string {
  const missing = getMissingDraftFields(state);

  if (missing.length === 0) {
    return state.contract_id
      ? "Everything looks good - you can run it now."
      : "The draft is ready. Say \"run\" to execute or \"save\" to save it for later.";
  }

  return `I still need: ${missing.join(", ")}.`;
}

function renderContractList(contracts: ReportContractRecord[]): string {
  if (contracts.length === 0) {
    return "No report contracts yet. Describe a report and I'll create one for you.";
  }

  const lines = contracts.slice(0, 12).map((contract) => {
    const schedule = contract.schedule_cron ?? "manual";
    return `  - ${contract.name} (${schedule}, ${contract.timezone})`;
  });

  return `Here are your saved contracts:\n${lines.join("\n")}`;
}

function renderConnectedTables(context: ConnectionContextRecord): string {
  if (!context.connected) {
    return "No database connected yet. Head over to /connect to hook up your Postgres database.";
  }

  const tables = context.allowed_relations.length > 0 ? context.allowed_relations : context.available_relations;
  if (tables.length === 0) {
    return "Your database is connected, but no tables have been selected yet. Use /connect to pick the ones you want to work with.";
  }

  const lines = tables.slice(0, 40).map((table) => `  - ${table}`);
  return [
    `Connected to ${context.database ?? context.name ?? "your database"} with ${tables.length} table${tables.length === 1 ? "" : "s"}:`,
    lines.join("\n"),
    `\nSay "use connected tables" to pull these into your report draft.`
  ].join("\n");
}

function renderSafeQueryResult(result: SafeQueryResponseRecord): string {
  const preview = result.rows.slice(0, 10);

  const parts = [`Query returned ${result.row_count} row${result.row_count === 1 ? "" : "s"}.`];

  if (result.warnings.length > 0) {
    parts.push(`Note: ${result.warnings.join("; ")}`);
  }

  parts.push(`\nPreview (first ${Math.min(10, preview.length)}):\n${JSON.stringify(preview, null, 2)}`);

  return parts.join("\n");
}

function renderExecBrief(execBrief: ExecBriefRecord): string {
  const bullet = (items: string[]) =>
    items.length > 0 ? items.map((item) => `  - ${item}`).join("\n") : "  (none detected)";

  const sections = [
    `What changed:\n${bullet(execBrief.what_changed)}`,
    `Why it changed:\n${bullet(execBrief.why)}`,
    `What it means:\n${bullet(execBrief.so_what)}`,
    `Recommended actions:\n${bullet(execBrief.what_to_do)}`
  ];

  if (execBrief.deltas_vs_last_run.length > 0) {
    sections.push(`Changes since last run:\n${bullet(execBrief.deltas_vs_last_run)}`);
  }

  sections.push(`Confidence: ${(execBrief.confidence.score * 100).toFixed(0)}%`);

  return sections.join("\n\n");
}

function answerConversationalPrompt(command: string, state: ChatState): ChatTurnResponse | null {
  if (isWellbeingQuestion(command)) {
    return {
      assistant_message:
        "Doing great, thanks for asking! What kind of report are you looking to build? Tell me the audience and the key metric, and I'll get a draft going.",
      state
    };
  }

  if (isGreeting(command)) {
    return {
      assistant_message:
        "Hey! I'm your report assistant - I can help you set up a report, run it against your data, and generate a polished PDF. What are you working on?",
      state
    };
  }

  if (isThanks(command)) {
    return {
      assistant_message: "Happy to help! Let me know if you want to tweak anything or build another report.",
      state
    };
  }

  if (asksForCapabilities(command)) {
    return {
      assistant_message:
        "I can help you with the full report workflow:\n" +
        "- Define what to track (metrics, dimensions, SQL)\n" +
        "- Connect to your database and run safe read-only queries\n" +
        "- Execute the report pipeline and analyze the results\n" +
        "- Generate a PDF you can share with stakeholders\n\n" +
        "Just describe what you need and I'll guide you through it.",
      state
    };
  }

  if (asksForFindings(command)) {
    if (!state.last_exec_brief) {
      return {
        assistant_message: "I haven't run an analysis yet. Say \"run\" and I'll execute the report and show you what I find.",
        state
      };
    }

    return {
      assistant_message: summarizeExecBrief(state.last_exec_brief),
      state
    };
  }

  if (asksForPdf(command)) {
    if (!state.last_run_id) {
      return {
        assistant_message: "No report has been run yet. Say \"run\" first and I'll generate the PDF for you.",
        state
      };
    }

    return {
      assistant_message: `Here's your PDF - click to download: /api/runs/${state.last_run_id}/pdf`,
      state,
      pdf_download_url: `/api/runs/${state.last_run_id}/pdf`
    };
  }

  return null;
}

function isGreeting(command: string): boolean {
  const normalized = command.trim();
  return /\b(hi|hello|hey|yo|good morning|good evening)\b/.test(normalized);
}

function isWellbeingQuestion(command: string): boolean {
  return /\b(how are you|how are you doing|how's it going|how is it going|how do you do)\b/.test(command);
}

function isThanks(command: string): boolean {
  return /\b(thanks|thank you|thx)\b/.test(command);
}

function asksForCapabilities(command: string): boolean {
  return /\b(what can you do|help me|how does this work|what do you do)\b/.test(command);
}

function asksForFindings(command: string): boolean {
  const patterns = [
    "what did you find",
    "what did it find",
    "what did you analyze",
    "tell me what you found",
    "tell me what it found",
    "what did you learn",
    "summary",
    "insights",
    "findings",
    "what changed"
  ];

  return patterns.some((pattern) => command.includes(pattern));
}

function asksForPdf(command: string): boolean {
  return command.includes("pdf") || command.includes("download");
}

function asksForConnectedTables(command: string): boolean {
  return /\b(connected tables|which tables|show tables|list tables|what tables)\b/.test(command);
}

function asksToUseConnectedTables(command: string): boolean {
  return /\b(use connected tables|sync connected tables|use connected db|use database tables)\b/.test(command);
}

async function syncConnectedTables(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const context = await apiClient.getConnectionContext();

  if (!context.connected || context.allowed_relations.length === 0) {
    return {
      assistant_message:
        "No tables available yet. Head to /connect to connect your database and pick the tables you want to use.",
      state
    };
  }

  const nextState = parseChatState(state);
  nextState.draft.allowed_relations = [...context.allowed_relations];
  nextState.draft.allowed_schemas = [...context.allowed_schemas];

  const firstRelation = context.allowed_relations[0];
  if (
    nextState.draft.sql_template.trim().toLowerCase() === "select * from analytics.sales" ||
    nextState.draft.sql_template.trim().length === 0
  ) {
    nextState.draft.sql_template = `SELECT * FROM ${firstRelation}`;
  }

  nextState.contract_id = null;

  return {
    assistant_message:
      `Pulled in ${context.allowed_relations.length} table${context.allowed_relations.length === 1 ? "" : "s"} from your connected database.\n` +
      `Default query set to: ${nextState.draft.sql_template}\n` +
      renderDraftChecklist(nextState),
    state: nextState
  };
}

function summarizeExecBrief(execBrief: ExecBriefRecord): string {
  const top = (items: string[]) => (items.length > 0 ? items[0] : "Nothing notable");

  return [
    `Here's a quick summary of the last run:\n`,
    `The main finding is: ${top(execBrief.what_changed)}`,
    `This happened because: ${top(execBrief.why)}`,
    `What it means for the business: ${top(execBrief.so_what)}`,
    `I'd recommend: ${top(execBrief.what_to_do)}`,
    `\nConfidence: ${(execBrief.confidence.score * 100).toFixed(0)}%`,
    `\nWant the full PDF? Just say "download".`
  ].join("\n");
}

function detectConversationalAction(command: string): "run" | "save" | "preview" | "list" | null {
  if (/\b(run|execute|start now|run now|launch)\b/.test(command)) {
    return "run";
  }

  if (/\b(save|store|persist)\b/.test(command)) {
    return "save";
  }

  if (/\b(preview|show draft|show contract|what do you have)\b/.test(command)) {
    return "preview";
  }

  if (/\b(list contracts|show contracts|list reports|list)\b/.test(command)) {
    return "list";
  }

  return null;
}

function asksForMissingDetails(command: string): boolean {
  return /\b(what do you still need|what else do you need|anything missing|what is missing)\b/.test(command);
}

function renderMissingDetails(state: ChatState): string {
  const missing = getMissingDraftFields(state);
  if (missing.length === 0) {
    return "You're all set - everything I need is filled in. Say \"run\" when you're ready!";
  }

  return `I still need: ${missing.join(", ")}. Once you provide ${missing.length === 1 ? "that" : "those"}, we're good to go.`;
}

function renderOpenEndedFallback(state: ChatState): string {
  const missing = getMissingDraftFields(state);
  if (missing.length > 0) {
    return [
      "I'm not sure what you meant there.",
      `To continue building the report, I still need: ${missing.join(", ")}.`,
      `For example, try: "Call it ${suggestReportName(state)} and run it"`
    ].join("\n");
  }

  return [
    "I'm not sure what you meant. Here are some things you can try:",
    "  - \"run\" to execute the report",
    "  - \"what did you find?\" to see the analysis",
    "  - \"download\" to get the PDF",
    "  - or describe what you'd like to change"
  ].join("\n");
}

function renderReportDiscoveryPrompt(state: ChatState): string {
  const draft = state.draft;

  return [
    "Great, let's build that report! Here's what I have so far:",
    `  Audience: ${draft.audience}`,
    `  Tracking: ${draft.metric_ids.join(", ")} by ${draft.dimension_ids.join(", ")}`,
    `  Suggested name: ${suggestReportName(state)}`,
    "\nFeel free to adjust anything, or say \"run\" when you're ready."
  ].join("\n");
}

function suggestsWeeklyCadence(state: ChatState): boolean {
  return state.draft.schedule_cron === "0 18 * * 5";
}

function suggestReportName(state: ChatState): string {
  if (state.draft.name.trim().length > 0) {
    return state.draft.name.trim();
  }

  const audience = state.draft.audience.trim().length > 0 ? state.draft.audience : "Executive";
  const cadence = suggestsWeeklyCadence(state) ? "Weekly" : "Performance";
  return `${cadence} ${audience} Report`;
}

function getMissingDraftFields(state: ChatState): string[] {
  const missing: string[] = [];
  if (state.draft.name.trim().length === 0) {
    missing.push("name");
  }

  if (!/^\s*select\b/i.test(state.draft.sql_template)) {
    missing.push("sql_template (must start with SELECT)");
  }

  return missing;
}

function expressesReportIntent(command: string): boolean {
  const hasReportWord = /\b(report|brief|dashboard|analysis)\b/.test(command);
  const hasIntentWord = /\b(need|want|create|build|make|prepare|generate)\b/.test(command);
  return hasReportWord && hasIntentWord;
}

function applyNaturalLanguageDraftUpdates(
  message: string,
  state: ChatState
): { state: ChatState; updated_fields: string[] } {
  const next = parseChatState(state);
  const updated = new Set<string>();
  const lower = message.toLowerCase();

  const explicitNameMatch =
    message.match(/(?:name\s+(?:to|as|is)\s+|call\s+(?:it|this)\s+)([^.?!]+)/i) ??
    message.match(/(?:called|named)\s+["']?([^"'.?!]+)["']?/i);

  if (explicitNameMatch) {
    const parsedName = explicitNameMatch[1].trim();
    if (parsedName.length > 0) {
      next.draft.name = parsedName;
      next.contract_id = null;
      updated.add("name");
    }
  }

  if (lower.includes("ceo")) {
    if (next.draft.audience !== "CEO") {
      next.draft.audience = "CEO";
      next.contract_id = null;
      updated.add("audience");
    }
  } else if (lower.includes("cfo")) {
    if (next.draft.audience !== "CFO") {
      next.draft.audience = "CFO";
      next.contract_id = null;
      updated.add("audience");
    }
  } else if (lower.includes("ops")) {
    if (next.draft.audience !== "Ops") {
      next.draft.audience = "Ops";
      next.contract_id = null;
      updated.add("audience");
    }
  }

  const timezoneMatch = message.match(/\btimezone(?:\s*(?:to|as|is))?\s*([A-Za-z_/+-]+)/i);
  if (timezoneMatch) {
    const timezone = timezoneMatch[1].trim();
    if (timezone.length > 0) {
      next.draft.timezone = timezone;
      next.contract_id = null;
      updated.add("timezone");
    }
  }

  if (lower.includes("weekly") || lower.includes("every friday")) {
    if (next.draft.schedule_cron !== "0 18 * * 5") {
      next.draft.schedule_cron = "0 18 * * 5";
      next.contract_id = null;
      updated.add("schedule_cron");
    }
  } else if (lower.includes("daily")) {
    if (next.draft.schedule_cron !== "0 9 * * *") {
      next.draft.schedule_cron = "0 9 * * *";
      next.contract_id = null;
      updated.add("schedule_cron");
    }
  } else if (lower.includes("monthly")) {
    if (next.draft.schedule_cron !== "0 9 1 * *") {
      next.draft.schedule_cron = "0 9 1 * *";
      next.contract_id = null;
      updated.add("schedule_cron");
    }
  }

  if (lower.includes("by region") && !next.draft.dimension_ids.includes("region")) {
    next.draft.dimension_ids = Array.from(new Set([...next.draft.dimension_ids, "region"]));
    next.contract_id = null;
    updated.add("dimension_ids");
  }

  if (lower.includes("by channel") && !next.draft.dimension_ids.includes("channel")) {
    next.draft.dimension_ids = Array.from(new Set([...next.draft.dimension_ids, "channel"]));
    next.contract_id = null;
    updated.add("dimension_ids");
  }

  if (lower.includes("revenue") && !next.draft.metric_ids.includes("metric_revenue")) {
    next.draft.metric_ids = Array.from(new Set([...next.draft.metric_ids, "metric_revenue"]));
    next.contract_id = null;
    updated.add("metric_ids");
  }

  if (lower.includes("orders") && !next.draft.metric_ids.includes("metric_orders")) {
    next.draft.metric_ids = Array.from(new Set([...next.draft.metric_ids, "metric_orders"]));
    next.contract_id = null;
    updated.add("metric_ids");
  }

  if (lower.includes("sales_enriched")) {
    next.draft.allowed_relations = Array.from(new Set([...next.draft.allowed_relations, "analytics.sales_enriched"]));
    next.draft.allowed_schemas = Array.from(new Set([...next.draft.allowed_schemas, "analytics"]));
    next.contract_id = null;
    updated.add("allowed_relations");
  }

  if (
    lower.includes("revenue by region") &&
    next.draft.sql_template.trim().toLowerCase() === "select * from analytics.sales"
  ) {
    next.draft.sql_template =
      "SELECT region, SUM(amount) AS amount, MIN(event_time) AS event_time FROM analytics.sales GROUP BY region";
    next.contract_id = null;
    updated.add("sql_template");
  }

  return {
    state: next,
    updated_fields: [...updated]
  };
}

async function parseJsonResponse<TSchema extends z.ZodTypeAny>(
  response: Response,
  schema: TSchema
): Promise<z.output<TSchema>> {
  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : `API request failed with status ${response.status}`;
    throw new Error(message);
  }

  return schema.parse(payload);
}
