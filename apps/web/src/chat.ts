import { randomUUID } from "node:crypto";
import {
  ExecBriefSchema,
  ReportContractSchema
} from "@project-overload/shared";
import { z } from "zod";
import type {
  QueryRouterClient,
  QueryRoutingDecision
} from "./query-router";

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
  last_query_id: z.string().nullable().default(null),
  last_exec_brief: ExecBriefSchema.nullable(),
  conversation_history: z.array(ChatHistoryTurnSchema).max(40).default([]),
  prep_pending: z.boolean().default(false),
  prep_complete: z.boolean().default(false),
  scope_pending: z.boolean().default(false),
  pending_query_sql: z.string().nullable().default(null),
  pending_query_limit: z.number().int().positive().nullable().default(null),
  pending_single_query_request: z.string().nullable().default(null),
  last_single_query_snapshot: z
    .object({
      normalized_request: z.string().min(1),
      context_key: z.string().min(1),
      query_id: z.string().min(1),
      assistant_message: z.string().min(1),
      created_at: z.string().datetime()
    })
    .nullable()
    .default(null),
  planner_summary: z.string().nullable().default(null),
  preparation_summary: z.string().nullable().default(null),
  prepared_payloads: z.array(
    z.object({
      question_id: z.string(),
      question_number: z.number().int().min(1).optional(),
      question: z.string(),
      purpose: z.string(),
      group_id: z.string().optional(),
      source_query_count: z.number().int().min(1).optional(),
      row_count_before_reduction: z.number().int().min(0),
      prepared_row_count: z.number().int().min(0),
      validation: z
        .object({
          expected_months: z.number().int().min(1).nullable().optional(),
          observed_months: z.number().int().min(0),
          missing_months: z.array(z.string()).default([]),
          monthly_row_counts: z
            .array(
              z.object({
                month: z.string(),
                row_count: z.number().int().min(0)
              })
            )
            .default([]),
          metric_column: z.string().nullable().optional(),
          monthly_metric_totals: z
            .array(
              z.object({
                month: z.string(),
                total: z.number()
              })
            )
            .default([])
        })
        .optional(),
      preparation_notes: z.array(z.string()).default([]),
      warnings: z.array(z.string()).default([])
    })
  ).default([]),
  awaiting_pdf_confirmation: z.boolean().default(false),
  awaiting_save_confirmation: z.boolean().default(false),
  awaiting_schedule_confirmation: z.boolean().default(false),
  awaiting_schedule_mode_selection: z.boolean().default(false),
  schedule_mode_pending: z.enum(["weekly", "monthly", "quarterly"]).nullable().default(null),
  schedule_day_kind: z.enum(["weekday", "monthday"]).nullable().default(null),
  awaiting_custom_day_input: z.boolean().default(false),
  last_concise_summary: z.string().nullable().default(null),
  last_token_usage: z
    .object({
      input_tokens: z.number().int().min(0),
      output_tokens: z.number().int().min(0),
      total_tokens: z.number().int().min(0),
      by_agent: z.record(
        z.string(),
        z.object({
          input_tokens: z.number().int().min(0),
          output_tokens: z.number().int().min(0),
          total_tokens: z.number().int().min(0)
        })
      )
    })
    .nullable()
    .default(null)
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
  approveContract(contractId: string): Promise<ReportContractRecord>;
  lockContract(contractId: string): Promise<ReportContractRecord>;
  prepareContract(contractId: string): Promise<{
    contract_id: string;
    planner_summary?: string;
    prepared_payloads: PreparedPayloadRecord[];
    token_usage?: TokenUsageRecord;
  }>;
  runContract(contractId: string): Promise<{
    run_id: string;
    exec_brief: ExecBriefRecord;
    exec_brief_html?: string;
    planner_summary?: string;
    concise_summary?: string;
    prepared_payloads?: PreparedPayloadRecord[];
    token_usage?: TokenUsageRecord;
    pdf_path?: string;
  }>;
  downloadRunPdf(runId: string): Promise<Response>;
  askRunQuestion(runId: string, question: string): Promise<{
    answer: string;
    citations: string[];
    grounded: boolean;
  }>;
  saveRun(runId: string): Promise<{
    run_id: string;
    contract_id: string;
    saved: boolean;
    logged_at: string;
  }>;
  scheduleContract(
    contractId: string,
    payload: {
      frequency: "weekly" | "monthly" | "quarterly";
      timezone?: string;
      day_of_week?: number;
      day_of_month?: number;
      hour_utc?: number;
      minute_utc?: number;
    }
  ): Promise<{
    contract_id: string;
    frequency: "weekly" | "monthly" | "quarterly";
    timezone: string;
    schedule_cron: string;
  }>;
  getConnectionContext(): Promise<ConnectionContextRecord>;
  runSafeQuery(sql: string, limit?: number): Promise<SafeQueryResponseRecord>;
  getCatalog(): Promise<DataCatalogRecord>;
  getTableHealth(): Promise<RelationHealthRecord[]>;
}

const TokenUsageSchema = z.object({
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
  by_agent: z.record(
    z.string(),
    z.object({
      input_tokens: z.number().int().min(0),
      output_tokens: z.number().int().min(0),
      total_tokens: z.number().int().min(0)
    })
  )
});

const PreparedPayloadSchema = z.object({
  question_id: z.string().min(1),
  question_number: z.number().int().min(1).optional(),
  question: z.string().min(1),
  purpose: z.string().min(1),
  group_id: z.string().optional(),
  source_query_count: z.number().int().min(1).optional(),
  row_count_before_reduction: z.number().int().min(0),
  prepared_row_count: z.number().int().min(0),
  validation: z
    .object({
      expected_months: z.number().int().min(1).nullable().optional(),
      observed_months: z.number().int().min(0),
      missing_months: z.array(z.string()).default([]),
      monthly_row_counts: z
        .array(
          z.object({
            month: z.string(),
            row_count: z.number().int().min(0)
          })
        )
        .default([]),
      metric_column: z.string().nullable().optional(),
      monthly_metric_totals: z
        .array(
          z.object({
            month: z.string(),
            total: z.number()
          })
        )
        .default([])
    })
    .optional(),
  preparation_notes: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
});

type TokenUsageRecord = z.output<typeof TokenUsageSchema>;
type PreparedPayloadRecord = z.output<typeof PreparedPayloadSchema>;

const RunContractResponseSchema = z.object({
  run_id: z.string().min(1),
  exec_brief: ExecBriefSchema,
  exec_brief_html: z.string().optional(),
  planner_summary: z.string().optional(),
  concise_summary: z.string().optional(),
  prepared_payloads: z.array(PreparedPayloadSchema).optional(),
  token_usage: TokenUsageSchema.optional(),
  pdf_path: z.string().min(1).optional()
});

const PrepareContractResponseSchema = z.object({
  contract_id: z.string().min(1),
  planner_summary: z.string().optional(),
  prepared_payloads: z.array(PreparedPayloadSchema).default([]),
  token_usage: TokenUsageSchema.optional()
});

const SaveRunResponseSchema = z.object({
  run_id: z.string().min(1),
  contract_id: z.string().min(1),
  saved: z.boolean(),
  logged_at: z.string().min(1)
});

const ScheduleContractResponseSchema = z.object({
  contract_id: z.string().min(1),
  frequency: z.enum(["weekly", "monthly", "quarterly"]),
  timezone: z.string().min(1),
  schedule_cron: z.string().min(1)
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
  table_id: z.string().default(""),
  qualified_name: z.string(),
  relation_type: z.enum(["TABLE", "VIEW", "MATERIALIZED VIEW"]),
  summary: z.string().default(""),
  columns: z.array(TableColumnInfoSchema),
  low_cardinality_columns: z.array(z.object({
    column_name: z.string(),
    distinct_values: z.array(z.string()).default([])
  })).default([]),
  sample_rows: z.array(z.record(z.string(), z.unknown())),
  row_count_estimate: z.number().int().min(0)
});

