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
  allowed_schemas: z.array(z.string()),
  insight_mode: z.enum(["business", "data"]).default("business")
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
  conversation_history: z.array(ChatHistoryTurnSchema).max(40).default([]),
  scope_pending: z.boolean().default(false)
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
  exec_brief_html?: string;
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
    exec_brief_html?: string;
    pdf_path?: string;
  }>;
  downloadRunPdf(runId: string): Promise<Response>;
  getConnectionContext(): Promise<ConnectionContextRecord>;
  runSafeQuery(sql: string, limit?: number): Promise<SafeQueryResponseRecord>;
  getCatalog(): Promise<DataCatalogRecord>;
  getTableHealth(): Promise<RelationHealthRecord[]>;
}

const RunContractResponseSchema = z.object({
  run_id: z.string().min(1),
  exec_brief: ExecBriefSchema,
  exec_brief_html: z.string().optional(),
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

const TableColumnInfoSchema = z.object({
  column_name: z.string(),
  data_type: z.string(),
  is_nullable: z.boolean()
});

const TableCatalogEntrySchema = z.object({
  qualified_name: z.string(),
  relation_type: z.enum(["TABLE", "VIEW", "MATERIALIZED VIEW"]),
  columns: z.array(TableColumnInfoSchema),
  sample_rows: z.array(z.record(z.string(), z.unknown())),
  row_count_estimate: z.number().int().min(0)
});

const DataCatalogSchema = z.object({
  tables: z.array(TableCatalogEntrySchema).default([]),
  business_context: z.string().default(""),
  cataloged_at: z.string().nullable().default(null)
});

type DataCatalogRecord = z.output<typeof DataCatalogSchema>;

const RelationHealthSchema = z.object({
  schema_name: z.string(),
  relation_name: z.string(),
  qualified_name: z.string(),
  has_select_privilege: z.boolean(),
  rls_active_for_me: z.boolean(),
  policies_count_for_me: z.number(),
  status: z.enum(["OK", "NO_SELECT_GRANT", "RLS_NO_POLICY"]),
  status_label: z.string()
});

const TableHealthResponseSchema = z.object({
  relations: z.array(RelationHealthSchema).default([])
});

type RelationHealthRecord = z.output<typeof RelationHealthSchema>;

const DEFAULT_DRAFT: ChatDraft = {
  name: "",
  audience: "Executive",
  timezone: "UTC",
  schedule_cron: null,
  sql_template: "SELECT * FROM analytics.sales",
  metric_ids: ["metric_revenue"],
  dimension_ids: ["region"],
  allowed_relations: ["analytics.sales"],
  allowed_schemas: ["analytics"],
  insight_mode: "business"
};

export const MAX_CONVERSATION_TURNS = 12;

export function createInitialChatState(): ChatState {
  return {
    draft: {
      ...DEFAULT_DRAFT,
      metric_ids: [...DEFAULT_DRAFT.metric_ids],
      dimension_ids: [...DEFAULT_DRAFT.dimension_ids],
      allowed_relations: [...DEFAULT_DRAFT.allowed_relations],
      allowed_schemas: [...DEFAULT_DRAFT.allowed_schemas],
      insight_mode: DEFAULT_DRAFT.insight_mode
    },
    contract_id: null,
    last_run_id: null,
    last_exec_brief: null,
    conversation_history: [],
    scope_pending: false
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
      allowed_schemas: [...parsed.data.draft.allowed_schemas],
      insight_mode: parsed.data.draft.insight_mode ?? "business"
    },
    contract_id: parsed.data.contract_id,
    last_run_id: parsed.data.last_run_id,
    last_exec_brief: parsed.data.last_exec_brief,
    conversation_history: [...parsed.data.conversation_history],
    scope_pending: parsed.data.scope_pending ?? false
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

// ---------------------------------------------------------------------------
// applyLlmDraftUpdates — merges structured LLM draft updates into state
// ---------------------------------------------------------------------------

import type { DraftUpdates } from "./conversation";

export function applyLlmDraftUpdates(state: ChatState, updates: DraftUpdates): ChatState {
  const next = parseChatState(state);
  let changed = false;

  if (updates.name !== undefined && updates.name !== next.draft.name) {
    next.draft.name = updates.name;
    changed = true;
  }

  if (updates.audience !== undefined && updates.audience !== next.draft.audience) {
    next.draft.audience = updates.audience;
    changed = true;
  }

  if (updates.timezone !== undefined && updates.timezone !== next.draft.timezone) {
    next.draft.timezone = updates.timezone;
    changed = true;
  }

  if (updates.schedule_cron !== undefined && updates.schedule_cron !== next.draft.schedule_cron) {
    next.draft.schedule_cron = updates.schedule_cron;
    changed = true;
  }

  if (updates.sql_template !== undefined && /^\s*(select|with)\b/i.test(updates.sql_template) && updates.sql_template !== next.draft.sql_template) {
    next.draft.sql_template = updates.sql_template;
    changed = true;
  }

  if (updates.metric_ids !== undefined && updates.metric_ids.length > 0) {
    next.draft.metric_ids = Array.from(new Set([...next.draft.metric_ids, ...updates.metric_ids]));
    changed = true;
  }

  if (updates.dimension_ids !== undefined && updates.dimension_ids.length > 0) {
    next.draft.dimension_ids = Array.from(new Set([...next.draft.dimension_ids, ...updates.dimension_ids]));
    changed = true;
  }

  if (updates.allowed_relations !== undefined && updates.allowed_relations.length > 0) {
    next.draft.allowed_relations = Array.from(new Set([...next.draft.allowed_relations, ...updates.allowed_relations]));
    const derivedSchemas = updates.allowed_relations.map((r) => r.split(".")[0]).filter(Boolean);
    next.draft.allowed_schemas = Array.from(new Set([...next.draft.allowed_schemas, ...derivedSchemas]));
    changed = true;
  }

  if (updates.allowed_schemas !== undefined && updates.allowed_schemas.length > 0) {
    next.draft.allowed_schemas = Array.from(new Set([...next.draft.allowed_schemas, ...updates.allowed_schemas]));
    changed = true;
  }

  if (updates.insight_mode !== undefined && updates.insight_mode !== next.draft.insight_mode) {
    next.draft.insight_mode = updates.insight_mode;
    changed = true;
  }

  if (changed) {
    next.contract_id = null;
  }

  return next;
}

// ---------------------------------------------------------------------------
// verifyDataScope — checks tables exist, are accessible, and have data
// ---------------------------------------------------------------------------

type VerificationResult = {
  ok: boolean;
  blocking_message?: string;
  warning_lines: string[];
};

async function verifyDataScope(
  draft: ChatDraft,
  apiClient: WebApiClient
): Promise<VerificationResult> {
  const warnings: string[] = [];

  if (draft.allowed_relations.length === 0) {
    return {
      ok: false,
      blocking_message: "No tables are scoped for this report. Tell me which tables to analyze, or say 'use connected tables' to include all available tables.",
      warning_lines: []
    };
  }

  // Step 1: Check table health (permissions, RLS)
  const relations = await apiClient.getTableHealth();
  const healthMap = new Map(relations.map((r) => [r.qualified_name.toLowerCase(), r.status]));

  const blockedTables: string[] = [];
  const rlsTables: string[] = [];
  const missingTables: string[] = [];

  if (relations.length > 0) {
    for (const relation of draft.allowed_relations) {
      const status = healthMap.get(relation.toLowerCase());
      if (status === undefined) {
        missingTables.push(relation);
      } else if (status === "NO_SELECT_GRANT") {
        blockedTables.push(relation);
      } else if (status === "RLS_NO_POLICY") {
        rlsTables.push(relation);
      }
    }
  }

  if (blockedTables.length > 0) {
    return {
      ok: false,
      blocking_message: [
        `Cannot read these tables (no SELECT permission): ${blockedTables.join(", ")}.`,
        "Visit the connection wizard to generate a GRANT SQL fix script, or remove these tables from the scope."
      ].join("\n"),
      warning_lines: []
    };
  }

  if (missingTables.length > 0) {
    return {
      ok: false,
      blocking_message: [
        `These tables don't exist in your connected database: ${missingTables.join(", ")}.`,
        "They may have been renamed or dropped. Update your table scope or say 'use connected tables'."
      ].join("\n"),
      warning_lines: []
    };
  }

  if (rlsTables.length > 0) {
    warnings.push(`${rlsTables.join(", ")} ${rlsTables.length === 1 ? "has" : "have"} Row-Level Security active but no policy for this role — data access may be restricted.`);
  }

  // Step 2: Row-count check on primary table
  const primaryTable = draft.allowed_relations[0];
  try {
    const countResult = await apiClient.runSafeQuery(
      `SELECT COUNT(*) AS row_count FROM ${primaryTable}`,
      1
    );

    const firstRow = countResult.rows[0];
    const rowCount = firstRow ? Number(firstRow["row_count"] ?? firstRow["count"] ?? 0) : 0;

    if (rowCount === 0) {
      return {
        ok: false,
        blocking_message: [
          `The table ${primaryTable} appears to be empty (0 rows).`,
          "There's no data to analyze. Check that data is being loaded into this table."
        ].join("\n"),
        warning_lines: warnings
      };
    }

    warnings.push(`Data verified: ${primaryTable} contains ${rowCount.toLocaleString()} rows.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    warnings.push(`Could not verify row count for ${primaryTable}: ${message}`);
  }

  return {
    ok: true,
    warning_lines: warnings
  };
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
    },
    async getCatalog() {
      const response = await fetcher(`${baseUrl}/connections/catalog`, {
        method: "GET"
      });

      return parseJsonResponse(response, DataCatalogSchema);
    },
    async getTableHealth() {
      try {
        const response = await fetcher(`${baseUrl}/connections/tables`, {
          method: "GET"
        });

        if (!response.ok) return [];
        const result = await parseJsonResponse(response, TableHealthResponseSchema);
        return result.relations;
      } catch {
        return [];
      }
    }
  };
}

// ---------------------------------------------------------------------------
// handleChatTurn — action router
//
// Detects and executes concrete actions (save, run, query, draft updates).
// Everything else returns minimal context for the LLM to generate a response.
// ---------------------------------------------------------------------------

export async function handleChatTurn(input: {
  message: string;
  state: ChatState;
  api_client: WebApiClient;
}): Promise<ChatTurnResponse> {
  const rawMessage = input.message.trim();
  const command = rawMessage.toLowerCase();
  let nextState = parseChatState(input.state);

  // --- Scope confirmation: if pending and user confirms, execute the run ---

  if (nextState.scope_pending && isScopeConfirmation(command)) {
    nextState.scope_pending = false;
    return executeRun(nextState, input.api_client);
  }

  // --- Explicit actions ---

  if (command === "save") {
    return executeSave(nextState, input.api_client);
  }

  if (command === "run") {
    return maybeScopeConfirmOrRun(nextState, input.api_client);
  }

  if (command === "preview" || command === "/preview") {
    return {
      assistant_message: `Draft preview:\n${JSON.stringify(nextState.draft, null, 2)}\nContract: ${nextState.contract_id ?? "not saved"}. Last run: ${nextState.last_run_id ?? "none"}.`,
      state: nextState
    };
  }

  if (asksForPdf(command)) {
    if (!nextState.last_run_id) {
      return { assistant_message: "No report has been run yet.", state: nextState };
    }
    return {
      assistant_message: `PDF available for run ${nextState.last_run_id}.`,
      state: nextState,
      pdf_download_url: `/api/runs/${nextState.last_run_id}/pdf`
    };
  }

  if (asksToUseConnectedTables(command)) {
    return syncConnectedTables(nextState, input.api_client);
  }

  const queryCommand = parseQueryCommand(rawMessage);
  if (queryCommand) {
    const result = await input.api_client.runSafeQuery(queryCommand.sql, queryCommand.limit);
    const preview = result.rows.slice(0, 10);
    const warnings = result.warnings.length > 0 ? `\nWarnings: ${result.warnings.join("; ")}` : "";
    return {
      assistant_message: `Query returned ${result.row_count} row${result.row_count === 1 ? "" : "s"}.${warnings}\nPreview:\n${JSON.stringify(preview, null, 2)}`,
      state: nextState
    };
  }

  if (command === "list contracts" || command === "list") {
    const contracts = await input.api_client.listContracts();
    if (contracts.length === 0) {
      return { assistant_message: "No contracts saved yet.", state: nextState };
    }
    const lines = contracts.slice(0, 12).map((c) => `${c.name} (${c.schedule_cron ?? "manual"}, ${c.timezone})`);
    return {
      assistant_message: `${contracts.length} contract${contracts.length === 1 ? "" : "s"}:\n${lines.join("\n")}`,
      state: nextState
    };
  }

  // --- Set commands ---

  // --- Insight mode switch ---
  const insightMode = detectInsightMode(command);
  if (insightMode) {
    nextState.draft.insight_mode = insightMode;
    nextState.contract_id = null;
    const label = insightMode === "data" ? "Data Quality" : "Business Insights";
    return {
      assistant_message: `Insight mode set to **${label}**. ${insightMode === "data" ? "I'll focus on data quality, completeness, anomalies, and issues you can fix." : "I'll focus on business trends, opportunities, risks, and actionable recommendations — treating your data as trustworthy."}`,
      state: nextState
    };
  }

  const setCommand = parseSetCommand(rawMessage);
  if (setCommand) {
    const applied = applySetCommand(nextState, setCommand.field, setCommand.value);
    if (applied.updated) {
      nextState = applied.state;
      return {
        assistant_message: `Draft updated: ${setCommand.field} set to "${setCommand.value}".`,
        state: nextState
      };
    }
  }

  // --- Natural language draft updates ---

  const natural = applyNaturalLanguageDraftUpdates(rawMessage, nextState);
  if (natural.updated_fields.length > 0) {
    nextState = natural.state;

    // Only auto-trigger save if explicitly mentioned — never auto-trigger run
    // from draft updates. Let the user have a conversation first.
    const action = detectConversationalAction(command);
    if (action === "save") return executeSave(nextState, input.api_client);

    return {
      assistant_message: `Draft updated: ${natural.updated_fields.join(", ")}.`,
      state: nextState
    };
  }

  // --- Simple intent inference ---

  const inferred = inferSimpleIntent(rawMessage, nextState);
  if (inferred) return inferred;

  // --- Conversational action mentions (e.g. "let's run it") ---

  const action = detectConversationalAction(command);
  if (action === "run") return maybeScopeConfirmOrRun(nextState, input.api_client);
  if (action === "save") return executeSave(nextState, input.api_client);
  if (action === "list") {
    const contracts = await input.api_client.listContracts();
    if (contracts.length === 0) {
      return { assistant_message: "No contracts saved yet.", state: nextState };
    }
    const lines = contracts.slice(0, 12).map((c) => `${c.name} (${c.schedule_cron ?? "manual"}, ${c.timezone})`);
    return {
      assistant_message: `${contracts.length} contract${contracts.length === 1 ? "" : "s"}:\n${lines.join("\n")}`,
      state: nextState
    };
  }

  // --- No action — LLM handles the conversation ---

  return {
    assistant_message: buildStateContext(nextState),
    state: nextState
  };
}

// ---------------------------------------------------------------------------
// Action executors
// ---------------------------------------------------------------------------

async function executeSave(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const missing = getMissingDraftFields(state);
  if (missing.length > 0) {
    return { assistant_message: `Cannot save yet: ${missing.join(", ")}.`, state };
  }

  const contract = buildContractPayload(state);
  const created = await apiClient.createContract(contract);
  const nextState = parseChatState(state);
  nextState.contract_id = created.id;

  return {
    assistant_message: `Contract saved. ID: ${created.id}. Name: "${created.name}".`,
    state: nextState
  };
}

async function maybeScopeConfirmOrRun(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  if (state.scope_pending) {
    // Already confirmed scope in a previous turn — run now
    const nextState = parseChatState(state);
    nextState.scope_pending = false;
    return executeRun(nextState, apiClient);
  }

  // Show scope confirmation first
  return buildScopeConfirmation(state, apiClient);
}

async function buildScopeConfirmation(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const missing = getMissingDraftFields(state);
  if (missing.length > 0) {
    return { assistant_message: `Cannot run yet: ${missing.join(", ")}.`, state };
  }

  // Verify data scope before showing confirmation
  const verification = await verifyDataScope(state.draft, apiClient);
  if (!verification.ok) {
    return {
      assistant_message: verification.blocking_message!,
      state
    };
  }

  const nextState = parseChatState(state);
  nextState.scope_pending = true;

  const draft = nextState.draft;
  const tables = draft.allowed_relations.length > 0 ? draft.allowed_relations.join(", ") : "default tables";
  const metrics = draft.metric_ids.length > 0 ? draft.metric_ids.map(m => m.replace(/^metric_/, "")).join(", ") : "all available";
  const dimensions = draft.dimension_ids.length > 0 ? draft.dimension_ids.join(", ") : "none specified";
  const modeLabel = draft.insight_mode === "data" ? "Data Quality" : "Business Insights";

  // Try to detect date/time columns from catalog for timeline context
  let timelineHint = "all available data in the selected tables";
  try {
    const catalog = await apiClient.getCatalog();
    const dateColumns: string[] = [];
    for (const table of catalog.tables) {
      for (const col of table.columns) {
        if (/date|time|timestamp|created|updated/i.test(col.column_name) && /timestamp|date|time/i.test(col.data_type)) {
          dateColumns.push(`${table.qualified_name}.${col.column_name}`);
        }
      }
    }
    if (dateColumns.length > 0) {
      timelineHint = `Data will be scoped using time columns: ${dateColumns.slice(0, 3).join(", ")}${dateColumns.length > 3 ? ` (+${dateColumns.length - 3} more)` : ""}`;
    }
  } catch {
    // catalog unavailable — use default hint
  }

  const reportName = draft.name.trim().length > 0 ? draft.name.trim() : "Untitled Report";

  const verificationLines = verification.warning_lines.length > 0
    ? ["", "Data verification:", ...verification.warning_lines.map((w) => `- ${w}`)]
    : [];

  const scopeMessage = [
    `Ready to run: "${reportName}"`,
    "",
    "Scope summary:",
    `- Tables: ${tables}`,
    `- Metrics: ${metrics}`,
    `- Dimensions: ${dimensions}`,
    `- Mode: ${modeLabel}`,
    `- Timeline: ${timelineHint}`,
    ...verificationLines,
    "",
    "Quality: Only analysis sections scoring 90%+ confidence will be included.",
    "",
    'Say "confirm" to run, or tell me what to adjust.'
  ].join("\n");

  return {
    assistant_message: scopeMessage,
    state: nextState
  };
}

function isScopeConfirmation(command: string): boolean {
  return /\b(confirm|yes|go ahead|proceed|looks good|lgtm|run it|do it|execute|approved|ok|okay|sure|start)\b/.test(command);
}

async function executeRun(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const missing = getMissingDraftFields(state);
  if (missing.length > 0) {
    return { assistant_message: `Cannot run yet: ${missing.join(", ")}.`, state };
  }

  let nextState = parseChatState(state);
  nextState.scope_pending = false;

  if (!nextState.contract_id) {
    const contract = buildContractPayload(nextState);
    const created = await apiClient.createContract(contract);
    nextState.contract_id = created.id;
  }

  const run = await apiClient.runContract(nextState.contract_id!);
  nextState.last_run_id = run.run_id;
  nextState.last_exec_brief = run.exec_brief;

  const brief = run.exec_brief;
  const briefLines = [
    `What changed: ${brief.what_changed.join("; ") || "nothing notable"}`,
    `Why: ${brief.why.join("; ") || "unknown"}`,
    `So what: ${brief.so_what.join("; ") || "no impact noted"}`,
    `Recommended: ${brief.what_to_do.join("; ") || "no action needed"}`,
    `Confidence: ${(brief.confidence.score * 100).toFixed(0)}%`
  ];

  return {
    assistant_message: `Report executed. Run ID: ${run.run_id}.\n${briefLines.join("\n")}\nPDF available.`,
    state: nextState,
    pdf_download_url: `/api/runs/${run.run_id}/pdf`,
    exec_brief_html: run.exec_brief_html
  };
}

// ---------------------------------------------------------------------------
// State context builder (for LLM when no action was taken)
// ---------------------------------------------------------------------------

function buildStateContext(state: ChatState): string {
  const modeLabel = state.draft.insight_mode === "data" ? "Data Quality" : "Business Insights";
  const parts = [
    `Current draft: ${state.draft.audience} audience, ${modeLabel} mode, tracking ${state.draft.metric_ids.join(", ")} by ${state.draft.dimension_ids.join(", ")}.`
  ];

  if (state.draft.name) {
    parts.push(`Report name: "${state.draft.name}".`);
  }

  if (state.contract_id) {
    parts.push(`Saved as ${state.contract_id}.`);
  }

  if (state.last_run_id) {
    parts.push(`Last run: ${state.last_run_id}.`);
  }

  if (state.last_exec_brief) {
    const eb = state.last_exec_brief;
    parts.push(
      `Last analysis: ${eb.what_changed.join("; ")}. ` +
      `Confidence: ${(eb.confidence.score * 100).toFixed(0)}%.`
    );
  }

  parts.push("No specific action was executed for this message.");
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

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
    case "insight_mode":
    case "mode":
      if (value === "data" || value === "business") {
        next.draft.insight_mode = value;
        next.contract_id = null;
        return { state: next, updated: true };
      }
      return { state: next, updated: false };
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
  const changes: string[] = [];

  if (lowered.startsWith("create ") || lowered.startsWith("new report")) {
    const guessedName = message.replace(/^(create|new report)\s*/i, "").trim();
    if (guessedName.length > 0) {
      nextState.draft.name = guessedName;
      nextState.contract_id = null;
      changes.push(`name to "${guessedName}"`);
    }
  }

  if (changes.length === 0 && looksLikeReportTitle(lowered)) {
    nextState.draft.name = message.trim();
    nextState.contract_id = null;
    changes.push(`name to "${message.trim()}"`);
  }

  const audience = extractAudience(lowered);
  if (audience && nextState.draft.audience !== audience) {
    nextState.draft.audience = audience;
    nextState.contract_id = null;
    changes.push(`audience to ${audience}`);
  }

  if (lowered.includes("by region") && !nextState.draft.dimension_ids.includes("region")) {
    nextState.draft.dimension_ids = Array.from(new Set([...nextState.draft.dimension_ids, "region"]));
    nextState.contract_id = null;
    changes.push("added region dimension");
  }
  if (lowered.includes("by channel") && !nextState.draft.dimension_ids.includes("channel")) {
    nextState.draft.dimension_ids = Array.from(new Set([...nextState.draft.dimension_ids, "channel"]));
    nextState.contract_id = null;
    changes.push("added channel dimension");
  }

  if (lowered.includes("weekly") && nextState.draft.schedule_cron !== "0 18 * * 5") {
    nextState.draft.schedule_cron = "0 18 * * 5";
    nextState.contract_id = null;
    changes.push("schedule to weekly (Fridays at 18:00)");
  } else if (lowered.includes("daily") && nextState.draft.schedule_cron !== "0 9 * * *") {
    nextState.draft.schedule_cron = "0 9 * * *";
    nextState.contract_id = null;
    changes.push("schedule to daily (09:00)");
  }

  if (changes.length > 0) {
    return {
      assistant_message: `Draft updated: ${changes.join(", ")}.`,
      state: nextState
    };
  }

  return null;
}

function looksLikeReportTitle(lower: string): boolean {
  if (lower.length > 100 || lower.length < 5) return false;
  const hasReportWord = /\b(report|performance|summary|analysis|overview|dashboard|brief|metrics?|revenue|sales|kpi)\b/.test(lower);
  const isQuestion = lower.includes("?") || /^(what|how|why|when|where|can|do|does|is|are)\b/.test(lower);
  const isCommand = /^(set|run|save|preview|list|help|query|use|show)\b/.test(lower);
  const isIntent = /\b(i need|i want|create|build|make|prepare|generate|give me)\b/.test(lower);
  return hasReportWord && !isQuestion && !isCommand && !isIntent;
}

// ---------------------------------------------------------------------------
// Contract / report helpers
// ---------------------------------------------------------------------------

function buildContractPayload(state: ChatState): ReportContractRecord {
  const draft = state.draft;
  const name = draft.name.trim().length > 0 ? draft.name.trim() : suggestReportName(state);

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
    insight_mode: draft.insight_mode ?? "business",
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

function suggestsWeeklyCadence(state: ChatState): boolean {
  return state.draft.schedule_cron === "0 18 * * 5";
}

function suggestReportName(state: ChatState): string {
  if (state.draft.name.trim().length > 0) {
    return state.draft.name.trim();
  }

  const audience = state.draft.audience.trim().length > 0 ? state.draft.audience : "Executive";
  const cadence = suggestsWeeklyCadence(state) ? "Weekly " : "";
  const metric = state.draft.metric_ids.length > 0
    ? state.draft.metric_ids[0].replace(/^metric_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Performance";
  return `${cadence}${audience} ${metric} Report`;
}

function getMissingDraftFields(state: ChatState): string[] {
  const missing: string[] = [];

  if (!/^\s*select\b/i.test(state.draft.sql_template)) {
    missing.push("sql_template (must start with SELECT)");
  }

  return missing;
}

// ---------------------------------------------------------------------------
// Boolean detectors
// ---------------------------------------------------------------------------

function asksForPdf(command: string): boolean {
  return command.includes("pdf") || command.includes("download");
}

function asksToUseConnectedTables(command: string): boolean {
  return /\b(use connected tables|sync connected tables|use connected db|use database tables)\b/.test(command);
}

function detectInsightMode(command: string): "business" | "data" | null {
  if (/\bdata\s*(insights?|quality|mode|analysis)\b/.test(command)) return "data";
  if (/\bbusiness\s*(insights?|mode|analysis)\b/.test(command)) return "business";
  if (/\binsight\s*mode\s*[:=]?\s*data\b/.test(command)) return "data";
  if (/\binsight\s*mode\s*[:=]?\s*business\b/.test(command)) return "business";
  return null;
}

function detectConversationalAction(command: string): "run" | "save" | "list" | null {
  // Only match explicit, standalone run commands — NOT casual mentions like
  // "I want to run an analysis on refunds" or "can you run through the data".
  // The user should explicitly say "run the report", "execute now", etc.
  if (/^(run|run it|run it now|run now|run the report|run report|execute now|execute it|execute the report|start the analysis|launch report|let'?s run it|let'?s run)\s*[.!]?$/.test(command)) {
    return "run";
  }

  if (/\b(save|store|persist)\b/.test(command)) {
    return "save";
  }

  if (/\b(list contracts|show contracts|list reports|list)\b/.test(command)) {
    return "list";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Audience extraction
// ---------------------------------------------------------------------------

function extractAudience(lower: string): string | null {
  const forMatch = lower.match(/\bfor\s+(?:the\s+)?(.+?)(?:\s+(?:team|department|group|level))?\s*(?:[.,!?]|$)/i);
  if (forMatch) {
    const raw = forMatch[1].replace(/\s*(team|department|group|level)\s*$/i, "").trim();
    const mapped = mapAudienceKeyword(raw);
    if (mapped) return mapped;
  }

  if (/\bnot\b.*\bexecutive\b/.test(lower)) {
    // Don't return Executive; let more specific match win
  } else if (lower.includes("executive")) return "Executive";

  if (lower.includes("ceo")) return "CEO";
  if (lower.includes("cfo")) return "CFO";
  if (lower.includes("cto")) return "CTO";
  if (lower.includes("coo")) return "COO";
  if (/\bsales\b/.test(lower)) return "Sales";
  if (/\bmarketing\b/.test(lower)) return "Marketing";
  if (/\bops\b|\boperations\b/.test(lower)) return "Ops";
  if (/\bengineering\b|\bdev\b|\bdevelopment\b/.test(lower)) return "Engineering";
  if (/\bfinance\b|\baccounting\b/.test(lower)) return "Finance";
  if (/\bhr\b|\bhuman resources\b/.test(lower)) return "HR";
  if (/\bproduct\b/.test(lower)) return "Product";
  if (/\bboard\b/.test(lower)) return "Board";
  if (/\bmanagement\b|\bmanagers?\b/.test(lower)) return "Management";

  return null;
}

function mapAudienceKeyword(raw: string): string | null {
  const map: Record<string, string> = {
    ceo: "CEO", cfo: "CFO", cto: "CTO", coo: "COO",
    sales: "Sales", marketing: "Marketing",
    ops: "Ops", operations: "Ops",
    engineering: "Engineering", dev: "Engineering", development: "Engineering",
    finance: "Finance", accounting: "Finance",
    hr: "HR", "human resources": "HR",
    product: "Product", board: "Board",
    management: "Management", managers: "Management",
    executive: "Executive", executives: "Executive"
  };
  return map[raw] ?? null;
}

// ---------------------------------------------------------------------------
// Natural language draft updates
// ---------------------------------------------------------------------------

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

  const audienceMatch = extractAudience(lower);
  if (audienceMatch && next.draft.audience !== audienceMatch) {
    next.draft.audience = audienceMatch;
    next.contract_id = null;
    updated.add("audience");
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

// ---------------------------------------------------------------------------
// Table sync
// ---------------------------------------------------------------------------

async function syncConnectedTables(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const context = await apiClient.getConnectionContext();

  if (!context.connected || context.allowed_relations.length === 0) {
    return {
      assistant_message: "No tables available. Database not connected or no tables selected at /connect.",
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
    assistant_message: `Synced ${context.allowed_relations.length} table${context.allowed_relations.length === 1 ? "" : "s"} from connected database. SQL updated to: ${nextState.draft.sql_template}.`,
    state: nextState
  };
}

// ---------------------------------------------------------------------------
// Catalog context (for LLM system prompt)
// ---------------------------------------------------------------------------

export async function fetchCatalogContext(apiClient: WebApiClient): Promise<{ catalog_summary: string; business_context: string }> {
  try {
    const catalog = await apiClient.getCatalog();
    if (catalog.tables.length === 0) {
      return { catalog_summary: "", business_context: catalog.business_context ?? "" };
    }

    const lines: string[] = [];
    for (const table of catalog.tables.slice(0, 20)) {
      const cols = table.columns.slice(0, 12).map((c) => `${c.column_name}(${c.data_type})`).join(", ");
      const extra = table.columns.length > 12 ? ` +${table.columns.length - 12} more` : "";
      const rowInfo = table.row_count_estimate > 0 ? ` ~${formatNumber(table.row_count_estimate)} rows` : "";
      lines.push(`${table.qualified_name} [${table.relation_type}]${rowInfo}: ${cols}${extra}`);
      if (table.sample_rows.length > 0) {
        const sampleKeys = Object.keys(table.sample_rows[0]).slice(0, 6);
        const preview = sampleKeys.map((k) => `${k}=${String(table.sample_rows[0][k] ?? "null").slice(0, 25)}`).join(", ");
        lines.push(`  sample: ${preview}`);
      }
    }
    if (catalog.tables.length > 20) {
      lines.push(`... +${catalog.tables.length - 20} more tables`);
    }
    return { catalog_summary: lines.join("\n"), business_context: catalog.business_context ?? "" };
  } catch {
    return { catalog_summary: "", business_context: "" };
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// JSON response parser
// ---------------------------------------------------------------------------

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