const DataCatalogSchema = z.object({
  business_id: z.string().nullable().default(null),
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
    last_query_id: null,
    last_exec_brief: null,
    conversation_history: [],
    prep_pending: false,
    prep_complete: false,
    scope_pending: false,
    pending_query_sql: null,
    pending_query_limit: null,
    pending_single_query_request: null,
    last_single_query_snapshot: null,
    planner_summary: null,
    preparation_summary: null,
    prepared_payloads: [],
    awaiting_pdf_confirmation: false,
    awaiting_save_confirmation: false,
    awaiting_schedule_confirmation: false,
    awaiting_schedule_mode_selection: false,
    schedule_mode_pending: null,
    schedule_day_kind: null,
    awaiting_custom_day_input: false,
    last_concise_summary: null,
    last_token_usage: null
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
    last_query_id: parsed.data.last_query_id ?? null,
    last_exec_brief: parsed.data.last_exec_brief,
    conversation_history: [...parsed.data.conversation_history],
    prep_pending: parsed.data.prep_pending ?? false,
    prep_complete: parsed.data.prep_complete ?? false,
    scope_pending: parsed.data.scope_pending ?? false,
    pending_query_sql: parsed.data.pending_query_sql ?? null,
    pending_query_limit: parsed.data.pending_query_limit ?? null,
    pending_single_query_request: parsed.data.pending_single_query_request ?? null,
    last_single_query_snapshot: parsed.data.last_single_query_snapshot ?? null,
    planner_summary: parsed.data.planner_summary ?? null,
    preparation_summary: parsed.data.preparation_summary ?? null,
    prepared_payloads: [...parsed.data.prepared_payloads],
    awaiting_pdf_confirmation: parsed.data.awaiting_pdf_confirmation ?? false,
    awaiting_save_confirmation: parsed.data.awaiting_save_confirmation ?? false,
    awaiting_schedule_confirmation: parsed.data.awaiting_schedule_confirmation ?? false,
    awaiting_schedule_mode_selection: parsed.data.awaiting_schedule_mode_selection ?? false,
    schedule_mode_pending: parsed.data.schedule_mode_pending ?? null,
    schedule_day_kind: parsed.data.schedule_day_kind ?? null,
    awaiting_custom_day_input: parsed.data.awaiting_custom_day_input ?? false,
    last_concise_summary: parsed.data.last_concise_summary ?? null,
    last_token_usage: parsed.data.last_token_usage ?? null
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
    resetPreparedState(next);
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
    async approveContract(contractId) {
      const response = await fetcher(`${baseUrl}/report-contracts/${encodeURIComponent(contractId)}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });

      return parseJsonResponse(response, ReportContractSchema);
    },
    async lockContract(contractId) {
      const response = await fetcher(`${baseUrl}/report-contracts/${encodeURIComponent(contractId)}/lock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });

      return parseJsonResponse(response, ReportContractSchema);
    },
    async prepareContract(contractId) {
      const response = await fetcher(`${baseUrl}/report-contracts/${encodeURIComponent(contractId)}/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });

      return parseJsonResponse(response, PrepareContractResponseSchema);
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
    async askRunQuestion(runId, question) {
      const response = await fetcher(`${baseUrl}/report-runs/${encodeURIComponent(runId)}/qa`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question })
      });

      return parseJsonResponse(response, z.object({
        answer: z.string().min(1),
        citations: z.array(z.string()).default([]),
        grounded: z.boolean().default(false)
      }));
    },
    async saveRun(runId) {
      const response = await fetcher(`${baseUrl}/report-runs/${encodeURIComponent(runId)}/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });

      return parseJsonResponse(response, SaveRunResponseSchema);
    },
    async scheduleContract(contractId, payload) {
      const response = await fetcher(`${baseUrl}/report-contracts/${encodeURIComponent(contractId)}/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      return parseJsonResponse(response, ScheduleContractResponseSchema);
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
  query_router?: QueryRouterClient;
}): Promise<ChatTurnResponse> {
  const rawMessage = input.message.trim();
  const command = rawMessage.toLowerCase();
  let nextState = parseChatState(input.state);

  // --- Query intent confirmation gate ---

  if (nextState.pending_query_sql) {
    if (isQueryExecutionChoice(command)) {
      return executePendingQuery(nextState, input.api_client);
    }

    if (isQueryOtherInstructionChoice(command)) {
      nextState.pending_query_sql = null;
      nextState.pending_query_limit = null;
      return {
        assistant_message: "Okay, let's continue with other instructions. Tell me what to adjust.",
        state: nextState
      };
    }

    return {
      assistant_message: 'SQL decision pending (Run query / Other instruction).',
      state: nextState
    };
  }

  // --- Single-query clarification gate ---

  if (nextState.pending_single_query_request) {
    if (
      isQueryOtherInstructionChoice(command) ||
      /^(cancel|stop|nevermind|never mind|skip)\b/.test(command)
    ) {
      nextState.pending_single_query_request = null;
      return {
        assistant_message: "Okay, skipping that query. Tell me the next instruction.",
        state: nextState
      };
    }

    const mergedMessage = [
      nextState.pending_single_query_request,
      `Clarification: ${rawMessage}`
    ].join("\n");
    nextState.pending_single_query_request = null;

    const routedFromClarification = await attemptSingleQueryOrAnalysisRouting(
      mergedMessage,
      nextState,
      input.api_client,
      input.query_router
    );
    if (routedFromClarification) {
      return routedFromClarification;
    }

    return {
      assistant_message:
        "I still need a bit more detail before running that query. Please specify time window and any status filters.",
      state: nextState
    };
  }

  // --- PDF confirmation gate ---

  if (nextState.awaiting_pdf_confirmation) {
    if (isPdfGenerateYesChoice(command)) {
      nextState.awaiting_pdf_confirmation = false;
      if (!nextState.last_run_id) {
        return {
          assistant_message: "No run is available for PDF generation yet.",
          state: nextState
        };
      }
      nextState.awaiting_save_confirmation = true;
      return {
        assistant_message: `PDF is ready for run ${nextState.last_run_id}.\nWould you like to save this run to report logs?`,
        state: nextState,
        pdf_download_url: `/api/runs/${nextState.last_run_id}/pdf`
      };
    }

    if (isPdfGenerateNoChoice(command)) {
      nextState.awaiting_pdf_confirmation = false;
      return {
        assistant_message: "Okay, PDF generation skipped for now. You can ask follow-up questions from this run payload.",
        state: nextState
      };
    }

    if (nextState.last_run_id && looksLikePayloadQaQuestion(rawMessage)) {
      return executePayloadQa(nextState, rawMessage, input.api_client);
    }

    return {
      assistant_message: "PDF decision pending (Generate report PDF / Not yet).",
      state: nextState
    };
  }

  // --- Save report confirmation gate ---

  if (nextState.awaiting_save_confirmation) {
    if (isSaveReportYesChoice(command)) {
      if (!nextState.last_run_id) {
        nextState.awaiting_save_confirmation = false;
        return {
          assistant_message: "No run is available to save.",
          state: nextState
        };
      }

      await input.api_client.saveRun(nextState.last_run_id);
      nextState.awaiting_save_confirmation = false;
      nextState.awaiting_schedule_confirmation = true;
      return {
        assistant_message: "Saved to report logs.\nWould you like help scheduling this report for future runs?",
        state: nextState
      };
    }

    if (isSaveReportNoChoice(command)) {
      nextState.awaiting_save_confirmation = false;
      nextState.awaiting_schedule_confirmation = true;
      return {
        assistant_message: "Okay, skipped saving.\nWould you like help scheduling this report for future runs?",
        state: nextState
      };
    }

    if (nextState.last_run_id && looksLikePayloadQaQuestion(rawMessage)) {
      return executePayloadQa(nextState, rawMessage, input.api_client);
    }

    return {
      assistant_message: "Save decision pending (Save report log / Skip save).",
      state: nextState
    };
  }

  // --- Schedule confirmation gate ---

  if (nextState.awaiting_schedule_confirmation) {
    if (isScheduleSetupYesChoice(command)) {
      nextState.awaiting_schedule_confirmation = false;
      nextState.awaiting_schedule_mode_selection = true;
      return {
      assistant_message: "Schedule cadence decision pending (Weekly / Monthly / Quarterly).",
        state: nextState
      };
    }

    if (isScheduleSetupNoChoice(command)) {
      nextState.awaiting_schedule_confirmation = false;
      return {
        assistant_message: "No problem. Scheduling skipped for now.",
        state: nextState
      };
    }

    return {
      assistant_message: "Schedule setup decision pending (Schedule report / Not now).",
      state: nextState
    };
  }

  // --- Schedule mode selection gate ---

  if (nextState.awaiting_schedule_mode_selection) {
    if (isScheduleModeWeeklyChoice(command)) {
      nextState.awaiting_schedule_mode_selection = false;
      nextState.schedule_mode_pending = "weekly";
      nextState.schedule_day_kind = "weekday";
      return {
        assistant_message: "Weekly schedule selected. Weekday decision pending (UTC).",
        state: nextState
      };
    }

    if (isScheduleModeMonthlyChoice(command)) {
      nextState.awaiting_schedule_mode_selection = false;
      nextState.schedule_mode_pending = "monthly";
      nextState.schedule_day_kind = "monthday";
      return {
        assistant_message: "Monthly schedule selected. Day-of-month decision pending.",
        state: nextState
      };
    }

    if (isScheduleModeQuarterlyChoice(command)) {
      nextState.awaiting_schedule_mode_selection = false;
      nextState.schedule_mode_pending = "quarterly";
      nextState.schedule_day_kind = "monthday";
      return {
        assistant_message: "Quarterly schedule selected. Day-of-month decision pending.",
        state: nextState
      };
    }

    return {
      assistant_message: "Schedule cadence decision pending (Weekly / Monthly / Quarterly).",
      state: nextState
    };
  }

  // --- Schedule day selection gate ---

  if (nextState.schedule_mode_pending && nextState.schedule_day_kind === "weekday") {
    const weekday = parseWeekdayChoice(command);
    if (weekday === null) {
      return {
        assistant_message: "Weekday decision pending (Mon-Sun).",
        state: nextState
      };
    }

    return executeSchedule(nextState, input.api_client, {
      frequency: "weekly",
      day_of_week: weekday
    });
  }

  if (nextState.schedule_mode_pending && nextState.schedule_day_kind === "monthday") {
    if (isScheduleCustomDayChoice(command)) {
      nextState.awaiting_custom_day_input = true;
      nextState.schedule_day_kind = null;
      return {
        assistant_message: "Type a day of month between 1 and 28.",
        state: nextState
      };
    }

    const dayFromButton = parseMonthDayChoice(command);
    if (dayFromButton !== null) {
      return executeSchedule(nextState, input.api_client, {
        frequency: nextState.schedule_mode_pending,
        day_of_month: dayFromButton
      });
    }

    return {
      assistant_message: "Day-of-month decision pending (1, 15, 28, or custom day).",
      state: nextState
    };
  }

  if (nextState.schedule_mode_pending && nextState.awaiting_custom_day_input) {
    const customDay = parseCustomMonthDay(rawMessage);
    if (customDay === null) {
      return {
        assistant_message: "Please type a valid day number from 1 to 28.",
        state: nextState
      };
    }

    return executeSchedule(nextState, input.api_client, {
      frequency: nextState.schedule_mode_pending,
      day_of_month: customDay
    });
  }

  // --- Data preparation gate ---

  if (nextState.prep_pending) {
    if (isRunPreparationChoice(command)) {
      return executePreparation(nextState, input.api_client);
    }

    if (isScopeContinueChoice(command)) {
      nextState.prep_pending = false;
      return {
        assistant_message: "Sounds good. Continue scoping and tell me what to refine before we prepare data.",
        state: nextState
      };
    }

    const prepSimpleQueryAction = await inferNaturalQueryAction(rawMessage, nextState, input.api_client);
    if (prepSimpleQueryAction) {
      return executeNaturalSimpleQuery(nextState, input.api_client, prepSimpleQueryAction, {
        user_message: rawMessage,
        query_router: input.query_router
      });
    }

    return {
      assistant_message: "Data preparation decision pending (Run Data Preparation / Continue scoping).",
      state: nextState
    };
  }

  // --- Analysis confirmation gate ---

  if (nextState.scope_pending) {
    if (isScopeRunChoice(command)) {
      nextState.scope_pending = false;
      return executeRun(nextState, input.api_client);
    }

    if (isScopeContinueChoice(command)) {
      nextState.scope_pending = false;
      return {
        assistant_message: "Sounds good. Continue scoping and tell me what to refine before we run.",
        state: nextState
      };
    }

    const scopedSimpleQueryAction = await inferNaturalQueryAction(rawMessage, nextState, input.api_client);
    if (scopedSimpleQueryAction) {
      return executeNaturalSimpleQuery(nextState, input.api_client, scopedSimpleQueryAction, {
        user_message: rawMessage,
        query_router: input.query_router
      });
    }

    return {
      assistant_message:
        "Analysis decision pending (Finish scoping and run analysis / Continue scoping).",
      state: nextState
    };
  }

  // --- Explicit actions ---

  if (/^__ui_run_data_preparation__$/.test(command)) {
    if (nextState.prep_pending) {
      return executePreparation(nextState, input.api_client);
    }

    if (nextState.prep_complete) {
      return buildAnalysisConfirmation(nextState);
    }

    return maybePrepareOrRun(nextState, input.api_client);
  }

  if (/^__ui_finish_scoping_run_analysis__$/.test(command)) {
    if (nextState.prep_complete) {
      return executeRun(nextState, input.api_client);
    }

    return {
      assistant_message:
        "Data preparation is still pending; analysis can start after preparation completes.",
      state: nextState
    };
  }

  if (command === "save") {
    return executeSave(nextState, input.api_client);
  }

  if (command === "run" || command === "run analysis" || command === "prepare") {
    return maybePrepareOrRun(nextState, input.api_client);
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
    nextState.awaiting_pdf_confirmation = true;
    return {
      assistant_message: "PDF generation decision is pending.",
      state: nextState
    };
  }

  if (asksToUseConnectedTables(command)) {
    return syncConnectedTables(nextState, input.api_client);
  }

  const queryCommand = parseQueryCommand(rawMessage);
  if (queryCommand) {
    nextState.pending_query_sql = queryCommand.sql;
    nextState.pending_query_limit = queryCommand.limit ?? null;
    const sqlPreview = summarizeSql(queryCommand.sql);
    return {
      assistant_message: [
        "SQL is drafted and waiting on the current workflow decision.",
        `SQL preview: ${sqlPreview}`,
        "Decision options are visible in the interface."
      ].join("\n"),
      state: nextState
    };
  }

  const repeatedSingleQuery = maybeReuseSingleQuerySnapshot(rawMessage, nextState);
  if (repeatedSingleQuery) {
    return repeatedSingleQuery;
  }

  const routedSingleOrAnalysis = await attemptSingleQueryOrAnalysisRouting(
    rawMessage,
    nextState,
    input.api_client,
    input.query_router
  );
  if (routedSingleOrAnalysis) {
    return routedSingleOrAnalysis;
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
    resetPreparedState(nextState);
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

  if (nextState.last_run_id && looksLikePayloadQaQuestion(rawMessage)) {
    return executePayloadQa(nextState, rawMessage, input.api_client);
  }

  // --- Simple intent inference ---

  const inferred = inferSimpleIntent(rawMessage, nextState);
  if (inferred) return inferred;

  // --- Conversational action mentions (e.g. "let's run it") ---

  const action = detectConversationalAction(command);
  if (action === "run") return maybePrepareOrRun(nextState, input.api_client);
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

async function executePendingQuery(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  const sql = nextState.pending_query_sql ? normalizeExecutableSql(nextState.pending_query_sql) : null;

  if (!sql) {
    return {
      assistant_message: "No pending query was found. Tell me what SQL you want to run.",
      state: nextState
    };
  }

  const queryId = `qry_${randomUUID()}`;
  const limit = nextState.pending_query_limit ?? undefined;
  nextState.pending_query_sql = null;
  nextState.pending_query_limit = null;
  nextState.last_query_id = queryId;

  try {
    const startedAt = Date.now();
    const result = await apiClient.runSafeQuery(sql, limit);
    const elapsedMs = Date.now() - startedAt;
    const preview = result.rows.slice(0, 10);
    const warnings = result.warnings.length > 0 ? `\nWarnings: ${result.warnings.join("; ")}` : "";

    return {
      assistant_message: [
        `Query completed. Query ID: ${queryId}.`,
        `Rows returned: ${result.row_count}. Elapsed: ${elapsedMs}ms.`,
        `Executed SQL: ${summarizeSql(result.governed_sql)}`,
        `${warnings}`.trim(),
        `Preview:\n${JSON.stringify(preview, null, 2)}`
      ]
        .filter((line) => line.length > 0)
        .join("\n"),
      state: nextState
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return {
      assistant_message: `Query failed. Query ID: ${queryId}. Error: ${reason}`,
      state: nextState
    };
  }
}

async function executeNaturalSimpleQuery(
  state: ChatState,
  apiClient: WebApiClient,
  action: NaturalQueryAction,
  options: {
    user_message?: string;
    query_router?: QueryRouterClient;
  } = {}
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  const queryId = `qry_${randomUUID()}`;
  nextState.last_query_id = queryId;
  nextState.pending_single_query_request = null;
  const normalizedRequest = normalizeSingleQueryRequest(options.user_message ?? "");
  const contextKey = buildNaturalQueryContextKey(action);

  try {
    const startedAt = Date.now();
    const result = await apiClient.runSafeQuery(action.sql, action.limit);
    const elapsedMs = Date.now() - startedAt;
    const summary = summarizeNaturalQueryResult(action, result.rows[0]);
    const method = summarizeSingleQueryMethod(action.explanation, result.governed_sql);
    const warnings = result.warnings.length > 0 ? `\nWarnings: ${result.warnings.join("; ")}` : "";
    const naturalNarration = await maybeNarrateSingleQueryResponse({
      query_router: options.query_router,
      query_id: queryId,
      user_message: options.user_message ?? "",
      result_summary: summary,
      method_summary: method,
      governed_sql: result.governed_sql,
      rows: result.rows,
      row_count: result.row_count,
      elapsed_ms: elapsedMs,
      warnings: result.warnings
    });

    if (naturalNarration) {
      nextState.last_single_query_snapshot = {
        normalized_request: normalizedRequest,
        context_key: contextKey,
        query_id: queryId,
        assistant_message: naturalNarration,
        created_at: new Date().toISOString()
      };
      return {
        assistant_message: naturalNarration,
        state: nextState
      };
    }

    const assistantMessage = [
      `Query completed. Query ID: ${queryId}.`,
      summary,
      method,
      `Elapsed: ${elapsedMs}ms.`,
      `${warnings}`.trim()
    ]
      .filter((line) => line.length > 0)
      .join("\n");
    nextState.last_single_query_snapshot = {
      normalized_request: normalizedRequest,
      context_key: contextKey,
      query_id: queryId,
      assistant_message: assistantMessage,
      created_at: new Date().toISOString()
    };
    return {
      assistant_message: assistantMessage,
      state: nextState
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    nextState.last_single_query_snapshot = null;
    return {
      assistant_message: `Query failed. Query ID: ${queryId}. Error: ${reason}`,
      state: nextState
    };
  }
}

async function inferLlmQueryRoutingDecision(
  rawMessage: string,
  state: ChatState,
  apiClient: WebApiClient,
  queryRouter: QueryRouterClient | undefined
): Promise<QueryRoutingDecision | null> {
  if (!queryRouter) {
    return null;
  }

  const lower = rawMessage.toLowerCase();
  if (parseSetCommand(rawMessage) || parseQueryCommand(rawMessage)) {
    return null;
  }
  if (detectConversationalAction(lower)) {
    return null;
  }
  if (asksForPdf(lower) || asksToUseConnectedTables(lower)) {
    return null;
  }
  if (isUiControlCommand(lower)) {
    return null;
  }
  if (rawMessage.trim().length < 4) {
    return null;
  }

  const catalog = await fetchCatalogContext(apiClient);
  if (!catalog.catalog_summary || catalog.catalog_summary.trim().length === 0) {
    return null;
  }

  try {
    return await queryRouter.decide({
      message: rawMessage,
      now_iso: new Date().toISOString(),
      business_context: catalog.business_context,
      catalog_summary: catalog.catalog_summary,
      allowed_relations: [...state.draft.allowed_relations],
      allowed_schemas: [...state.draft.allowed_schemas],
      report_draft: {
        name: state.draft.name,
        audience: state.draft.audience,
        timezone: state.draft.timezone,
        insight_mode: state.draft.insight_mode,
        metric_ids: [...state.draft.metric_ids],
        dimension_ids: [...state.draft.dimension_ids]
      },
      conversation_history: state.conversation_history
        .slice(-8)
        .map((turn) => ({ role: turn.role, content: turn.content }))
    });
  } catch {
    return null;
  }
}

async function attemptSingleQueryOrAnalysisRouting(
  rawMessage: string,
  state: ChatState,
  apiClient: WebApiClient,
  queryRouter: QueryRouterClient | undefined
): Promise<ChatTurnResponse | null> {
  const llmQueryRouting = await inferLlmQueryRoutingDecision(
    rawMessage,
    state,
    apiClient,
    queryRouter
  );

  if (llmQueryRouting?.route === "single_query" && llmQueryRouting.sql) {
    const clarificationPrompt = buildSingleQueryClarificationPrompt(rawMessage, state);
    if (clarificationPrompt) {
      const nextState = parseChatState(state);
      nextState.pending_single_query_request = rawMessage;
      return {
        assistant_message: clarificationPrompt,
        state: nextState
      };
    }
    return executeLlmRoutedSingleQuery(state, apiClient, rawMessage, llmQueryRouting, queryRouter);
  }

  if (llmQueryRouting?.route === "deep_analysis") {
    const preparation = await buildPreparationConfirmation(state, apiClient);
    const routerLine = llmQueryRouting.reason
      ? `Routing decision: ${llmQueryRouting.reason}`
      : "";

    return {
      assistant_message: [routerLine, preparation.assistant_message]
        .filter((line) => line.trim().length > 0)
        .join("\n\n"),
      state: preparation.state
    };
  }

  const naturalQueryAction = await inferNaturalQueryAction(rawMessage, state, apiClient);
  if (!naturalQueryAction) {
    return null;
  }

  const clarificationPrompt = buildSingleQueryClarificationPrompt(rawMessage, state);
  if (clarificationPrompt) {
    const nextState = parseChatState(state);
    nextState.pending_single_query_request = rawMessage;
    return {
      assistant_message: clarificationPrompt,
      state: nextState
    };
  }

  return executeNaturalSimpleQuery(state, apiClient, naturalQueryAction, {
    user_message: rawMessage,
    query_router: queryRouter
  });
}

async function executeLlmRoutedSingleQuery(
  state: ChatState,
  apiClient: WebApiClient,
  userMessage: string,
  decision: QueryRoutingDecision,
  queryRouter?: QueryRouterClient
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  const queryId = `qry_${randomUUID()}`;
  nextState.last_query_id = queryId;
  nextState.pending_single_query_request = null;
  const normalizedRequest = normalizeSingleQueryRequest(userMessage);

  const sql = decision.sql ? normalizeExecutableSql(decision.sql) : "";
  const contextKey = buildSqlQueryContextKey(sql);
  if (!isLikelySingleSelectSql(sql)) {
    nextState.last_single_query_snapshot = null;
    return {
      assistant_message: `Could not execute routed query. Query ID: ${queryId}. Reason: generated SQL was not a single SELECT statement.`,
      state: nextState
    };
  }

  try {
    const startedAt = Date.now();
    const result = await apiClient.runSafeQuery(sql);
    const elapsedMs = Date.now() - startedAt;
    const summary = summarizeLlmRoutedQueryResult(userMessage, result.rows, result.row_count);
    const method = summarizeSingleQueryMethod(decision.reason, result.governed_sql || sql);
    const warnings = result.warnings.length > 0 ? `\nWarnings: ${result.warnings.join("; ")}` : "";
    const naturalNarration = await maybeNarrateSingleQueryResponse({
      query_router: queryRouter,
      query_id: queryId,
      user_message: userMessage,
      result_summary: summary,
      method_summary: method,
      governed_sql: result.governed_sql || sql,
      rows: result.rows,
      row_count: result.row_count,
      elapsed_ms: elapsedMs,
      warnings: result.warnings
    });

    if (naturalNarration) {
      nextState.last_single_query_snapshot = {
        normalized_request: normalizedRequest,
        context_key: contextKey,
        query_id: queryId,
        assistant_message: naturalNarration,
        created_at: new Date().toISOString()
      };
      return {
        assistant_message: naturalNarration,
        state: nextState
      };
    }
    const assistantMessage = [
      `Query completed. Query ID: ${queryId}.`,
      summary,
      method,
      `Elapsed: ${elapsedMs}ms.`,
      `${warnings}`.trim()
    ]
      .filter((line) => line.length > 0)
      .join("\n");
    nextState.last_single_query_snapshot = {
      normalized_request: normalizedRequest,
      context_key: contextKey,
      query_id: queryId,
      assistant_message: assistantMessage,
      created_at: new Date().toISOString()
    };
    return {
      assistant_message: assistantMessage,
      state: nextState
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    nextState.last_single_query_snapshot = null;
    return {
      assistant_message: `Query failed. Query ID: ${queryId}. Error: ${reason}`,
      state: nextState
    };
  }
}

function maybeReuseSingleQuerySnapshot(rawMessage: string, state: ChatState): ChatTurnResponse | null {
  const snapshot = state.last_single_query_snapshot;
  if (!snapshot) {
    return null;
  }

  const lower = rawMessage.toLowerCase().trim();
  if (lower.length < 2) {
    return null;
  }

  if (
    parseSetCommand(rawMessage) ||
    parseQueryCommand(rawMessage) ||
    isUiControlCommand(lower) ||
    asksForPdf(lower) ||
    asksToUseConnectedTables(lower) ||
    looksLikeAnalysisIntent(lower) ||
    looksLikeComplexMultiQuestionPrompt(lower)
  ) {
    return null;
  }

  const explicitRepeat = isExplicitSingleQueryRepeatRequest(lower);
  const normalizedRequest = normalizeSingleQueryRequest(rawMessage);
  const sameRequest =
    normalizedRequest.length > 0 &&
    snapshot.normalized_request.length > 0 &&
    normalizedRequest === snapshot.normalized_request;

  if (!explicitRepeat && !sameRequest) {
    return null;
  }

  const nextState = parseChatState(state);
  nextState.pending_single_query_request = null;
  nextState.last_query_id = snapshot.query_id;

  return {
    assistant_message: [
      "Using the same context as your previous single-query request.",
      snapshot.assistant_message
    ].join("\n\n"),
    state: nextState
  };
}

function isExplicitSingleQueryRepeatRequest(lower: string): boolean {
  return (
    /\b(same question|same query|same context|same as above)\b/.test(lower) ||
    /\b(repeat that|repeat it|again please|show again|give again)\b/.test(lower) ||
    /^again\b/.test(lower)
  );
}

function normalizeSingleQueryRequest(message: string): string {
  const stopWords = new Set([
    "can",
    "could",
    "would",
    "please",
    "just",
    "me",
    "you",
    "my",
    "the",
    "a",
    "an",
    "show",
    "give",
    "tell",
    "what",
    "whats",
    "is",
    "are"
  ]);

  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !stopWords.has(token))
    .join(" ");
}

function buildNaturalQueryContextKey(action: NaturalQueryAction): string {
  return [
    action.kind,
    action.relation,
    action.date_column ?? "",
    String(action.requested_months ?? ""),
    String(action.requested_days ?? ""),
    action.metric_column ?? "",
    action.city_filter ?? "",
    action.product_filter ?? "",
    (action.joined_relations ?? []).join(","),
    action.window_label ?? "",
    String(action.limit ?? "")
  ].join("|");
}

function buildSqlQueryContextKey(sql: string): string {
  return sql
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeLlmRoutedQueryResult(
  userMessage: string,
  rows: Array<Record<string, unknown>>,
  rowCount: number
): string {
  if (rowCount === 0 || rows.length === 0) {
    return "No rows matched your request.";
  }

  const first = rows[0] ?? {};
  const entries = Object.entries(first);
  const numericEntries = entries
    .map(([key, value]) => ({
      key,
      value: parseNumberValue(value)
    }))
    .filter((entry): entry is { key: string; value: number } => entry.value !== null);

  const preferredMetric = pickPrimaryMetricEntry(userMessage, numericEntries);
  if (preferredMetric) {
    const label = prettifyColumnLabel(preferredMetric.key);
    const lines: string[] = [
      `${label}: ${formatNumericValue(preferredMetric.value)}.`
    ];

    const window = formatWindowFromRow(first);
    if (window) {
      lines.push(`Window checked: ${window}.`);
    }

    if (rowCount > 1) {
      lines.push(`Rows returned: ${rowCount}.`);
    }

    return lines.join("\n");
  }

  if (rowCount === 1) {
    const compact = entries
      .slice(0, 6)
      .map(([key, value]) => `${prettifyColumnLabel(key)}: ${formatUnknownValue(value)}`)
      .join("; ");
    return compact.length > 0 ? compact : "One row returned.";
  }

  const preview = rows
    .slice(0, 3)
    .map((row, index) => `${index + 1}. ${Object.entries(row)
      .slice(0, 4)
      .map(([key, value]) => `${key}=${formatUnknownValue(value)}`)
      .join(", ")}`)
    .join("\n");
  return `Rows returned: ${rowCount}.\nPreview:\n${preview}`;
}

function summarizeSingleQueryMethod(primaryExplanation: string, governedSql: string): string {
  const lines: string[] = [];
  const normalizedPrimary = primaryExplanation.trim();
  if (normalizedPrimary.length > 0) {
    lines.push(`Method: ${normalizedPrimary.replace(/\.$/, "")}.`);
  } else {
    lines.push("Method: single safe SELECT query.");
  }

  const sqlDetails = summarizeSqlExecutionDetails(governedSql);
  lines.push(`Tables used: ${sqlDetails.tables.length > 0 ? sqlDetails.tables.join(", ") : "not detected"}.`);
  lines.push(`Joins used: ${sqlDetails.joins.length > 0 ? sqlDetails.joins.join(" | ") : "none"}.`);
  lines.push(
    `Filters used: ${sqlDetails.filters.length > 0 ? sqlDetails.filters.join(" | ") : "none beyond safety guardrails"}.`
  );
  if (sqlDetails.limit !== null) {
    lines.push(`Limit applied: ${sqlDetails.limit}.`);
  }

  return lines.join("\n");
}

async function maybeNarrateSingleQueryResponse(input: {
  query_router?: QueryRouterClient;
  query_id: string;
  user_message: string;
  result_summary: string;
  method_summary: string;
  governed_sql: string;
  rows: Array<Record<string, unknown>>;
  row_count: number;
  elapsed_ms: number;
  warnings: string[];
}): Promise<string | null> {
  if (!input.query_router?.narrate_single_query) {
    return null;
  }

  const sqlDetails = summarizeSqlExecutionDetails(input.governed_sql);
  try {
    const narration = await input.query_router.narrate_single_query({
      user_message: input.user_message,
      query_id: input.query_id,
      result_summary: input.result_summary,
      method_summary: input.method_summary,
      row_count: input.row_count,
      elapsed_ms: input.elapsed_ms,
      warnings: [...input.warnings],
      tables: [...sqlDetails.tables],
      joins: [...sqlDetails.joins],
      filters: [...sqlDetails.filters],
      rows_preview: input.rows.slice(0, 3)
    });

    const warningLine =
      input.warnings.length > 0 ? `Warnings: ${input.warnings.join("; ")}` : null;
    return [
      `Query completed. Query ID: ${input.query_id}.`,
      narration.trim(),
      warningLine,
      `Elapsed: ${input.elapsed_ms}ms.`
    ]
      .filter((line): line is string => Boolean(line && line.trim().length > 0))
      .join("\n");
  } catch {
    return null;
  }
}

function summarizeSqlExecutionDetails(sql: string): {
  tables: string[];
  joins: string[];
  filters: string[];
  limit: number | null;
} {
  const compact = sql.replace(/\s+/g, " ").trim();
  if (compact.length === 0) {
    return {
      tables: [],
      joins: [],
      filters: [],
      limit: null
    };
  }

  const tables: string[] = [];
  const tableRegex = /\b(?:from|join)\s+((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRegex.exec(compact)) !== null) {
    const relation = normalizeSqlRelationName(tableMatch[1]);
    if (relation && !tables.includes(relation)) {
      tables.push(relation);
    }
  }

  const joins: string[] = [];
  const joinRegex = /\bjoin\s+.+?\bon\s+(.+?)(?=\bjoin\b|\bwhere\b|\bgroup\b|\border\b|\blimit\b|$)/gi;
  let joinMatch: RegExpExecArray | null;
  while ((joinMatch = joinRegex.exec(compact)) !== null) {
    const joinClause = compactSqlSnippet(joinMatch[1], 120);
    if (joinClause.length > 0) {
      joins.push(joinClause);
    }
  }

  const whereMatch = compact.match(/\bwhere\b\s+(.+?)(?=\bgroup\b|\border\b|\blimit\b|$)/i);
  const filters: string[] = [];
  if (whereMatch?.[1]) {
    const clauses = whereMatch[1]
      .split(/\s+and\s+/i)
      .map((clause) => clause.trim())
      .filter((clause) => clause.length > 0)
      .filter((clause) => !/^(1\s*=\s*1|true)$/i.test(clause));

    for (const clause of clauses.slice(0, 4)) {
      filters.push(compactSqlSnippet(clause, 110));
    }
    if (clauses.length > 4) {
      filters.push(`(+${clauses.length - 4} more)`);
    }
  }

  const limitMatch = compact.match(/\blimit\s+(\d+)\b/i);
  const limit = limitMatch ? Number.parseInt(limitMatch[1], 10) : null;

  return { tables, joins, filters, limit: Number.isNaN(limit ?? Number.NaN) ? null : limit };
}

function normalizeSqlRelationName(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const cleaned = value.replace(/"/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function compactSqlSnippet(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 3))}...`;
}

function pickPrimaryMetricEntry(
  userMessage: string,
  entries: Array<{ key: string; value: number }>
): { key: string; value: number } | null {
  if (entries.length === 0) {
    return null;
  }

  const lower = userMessage.toLowerCase();
  const prioritized = entries
    .map((entry) => {
      const key = entry.key.toLowerCase();
      let score = 0;
      if (/(total|sum|sales|revenue|gmv|amount|value|metric|count)/.test(key)) score += 8;
      if (/(count|rows|row_count)/.test(key) && !/\bhow many\b/.test(lower)) score -= 3;
      if (/\bhow many\b/.test(lower) && /(count|rows|row_count)/.test(key)) score += 10;
      if (/\bsales|revenue|gmv|amount\b/.test(lower) && /(sales|revenue|gmv|amount|value|total)/.test(key)) score += 6;
      return { ...entry, score };
    })
    .sort((a, b) => b.score - a.score);

  return prioritized[0] ?? null;
}

function formatWindowFromRow(row: Record<string, unknown>): string | null {
  const monthWindow = formatMonthWindow(row.from_month, row.to_month);
  if (monthWindow) {
    return monthWindow;
  }

  const dayWindow = formatDayWindow(row.from_date, row.to_date);
  if (dayWindow) {
    return dayWindow;
  }

  return null;
}

function prettifyColumnLabel(columnName: string): string {
  return columnName
    .replace(/[_\s]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatUnknownValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? formatNumericValue(value) : "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return JSON.stringify(value);
}

function isLikelySingleSelectSql(sql: string): boolean {
  if (!sql || sql.trim().length === 0) {
    return false;
  }
  if (sql.includes(";")) {
    return false;
  }
  return /^\s*(select|with)\b/i.test(sql);
}

function isUiControlCommand(command: string): boolean {
  return /^__ui_[a-z0-9_]+__$/.test(command);
}

function summarizeNaturalQueryResult(
  action: NaturalQueryAction,
  firstRow: Record<string, unknown> | undefined
): string {
  const row = firstRow ?? {};
  const observedMonths = parseIntegerValue(row.observed_months);
  const expectedMonths = parseIntegerValue(row.expected_months) ?? action.requested_months;
  const missingMonths = parseStringArrayValue(row.missing_months);
  const locationSuffix = action.city_filter ? ` in ${action.city_filter}` : "";
  const productSuffix = action.product_filter ? ` for product ${action.product_filter}` : "";

  if (action.kind === "sum_days") {
    const totalValue = parseNumberValue(row.total_value) ?? 0;
    const dayWindow = action.requested_days ?? parseIntegerValue(row.requested_days) ?? 1;
    const lines: string[] = [
      `Total sales${locationSuffix}${productSuffix} for the last ${dayWindow} day(s): ${formatNumericValue(totalValue)}.`
    ];
    const rowCount = parseIntegerValue(row.row_count);
    if (rowCount !== null) {
      lines.push(`Rows scanned in window: ${rowCount}.`);
    }
    const dayWindowLabel = formatDayWindow(row.from_date, row.to_date);
    if (dayWindowLabel) {
      lines.push(`Window checked: ${dayWindowLabel}.`);
    }
    return lines.join("\n");
  }

  if (action.kind === "sum_months") {
    const totalValue = parseNumberValue(row.total_value) ?? 0;
    const monthWindow = expectedMonths ?? action.requested_months ?? observedMonths;
    const windowLabel = action.window_label
      ? `for ${action.window_label}`
      : `for the last ${monthWindow ?? "requested"} month(s)`;
    const lines: string[] = [
      `Total sales${locationSuffix}${productSuffix} ${windowLabel}: ${formatNumericValue(totalValue)}.`
    ];
    lines.push(formatCoverageLine(observedMonths, expectedMonths, missingMonths));
    const window = formatMonthWindow(row.from_month, row.to_month);
    if (window) {
      lines.push(`Window checked: ${window}.`);
    }
    return lines.join("\n");
  }

  if (action.kind === "sum_total") {
    const totalValue = parseNumberValue(row.total_value) ?? 0;
    const lines: string[] = [
      `Total sales${locationSuffix}${productSuffix} across all available data: ${formatNumericValue(totalValue)}.`
    ];
    const rowCount = parseIntegerValue(row.row_count);
    if (rowCount !== null) {
      lines.push(`Rows scanned: ${rowCount}.`);
    }
    const dayWindowLabel = formatDayWindow(row.from_date, row.to_date);
    if (dayWindowLabel) {
      lines.push(`Data range: ${dayWindowLabel}.`);
    }
    return lines.join("\n");
  }

  if (expectedMonths !== null || action.requested_months !== null) {
    const lines: string[] = [
      formatCoverageLine(observedMonths, expectedMonths, missingMonths)
    ];
    const window = formatMonthWindow(row.from_month, row.to_month);
    if (window) {
      lines.push(`Window checked: ${window}.`);
    }
    return lines.join("\n");
  }

  const availableMonths = parseIntegerValue(row.months_available);
  const firstMonth = parseDateValue(row.first_month);
  const lastMonth = parseDateValue(row.last_month);
  const rangeText = firstMonth && lastMonth ? ` (${firstMonth} to ${lastMonth})` : "";
  return `Months available: ${availableMonths ?? 0}${rangeText}.`;
}

function formatCoverageLine(
  observedMonths: number | null,
  expectedMonths: number | null,
  missingMonths: string[]
): string {
  if (observedMonths === null && expectedMonths === null) {
    return "Coverage could not be determined from the query output.";
  }

  if (expectedMonths !== null && observedMonths !== null) {
    if (observedMonths < expectedMonths || missingMonths.length > 0) {
      if (missingMonths.length > 0) {
        return `Coverage: ${observedMonths} out of ${expectedMonths} month(s) have data. Missing months: ${missingMonths.join(", ")}.`;
      }

      const inferredMissing = Math.max(expectedMonths - observedMonths, 0);
      return `Coverage: ${observedMonths} out of ${expectedMonths} month(s) have data. Missing months detected: ${inferredMissing}.`;
    }
    return `Coverage: all ${expectedMonths} month(s) have data.`;
  }

  if (observedMonths !== null) {
    return `Coverage: ${observedMonths} month(s) have data.`;
  }

  return `Coverage target: ${expectedMonths} month(s).`;
}

function parseIntegerValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parseStringArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "").trim()))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return [];
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner.length === 0) {
      return [];
    }
    return inner
      .split(",")
      .map((entry) => entry.replace(/^"(.*)"$/, "$1").trim())
      .filter((entry) => entry.length > 0);
  }

  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [trimmed];
}

function parseDateValue(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().slice(0, 10);
  }
  return null;
}

function formatMonthWindow(fromValue: unknown, toValue: unknown): string | null {
  const from = parseDateValue(fromValue);
  const to = parseDateValue(toValue);
  if (!from || !to) {
    return null;
  }
  return `${from} to ${to}`;
}

function formatDayWindow(fromValue: unknown, toValue: unknown): string | null {
  const from = parseDateValue(fromValue);
  const to = parseDateValue(toValue);
  if (!from || !to) {
    return null;
  }
  return `${from} to ${to}`;
}

function formatNumericValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function maybePrepareOrRun(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  if (state.prep_complete) {
    // Already confirmed scope in a previous turn — run now
    return buildAnalysisConfirmation(state);
  }

  // Show scope confirmation first
  return buildPreparationConfirmation(state, apiClient);
}

async function buildPreparationConfirmation(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
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
  nextState.prep_pending = true;
  nextState.scope_pending = false;

  const draft = nextState.draft;
  const tables = draft.allowed_relations.length > 0 ? draft.allowed_relations.join(", ") : "default tables";
  const metrics = draft.metric_ids.length > 0 ? draft.metric_ids.map((m) => m.replace(/^metric_/, "")).join(", ") : "all available";
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
    `Ready to prepare data for: "${reportName}"`,
    "",
    "Scope summary:",
    `- Tables: ${tables}`,
    `- Metrics: ${metrics}`,
    `- Dimensions: ${dimensions}`,
    `- Mode: ${modeLabel}`,
    `- Timeline: ${timelineHint}`,
    ...verificationLines,
    "",
    "Scope is locked and waiting on the current workflow decision."
  ].join("\n");

  return {
    assistant_message: scopeMessage,
    state: nextState
  };
}

function buildAnalysisConfirmation(state: ChatState): ChatTurnResponse {
  const nextState = parseChatState(state);
  nextState.scope_pending = true;
  nextState.prep_pending = false;

  const payloadCount = nextState.prepared_payloads.length;
  const payloadLine = payloadCount > 0
    ? `Prepared payloads: ${payloadCount} question${payloadCount === 1 ? "" : "s"}.`
    : "Prepared payloads are ready.";

  return {
    assistant_message: [
      payloadLine,
      "Analysis is staged and waiting on the current workflow decision."
    ].join("\n"),
    state: nextState
  };
}

function isQueryExecutionChoice(command: string): boolean {
  return (
    /^__ui_run_query__$/.test(command) ||
    /^(run query|execute query|yes run query|confirm query)\b/.test(command) ||
    /^(yes|y|go ahead|proceed|ok|okay|sure|confirm|do it|run it|run this query)\b/.test(command) ||
    /^can you run (?:this )?query\b/.test(command)
  );
}

function isQueryOtherInstructionChoice(command: string): boolean {
  return (
    /^__ui_query_other_instruction__$/.test(command) ||
    /^(other instruction|continue instruction|skip query|cancel query)\b/.test(command)
  );
}

function isScopeRunChoice(command: string): boolean {
  return (
    /^__ui_finish_scoping_run_analysis__$/.test(command) ||
    /\b(confirm|yes|go ahead|proceed|looks good|lgtm|run it|do it|execute|approved|ok|okay|sure|start)\b/.test(command) ||
    /^(finish scoping and run analysis|run analysis|execute analysis)\b/.test(command)
  );
}

function isScopeContinueChoice(command: string): boolean {
  return (
    /^__ui_continue_scoping__$/.test(command) ||
    /^(continue scoping|keep scoping|adjust scope)\b/.test(command)
  );
}

function isRunPreparationChoice(command: string): boolean {
  return (
    /^__ui_run_data_preparation__$/.test(command) ||
    /^(run data preparation|prepare data|run preparation)\b/.test(command)
  );
}

function isPdfGenerateYesChoice(command: string): boolean {
  return (
    /^__ui_generate_pdf_yes__$/.test(command) ||
    /^(yes|generate pdf|create pdf|download pdf)\b/.test(command)
  );
}

function isPdfGenerateNoChoice(command: string): boolean {
  return (
    /^__ui_generate_pdf_no__$/.test(command) ||
    /^(not yet|no|skip pdf|later)\b/.test(command)
  );
}

function isSaveReportYesChoice(command: string): boolean {
  return (
    /^__ui_save_report_yes__$/.test(command) ||
    /^(save report|save log|yes save)\b/.test(command)
  );
}

function isSaveReportNoChoice(command: string): boolean {
  return (
    /^__ui_save_report_no__$/.test(command) ||
    /^(skip save|dont save|don't save|no save)\b/.test(command)
  );
}

function isScheduleSetupYesChoice(command: string): boolean {
  return (
    /^__ui_schedule_setup_yes__$/.test(command) ||
    /^(schedule report|yes schedule|set schedule)\b/.test(command)
  );
}

function isScheduleSetupNoChoice(command: string): boolean {
  return (
    /^__ui_schedule_setup_no__$/.test(command) ||
    /^(not now|skip schedule|no schedule)\b/.test(command)
  );
}

function isScheduleModeWeeklyChoice(command: string): boolean {
  return /^__ui_schedule_mode_weekly__$/.test(command) || /^(weekly)\b/.test(command);
}

function isScheduleModeMonthlyChoice(command: string): boolean {
  return /^__ui_schedule_mode_monthly__$/.test(command) || /^(monthly)\b/.test(command);
}

function isScheduleModeQuarterlyChoice(command: string): boolean {
  return /^__ui_schedule_mode_quarterly__$/.test(command) || /^(quarterly)\b/.test(command);
}

function isScheduleCustomDayChoice(command: string): boolean {
  return /^__ui_schedule_day_custom__$/.test(command) || /custom day/.test(command);
}

function parseMonthDayChoice(command: string): number | null {
  if (/^__ui_schedule_day_1__$/.test(command)) return 1;
  if (/^__ui_schedule_day_15__$/.test(command)) return 15;
  if (/^__ui_schedule_day_28__$/.test(command)) return 28;
  return null;
}

function parseCustomMonthDay(rawMessage: string): number | null {
  const match = rawMessage.match(/\b([1-9]|1\d|2[0-8])\b/);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[1], 10);
  if (Number.isNaN(value) || value < 1 || value > 28) {
    return null;
  }
  return value;
}

function parseWeekdayChoice(command: string): number | null {
  const normalized = command.trim().toLowerCase();
  if (/^__ui_schedule_weekday_mon__$/.test(normalized) || /\bmonday\b/.test(normalized)) return 1;
  if (/^__ui_schedule_weekday_tue__$/.test(normalized) || /\btuesday\b/.test(normalized)) return 2;
  if (/^__ui_schedule_weekday_wed__$/.test(normalized) || /\bwednesday\b/.test(normalized)) return 3;
  if (/^__ui_schedule_weekday_thu__$/.test(normalized) || /\bthursday\b/.test(normalized)) return 4;
  if (/^__ui_schedule_weekday_fri__$/.test(normalized) || /\bfriday\b/.test(normalized)) return 5;
  if (/^__ui_schedule_weekday_sat__$/.test(normalized) || /\bsaturday\b/.test(normalized)) return 6;
  if (/^__ui_schedule_weekday_sun__$/.test(normalized) || /\bsunday\b/.test(normalized)) return 0;
  return null;
}

async function executePreparation(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const missing = getMissingDraftFields(state);
  if (missing.length > 0) {
    return { assistant_message: `Cannot prepare data yet: ${missing.join(", ")}.`, state };
  }

  const nextState = parseChatState(state);
  nextState.prep_pending = false;

  if (!nextState.contract_id) {
    const contract = buildContractPayload(nextState);
    const created = await apiClient.createContract(contract);
    nextState.contract_id = created.id;
  }

  const prepared = await apiClient.prepareContract(nextState.contract_id!);
  nextState.prep_complete = true;
  nextState.scope_pending = true;
  nextState.prepared_payloads = prepared.prepared_payloads;
  nextState.preparation_summary = prepared.planner_summary ?? null;
  if (prepared.token_usage) {
    nextState.last_token_usage = prepared.token_usage;
  }

  const payloadLines = prepared.prepared_payloads
    .slice(0, 6)
    .map((payload) => formatPreparedPayloadSummary(payload));

  return {
    assistant_message: [
      "Data preparation completed with validation checks and correction trace.",
      payloadLines.length > 0 ? payloadLines.join("\n\n") : "- No prepared payloads.",
      "",
      "Analysis is staged and waiting on the current workflow decision."
    ].join("\n"),
    state: nextState
  };
}

async function executePayloadQa(
  state: ChatState,
  question: string,
  apiClient: WebApiClient
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  if (!nextState.last_run_id) {
    return {
      assistant_message: "No completed run found yet. Run analysis first.",
      state: nextState
    };
  }

  const response = await apiClient.askRunQuestion(nextState.last_run_id, question);
  const citationLine = response.citations.length > 0
    ? `\nReferences: ${response.citations.join(", ")}`
    : "";

  return {
    assistant_message: `${response.answer}${citationLine}`,
    state: nextState
  };
}

async function executeRun(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const missing = getMissingDraftFields(state);
  if (missing.length > 0) {
    return { assistant_message: `Cannot run yet: ${missing.join(", ")}.`, state };
  }

  if (!state.prep_complete) {
    return {
      assistant_message:
        "Data preparation is still pending; analysis can start after preparation completes.",
      state
    };
  }

  const nextState = parseChatState(state);
  nextState.prep_pending = false;
  nextState.scope_pending = false;
  nextState.pending_query_sql = null;
  nextState.pending_query_limit = null;

  if (!nextState.contract_id) {
    const contract = buildContractPayload(nextState);
    const created = await apiClient.createContract(contract);
    nextState.contract_id = created.id;
  }

  const run = await apiClient.runContract(nextState.contract_id!);
  nextState.last_run_id = run.run_id;
  nextState.last_exec_brief = run.exec_brief;
  nextState.planner_summary = run.planner_summary ?? null;
  nextState.last_concise_summary = run.concise_summary ?? null;
  nextState.prepared_payloads = run.prepared_payloads ?? nextState.prepared_payloads;
  nextState.awaiting_pdf_confirmation = true;
  if (run.token_usage) {
    nextState.last_token_usage = run.token_usage;
  }

  const brief = run.exec_brief;
  const briefLines: string[] = [];

  if (run.planner_summary) {
    briefLines.push(`**Planning:** ${run.planner_summary}`);
    briefLines.push("");
  }

  briefLines.push(
    `What changed: ${brief.what_changed.join("; ") || "nothing notable"}`,
    `Why: ${brief.why.join("; ") || "unknown"}`,
    `So what: ${brief.so_what.join("; ") || "no impact noted"}`,
    `Recommended: ${brief.what_to_do.join("; ") || "no action needed"}`
  );

  const payloadDiagnostics = (run.prepared_payloads ?? [])
    .slice(0, 6)
    .map((payload) => formatPreparedPayloadSummary(payload));
  const diagnosticsBlock = payloadDiagnostics.length > 0
    ? ["Data prep validation:", payloadDiagnostics.join("\n\n")].join("\n")
    : "";

  const tokenUsageLine = run.token_usage
    ? `Tokens used - input: ${run.token_usage.input_tokens}, output: ${run.token_usage.output_tokens}, total: ${run.token_usage.total_tokens}.`
    : "";

  return {
    assistant_message: [
      `Report executed. Run ID: ${run.run_id}.`,
      run.concise_summary ?? "",
      briefLines.join("\n"),
      diagnosticsBlock,
      tokenUsageLine,
      "PDF generation decision is pending."
    ].filter((line) => line.length > 0).join("\n\n"),
    state: nextState,
    exec_brief_html: run.exec_brief_html
  };
}

async function executeSchedule(
  state: ChatState,
  apiClient: WebApiClient,
  payload: {
    frequency: "weekly" | "monthly" | "quarterly";
    day_of_week?: number;
    day_of_month?: number;
  }
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);

  if (!nextState.contract_id) {
    const contract = buildContractPayload(nextState);
    const created = await apiClient.createContract(contract);
    nextState.contract_id = created.id;
  }

  try {
    await apiClient.approveContract(nextState.contract_id!);
    await apiClient.lockContract(nextState.contract_id!);

    const scheduled = await apiClient.scheduleContract(nextState.contract_id!, {
      frequency: payload.frequency,
      day_of_week: payload.day_of_week,
      day_of_month: payload.day_of_month,
      timezone: nextState.draft.timezone
    });

    nextState.draft.timezone = scheduled.timezone;
    nextState.draft.schedule_cron = scheduled.schedule_cron;
    nextState.awaiting_schedule_confirmation = false;
    nextState.awaiting_schedule_mode_selection = false;
    nextState.schedule_mode_pending = null;
    nextState.schedule_day_kind = null;
    nextState.awaiting_custom_day_input = false;

    return {
      assistant_message: `Scheduled ${scheduled.frequency} runs in ${scheduled.timezone} (cron: \`${scheduled.schedule_cron}\`).`,
      state: nextState
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to schedule report.";
    return {
      assistant_message: `Could not create schedule: ${message}`,
      state: nextState
    };
  }
}

function formatPreparedPayloadSummary(payload: PreparedPayloadRecord): string {
  const label = payload.question_number ? `Q${payload.question_number}` : "Question";
  const lines: string[] = [
    `- ${label}: ${payload.question}`,
    `  Rows: ${payload.row_count_before_reduction} raw -> ${payload.prepared_row_count} prepared`
  ];

  if (payload.source_query_count && payload.source_query_count > 1) {
    lines.push(`  Sources merged: ${payload.source_query_count} queries${payload.group_id ? ` (group: ${payload.group_id})` : ""}`);
  }

  const qualitySummary = summarizeQueryQuality(payload.preparation_notes);
  if (qualitySummary) {
    lines.push(`  Query quality: ${qualitySummary}`);
  }

  const autoCorrections = collectAutoCorrections(payload.preparation_notes, payload.warnings);
  if (autoCorrections.length > 0) {
    lines.push(`  Auto-corrections: ${autoCorrections.join(" | ")}`);
  }

  const unresolvedWarnings = collectUnresolvedWarnings(payload.warnings);
  if (unresolvedWarnings.length > 0) {
    lines.push(`  Remaining hiccups: ${unresolvedWarnings.join(" | ")}`);
  } else {
    lines.push("  Remaining hiccups: none");
  }

  if (payload.validation) {
    const expectedMonths = payload.validation.expected_months ?? null;
    if (expectedMonths) {
      const coveragePct = expectedMonths > 0
        ? Math.round((payload.validation.observed_months / expectedMonths) * 100)
        : 0;
      const status = payload.validation.missing_months.length === 0 && payload.validation.observed_months >= expectedMonths
        ? "PASS"
        : "GAP";
      const missing = payload.validation.missing_months.length > 0
        ? ` | missing: ${payload.validation.missing_months.join(", ")}`
        : "";
      lines.push(
        `  Validation timeline: ${status} (${payload.validation.observed_months}/${expectedMonths} months, ${coveragePct}%)${missing}`
      );
    } else if (payload.validation.observed_months > 0) {
      lines.push(`  Validation timeline: ${payload.validation.observed_months} month(s) detected`);
    } else {
      lines.push("  Validation timeline: no valid month keys detected");
    }

    if (payload.validation.monthly_row_counts.length > 0) {
      const monthlyRows = payload.validation.monthly_row_counts
        .slice(-6)
        .map((entry) => `${entry.month}=${entry.row_count}`)
        .join(", ");
      const coveredMonths = payload.validation.monthly_row_counts.filter((entry) => entry.row_count > 0).length;
      lines.push(
        `  Validation monthly rows: ${monthlyRows} (non-zero months: ${coveredMonths}/${payload.validation.monthly_row_counts.length})`
      );
    }

    if (payload.validation.metric_column && payload.validation.monthly_metric_totals.length > 0) {
      const monthly = payload.validation.monthly_metric_totals
        .slice(-6)
        .map((entry) => `${entry.month}=${entry.total}`)
        .join(", ");
      lines.push(`  MoM ${payload.validation.metric_column}: ${monthly}`);
    }
  }

  return lines.join("\n");
}

function summarizeQueryQuality(preparationNotes: string[]): string | null {
  const scores = preparationNotes
    .map((note) => {
      const match = note.match(/Source query\s+(\d+).*quality score:\s*(\d+)\/100/i);
      if (!match) {
        return null;
      }
      return `Q${match[1]}=${match[2]}/100`;
    })
    .filter((entry): entry is string => entry !== null);

  if (scores.length === 0) {
    return null;
  }

  return scores.join(", ");
}

function collectAutoCorrections(preparationNotes: string[], warnings: string[]): string[] {
  const candidates = [...preparationNotes, ...warnings];
  const patterns = [
    /auto-repaired/i,
    /fallback candidate/i,
    /applied .*reduction/i,
    /re-prepared dataset/i,
    /enforce requested month-over-month comparison coverage/i
  ];

  const corrections = candidates
    .filter((entry) => patterns.some((pattern) => pattern.test(entry)))
    .map((entry) => entry.replace(/^Source query \d+:\s*/i, "").trim())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(corrections)).slice(0, 4);
}

function collectUnresolvedWarnings(warnings: string[]): string[] {
  const resolvedPatterns = [
    /auto-repaired/i,
    /fallback candidate/i
  ];

  const unresolved = warnings
    .filter((warning) => !resolvedPatterns.some((pattern) => pattern.test(warning)))
    .map((warning) => warning.replace(/^Source query \d+:\s*/i, "").trim())
    .filter((warning) => warning.length > 0);

  return Array.from(new Set(unresolved)).slice(0, 4);
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

  if (state.last_query_id) {
    parts.push(`Last query ID: ${state.last_query_id}.`);
  }

  if (state.last_single_query_snapshot) {
    parts.push("Single-query context is available for replay.");
  }

  if (state.last_exec_brief) {
    const eb = state.last_exec_brief;
    parts.push(`Last analysis: ${eb.what_changed.join("; ")}.`);
  }

  if (state.pending_query_sql) {
    parts.push("A query is pending confirmation.");
  }

  if (state.pending_single_query_request) {
    parts.push("A single-query clarification is pending.");
  }

  if (state.prep_pending) {
    parts.push("Data preparation is waiting for confirmation.");
  }

  if (state.scope_pending) {
    parts.push("Analysis execution is waiting for scope confirmation.");
  }

  if (state.awaiting_pdf_confirmation) {
    parts.push("PDF generation is waiting for confirmation.");
  }

  parts.push("No specific action was executed for this message.");
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function summarizeSql(sql: string): string {
  const compact = sql.replace(/\s+/g, " ").trim();
  if (compact.length <= 180) {
    return compact;
  }

  return `${compact.slice(0, 177)}...`;
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
  if (match) {
    const sql = normalizeExecutableSql(match[1]);
    if (sql.length === 0) {
      return null;
    }

    return { sql };
  }

  const trimmed = normalizeExecutableSql(raw);
  if (
    (/^\s*select\b/i.test(trimmed) && /\bfrom\b/i.test(trimmed)) ||
    (/^\s*with\b/i.test(trimmed) && /\bselect\b/i.test(trimmed))
  ) {
    return { sql: trimmed };
  }

  const fenced = extractSqlFence(raw);
  if (fenced) {
    return { sql: normalizeExecutableSql(fenced) };
  }

  return null;
}

function normalizeExecutableSql(value: string): string {
  const withoutFence = value
    .replace(/^\s*```(?:sql)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const withoutEllipsis = withoutFence.replace(/\n\s*(?:\.{3}|…)\s*$/u, "").trim();
  return withoutEllipsis.replace(/;+\s*$/g, "").trim();
}

type NaturalQueryAction = {
  kind: "month_coverage" | "sum_months" | "sum_days" | "sum_total";
  sql: string;
  explanation: string;
  relation: string;
  date_column: string | null;
  requested_months: number | null;
  requested_days?: number | null;
  metric_column?: string;
  city_filter?: string | null;
  product_filter?: string | null;
  joined_relations?: string[];
  window_label?: string | null;
  limit?: number;
};

async function inferNaturalQueryAction(
  rawMessage: string,
  state: ChatState,
  apiClient: WebApiClient
): Promise<NaturalQueryAction | null> {
  const lower = rawMessage.toLowerCase();
  if (!looksLikeSingleQueryCandidate(lower, state)) {
    return null;
  }

  let catalog: DataCatalogRecord;
  try {
    catalog = await apiClient.getCatalog();
  } catch {
    return null;
  }

  if (catalog.tables.length === 0) {
    return null;
  }

  const requestedMonths = extractRequestedMonths(lower);
  const requestedDays = extractRequestedDays(lower);
  const canCarryWindowFromHistory =
    looksLikeSalesNumericFollowUp(lower, state) && requestedMonths === null && requestedDays === null;
  const historicalWindow = canCarryWindowFromHistory ? extractRequestedWindowFromHistory(state) : null;
  const contextualMonths =
    requestedMonths ?? (historicalWindow?.unit === "months" ? historicalWindow.value : null);
  const contextualDays =
    requestedDays ?? (historicalWindow?.unit === "days" ? historicalWindow.value : null);
  const hasExplicitTimeWindow =
    contextualDays !== null ||
    contextualMonths !== null ||
    /\b(this|current|past|last|previous)\s+(day|days|week|weeks|month|months|quarter|quarters|year|years)\b/.test(lower) ||
    /\btoday\b/.test(lower);
  const salesSumIntent = asksForSalesSum(lower) || looksLikeSalesNumericFollowUp(lower, state);

  if (salesSumIntent) {
    const target = pickBestAggregateTargetForQuestion(lower, catalog.tables);
    if (!target) {
      return null;
    }

    const baseAlias = "base";
    const relation = quoteQualifiedRelation(target.table.qualified_name);
    const dateExpression = target.date_column
      ? `${baseAlias}.${quoteSqlIdentifier(target.date_column.column_name)}`
      : null;
    let fromClause = `FROM ${relation} AS ${baseAlias}`;
    const whereClauses: string[] = [];
    const joinedRelations: string[] = [];

    const cityFilter = pickCityFilter(lower, target.table, state);
    if (cityFilter !== null) {
      whereClauses.push(
        `  AND lower(${baseAlias}.${quoteSqlIdentifier(cityFilter.column_name)}::text) = lower(${quoteSqlLiteral(cityFilter.value)})`
      );
    }
    const statusFilters = collectRequestedStatuses(lower, state);
    const statusColumn =
      statusFilters.length > 0
        ? pickBestStatusColumnForFilter(target.table)
        : null;
    if (statusColumn && statusFilters.length > 0) {
      whereClauses.push(
        `  AND lower(${baseAlias}.${quoteSqlIdentifier(statusColumn.column_name)}::text) = ANY (ARRAY[${statusFilters
          .map((value) => quoteSqlLiteral(value))
          .join(", ")}])`
      );
    }

    let productFilterValue: string | null = null;
    const productFilterInBase = pickProductFilter(lower, target.table, state);
    if (productFilterInBase) {
      whereClauses.push(
        `  AND lower(${baseAlias}.${quoteSqlIdentifier(productFilterInBase.column_name)}::text) = lower(${quoteSqlLiteral(productFilterInBase.value)})`
      );
      productFilterValue = productFilterInBase.value;
    } else if (asksForProductFilter(lower)) {
      const joinPlan = pickJoinPlanForProductFilter(lower, target.table, catalog.tables, state);
      if (!joinPlan) {
        return null;
      }

      const joinAlias = "dim";
      fromClause = [
        `FROM ${relation} AS ${baseAlias}`,
        `JOIN ${quoteQualifiedRelation(joinPlan.table.qualified_name)} AS ${joinAlias}`,
        `  ON ${baseAlias}.${quoteSqlIdentifier(joinPlan.base_key)} = ${joinAlias}.${quoteSqlIdentifier(joinPlan.join_key)}`
      ].join("\n");
      whereClauses.push(
        `  AND lower(${joinAlias}.${quoteSqlIdentifier(joinPlan.filter_column)}::text) = lower(${quoteSqlLiteral(joinPlan.filter_value)})`
      );
      productFilterValue = joinPlan.filter_value;
      joinedRelations.push(joinPlan.table.qualified_name);
    }

    const metricColumn = pickBestMetricColumnForSum(lower, target.table);
    if (!metricColumn) {
      return null;
    }

    const metricExpression = `${baseAlias}.${quoteSqlIdentifier(metricColumn.column_name)}`;
    const calendarMonthRange = extractCalendarMonthRange(rawMessage);

    if (calendarMonthRange && dateExpression && target.date_column) {
      const sql = [
        "SELECT",
        `  COALESCE(SUM(COALESCE(${metricExpression}::numeric, 0)), 0)::numeric AS total_value,`,
        `  COUNT(DISTINCT date_trunc('month', ${dateExpression}::timestamp))::int AS observed_months,`,
        "  1::int AS expected_months,",
        "  ARRAY[]::text[] AS missing_months,",
        `  DATE ${quoteSqlLiteral(calendarMonthRange.from_date)} AS from_month,`,
        `  (DATE ${quoteSqlLiteral(calendarMonthRange.to_exclusive_date)} - INTERVAL '1 day')::date AS to_month`,
        fromClause,
        `WHERE ${dateExpression} IS NOT NULL`,
        `  AND ${dateExpression} >= DATE ${quoteSqlLiteral(calendarMonthRange.from_date)}`,
        `  AND ${dateExpression} < DATE ${quoteSqlLiteral(calendarMonthRange.to_exclusive_date)}`,
        ...whereClauses
      ].join("\n");

      return {
        kind: "sum_months",
        sql,
        explanation:
          `Using ${target.table.qualified_name}.${target.date_column.column_name} with ` +
          `${target.table.qualified_name}.${metricColumn.column_name} for calendar month ${calendarMonthRange.label}` +
          (productFilterValue ? `, filtered to product ${productFilterValue}` : "") +
          (statusFilters.length > 0 ? `, filtered by ${statusFilters.join(", ")} status` : "") +
          (cityFilter ? `, filtered to ${cityFilter.value}` : "") +
          ".",
        relation: target.table.qualified_name,
        date_column: target.date_column.column_name,
        requested_months: 1,
        metric_column: metricColumn.column_name,
        city_filter: cityFilter?.value ?? null,
        product_filter: productFilterValue,
        joined_relations: joinedRelations.length > 0 ? joinedRelations : undefined,
        window_label: calendarMonthRange.label
      };
    }

    const monthWindowHint = /\b(month|months|quarter|quarters|year|years)\b/.test(lower);
    if (hasExplicitTimeWindow && (contextualMonths !== null || monthWindowHint)) {
      if (!dateExpression || !target.date_column) {
        return null;
      }

      const months = normalizeMonthWindow(contextualMonths ?? 4);
      const lookback = months - 1;
      const sql = [
        "SELECT",
        `  COALESCE(SUM(COALESCE(${metricExpression}::numeric, 0)), 0)::numeric AS total_value,`,
        `  COUNT(DISTINCT date_trunc('month', ${dateExpression}::timestamp))::int AS observed_months,`,
        `  ${months}::int AS expected_months,`,
        "  ARRAY[]::text[] AS missing_months,",
        `  (date_trunc('month', CURRENT_DATE) - interval '${lookback} months')::date AS from_month,`,
        "  (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date AS to_month",
        fromClause,
        `WHERE ${dateExpression} IS NOT NULL`,
        `  AND ${dateExpression} >= date_trunc('month', CURRENT_DATE) - interval '${lookback} months'`,
        `  AND ${dateExpression} < date_trunc('month', CURRENT_DATE) + interval '1 month'`,
        ...whereClauses
      ].join("\n");

      return {
        kind: "sum_months",
        sql,
        explanation:
          `Using ${target.table.qualified_name}.${target.date_column.column_name} with ` +
          `${target.table.qualified_name}.${metricColumn.column_name} for rolling monthly total` +
          (productFilterValue ? `, filtered to product ${productFilterValue}` : "") +
          (statusFilters.length > 0 ? `, filtered by ${statusFilters.join(", ")} status` : "") +
          (cityFilter ? `, filtered to ${cityFilter.value}` : "") +
          ".",
        relation: target.table.qualified_name,
        date_column: target.date_column.column_name,
        requested_months: months,
        metric_column: metricColumn.column_name,
        city_filter: cityFilter?.value ?? null,
        product_filter: productFilterValue,
        joined_relations: joinedRelations.length > 0 ? joinedRelations : undefined
      };
    }

    if (contextualDays !== null && dateExpression && target.date_column) {
      const safeDays = normalizeDayWindow(contextualDays);
      const lookbackDays = safeDays - 1;
      const sql = [
        "SELECT",
        `  COALESCE(SUM(COALESCE(${metricExpression}::numeric, 0)), 0)::numeric AS total_value,`,
        "  COUNT(*)::int AS row_count,",
        `  (CURRENT_DATE - interval '${lookbackDays} days')::date AS from_date,`,
        "  CURRENT_DATE::date AS to_date",
        fromClause,
        `WHERE ${dateExpression} IS NOT NULL`,
        `  AND ${dateExpression} >= CURRENT_DATE - interval '${lookbackDays} days'`,
        "  AND " + `${dateExpression} < CURRENT_DATE + interval '1 day'`,
        ...whereClauses
      ].join("\n");

      return {
        kind: "sum_days",
        sql,
        explanation:
          `Using ${target.table.qualified_name}.${target.date_column.column_name} with ` +
          `${target.table.qualified_name}.${metricColumn.column_name} for a ${safeDays}-day total` +
          (productFilterValue ? `, filtered to product ${productFilterValue}` : "") +
          (statusFilters.length > 0 ? `, filtered by ${statusFilters.join(", ")} status` : "") +
          (cityFilter ? `, filtered to ${cityFilter.value}` : "") +
          ".",
        relation: target.table.qualified_name,
        date_column: target.date_column.column_name,
        requested_months: null,
        requested_days: safeDays,
        metric_column: metricColumn.column_name,
        city_filter: cityFilter?.value ?? null,
        product_filter: productFilterValue,
        joined_relations: joinedRelations.length > 0 ? joinedRelations : undefined
      };
    }

    const sql = [
      "SELECT",
      `  COALESCE(SUM(COALESCE(${metricExpression}::numeric, 0)), 0)::numeric AS total_value,`,
      "  COUNT(*)::int AS row_count,",
      ...(dateExpression
        ? [
            `  MIN(${dateExpression})::date AS from_date,`,
            `  MAX(${dateExpression})::date AS to_date`
          ]
        : [
            "  NULL::date AS from_date,",
            "  NULL::date AS to_date"
          ]),
      fromClause,
      "WHERE 1 = 1",
      ...whereClauses
    ].join("\n");

    return {
      kind: "sum_total",
      sql,
      explanation:
        `Using ${target.table.qualified_name}` +
        (target.date_column ? `.${target.date_column.column_name}` : "") +
        ` with ${target.table.qualified_name}.${metricColumn.column_name} for all-time total` +
        (productFilterValue ? `, filtered to product ${productFilterValue}` : "") +
        (statusFilters.length > 0 ? `, filtered by ${statusFilters.join(", ")} status` : "") +
        (cityFilter ? `, filtered to ${cityFilter.value}` : "") +
        ".",
      relation: target.table.qualified_name,
      date_column: target.date_column?.column_name ?? null,
      requested_months: null,
      metric_column: metricColumn.column_name,
      city_filter: cityFilter?.value ?? null,
      product_filter: productFilterValue,
      joined_relations: joinedRelations.length > 0 ? joinedRelations : undefined
    };
  }

  if (asksForMonthCoverage(lower)) {
    const target = pickBestTemporalTableForQuestion(lower, catalog.tables);
    if (!target) {
      return null;
    }

    const relation = quoteQualifiedRelation(target.table.qualified_name);
    const column = quoteSqlIdentifier(target.date_column.column_name);

    if (requestedMonths) {
      const months = normalizeMonthWindow(requestedMonths);
      const lookback = months - 1;
      const sql = [
        "SELECT",
        `  COUNT(DISTINCT date_trunc('month', ${column}::timestamp))::int AS observed_months,`,
        `  ${months}::int AS expected_months,`,
        "  ARRAY[]::text[] AS missing_months,",
        `  (date_trunc('month', CURRENT_DATE) - interval '${lookback} months')::date AS from_month,`,
        "  date_trunc('month', CURRENT_DATE)::date AS to_month",
        `FROM ${relation}`,
        `WHERE ${column} IS NOT NULL`,
        `  AND ${column} >= date_trunc('month', CURRENT_DATE) - interval '${lookback} months'`,
        `  AND ${column} < date_trunc('month', CURRENT_DATE) + interval '1 month'`
      ].join("\n");

      return {
        kind: "month_coverage",
        sql,
        explanation:
          `Using ${target.table.qualified_name}.${target.date_column.column_name} to validate ${months}-month coverage.`,
        relation: target.table.qualified_name,
        date_column: target.date_column.column_name,
        requested_months: months
      };
    }

    const sql = [
      "SELECT",
      `  COUNT(DISTINCT date_trunc('month', ${column}::timestamp))::int AS months_available,`,
      `  MIN(date_trunc('month', ${column}::timestamp))::date AS first_month,`,
      `  MAX(date_trunc('month', ${column}::timestamp))::date AS last_month`,
      `FROM ${relation}`,
      `WHERE ${column} IS NOT NULL`
    ].join("\n");

    return {
      kind: "month_coverage",
      sql,
      explanation: `Using ${target.table.qualified_name}.${target.date_column.column_name} to count distinct populated months and show first/last month.`,
      relation: target.table.qualified_name,
      date_column: target.date_column.column_name,
      requested_months: null
    };
  }

  return null;
}

function looksLikeSingleQueryCandidate(lower: string, state: ChatState): boolean {
  if (looksLikeAnalysisIntent(lower) || looksLikeComplexMultiQuestionPrompt(lower)) {
    return false;
  }

  if ((lower.match(/\?/g) ?? []).length > 1) {
    return false;
  }

  if (/\b(also|along with|as well|plus)\b/.test(lower)) {
    return false;
  }

  if (lower.length > 220 && (lower.includes(",") || /\band\b/.test(lower))) {
    return false;
  }

  return looksLikeSimpleQueryIntent(lower, state);
}

function buildSingleQueryClarificationPrompt(rawMessage: string, state: ChatState): string | null {
  const lower = rawMessage.toLowerCase();
  if (!(asksForSalesSum(lower) || looksLikeSalesNumericFollowUp(lower, state))) {
    return null;
  }

  const inheritedWindow = looksLikeSalesNumericFollowUp(lower, state)
    ? extractRequestedWindowFromHistory(state)
    : null;
  const missingTimeScope = !hasExplicitTimeScope(rawMessage, lower) && inheritedWindow === null;
  if (!missingTimeScope) {
    return null;
  }

  return [
    "Before I run that query, I need one clarification so the number is exact:",
    "- What time window should I use? (examples: `last 30 days`, `last full month`, `January 2026`, `all-time`)",
    "Reply with the time window and I’ll run the query immediately."
  ].join("\n");
}

function hasExplicitTimeScope(rawMessage: string, lower: string): boolean {
  if (extractRequestedDays(lower) !== null || extractRequestedMonths(lower) !== null) {
    return true;
  }

  if (extractCalendarMonthRange(rawMessage)) {
    return true;
  }

  if (
    /\b(all[- ]?time|overall|to date|year to date|ytd|month to date|mtd|quarter to date|qtd)\b/.test(lower) ||
    /\bthis\s+(week|month|quarter|year)\b/.test(lower) ||
    /\blast\s+(week|month|quarter|year)\b/.test(lower) ||
    /\btoday\b|\byesterday\b/.test(lower)
  ) {
    return true;
  }

  if (/\b20\d{2}-\d{2}-\d{2}\b/.test(lower) || /\b20\d{2}\/\d{2}\/\d{2}\b/.test(lower)) {
    return true;
  }

  return false;
}

function asksForMonthCoverage(lower: string): boolean {
  if (!/\bmonth(s)?\b/.test(lower)) {
    return false;
  }
  return (
    /\bhow many\b/.test(lower) ||
    /\bmonths of\b/.test(lower) ||
    /\bcoverage\b/.test(lower) ||
    /\brange\b/.test(lower) ||
    /\bdata do we have\b/.test(lower)
  );
}

function asksForSalesSum(lower: string): boolean {
  const hasSalesTerm = /\b(sales|revenue|gmv|amount|income|turnover|booking|value)\b/.test(lower);
  if (!hasSalesTerm) {
    return false;
  }

  return (
    /\b(sum|total)\b/.test(lower) ||
    /\b(give|show|tell)\s+me\b.*\b(sales|revenue|gmv|income|turnover)\b/.test(lower) ||
    /\bhow much\b/.test(lower) ||
    /\bwhat(?:'s| is| are)(?:\s+my)?\s+(?:total\s+)?(?:sales|revenue|gmv|income|turnover)\b/.test(lower) ||
    /\b(?:sales|revenue|gmv|income|turnover)\b.*\b(?:past|last|previous)\b.*\bmonth/.test(lower) ||
    /\b(?:sales|revenue|gmv|income|turnover)\b.*\b(?:past|last|previous)\b.*\bdays?\b/.test(lower)
  );
}

function asksForProductFilter(lower: string): boolean {
  return /\b(product|sku|item|category|brand|model)\b/.test(lower);
}

function pickProductFilter(
  lower: string,
  table: DataCatalogRecord["tables"][number],
  state: ChatState
): { column_name: string; value: string } | null {
  const direct = pickProductFilterFromLowCardinality(lower, table);
  if (direct) {
    return direct;
  }

  const phrase = extractProductPhrase(lower) ?? extractProductPhraseFromHistory(state);
  if (!phrase) {
    return null;
  }

  const productColumn = pickBestProductFilterColumnName(table);
  if (!productColumn) {
    return null;
  }

  return {
    column_name: productColumn,
    value: phrase
  };
}

function pickJoinPlanForProductFilter(
  lower: string,
  baseTable: DataCatalogRecord["tables"][number],
  tables: DataCatalogRecord["tables"],
  state: ChatState
): {
  table: DataCatalogRecord["tables"][number];
  base_key: string;
  join_key: string;
  filter_column: string;
  filter_value: string;
} | null {
  const explicitPhrase = extractProductPhrase(lower) ?? extractProductPhraseFromHistory(state);
  let best:
    | {
        table: DataCatalogRecord["tables"][number];
        base_key: string;
        join_key: string;
        filter_column: string;
        filter_value: string;
        score: number;
      }
    | null = null;

  for (const table of tables) {
    if (table.qualified_name === baseTable.qualified_name) {
      continue;
    }

    const joinKeys = pickJoinKeysForTables(baseTable, table);
    if (!joinKeys) {
      continue;
    }

    const lowCardFilter = pickProductFilterFromLowCardinality(lower, table);
    const fallbackColumn = pickBestProductFilterColumnName(table);
    const filterColumn = lowCardFilter?.column_name ?? fallbackColumn;
    const filterValue = lowCardFilter?.value ?? explicitPhrase;
    if (!filterColumn || !filterValue) {
      continue;
    }

    const score =
      (lowCardFilter ? 12 : 0) +
      (joinKeys.exact_match ? 8 : 4) +
      (table.relation_type === "VIEW" ? 1 : 0);
    if (!best || score > best.score) {
      best = {
        table,
        base_key: joinKeys.base_key,
        join_key: joinKeys.join_key,
        filter_column: filterColumn,
        filter_value: filterValue,
        score
      };
    }
  }

  return best
    ? {
        table: best.table,
        base_key: best.base_key,
        join_key: best.join_key,
        filter_column: best.filter_column,
        filter_value: best.filter_value
      }
    : null;
}

function pickProductFilterFromLowCardinality(
  lower: string,
  table: DataCatalogRecord["tables"][number]
): { column_name: string; value: string } | null {
  let best: { column_name: string; value: string; score: number } | null = null;

  for (const column of table.low_cardinality_columns) {
    if (!isProductLikeColumnName(column.column_name)) {
      continue;
    }

    const matchedValue = pickMentionedDistinctValue(lower, column.distinct_values);
    if (!matchedValue) {
      continue;
    }

    const score = matchedValue.length + scoreProductColumnName(column.column_name);
    if (!best || score > best.score) {
      best = {
        column_name: column.column_name,
        value: matchedValue,
        score
      };
    }
  }

  return best
    ? {
        column_name: best.column_name,
        value: best.value
      }
    : null;
}

function pickBestProductFilterColumnName(
  table: DataCatalogRecord["tables"][number]
): string | null {
  const fromLowCard = table.low_cardinality_columns
    .filter((column) => isProductLikeColumnName(column.column_name))
    .sort((a, b) => scoreProductColumnName(b.column_name) - scoreProductColumnName(a.column_name));
  if (fromLowCard.length > 0) {
    return fromLowCard[0]!.column_name;
  }

  const fromColumns = table.columns
    .filter((column) => isProductLikeColumnName(column.column_name) && isTextualColumnType(column.data_type))
    .sort((a, b) => scoreProductColumnName(b.column_name) - scoreProductColumnName(a.column_name));
  if (fromColumns.length === 0) {
    return null;
  }

  return fromColumns[0]!.column_name;
}

function isProductLikeColumnName(columnName: string): boolean {
  return /(product|sku|item|category|brand|model|variant|style|collection|family|catalog)/i.test(columnName);
}

function scoreProductColumnName(columnName: string): number {
  const lower = columnName.toLowerCase();
  let score = 0;
  if (lower === "product_name") score += 8;
  if (lower === "product_id") score += 7;
  if (lower.includes("product")) score += 6;
  if (lower.includes("sku")) score += 5;
  if (lower.includes("item")) score += 4;
  if (lower.includes("category")) score += 3;
  if (lower.includes("brand")) score += 3;
  if (lower.includes("model")) score += 2;
  return score;
}

function pickMentionedDistinctValue(lower: string, values: string[]): string | null {
  let best: { value: string; score: number } | null = null;
  for (const raw of values) {
    const value = raw.trim();
    if (value.length < 2) {
      continue;
    }

    const normalized = value.toLowerCase();
    const exactWord = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "i").test(lower);
    const phraseMatch = !exactWord && normalized.includes(" ") && lower.includes(normalized);
    if (!exactWord && !phraseMatch) {
      continue;
    }

    const score = normalized.length + (exactWord ? 2 : 0);
    if (!best || score > best.score) {
      best = { value, score };
    }
  }

  return best?.value ?? null;
}

function extractProductPhrase(lower: string): string | null {
  const patterns = [
    /\b(?:for|of|about)\s+(?:product|sku|item|category|brand|model)\s+([a-z0-9][a-z0-9\s._'/-]{1,60})\b/i,
    /\b(?:for|of|about)\s+([a-z0-9][a-z0-9\s._'/-]{1,60})\s+(?:product|sku|item|category|brand|model)\b/i,
    /\b(?:product|sku|item|category|brand|model)\s*[:=]\s*([a-z0-9][a-z0-9\s._'/-]{1,60})\b/i
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (!match) {
      continue;
    }

    const cleaned = normalizeFilterPhrase(match[1] ?? "");
    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

function extractProductPhraseFromHistory(state: ChatState): string | null {
  const recentUserMessages = state.conversation_history
    .slice(-8)
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content.toLowerCase());

  for (let index = recentUserMessages.length - 1; index >= 0; index -= 1) {
    const phrase = extractProductPhrase(recentUserMessages[index]!);
    if (phrase) {
      return phrase;
    }
  }

  return null;
}

function normalizeFilterPhrase(value: string): string | null {
  const cleaned = value
    .replace(/[!?.,;:]+$/g, "")
    .replace(/\b(the|a|an|my|our)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 2 || cleaned.length > 48) {
    return null;
  }

  if (
    /\b(past|last|previous|this|current|month|months|day|days|week|weeks|year|years|total|sales|revenue|gmv)\b/i.test(
      cleaned
    )
  ) {
    return null;
  }

  return cleaned;
}

function pickJoinKeysForTables(
  baseTable: DataCatalogRecord["tables"][number],
  joinTable: DataCatalogRecord["tables"][number]
): { base_key: string; join_key: string; exact_match: boolean } | null {
  const baseColumns = baseTable.columns.map((column) => column.column_name);
  const joinColumns = joinTable.columns.map((column) => column.column_name);
  const joinColumnSet = new Set(joinColumns.map((column) => column.toLowerCase()));
  const baseColumnSet = new Set(baseColumns.map((column) => column.toLowerCase()));

  let best:
    | {
        base_key: string;
        join_key: string;
        exact_match: boolean;
        score: number;
      }
    | null = null;

  for (const baseColumn of baseColumns) {
    const baseLower = baseColumn.toLowerCase();
    if (!looksLikeIdentifierColumnName(baseLower)) {
      continue;
    }
    if (baseLower === "id") {
      continue;
    }

    if (joinColumnSet.has(baseLower)) {
      const score = 12 + (baseLower.endsWith("_id") ? 2 : 0);
      if (!best || score > best.score) {
        best = {
          base_key: baseColumn,
          join_key: joinColumns.find((column) => column.toLowerCase() === baseLower) ?? baseLower,
          exact_match: true,
          score
        };
      }
    }
  }

  const baseTableName = baseTable.qualified_name.split(".").pop()?.toLowerCase() ?? "";
  const joinTableName = joinTable.qualified_name.split(".").pop()?.toLowerCase() ?? "";
  const joinHasId = joinColumnSet.has("id");
  const baseHasId = baseColumnSet.has("id");

  for (const baseColumn of baseColumns) {
    const match = baseColumn.toLowerCase().match(/^([a-z0-9_]+)_id$/);
    if (!match || !joinHasId) {
      continue;
    }

    const stem = match[1];
    if (tableNameContainsStem(joinTableName, stem)) {
      const score = 9;
      if (!best || score > best.score) {
        best = {
          base_key: baseColumn,
          join_key: "id",
          exact_match: false,
          score
        };
      }
    }
  }

  for (const joinColumn of joinColumns) {
    const match = joinColumn.toLowerCase().match(/^([a-z0-9_]+)_id$/);
    if (!match || !baseHasId) {
      continue;
    }

    const stem = match[1];
    if (tableNameContainsStem(baseTableName, stem)) {
      const score = 8;
      if (!best || score > best.score) {
        best = {
          base_key: "id",
          join_key: joinColumn,
          exact_match: false,
          score
        };
      }
    }
  }

  return best
    ? {
        base_key: best.base_key,
        join_key: best.join_key,
        exact_match: best.exact_match
      }
    : null;
}

function tableNameContainsStem(tableName: string, stem: string): boolean {
  if (!tableName || !stem) {
    return false;
  }

  return (
    tableName.includes(stem) ||
    tableName.includes(`${stem}s`) ||
    (stem.endsWith("s") ? tableName.includes(stem.slice(0, -1)) : false)
  );
}

function looksLikeSimpleQueryIntent(lower: string, state: ChatState): boolean {
  return (
    asksForMonthCoverage(lower) ||
    asksForSalesSum(lower) ||
    looksLikeSimpleSalesWindowQuestion(lower) ||
    /\b(count|how many|average|avg|min|max)\b/.test(lower) ||
    looksLikeSalesNumericFollowUp(lower, state)
  );
}

function looksLikeAnalysisIntent(lower: string): boolean {
  if (looksLikeConciseNumericFollowUpMessage(lower)) {
    return false;
  }

  if (looksLikeComplexMultiQuestionPrompt(lower)) {
    return true;
  }

  return (
    /\b(report|analysis|analyze|insight|deep dive|root cause|driver|anomaly|recommend|strategy|executive brief|pdf|trend|compare|comparison|versus|vs|breakdown|top|support ticket|tickets|issue|issues|reason|reasons)\b/.test(lower) ||
    /\b(run data preparation|finish scoping and run analysis|prepare data|batch)\b/.test(lower)
  );
}

function looksLikeConciseNumericFollowUpMessage(lower: string): boolean {
  return (
    /\bjust the number\b/.test(lower) ||
    /\bjust number\b/.test(lower) ||
    /\bno breakdown\b/.test(lower) ||
    /\boverall total\b/.test(lower) ||
    /\bjust the total\b/.test(lower) ||
    /\bonly total\b/.test(lower)
  );
}

function looksLikeComplexMultiQuestionPrompt(lower: string): boolean {
  const signalCount = [
    /\balso\b/.test(lower),
    /\balong with\b/.test(lower),
    /\bcompare|comparison|vs|versus\b/.test(lower),
    /\btop\b/.test(lower),
    /\bsupport ticket|tickets|issue|issues|reason|reasons\b/.test(lower),
    /[?.].*\b(also|and)\b/.test(lower)
  ].filter(Boolean).length;

  if (signalCount >= 2) {
    return true;
  }

  // Long requests with multiple clauses should be treated as scoped analysis, not a simple number query.
  return lower.length > 160 && /,|\band\b/.test(lower);
}

function extractRequestedMonths(lower: string): number | null {
  if (/\b(?:past|last|previous)\s+month\b/.test(lower) || /\bthis\s+month\b/.test(lower)) {
    return 1;
  }

  const match = lower.match(/\b(?:past|last|previous)\s+(\d{1,2})\s+months?\b/);
  if (!match) {
    return null;
  }
  const months = Number.parseInt(match[1], 10);
  if (Number.isNaN(months) || months <= 0) {
    return null;
  }
  return months;
}

function extractRequestedDays(lower: string): number | null {
  if (/\b(?:past|last|previous)\s+day\b/.test(lower) || /\btoday\b/.test(lower)) {
    return 1;
  }

  const match = lower.match(/\b(?:past|last|previous)\s+(\d{1,3})\s+days?\b/);
  if (!match) {
    return null;
  }

  const days = Number.parseInt(match[1], 10);
  if (Number.isNaN(days) || days <= 0) {
    return null;
  }
  return days;
}

function extractCalendarMonthRange(
  rawMessage: string
): { from_date: string; to_exclusive_date: string; label: string } | null {
  const lower = rawMessage.toLowerCase();
  const now = new Date();
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();

  const numericMatch = lower.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  if (numericMatch) {
    const year = Number.parseInt(numericMatch[1], 10);
    const month = Number.parseInt(numericMatch[2], 10);
    if (!Number.isNaN(year) && !Number.isNaN(month)) {
      return buildCalendarMonthRange(year, month - 1);
    }
  }

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ] as const;
  const monthAliases: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11
  };

  const monthRegex =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s+(20\d{2}))?/i;
  const monthMatch = lower.match(monthRegex);
  if (!monthMatch) {
    return null;
  }

  const monthToken = monthMatch[1]?.toLowerCase() ?? "";
  const monthIndex = monthAliases[monthToken];
  if (monthIndex === undefined) {
    return null;
  }

  const explicitYear = monthMatch[2] ? Number.parseInt(monthMatch[2], 10) : null;
  const inferredYear =
    explicitYear ??
    (monthIndex > nowMonth
      ? nowYear - 1
      : nowYear);
  if (!Number.isFinite(inferredYear)) {
    return null;
  }

  const range = buildCalendarMonthRange(inferredYear, monthIndex);
  if (!range) {
    return null;
  }

  const canonicalMonthLabel = `${monthNames[monthIndex][0]!.toUpperCase()}${monthNames[monthIndex].slice(1)} ${inferredYear}`;
  return {
    ...range,
    label: canonicalMonthLabel
  };
}

function buildCalendarMonthRange(
  year: number,
  monthIndex: number
): { from_date: string; to_exclusive_date: string; label: string } | null {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  const from = new Date(Date.UTC(year, monthIndex, 1));
  const toExclusive = new Date(Date.UTC(year, monthIndex + 1, 1));
  const label = from.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });

  return {
    from_date: from.toISOString().slice(0, 10),
    to_exclusive_date: toExclusive.toISOString().slice(0, 10),
    label
  };
}

function extractRequestedWindowFromHistory(
  state: ChatState
): { unit: "months" | "days"; value: number } | null {
  const recentUserMessages = state.conversation_history
    .slice(-8)
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content.toLowerCase());

  for (let index = recentUserMessages.length - 1; index >= 0; index -= 1) {
    const message = recentUserMessages[index]!;
    const months = extractRequestedMonths(message);
    if (months !== null) {
      return { unit: "months", value: months };
    }

    const days = extractRequestedDays(message);
    if (days !== null) {
      return { unit: "days", value: days };
    }
  }

  return null;
}

function looksLikeSimpleSalesWindowQuestion(lower: string): boolean {
  const hasSalesTerm = /\b(sales|revenue|gmv|income|turnover)\b/.test(lower);
  if (!hasSalesTerm) {
    return false;
  }

  return (
    /\bin\s+the\s+past\s+\d+\s+days?\b/.test(lower) ||
    /\bpast\s+\d+\s+days?\b/.test(lower) ||
    /\bfor\s+the\s+last\s+\d+\s+days?\b/.test(lower) ||
    /\bpast\s+\d+\s+months?\b/.test(lower) ||
    /\bpast\s+month\b/.test(lower) ||
    /\blast\s+month\b/.test(lower) ||
    /\bsales\b.*\b(in|for|at)\b\s+[a-z][a-z\s.'-]{1,40}\b/.test(lower) ||
    /\bin\s+[a-z][a-z\s.'-]{1,40}\b/.test(lower)
  );
}

function looksLikeSalesNumericFollowUp(lower: string, state: ChatState): boolean {
  if (looksLikeAnalysisIntent(lower) || looksLikeComplexMultiQuestionPrompt(lower)) {
    return false;
  }

  if (lower.length > 140) {
    return false;
  }

  const hasFollowUpSignal =
    /\bjust the number\b/.test(lower) ||
    /\bjust number\b/.test(lower) ||
    /\bno breakdown\b/.test(lower) ||
    /\boverall total\b/.test(lower) ||
    /\bjust the total\b/.test(lower) ||
    /\bonly total\b/.test(lower) ||
    /\b(entire|full|whole|calendar)\s+month\b/.test(lower) ||
    /\bnot\s+just\s+\d+\s+days?\b/.test(lower) ||
    /\b(delivered|paid|refunded|cancelled|canceled|completed|pending|failed)\b/.test(lower);

  if (!hasFollowUpSignal) {
    return false;
  }

  const recent = state.conversation_history
    .slice(-8)
    .map((turn) => turn.content.toLowerCase())
    .join(" ");

  return /\b(sales|revenue|gmv|amount|income|turnover|value)\b/.test(recent);
}

function collectRequestedStatuses(lower: string, state: ChatState): string[] {
  const normalizedCurrent = normalizeStatusTokensFromText(lower);
  if (normalizedCurrent.length > 0) {
    return normalizedCurrent;
  }

  if (!looksLikeSalesNumericFollowUp(lower, state)) {
    return [];
  }

  const recentUserText = state.conversation_history
    .slice(-8)
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content.toLowerCase())
    .join(" ");

  return normalizeStatusTokensFromText(recentUserText);
}

function pickCityFilter(
  lower: string,
  table: DataCatalogRecord["tables"][number],
  state: ChatState
): { column_name: string; value: string } | null {
  const directMatch = pickBestLowCardinalityMentionFilter(lower, table);
  if (directMatch) {
    return directMatch;
  }

  const cityLike = table.low_cardinality_columns.filter((entry) =>
    /\b(city|town|location|region|market)\b/i.test(entry.column_name)
  );

  let bestMatch: { column_name: string; value: string; score: number } | null = null;
  for (const column of cityLike) {
    for (const rawValue of column.distinct_values) {
      const value = rawValue.trim();
      if (value.length < 2) {
        continue;
      }
      const escaped = escapeRegExp(value.toLowerCase());
      const pattern = new RegExp(`\\b${escaped}\\b`, "i");
      if (!pattern.test(lower)) {
        continue;
      }
      const score = value.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { column_name: column.column_name, value, score };
      }
    }
  }

  if (bestMatch) {
    return { column_name: bestMatch.column_name, value: bestMatch.value };
  }

  const cityColumn = pickBestCityColumn(table) ?? pickBestTextualDimensionColumn(table);
  if (!cityColumn) {
    return null;
  }

  const phrase = extractCityPhrase(lower) ?? extractCityPhraseFromHistory(state);
  if (!phrase) {
    return null;
  }

  return {
    column_name: cityColumn.column_name,
    value: phrase
  };
}

function pickBestLowCardinalityMentionFilter(
  lower: string,
  table: DataCatalogRecord["tables"][number]
): { column_name: string; value: string } | null {
  let best: { column_name: string; value: string; score: number } | null = null;

  for (const column of table.low_cardinality_columns) {
    const columnName = column.column_name.toLowerCase();
    const columnBonus = /(city|town|location|region|market|country|state)/.test(columnName) ? 4 : 0;
    for (const rawValue of column.distinct_values) {
      const value = rawValue.trim();
      if (value.length < 2) {
        continue;
      }

      const normalizedValue = value.toLowerCase();
      const exactWordMatch = new RegExp(`\\b${escapeRegExp(normalizedValue)}\\b`, "i").test(lower);
      const phraseMatch = !exactWordMatch && normalizedValue.includes(" ") && lower.includes(normalizedValue);
      if (!exactWordMatch && !phraseMatch) {
        continue;
      }

      const score = value.length + columnBonus + (exactWordMatch ? 2 : 0);
      if (!best || score > best.score) {
        best = { column_name: column.column_name, value, score };
      }
    }
  }

  if (!best) {
    return null;
  }

  return { column_name: best.column_name, value: best.value };
}

function pickBestCityColumn(
  table: DataCatalogRecord["tables"][number]
): DataCatalogRecord["tables"][number]["columns"][number] | null {
  const candidates = table.columns.filter((column) => {
    const lower = column.column_name.toLowerCase();
    return /(city|town|location|region|market)/.test(lower) && isTextualColumnType(column.data_type);
  });

  if (candidates.length === 0) {
    return null;
  }

  let best = candidates[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const lower = candidate.column_name.toLowerCase();
    let score = 0;
    if (lower === "city") score += 6;
    if (lower.includes("city_name")) score += 5;
    if (lower.includes("location")) score += 4;
    if (lower.includes("region")) score += 3;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function pickBestTextualDimensionColumn(
  table: DataCatalogRecord["tables"][number]
): DataCatalogRecord["tables"][number]["columns"][number] | null {
  const candidates = table.columns.filter((column) => isTextualColumnType(column.data_type));
  if (candidates.length === 0) {
    return null;
  }

  let best = candidates[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const lower = candidate.column_name.toLowerCase();
    let score = 0;
    if (/(city|town|location|region|market|country|state)/.test(lower)) score += 4;
    if (/(name|label|type|category|segment)/.test(lower)) score += 2;
    if (/(description|notes|comment)/.test(lower)) score -= 2;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function extractCityPhrase(lower: string): string | null {
  const match =
    lower.match(/\b(?:in|for|at)\s+([a-z][a-z\s.'-]{1,40})$/i) ??
    lower.match(/\b(?:in|for|at)\s+([a-z][a-z\s.'-]{1,40})\b/i);
  if (!match) {
    return null;
  }

  const candidate = match[1]
    .replace(/\b(past|last|previous|month|months|day|days|week|weeks|year|years|quarter|quarters|this|current|the|a|an|my|all|total)\b/gi, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (candidate.length < 2) {
    return null;
  }

  if (
    /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/i.test(
      candidate
    ) ||
    /\b\d{4}\b/.test(candidate)
  ) {
    return null;
  }

  return candidate;
}

function extractCityPhraseFromHistory(state: ChatState): string | null {
  const recentUserMessages = state.conversation_history
    .slice(-8)
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content.toLowerCase());

  for (let index = recentUserMessages.length - 1; index >= 0; index -= 1) {
    const city = extractCityPhrase(recentUserMessages[index]!);
    if (city) {
      return city;
    }
  }

  return null;
}

function normalizeStatusTokensFromText(text: string): string[] {
  const candidates = [
    "delivered",
    "paid",
    "refunded",
    "cancelled",
    "canceled",
    "completed",
    "pending",
    "failed",
    "shipped",
    "processing"
  ];

  const selected = candidates.filter((candidate) =>
    new RegExp(`\\b${candidate}\\b`, "i").test(text)
  );

  return Array.from(
    new Set(
      selected.map((value) => (value === "canceled" ? "cancelled" : value))
    )
  );
}

function pickBestStatusColumnForFilter(
  table: DataCatalogRecord["tables"][number]
): DataCatalogRecord["tables"][number]["columns"][number] | null {
  const candidates = table.columns.filter((column) => {
    const lower = column.column_name.toLowerCase();
    if (!/(status|state)/.test(lower)) {
      return false;
    }
    return isTextualColumnType(column.data_type);
  });

  if (candidates.length === 0) {
    return null;
  }

  let best = candidates[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const lower = candidate.column_name.toLowerCase();
    let score = 0;
    if (lower === "status") score += 5;
    if (lower.includes("order_status")) score += 4;
    if (lower.includes("payment_status")) score += 4;
    if (lower.includes("delivery_status")) score += 3;
    if (lower.includes("state")) score += 1;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function isTextualColumnType(dataType: string): boolean {
  return /\b(char|text|varchar|citext|enum|name)\b/i.test(dataType);
}

function normalizeMonthWindow(months: number): number {
  return Math.max(1, Math.min(months, 24));
}

function normalizeDayWindow(days: number): number {
  return Math.max(1, Math.min(days, 365));
}

function tokenizeForScoring(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !/^\d+$/.test(token));
}

function buildQuestionTokens(lowerQuestion: string): Set<string> {
  const tokens = new Set(tokenizeForScoring(lowerQuestion));

  const hasRevenueIntent = ["sales", "revenue", "gmv", "income", "turnover"].some((token) =>
    tokens.has(token)
  );
  if (hasRevenueIntent) {
    [
      "sales",
      "revenue",
      "gmv",
      "amount",
      "value",
      "price",
      "net",
      "gross",
      "income",
      "turnover",
      "total"
    ].forEach((token) => tokens.add(token));
  }

  if (tokens.has("refund") || tokens.has("refunded")) {
    ["refund", "returned", "return", "chargeback"].forEach((token) => tokens.add(token));
  }

  return tokens;
}

function overlapTokenScore(tokens: Iterable<string>, queryTokens: Set<string>): number {
  let score = 0;
  for (const token of tokens) {
    if (queryTokens.has(token)) {
      score += 1;
    }
  }
  return score;
}

function looksLikeIdentifierColumnName(columnName: string): boolean {
  const lower = columnName.toLowerCase();
  return (
    /(^|_)(id|uuid|guid)(_|$)/.test(lower) ||
    /(identifier|primary_key|foreign_key)$/.test(lower)
  );
}

function pickBestMetricColumnForSum(
  lowerQuestion: string,
  table: DataCatalogRecord["tables"][number]
): DataCatalogRecord["tables"][number]["columns"][number] | null {
  const numericColumns = table.columns.filter((column) => isNumericColumnType(column.data_type));
  if (numericColumns.length === 0) {
    return null;
  }

  let best = numericColumns[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  const queryTokens = buildQuestionTokens(lowerQuestion);

  for (const column of numericColumns) {
    const name = column.column_name.toLowerCase();
    const nameTokens = tokenizeForScoring(name);
    let score = 0;

    score += overlapTokenScore(nameTokens, queryTokens) * 3;

    if (/(amount|revenue|sales|gmv|total|value|price|net)/.test(name)) {
      score += 6;
    }
    if (/(count|qty|quantity|units)/.test(name)) {
      score += 2;
    }
    if (/\brefund\b/.test(lowerQuestion) && /\brefund\b/.test(name)) {
      score += 2;
    }
    if (/\b(sales|revenue|gmv)\b/.test(lowerQuestion) && /\b(sales|revenue|gmv)\b/.test(name)) {
      score += 3;
    }
    if (looksLikeIdentifierColumnName(name)) {
      score -= 8;
    }
    if (/(tax|discount|fee|shipping)/.test(name) && /\b(net|gross|sales|revenue|gmv|amount|total)\b/.test(lowerQuestion)) {
      score -= 2;
    }
    if (score > bestScore) {
      best = column;
      bestScore = score;
    }
  }

  return best;
}

function isNumericColumnType(dataType: string): boolean {
  return /\b(int|integer|bigint|smallint|numeric|decimal|real|double|float|money)\b/i.test(dataType);
}

function pickBestTemporalTableForQuestion(
  lowerQuestion: string,
  tables: DataCatalogRecord["tables"]
): { table: DataCatalogRecord["tables"][number]; date_column: DataCatalogRecord["tables"][number]["columns"][number] } | null {
  const queryTokens = buildQuestionTokens(lowerQuestion);

  let best:
    | {
        table: DataCatalogRecord["tables"][number];
        date_column: DataCatalogRecord["tables"][number]["columns"][number];
        score: number;
      }
    | null = null;

  for (const table of tables) {
    const selectedColumn = pickBestDateColumnForQuestion(lowerQuestion, table, queryTokens);
    if (!selectedColumn) {
      continue;
    }

    const tableTokens = tokenizeForScoring(
      `${table.qualified_name} ${table.summary} ${table.columns.map((column) => column.column_name).join(" ")}`
    );
    let tableScore = 0;
    tableScore += overlapTokenScore(tableTokens, queryTokens) * 2;

    if (table.relation_type === "VIEW") {
      tableScore += 1;
    }
    if (table.row_count_estimate > 0) {
      tableScore += 1;
    }

    const columnScore = scoreDateColumn(selectedColumn, queryTokens);

    const totalScore = tableScore + columnScore;
    if (!best || totalScore > best.score) {
      best = {
        table,
        date_column: selectedColumn,
        score: totalScore
      };
    }
  }

  return best
    ? { table: best.table, date_column: best.date_column }
    : null;
}

function pickBestAggregateTargetForQuestion(
  lowerQuestion: string,
  tables: DataCatalogRecord["tables"]
): { table: DataCatalogRecord["tables"][number]; date_column: DataCatalogRecord["tables"][number]["columns"][number] | null } | null {
  const queryTokens = buildQuestionTokens(lowerQuestion);

  let best:
    | {
        table: DataCatalogRecord["tables"][number];
        date_column: DataCatalogRecord["tables"][number]["columns"][number] | null;
        score: number;
      }
    | null = null;

  for (const table of tables) {
    const numericColumns = table.columns.filter((column) => isNumericColumnType(column.data_type));
    if (numericColumns.length === 0) {
      continue;
    }

    const tableTokens = tokenizeForScoring(
      `${table.qualified_name} ${table.summary} ${table.columns.map((column) => column.column_name).join(" ")}`
    );
    const dateColumn = pickBestDateColumnForQuestion(lowerQuestion, table, queryTokens);
    const metricColumn = pickBestMetricColumnForSum(lowerQuestion, table);
    const metricScore = metricColumn
      ? overlapTokenScore(tokenizeForScoring(metricColumn.column_name), queryTokens) * 3 +
        (/(amount|revenue|sales|gmv|total|value|price|net)/.test(metricColumn.column_name.toLowerCase()) ? 3 : 0)
      : 0;

    let score = 0;
    score += overlapTokenScore(tableTokens, queryTokens) * 2;
    score += metricScore;
    if (dateColumn) score += 3;
    if (table.row_count_estimate > 0) score += 1;
    if (table.relation_type === "VIEW") score += 1;

    if (!best || score > best.score) {
      best = {
        table,
        date_column: dateColumn,
        score
      };
    }
  }

  return best
    ? { table: best.table, date_column: best.date_column }
    : null;
}

function pickBestDateColumnForQuestion(
  lowerQuestion: string,
  table: DataCatalogRecord["tables"][number],
  queryTokens: Set<string>
): DataCatalogRecord["tables"][number]["columns"][number] | null {
  const dateColumns = table.columns.filter((column) =>
    isTemporalColumnType(column.data_type) || isDateLikeColumnName(column.column_name)
  );
  if (dateColumns.length === 0) {
    return null;
  }

  let best = dateColumns[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const column of dateColumns) {
    let score = scoreDateColumn(column, queryTokens);
    const name = column.column_name.toLowerCase();
    if (/\b(refund|return)\b/.test(lowerQuestion) && /\b(refund|return)\b/.test(name)) score += 2;
    if (/\b(order|sale|transaction)\b/.test(lowerQuestion) && /\b(order|sale|transaction)\b/.test(name)) score += 2;
    if (score > bestScore) {
      best = column;
      bestScore = score;
    }
  }

  return best;
}

function scoreDateColumn(
  column: DataCatalogRecord["tables"][number]["columns"][number],
  queryTokens: Set<string>
): number {
  const name = column.column_name.toLowerCase();
  const nameTokens = tokenizeForScoring(name);
  let score = 0;
  score += overlapTokenScore(nameTokens, queryTokens);
  if (/order_date|event_time|created_at|transaction_date|date|time|timestamp/.test(name)) {
    score += 3;
  }
  if (isTemporalColumnType(column.data_type)) {
    score += 2;
  }
  return score;
}

function isTemporalColumnType(dataType: string): boolean {
  return /\b(date|time|timestamp)\b/i.test(dataType);
}

function isDateLikeColumnName(columnName: string): boolean {
  return /(date|time|timestamp|created|updated|event|period)/i.test(columnName);
}

function quoteSqlIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function quoteSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteQualifiedRelation(qualifiedName: string): string {
  return qualifiedName
    .split(".")
    .map((part) => quoteSqlIdentifier(part))
    .join(".");
}

function extractSqlFence(raw: string): string | null {
  const match = raw.match(/```(?:sql)?\s*\n?([\s\S]*?)```/i);
  if (!match) {
    return null;
  }

  const candidate = match[1].trim();
  if (
    (/^\s*select\b/i.test(candidate) && /\bfrom\b/i.test(candidate)) ||
    (/^\s*with\b/i.test(candidate) && /\bselect\b/i.test(candidate))
  ) {
    return candidate;
  }

  return null;
}

function applySetCommand(state: ChatState, field: string, value: string): { state: ChatState; updated: boolean } {
  const next = parseChatState(state);

  switch (field) {
    case "name":
      next.draft.name = value;
      resetPreparedState(next);
      return { state: next, updated: true };
    case "audience":
      next.draft.audience = value;
      resetPreparedState(next);
      return { state: next, updated: true };
    case "timezone":
      next.draft.timezone = value;
      resetPreparedState(next);
      return { state: next, updated: true };
    case "schedule":
    case "schedule_cron":
      next.draft.schedule_cron = value.toLowerCase() === "none" ? null : value;
      resetPreparedState(next);
      return { state: next, updated: true };
    case "sql":
    case "sql_template":
      next.draft.sql_template = value;
      resetPreparedState(next);
      return { state: next, updated: true };
    case "metrics":
    case "metric_ids":
      next.draft.metric_ids = parseCsv(value);
      resetPreparedState(next);
      return { state: next, updated: true };
    case "dimensions":
    case "dimension_ids":
      next.draft.dimension_ids = parseCsv(value);
      resetPreparedState(next);
      return { state: next, updated: true };
    case "relations":
    case "allowed_relations":
      next.draft.allowed_relations = parseCsv(value);
      resetPreparedState(next);
      return { state: next, updated: true };
    case "schemas":
    case "allowed_schemas":
      next.draft.allowed_schemas = parseCsv(value);
      resetPreparedState(next);
      return { state: next, updated: true };
    case "insight_mode":
    case "mode":
      if (value === "data" || value === "business") {
        next.draft.insight_mode = value;
        resetPreparedState(next);
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

function resetPreparedState(state: ChatState): void {
  state.contract_id = null;
  state.prep_pending = false;
  state.prep_complete = false;
  state.scope_pending = false;
  state.preparation_summary = null;
  state.prepared_payloads = [];
  state.awaiting_pdf_confirmation = false;
  state.awaiting_save_confirmation = false;
  state.awaiting_schedule_confirmation = false;
  state.awaiting_schedule_mode_selection = false;
  state.schedule_mode_pending = null;
  state.schedule_day_kind = null;
  state.awaiting_custom_day_input = false;
}

function inferSimpleIntent(message: string, state: ChatState): ChatTurnResponse | null {
  const lowered = message.toLowerCase();
  const nextState = parseChatState(state);
  const changes: string[] = [];

  if (lowered.startsWith("create ") || lowered.startsWith("new report")) {
    const guessedName = message.replace(/^(create|new report)\s*/i, "").trim();
    if (guessedName.length > 0) {
      nextState.draft.name = guessedName;
      resetPreparedState(nextState);
      changes.push(`name to "${guessedName}"`);
    }
  }

  if (changes.length === 0 && looksLikeReportTitle(lowered)) {
    nextState.draft.name = message.trim();
    resetPreparedState(nextState);
    changes.push(`name to "${message.trim()}"`);
  }

  const audience = extractAudience(lowered);
  if (audience && nextState.draft.audience !== audience) {
    nextState.draft.audience = audience;
    resetPreparedState(nextState);
    changes.push(`audience to ${audience}`);
  }

  if (lowered.includes("by region") && !nextState.draft.dimension_ids.includes("region")) {
    nextState.draft.dimension_ids = Array.from(new Set([...nextState.draft.dimension_ids, "region"]));
    resetPreparedState(nextState);
    changes.push("added region dimension");
  }
  if (lowered.includes("by channel") && !nextState.draft.dimension_ids.includes("channel")) {
    nextState.draft.dimension_ids = Array.from(new Set([...nextState.draft.dimension_ids, "channel"]));
    resetPreparedState(nextState);
    changes.push("added channel dimension");
  }

  if (lowered.includes("weekly") && nextState.draft.schedule_cron !== "0 18 * * 5") {
    nextState.draft.schedule_cron = "0 18 * * 5";
    resetPreparedState(nextState);
    changes.push("schedule to weekly (Fridays at 18:00)");
  } else if (lowered.includes("daily") && nextState.draft.schedule_cron !== "0 9 * * *") {
    nextState.draft.schedule_cron = "0 9 * * *";
    resetPreparedState(nextState);
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

function looksLikePayloadQaQuestion(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  if (trimmed.length < 4) {
    return false;
  }
  if (parseSetCommand(message) || parseQueryCommand(message)) {
    return false;
  }
  if (detectConversationalAction(trimmed)) {
    return false;
  }
  if (asksForPdf(trimmed) || asksToUseConnectedTables(trimmed)) {
    return false;
  }
  return trimmed.includes("?") || /\b(why|what|which|show|explain|compare|trend|change)\b/.test(trimmed);
}

function detectInsightMode(command: string): "business" | "data" | null {
  if (/\bdata\s*(insights?|quality|mode|analysis)\b/.test(command)) return "data";
  if (/\bbusiness\s*(insights?|mode|analysis)\b/.test(command)) return "business";
  if (/\binsight\s*mode\s*[:=]?\s*data\b/.test(command)) return "data";
  if (/\binsight\s*mode\s*[:=]?\s*business\b/.test(command)) return "business";
  return null;
}

function detectConversationalAction(command: string): "run" | "save" | "list" | null {
  // Only match explicit execution intent.
  if (/^(run|run it|run it now|run now|run the report|run report|execute now|execute it|execute the report|start the analysis|launch report|let'?s run it|let'?s run)\s*[.!]?$/.test(command)) {
    return "run";
  }

  // Also support approval-style confirmations so users do not need to type "run".
  if (
    /^(go ahead|proceed|looks good|lgtm|approved|ready|ready to proceed|ready to run|continue with analysis|continue with run)\s*[.!]?$/.test(command)
  ) {
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
      resetPreparedState(next);
      updated.add("name");
    }
  }

  const audienceMatch = extractAudience(lower);
  if (audienceMatch && next.draft.audience !== audienceMatch) {
    next.draft.audience = audienceMatch;
    resetPreparedState(next);
    updated.add("audience");
  }

  const timezoneMatch = message.match(/\btimezone(?:\s*(?:to|as|is))?\s*([A-Za-z_/+-]+)/i);
  if (timezoneMatch) {
    const timezone = timezoneMatch[1].trim();
    if (timezone.length > 0) {
      next.draft.timezone = timezone;
      resetPreparedState(next);
      updated.add("timezone");
    }
  }

  if (lower.includes("weekly") || lower.includes("every friday")) {
    if (next.draft.schedule_cron !== "0 18 * * 5") {
      next.draft.schedule_cron = "0 18 * * 5";
      resetPreparedState(next);
      updated.add("schedule_cron");
    }
  } else if (lower.includes("daily")) {
    if (next.draft.schedule_cron !== "0 9 * * *") {
      next.draft.schedule_cron = "0 9 * * *";
      resetPreparedState(next);
      updated.add("schedule_cron");
    }
  } else if (lower.includes("monthly")) {
    if (next.draft.schedule_cron !== "0 9 1 * *") {
      next.draft.schedule_cron = "0 9 1 * *";
      resetPreparedState(next);
      updated.add("schedule_cron");
    }
  }

  if (lower.includes("by region") && !next.draft.dimension_ids.includes("region")) {
    next.draft.dimension_ids = Array.from(new Set([...next.draft.dimension_ids, "region"]));
    resetPreparedState(next);
    updated.add("dimension_ids");
  }

  if (lower.includes("by channel") && !next.draft.dimension_ids.includes("channel")) {
    next.draft.dimension_ids = Array.from(new Set([...next.draft.dimension_ids, "channel"]));
    resetPreparedState(next);
    updated.add("dimension_ids");
  }

  if (lower.includes("revenue") && !next.draft.metric_ids.includes("metric_revenue")) {
    next.draft.metric_ids = Array.from(new Set([...next.draft.metric_ids, "metric_revenue"]));
    resetPreparedState(next);
    updated.add("metric_ids");
  }

  if (lower.includes("orders") && !next.draft.metric_ids.includes("metric_orders")) {
    next.draft.metric_ids = Array.from(new Set([...next.draft.metric_ids, "metric_orders"]));
    resetPreparedState(next);
    updated.add("metric_ids");
  }

  if (lower.includes("sales_enriched")) {
    next.draft.allowed_relations = Array.from(new Set([...next.draft.allowed_relations, "analytics.sales_enriched"]));
    next.draft.allowed_schemas = Array.from(new Set([...next.draft.allowed_schemas, "analytics"]));
    resetPreparedState(next);
    updated.add("allowed_relations");
  }

  if (
    lower.includes("revenue by region") &&
    next.draft.sql_template.trim().toLowerCase() === "select * from analytics.sales"
  ) {
    next.draft.sql_template =
      "SELECT region, SUM(amount) AS amount, MIN(event_time) AS event_time FROM analytics.sales GROUP BY region";
    resetPreparedState(next);
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

  resetPreparedState(nextState);

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
    if (catalog.business_id) {
      lines.push(`BUSINESS_ID: ${catalog.business_id}`);
      lines.push("");
    }

    for (const table of catalog.tables.slice(0, 20)) {
      const cols = table.columns.slice(0, 12).map((c) => `${c.column_name}(${c.data_type})`).join(", ");
      const extra = table.columns.length > 12 ? ` +${table.columns.length - 12} more` : "";
      const rowInfo = table.row_count_estimate > 0 ? ` ~${formatNumber(table.row_count_estimate)} rows` : "";
      const tableId = table.table_id ? ` | ${table.table_id}` : "";
      lines.push(`${table.qualified_name} [${table.relation_type}]${rowInfo}${tableId}: ${cols}${extra}`);
      if (table.summary && table.summary.length > 0) {
        lines.push(`  summary: ${table.summary}`);
      }
      if (table.low_cardinality_columns.length > 0) {
        const lowCard = table.low_cardinality_columns
          .slice(0, 4)
          .map((entry) => `${entry.column_name}=[${entry.distinct_values.slice(0, 6).join(", ")}]`)
          .join("; ");
        lines.push(`  low_cardinality: ${lowCard}`);
      }
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


