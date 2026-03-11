import { randomUUID } from "node:crypto";
import {
  BusinessCaseCandidateSchema,
  BusinessCaseOutputSchema,
  ConversationOrchestratorDecisionSchema,
  ExecBriefSchema,
  ReportClarificationOutputSchema,
  ReportContractSchema,
  type ConversationOrchestratorDecision
} from "@project-overload/shared";
import { z } from "zod";
import type {
  QueryRouterClient,
  QueryRoutingDecision,
  SqlDialect
} from "./query-router";

function parseTimeoutMsFromEnv(value: string | undefined, fallbackMs: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return parsed;
}

function clampTimeoutMs(value: number, minMs: number, maxMs: number): number {
  if (!Number.isFinite(value)) {
    return minMs;
  }
  return Math.max(minMs, Math.min(maxMs, Math.trunc(value)));
}

const DEFAULT_TIMEOUT_MS = clampTimeoutMs(parseTimeoutMsFromEnv(
  process.env.DEFAULT_QUERY_TIMEOUT_MS ?? process.env.LLM_TIMEOUT_MS,
  900_000
), 5_000, 3_600_000);
const DEFAULT_WEB_API_TIMEOUT_MS = clampTimeoutMs(parseTimeoutMsFromEnv(
  process.env.WEB_API_TIMEOUT_MS ?? process.env.LLM_TIMEOUT_MS,
  900_000
), 5_000, 3_600_000);
const PREPARE_TIMEOUT_MS = clampTimeoutMs(parseTimeoutMsFromEnv(
  process.env.WEB_PREPARE_TIMEOUT_MS ?? process.env.WEB_API_TIMEOUT_MS,
  900_000
), 10_000, 3_600_000);
const PDF_TIMEOUT_MS = clampTimeoutMs(parseTimeoutMsFromEnv(
  process.env.WEB_PDF_TIMEOUT_MS ?? process.env.WEB_API_TIMEOUT_MS,
  900_000
), 10_000, 3_600_000);

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

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

const ChatMetricDefinitionSchema = z.object({
  metric_key: z.string().min(1),
  display_name: z.string().min(1),
  definition: z.string().min(1)
});

const ChatPendingInputSchema = z.object({
  input_key: z.string().min(1),
  prompt: z.string().min(1),
  reason: z.string().optional(),
  question_number: z.number().int().min(1).optional()
});

const ChatScopeSuggestionSchema = z.object({
  suggestion_number: z.number().int().min(1),
  question: z.string().min(1),
  reason: z.string().min(1)
});

const ChatQuestionRegistrySchema = z.object({
  question_number: z.number().int().min(1),
  question_id: z.string().nullable().default(null),
  question_text: z.string().min(1),
  status: z.enum(["open", "scoped", "prepared", "analyzed", "complete"]).default("open"),
  group_id: z.string().nullable().default(null),
  clarification_needed: z.string().nullable().default(null),
  clarification_answer: z.string().nullable().default(null),
  scope_clarified: z.boolean().default(false)
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
  scope_finalized: z.boolean().default(false),
  metric_definitions: z.array(ChatMetricDefinitionSchema).default([]),
  pending_metric_confirmations: z.array(ChatMetricDefinitionSchema).default([]),
  pending_metric_resume_message: z.string().nullable().default(null),
  pending_metric_resume_mode: z.enum(["single_query", "deep_analysis"]).nullable().default(null),
  scope_clarification_pending: z.boolean().default(false),
  scope_business_context: z.string().nullable().default(null),
  scope_source_prompt: z.string().nullable().default(null),
  scope_suggestions: z.array(ChatScopeSuggestionSchema).default([]),
  scope_questions: z
    .array(
      z.object({
        question_number: z.number().int().min(1),
        question: z.string().min(1),
        clarification: z.string().min(1),
        answer: z.string().nullable().default(null),
        metric_key: z.string().nullable().default(null),
        metric_display_name: z.string().nullable().default(null),
        metric_definition_draft: z.string().nullable().default(null),
        metric_source_columns: z.array(z.string().min(1)).default([])
      })
    )
    .default([]),
  pending_query_sql: z.string().nullable().default(null),
  pending_query_limit: z.number().int().positive().nullable().default(null),
  pending_single_query_request: z.string().nullable().default(null),
  pending_followup_asks: z.array(z.string().min(1)).max(5).default([]),
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
  single_query_log: z
    .array(
      z.object({
        query_id: z.string().min(1),
        question: z.string().min(1),
        governed_sql: z.string().min(1),
        row_count: z.number().int().min(0),
        elapsed_ms: z.number().int().min(0),
        created_at: z.string().datetime(),
        sample_rows: z.array(z.record(z.string(), z.unknown())).max(10).default([])
      })
    )
    .max(20)
    .default([]),
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
      preparation_sqls: z.array(z.string()).default([]),
      sample_rows: z.array(z.record(z.string(), z.unknown())).max(5).default([]),
      preparation_notes: z.array(z.string()).default([]),
      warnings: z.array(z.string()).default([])
    })
  ).default([]),
  post_run_actions_pending: z.boolean().default(false),
  report_clarification_active: z.boolean().default(false),
  business_case_active: z.boolean().default(false),
  business_case_candidates: z.array(BusinessCaseCandidateSchema).default([]),
  business_case_selected_candidate_id: z.string().nullable().default(null),
  business_case_assumption_notes: z.array(z.string().min(1)).max(8).default([]),
  business_case_pending_clarification: z.string().nullable().default(null),
  awaiting_pdf_confirmation: z.boolean().default(false),
  awaiting_post_run_refinement: z.boolean().default(false),
  refinement_active: z.boolean().default(false),
  refinement_questions_remaining: z.number().int().min(0).max(2).default(0),
  awaiting_save_confirmation: z.boolean().default(false),
  awaiting_schedule_confirmation: z.boolean().default(false),
  awaiting_schedule_mode_selection: z.boolean().default(false),
  schedule_mode_pending: z.enum(["weekly", "monthly", "quarterly"]).nullable().default(null),
  schedule_day_kind: z.enum(["weekday", "monthday"]).nullable().default(null),
  awaiting_custom_day_input: z.boolean().default(false),
  schedule_pending: z.boolean().default(false),
  pending_schedule: z
    .object({
      frequency: z.enum(["weekly", "monthly", "quarterly"]),
      day_of_week: z.number().int().min(0).max(6).optional(),
      day_of_month: z.number().int().min(1).max(28).optional(),
      hour_utc: z.number().int().min(0).max(23).default(9),
      minute_utc: z.number().int().min(0).max(59).default(0),
      timezone: z.string().default("UTC"),
      kpi_watchlist: z
        .array(
          z.object({
            metric_key: z.string(),
            display_name: z.string(),
            threshold_value: z.number(),
            direction: z.enum(["above", "below"]),
            alert_message: z.string()
          })
        )
        .default([])
    })
    .nullable()
    .default(null),
  last_concise_summary: z.string().nullable().default(null),
  pending_run_id: z.string().nullable().default(null),
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
    .default(null),
  orchestrator_context_version: z.number().int().min(1).default(1),
  orchestrator_summary: z.string().nullable().default(null),
  last_orchestrator_decision: ConversationOrchestratorDecisionSchema.nullable().default(null),
  pending_inputs: z.array(ChatPendingInputSchema).default([]),
  question_registry: z.array(ChatQuestionRegistrySchema).default([])
});

export const ChatTurnRequestSchema = z.object({
  message: z.string().trim().min(1),
  chat_session_id: z.string().trim().max(128).optional().nullable(),
  state: z.unknown().optional()
});

export type ChatDraft = z.infer<typeof ChatDraftSchema>;
export type ChatHistoryTurn = z.infer<typeof ChatHistoryTurnSchema>;
export type ChatState = z.infer<typeof ChatStateSchema>;
type ChatMetricDefinition = z.infer<typeof ChatMetricDefinitionSchema>;

export type ChatTurnResponse = {
  assistant_message: string;
  state: ChatState;
  pdf_download_url?: string;
  exec_brief_html?: string;
  prepared_payloads?: PreparedPayloadRecord[];
};

type ReportContractRecord = z.output<typeof ReportContractSchema>;
type ConnectionContextRecord = z.output<typeof ConnectionContextSchema>;
type SafeQueryResponseRecord = z.output<typeof SafeQueryResponseSchema>;

export type CreateWebApiClientOptions = {
  base_url: string;
  fetch_impl?: typeof fetch;
  header_provider?: () => Record<string, string>;
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
  submitRun(contractId: string): Promise<{ run_id: string; status: string }>;
  getRunStatus(runId: string): Promise<z.output<typeof RunStatusResponseSchema>>;
  downloadRunPdf(runId: string): Promise<Response>;
  downloadRunHtml(runId: string): Promise<Response>;
  askRunQuestion(runId: string, question: string): Promise<{
    answer: string;
    citations: string[];
    grounded: boolean;
    requires_new_analysis: boolean;
  }>;
  askReportClarification(runId: string, question: string): Promise<z.output<typeof ReportClarificationOutputSchema>>;
  listBusinessCaseCandidates(runId: string): Promise<z.output<typeof BusinessCaseCandidateSchema>[]>;
  buildBusinessCase(
    runId: string,
    payload: {
      candidate_id: string;
      question: string;
      assumption_notes?: string[];
    }
  ): Promise<z.output<typeof BusinessCaseOutputSchema>>;
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
      kpi_watchlist?: Array<{
        metric_key: string;
        display_name: string;
        threshold_value: number;
        direction: "above" | "below";
        alert_message: string;
      }>;
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
  getUserSettings(): Promise<{ metric_definitions: Array<{ metric_key: string; display_name: string; definition: string }>; business_context: string }>;
  saveUserSettings(settings: { metric_definitions: Array<{ metric_key: string; display_name: string; definition: string }>; business_context: string }): Promise<void>;
  indexRagTurn(payload: {
    session_id?: string | null;
    chunks: Array<{ source: string; label: string; text: string }>;
  }): Promise<void>;
  searchRagMemory(payload: {
    session_id?: string | null;
    query_text: string;
    limit?: number;
  }): Promise<Array<{ source: string; label: string; text: string; similarity: number }>>;
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
  preparation_sqls: z.array(z.string()).default([]),
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
  warnings: z.array(z.string()).default([]),
  sample_rows: z.array(z.record(z.string(), z.unknown())).default([])
});

type TokenUsageRecord = z.output<typeof TokenUsageSchema>;
type PreparedPayloadRecord = z.output<typeof PreparedPayloadSchema>;

const KpiCheckResultSchema = z.object({
  metric_key: z.string(),
  display_name: z.string(),
  status: z.enum(["pass", "fail"]),
  actual: z.number().nullable(),
  threshold: z.number(),
  direction: z.enum(["above", "below"]),
  alert_message: z.string()
});

const RunStatusResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending"), run_id: z.string() }),
  z.object({ status: z.literal("running"), run_id: z.string() }),
  z.object({
    status: z.literal("succeeded"),
    run_id: z.string().min(1),
    exec_brief: ExecBriefSchema,
    exec_brief_html: z.string().optional(),
    prepared_payloads: z.array(PreparedPayloadSchema).default([]),
    kpi_results: z.array(KpiCheckResultSchema).default([]),
    pdf_path: z.string().optional()
  }),
  z.object({
    status: z.literal("failed"),
    run_id: z.string(),
    error: z.string().optional()
  })
]);

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

const BusinessCaseCandidatesResponseSchema = z.object({
  candidates: z.array(BusinessCaseCandidateSchema).default([])
});

const ConnectionContextSchema = z.object({
  connected: z.boolean(),
  provider: z.enum(["postgres", "supabase", "neon", "mysql", "snowflake", "bigquery"]).nullable().optional(),
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

const RagMemoryChunkSchema = z.object({
  source: z.string().min(1),
  label: z.string().min(1),
  text: z.string().min(1),
  similarity: z.number()
});

const RagMemorySearchResponseSchema = z.object({
  chunks: z.array(RagMemoryChunkSchema).default([])
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

const RelationHealthSchema = z
  .object({
    schema_name: z.string().optional(),
    relation_name: z.string().optional(),
    qualified_name: z.string(),
    has_select_privilege: z.boolean().optional(),
    rls_active_for_me: z.boolean().optional(),
    policies_count_for_me: z.number().optional(),
    status: z.enum(["OK", "NO_SELECT_GRANT", "RLS_NO_POLICY"]),
    status_label: z.string().optional()
  })
  .transform((entry) => {
    const [derivedSchema = "", derivedRelation = ""] = entry.qualified_name.split(".", 2);
    const hasSelectPrivilege =
      typeof entry.has_select_privilege === "boolean"
        ? entry.has_select_privilege
        : entry.status !== "NO_SELECT_GRANT";
    return {
      schema_name: entry.schema_name ?? derivedSchema,
      relation_name: entry.relation_name ?? derivedRelation,
      qualified_name: entry.qualified_name,
      has_select_privilege: hasSelectPrivilege,
      rls_active_for_me: entry.rls_active_for_me ?? false,
      policies_count_for_me: entry.policies_count_for_me ?? 0,
      status: entry.status,
      status_label: entry.status_label ?? entry.status
    };
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
  metric_ids: [],
  dimension_ids: [],
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
    scope_finalized: false,
    metric_definitions: [],
    pending_metric_confirmations: [],
    pending_metric_resume_message: null,
    pending_metric_resume_mode: null,
    scope_clarification_pending: false,
    scope_business_context: null,
    scope_source_prompt: null,
    scope_suggestions: [],
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
    post_run_actions_pending: false,
    report_clarification_active: false,
    business_case_active: false,
    business_case_candidates: [],
    business_case_selected_candidate_id: null,
    business_case_assumption_notes: [],
    business_case_pending_clarification: null,
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

export function parseChatState(value: unknown): ChatState {
  const parsed = ChatStateSchema.safeParse(value);
  if (!parsed.success) {
    return createInitialChatState();
  }

  const next: ChatState = {
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
    scope_finalized: parsed.data.scope_finalized ?? false,
    metric_definitions: parsed.data.metric_definitions.map((entry) => ({
      metric_key: entry.metric_key,
      display_name: entry.display_name,
      definition: entry.definition
    })),
    pending_metric_confirmations: parsed.data.pending_metric_confirmations.map((entry) => ({
      metric_key: entry.metric_key,
      display_name: entry.display_name,
      definition: entry.definition
    })),
    pending_metric_resume_message: parsed.data.pending_metric_resume_message ?? null,
    pending_metric_resume_mode: parsed.data.pending_metric_resume_mode ?? null,
    scope_clarification_pending: parsed.data.scope_clarification_pending ?? false,
    scope_business_context: parsed.data.scope_business_context ?? null,
    scope_source_prompt: parsed.data.scope_source_prompt ?? null,
    scope_suggestions: parsed.data.scope_suggestions.map((entry) => ({
      suggestion_number: entry.suggestion_number,
      question: entry.question,
      reason: entry.reason
    })),
    scope_questions: parsed.data.scope_questions.map((entry) => ({
      question_number: entry.question_number,
      question: entry.question,
      clarification: entry.clarification,
      answer: entry.answer ?? null,
      metric_key: entry.metric_key ?? null,
      metric_display_name: entry.metric_display_name ?? null,
      metric_definition_draft: entry.metric_definition_draft ?? null,
      metric_source_columns: [...entry.metric_source_columns]
    })),
    pending_query_sql: parsed.data.pending_query_sql ?? null,
    pending_query_limit: parsed.data.pending_query_limit ?? null,
    pending_single_query_request: parsed.data.pending_single_query_request ?? null,
    pending_followup_asks: [...(parsed.data.pending_followup_asks ?? [])],
    last_single_query_snapshot: parsed.data.last_single_query_snapshot ?? null,
    single_query_log: [...(parsed.data.single_query_log ?? [])],
    planner_summary: parsed.data.planner_summary ?? null,
    preparation_summary: parsed.data.preparation_summary ?? null,
    prepared_payloads: [...parsed.data.prepared_payloads],
    post_run_actions_pending: parsed.data.post_run_actions_pending ?? false,
    report_clarification_active: parsed.data.report_clarification_active ?? false,
    business_case_active: parsed.data.business_case_active ?? false,
    business_case_candidates: [...(parsed.data.business_case_candidates ?? [])],
    business_case_selected_candidate_id: parsed.data.business_case_selected_candidate_id ?? null,
    business_case_assumption_notes: [...(parsed.data.business_case_assumption_notes ?? [])],
    business_case_pending_clarification: parsed.data.business_case_pending_clarification ?? null,
    awaiting_pdf_confirmation: parsed.data.awaiting_pdf_confirmation ?? false,
    awaiting_post_run_refinement: parsed.data.awaiting_post_run_refinement ?? false,
    refinement_active: parsed.data.refinement_active ?? false,
    refinement_questions_remaining: parsed.data.refinement_questions_remaining ?? 0,
    awaiting_save_confirmation: parsed.data.awaiting_save_confirmation ?? false,
    awaiting_schedule_confirmation: parsed.data.awaiting_schedule_confirmation ?? false,
    awaiting_schedule_mode_selection: parsed.data.awaiting_schedule_mode_selection ?? false,
    schedule_mode_pending: parsed.data.schedule_mode_pending ?? null,
    schedule_day_kind: parsed.data.schedule_day_kind ?? null,
    awaiting_custom_day_input: parsed.data.awaiting_custom_day_input ?? false,
    schedule_pending: parsed.data.schedule_pending ?? false,
    pending_schedule: parsed.data.pending_schedule ?? null,
    last_concise_summary: parsed.data.last_concise_summary ?? null,
    pending_run_id: parsed.data.pending_run_id ?? null,
    last_token_usage: parsed.data.last_token_usage ?? null,
    orchestrator_context_version: parsed.data.orchestrator_context_version ?? 1,
    orchestrator_summary: parsed.data.orchestrator_summary ?? null,
    last_orchestrator_decision: parsed.data.last_orchestrator_decision ?? null,
    pending_inputs: parsed.data.pending_inputs.map((entry) => ({
      input_key: entry.input_key,
      prompt: entry.prompt,
      reason: entry.reason,
      question_number: entry.question_number
    })),
    question_registry: parsed.data.question_registry.map((entry) => ({
      question_number: entry.question_number,
      question_id: entry.question_id ?? null,
      question_text: entry.question_text,
      status: entry.status,
      group_id: entry.group_id ?? null,
      clarification_needed: entry.clarification_needed ?? null,
      clarification_answer: entry.clarification_answer ?? null,
      scope_clarified: entry.scope_clarified ?? false
    }))
  };

  normalizeSuggestedScopeEntries(next);
  syncQuestionRegistryFromScope(next);
  return next;
}

function isAdvancedQuestionStatus(status: "open" | "scoped" | "prepared" | "analyzed" | "complete"): boolean {
  return status === "prepared" || status === "analyzed" || status === "complete";
}

function syncQuestionRegistryFromScope(state: ChatState): void {
  if (state.scope_questions.length === 0) {
    state.question_registry = [];
    return;
  }

  const byNumber = new Map(
    state.question_registry.map((entry) => [entry.question_number, entry])
  );

  state.question_registry = state.scope_questions.map((entry) => {
    const existing = byNumber.get(entry.question_number);
    const answered = Boolean(entry.answer && entry.answer.trim().length > 0);
    const status =
      existing && isAdvancedQuestionStatus(existing.status)
        ? existing.status
        : answered
        ? "scoped"
        : "open";

    return {
      question_number: entry.question_number,
      question_id: existing?.question_id ?? null,
      question_text: entry.question,
      status,
      group_id: existing?.group_id ?? null,
      clarification_needed: entry.clarification,
      clarification_answer: entry.answer ?? null,
      scope_clarified: answered
    };
  });
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

function applyConversationOrchestratorDecision(
  state: ChatState,
  decision: ConversationOrchestratorDecision,
  userCommand?: string
): ChatState {
  const next = parseChatState(state);
  let scopeChanged = false;
  const hadScopeQuestionsBefore = state.scope_questions.length > 0;
  const parsed = ConversationOrchestratorDecisionSchema.safeParse(decision);
  if (!parsed.success) {
    return next;
  }

  const resolved = parsed.data;
  const userMessageText = typeof userCommand === "string" ? userCommand : "";
  const inClarificationPhase =
    hadScopeQuestionsBefore && (state.scope_clarification_pending || state.scope_questions.length > 0);
  const explicitAddQuestionSignal =
    /\b(also|add|include|another|one more|new question|follow up|follow-up)\b/.test(userMessageText) ||
    looksLikeNewQuestionWhileClarifying(userMessageText);
  const explicitAssignments = parseExplicitScopeAnswerAssignments(userMessageText);
  const hasNewQuestionIntent =
    parsed.data.intent_parts.some(
      (entry) => entry.type === "new_question" || entry.type === "follow_up_request"
    ) ||
    parsed.data.new_scope_questions.length > 0 ||
    parsed.data.follow_up_requests.some((entry) => entry.requires_new_data);
  const inferredUserFollowUpQuestion =
    inClarificationPhase
      ? extractImpromptuScopeQuestionFromClarification(next, userMessageText, [])
      : null;
  const freezeLockedScopeForAck =
    state.scope_finalized &&
    state.prep_pending &&
    !state.scope_clarification_pending &&
    !explicitAddQuestionSignal &&
    looksLikeAffirmativeScopeConfirmation(userMessageText);

  next.orchestrator_context_version = 1;
  next.last_orchestrator_decision = resolved;
  next.orchestrator_summary = resolved.state_updates.summary ?? null;

  if (freezeLockedScopeForAck) {
    syncQuestionRegistryFromScope(next);
    return next;
  }

  if (resolved.state_updates.clear_pending_inputs) {
    next.pending_inputs = [];
  } else if (resolved.pending_inputs.length > 0) {
    next.pending_inputs = resolved.pending_inputs.map((entry) => ({
      input_key: entry.input_key,
      prompt: entry.prompt,
      reason: entry.reason,
      question_number: entry.question_number
    }));
  }

  const isDeepAnalysisRoute =
    resolved.next_owner === "query_planning_agent" ||
    resolved.next_owner === "data_prep_orchestrator" ||
    resolved.next_owner === "wait_for_user" ||
    resolved.next_owner === "conversation_orchestrator";

  const rawIncomingScopeQuestions = resolved.new_scope_questions.map((entry) => ({
    question: entry.question_text,
    clarification: entry.clarification,
    answer: null,
    metric_key: null,
    metric_display_name: null,
    metric_definition_draft: null,
    metric_source_columns: []
  }));
  const scopeQuestionNumbersBeforeAppend = new Set(
    next.scope_questions.map((entry) => entry.question_number)
  );
  const newlyAddedQuestionNumbers = new Set<number>();

  const clarificationLikeIncoming = rawIncomingScopeQuestions.filter((entry) =>
    isClarificationStyleScopeQuestion(entry.question)
  );
  const trueIncomingScopeQuestions = rawIncomingScopeQuestions.filter(
    (entry) => !isClarificationStyleScopeQuestion(entry.question)
  );

  // Guardrail: reject clarification-style prompts as new planning questions.
  // Fold them into clarification text for the closest existing scoped question.
  if (clarificationLikeIncoming.length > 0 && next.scope_questions.length > 0) {
    if (mergeClarificationLikeScopeEntries(next.scope_questions, clarificationLikeIncoming)) {
      scopeChanged = true;
    }
  }

  let rawNewQuestions = trueIncomingScopeQuestions.map((entry) => ({
    question_number: next.scope_questions.length + 1,
    question: entry.question,
    clarification: entry.clarification,
    answer: null,
    metric_key: null,
    metric_display_name: null,
    metric_definition_draft: null,
    metric_source_columns: []
  }));
  if (clarificationLikeIncoming.length > 0 && rawNewQuestions.length > 0) {
    const draftScopeQuestions: ScopeQuestionEntry[] = rawNewQuestions.map((entry, index) => ({
      question_number: index + 1,
      question: entry.question,
      clarification: entry.clarification,
      answer: null,
      metric_key: null,
      metric_display_name: null,
      metric_definition_draft: null,
      metric_source_columns: []
    }));
    if (mergeClarificationLikeScopeEntries(draftScopeQuestions, clarificationLikeIncoming)) {
      rawNewQuestions = rawNewQuestions.map((entry, index) => ({
        ...entry,
        clarification: draftScopeQuestions[index]?.clarification ?? entry.clarification
      }));
      scopeChanged = true;
    }
  }

  const rawFollowUpCandidates = resolved.follow_up_requests
    .filter((entry) => entry.requires_new_data || inClarificationPhase)
    .map((entry) => ({
      question_number: next.scope_questions.length + 1,
      question: entry.question_text,
      clarification: "Follow-up scope requiring fresh data preparation.",
      answer: null,
      metric_key: null,
      metric_display_name: null,
      metric_definition_draft: null,
      metric_source_columns: []
    }));
  const clarificationLikeFollowUps = rawFollowUpCandidates.filter((entry) =>
    isClarificationStyleScopeQuestion(entry.question)
  );
  const rawFollowUpQuestions = rawFollowUpCandidates.filter(
    (entry) => !isClarificationStyleScopeQuestion(entry.question)
  );

  if (clarificationLikeFollowUps.length > 0 && next.scope_questions.length > 0) {
    if (mergeClarificationLikeScopeEntries(next.scope_questions, clarificationLikeFollowUps)) {
      scopeChanged = true;
    }
  }

  if (inferredUserFollowUpQuestion) {
    if (isClarificationStyleScopeQuestion(inferredUserFollowUpQuestion)) {
      if (
        next.scope_questions.length > 0 &&
        mergeClarificationLikeScopeEntries(next.scope_questions, [
          {
            question: inferredUserFollowUpQuestion,
            clarification: inferredUserFollowUpQuestion
          }
        ])
      ) {
        scopeChanged = true;
      }
    } else if (
      !rawNewQuestions.some((entry) => areScopeQuestionTextsSimilar(entry.question, inferredUserFollowUpQuestion)) &&
      !rawFollowUpQuestions.some((entry) => areScopeQuestionTextsSimilar(entry.question, inferredUserFollowUpQuestion))
    ) {
      rawFollowUpQuestions.push({
        question_number: next.scope_questions.length + 1,
        question: inferredUserFollowUpQuestion,
        clarification: buildClarificationForScopeQuestion(inferredUserFollowUpQuestion),
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      });
    }
  }

  // During active clarification, only append new questions when the user explicitly asks to add one.
  // This prevents suggested/accidental question drift that keeps scope in a pending loop.
  const newQuestions =
    inClarificationPhase &&
    !explicitAddQuestionSignal &&
    !hasNewQuestionIntent &&
    !inferredUserFollowUpQuestion
      ? []
      : rawNewQuestions;
  const followUpQuestions =
    inClarificationPhase &&
    !explicitAddQuestionSignal &&
    !hasNewQuestionIntent &&
    !inferredUserFollowUpQuestion
      ? []
      : rawFollowUpQuestions;

  // Only process scope questions for deep analysis routes — single_query_agent and
  // data_architect_agent must never create scope questions even if the LLM hallucinates them.

  const shouldAppendScopeQuestions =
    isDeepAnalysisRoute ||
    (inClarificationPhase &&
      (explicitAddQuestionSignal || hasNewQuestionIntent || Boolean(inferredUserFollowUpQuestion)));

  if ((newQuestions.length > 0 || followUpQuestions.length > 0) && shouldAppendScopeQuestions) {
    next.scope_questions = normalizeScopeQuestionsForPlanning([
      ...next.scope_questions,
      ...newQuestions,
      ...followUpQuestions
    ]);
    normalizeSuggestedScopeEntries(next);
    for (const question of next.scope_questions) {
      if (!scopeQuestionNumbersBeforeAppend.has(question.question_number)) {
        newlyAddedQuestionNumbers.add(question.question_number);
      }
    }
    applySavedMetricDefinitionsToScopeQuestions(next);
    next.scope_clarification_pending = true;
    next.scope_pending = false;
    next.prep_pending = false;
    next.scope_finalized = false;
    scopeChanged = true;
  }

  if (newlyAddedQuestionNumbers.size > 0) {
    for (const questionNumber of newlyAddedQuestionNumbers) {
      const target = next.scope_questions.find((entry) => entry.question_number === questionNumber);
      if (!target || (target.answer && target.answer.trim().length > 0)) {
        continue;
      }
      const hasPendingForQuestion = next.pending_inputs.some(
        (entry) => entry.question_number === questionNumber
      );
      if (hasPendingForQuestion) {
        continue;
      }
      const prompt =
        target.clarification && target.clarification.trim().length > 0
          ? target.clarification
          : buildClarificationForScopeQuestion(target.question);
      const isNewlyAddedDuringClarification = hadScopeQuestionsBefore || inClarificationPhase;
      next.pending_inputs.push({
        input_key: `scope_q${questionNumber}_clarification`,
        prompt,
        reason: isNewlyAddedDuringClarification
          ? "Clarification needed for newly added scope question."
          : "Clarification required before data preparation.",
        question_number: questionNumber
      });
    }
  }

  // Offer optional suggestions on the first deep-analysis scope turn, but do not
  // push them into the real scope until the user explicitly includes them.
  if (
    isDeepAnalysisRoute &&
    !hadScopeQuestionsBefore &&
    next.scope_questions.length > 0 &&
    next.scope_suggestions.length === 0
  ) {
    next.scope_suggestions = buildSuggestedScopeQuestions(next.scope_questions).slice(0, 2);
  }

  const shouldIgnoreResolvedAnswersForNewSessionQuestions =
    !hadScopeQuestionsBefore && (newQuestions.length > 0 || followUpQuestions.length > 0);

  const explicitAssignmentNumbers = new Set(explicitAssignments.map((entry) => entry.question_number));
  const explicitApplyToAll =
    /\b(same for all|all questions|for all questions|apply to all|across all questions|for each question)\b/i.test(
      userMessageText
    );
  const allowOrchestratorResolvedScopeAnswers = shouldApplyOrchestratorResolvedScopeAnswers({
    raw_message: userMessageText,
    in_clarification_phase: inClarificationPhase,
    explicit_assignment_count: explicitAssignments.length,
    explicit_apply_to_all: explicitApplyToAll,
    has_new_question_intent: hasNewQuestionIntent
  });

  if (
    allowOrchestratorResolvedScopeAnswers &&
    !shouldIgnoreResolvedAnswersForNewSessionQuestions &&
    resolved.resolved_scope_answers.length > 0
  ) {
    for (const answer of resolved.resolved_scope_answers) {
      if (newlyAddedQuestionNumbers.has(answer.question_number)) {
        continue;
      }
      const target = next.scope_questions.find(
        (entry) => entry.question_number === answer.question_number
      );
      if (!target) {
        continue;
      }
      if (
        !shouldAcceptResolvedScopeAssignment({
          raw_message: userMessageText,
          target_question: target,
          explicit_assignment_numbers: explicitAssignmentNumbers,
          explicit_apply_to_all: explicitApplyToAll
        })
      ) {
        continue;
      }
      const nextAnswer = answer.answer.trim();
      if (target.answer !== nextAnswer) {
        target.answer = nextAnswer;
        scopeChanged = true;
      }
    }
  }

  if (next.pending_inputs.length > 0) {
    reconcilePendingInputsToScopeQuestions(next);
    const answeredQuestionNumbers = new Set(
      next.scope_questions
        .filter((entry) => Boolean(entry.answer && entry.answer.trim().length > 0))
        .map((entry) => entry.question_number)
    );
    next.pending_inputs = next.pending_inputs.filter((entry) =>
      typeof entry.question_number === "number"
        ? !answeredQuestionNumbers.has(entry.question_number)
        : true
    );
  }

  const answeredScopeCount = next.scope_questions.filter(
    (entry) => entry.answer && entry.answer.trim().length > 0
  ).length;
  const hasOutstandingPendingScopeInputs = next.pending_inputs.some((entry) => {
    if (typeof entry.question_number !== "number") {
      return true;
    }
    const target = next.scope_questions.find((question) => question.question_number === entry.question_number);
    if (!target) {
      return true;
    }
    return !target.answer || target.answer.trim().length === 0;
  });
  const allScopeAnswered =
    next.scope_questions.length > 0 &&
    answeredScopeCount === next.scope_questions.length &&
    !hasOutstandingPendingScopeInputs;

  // Keep scope-state deterministic even when the orchestrator forgets to set
  // mark_scope_complete after all pending clarifications are answered.
  // This avoids "scope locked" text without prep decision controls.
  const shouldAutoLockScope =
    allScopeAnswered &&
    next.pending_inputs.length === 0 &&
    (scopeChanged || state.scope_clarification_pending || isDeepAnalysisRoute);
  if (shouldAutoLockScope) {
    // Clear stale pending-input artifacts once scope is fully resolved.
    next.pending_inputs = [];
    next.scope_clarification_pending = false;
    next.scope_finalized = true;
    next.scope_pending = false;
    if (!next.prep_complete) {
      next.prep_pending = true;
    }
  }

  if (
    resolved.state_updates.mark_scope_complete &&
    allScopeAnswered &&
    next.pending_inputs.length === 0
  ) {
    // Explicit scope-complete decisions should always carry a clean pending-input set.
    next.pending_inputs = [];
    next.scope_clarification_pending = false;
    next.scope_finalized = true;
    next.scope_pending = false;
    if (!next.prep_complete) {
      next.prep_pending = true;
    }
  }

  if (resolved.next_owner === "wait_for_user") {
    if (next.scope_questions.length > 0 && !allScopeAnswered) {
      next.scope_clarification_pending = true;
      next.prep_pending = false;
      next.scope_pending = false;
      next.scope_finalized = false;
    }
  }

  if (resolved.state_updates.question_registry_updates.length > 0) {
    const byQuestion = new Map(
      next.question_registry.map((entry) => [entry.question_number, entry])
    );

    for (const update of resolved.state_updates.question_registry_updates) {
      const existing = byQuestion.get(update.question_number);
      if (existing) {
        existing.status = update.status;
        existing.question_id = update.question_id ?? existing.question_id;
      } else {
        const source = next.scope_questions.find(
          (entry) => entry.question_number === update.question_number
        );
        byQuestion.set(update.question_number, {
          question_number: update.question_number,
          question_id: update.question_id ?? null,
          question_text: source?.question ?? `Q${update.question_number}`,
          status: update.status,
          group_id: null,
          clarification_needed: source?.clarification ?? null,
          clarification_answer: source?.answer ?? null,
          scope_clarified: Boolean(source?.answer && source.answer.trim().length > 0)
        });
      }
    }

    next.question_registry = Array.from(byQuestion.values()).sort(
      (left, right) => left.question_number - right.question_number
    );
  } else if (next.scope_questions.length > 0) {
    const existingByNumber = new Map(
      next.question_registry.map((entry) => [entry.question_number, entry])
    );
    next.question_registry = next.scope_questions.map((entry) => {
      const existing = existingByNumber.get(entry.question_number);
      return {
        question_number: entry.question_number,
        question_id: existing?.question_id ?? null,
        question_text: entry.question,
        status:
          existing?.status ??
          (entry.answer && entry.answer.trim().length > 0 ? "scoped" : "open"),
        group_id: existing?.group_id ?? null,
        clarification_needed: entry.clarification,
        clarification_answer: entry.answer ?? null,
        scope_clarified: Boolean(entry.answer && entry.answer.trim().length > 0)
      };
    });
  }

  // Final safety net: once scope is fully locked, stale pending-input entries
  // must be cleared so decision buttons are not suppressed in the UI.
  if (allScopeAnswered && next.scope_finalized) {
    next.pending_inputs = [];
  }

  if (scopeChanged) {
    invalidatePreparedStateForScopeChange(next);
  }

  syncQuestionRegistryFromScope(next);
  return next;
}

function invalidatePreparedStateForScopeChange(state: ChatState): void {
  state.contract_id = null;
  state.prep_complete = false;
  state.prepared_payloads = [];
  state.scope_pending = false;
  state.prep_pending = false;
  state.pending_run_id = null;
  resetPostRunFollowupState(state);
  state.awaiting_post_run_refinement = false;
  state.refinement_active = false;
  state.refinement_questions_remaining = 2;
  state.awaiting_pdf_confirmation = false;
  state.awaiting_save_confirmation = false;
  state.awaiting_schedule_confirmation = false;
  state.awaiting_schedule_mode_selection = false;
  state.awaiting_custom_day_input = false;
  state.schedule_pending = false;
  state.pending_schedule = null;
}

function resetPostRunFollowupState(state: ChatState): void {
  state.post_run_actions_pending = false;
  state.report_clarification_active = false;
  state.business_case_active = false;
  state.business_case_candidates = [];
  state.business_case_selected_candidate_id = null;
  state.business_case_assumption_notes = [];
  state.business_case_pending_clarification = null;
}

function applySavedMetricDefinitionsToScopeQuestions(state: ChatState): void {
  if (!Array.isArray(state.scope_questions) || state.scope_questions.length === 0) {
    return;
  }
  if (!Array.isArray(state.metric_definitions) || state.metric_definitions.length === 0) {
    return;
  }

  for (const question of state.scope_questions) {
    const matched = findSavedMetricDefinitionForText(
      state.metric_definitions,
      `${question.question} ${question.clarification}`
    );
    if (!matched) {
      continue;
    }
    if (!question.metric_key || question.metric_key.trim().length === 0) {
      question.metric_key = matched.metric_key;
    }
    if (!question.metric_display_name || question.metric_display_name.trim().length === 0) {
      question.metric_display_name = matched.display_name;
    }
    if (!question.metric_definition_draft || question.metric_definition_draft.trim().length === 0) {
      question.metric_definition_draft = matched.definition;
    }

    const savedFormula = matched.definition.trim();
    if (savedFormula.length > 0) {
      question.question = rewriteRefundRateFormulaText(question.question, savedFormula);
      question.clarification = rewriteRefundRateFormulaText(question.clarification, savedFormula);
    }

    const hasSavedMetricLine = /using saved metric:/i.test(question.clarification);
    if (!hasSavedMetricLine) {
      question.clarification = [
        question.clarification.trim(),
        `Using saved metric: ${matched.display_name} = ${matched.definition}.`
      ]
        .filter((line) => line.length > 0)
        .join(" ");
    }
  }
}

function isSuggestedScopeQuestionText(question: string): boolean {
  return /^\s*\[suggested\]/i.test(question);
}

function normalizeSuggestedScopeEntries(state: ChatState): void {
  if (state.scope_questions.length === 0) {
    return;
  }

  const unansweredNonSuggestedCount = state.scope_questions.filter(
    (entry) =>
      !isSuggestedScopeQuestionText(entry.question) &&
      (!entry.answer || entry.answer.trim().length === 0)
  ).length;
  let changed = false;
  const migratedSuggestions: ChatState["scope_suggestions"] = [];
  const retainedQuestions: ScopeQuestionEntry[] = [];

  for (const entry of state.scope_questions) {
    if (!isSuggestedScopeQuestionText(entry.question)) {
      retainedQuestions.push(entry);
      continue;
    }

    const normalizedQuestion = entry.question.replace(/^\s*\[suggested\]\s*/i, "").trim();
    const hasAnswer = Boolean(entry.answer && entry.answer.trim().length > 0);

    if (hasAnswer) {
      retainedQuestions.push({
        ...entry,
        question: normalizedQuestion
      });
      if (normalizedQuestion !== entry.question) {
        changed = true;
      }
      continue;
    }

    if (unansweredNonSuggestedCount === 0) {
      retainedQuestions.push(entry);
      continue;
    }

    migratedSuggestions.push({
      suggestion_number: 0,
      question: normalizedQuestion,
      reason:
        entry.clarification && entry.clarification.trim().length > 0
          ? entry.clarification.trim()
          : "Optional supporting analysis."
    });
    changed = true;
  }

  if (!changed && migratedSuggestions.length === 0) {
    return;
  }

  const oldToNewQuestionNumbers = new Map<number, number>();
  retainedQuestions.forEach((entry, index) => {
    oldToNewQuestionNumbers.set(entry.question_number, index + 1);
  });

  state.scope_questions = retainedQuestions.map((entry, index) =>
    sanitizeScopeQuestionLanguage({
      ...entry,
      question_number: index + 1
    })
  );
  state.pending_inputs = dedupePendingInputs(
    state.pending_inputs.flatMap((entry) => {
      if (typeof entry.question_number !== "number") {
        return [entry];
      }
      const mappedQuestionNumber = oldToNewQuestionNumbers.get(entry.question_number);
      if (!mappedQuestionNumber) {
        return [];
      }
      return [
        {
          ...entry,
          question_number: mappedQuestionNumber
        }
      ];
    })
  );

  if (migratedSuggestions.length > 0) {
    state.scope_suggestions = renumberScopeSuggestions(
      removeDuplicateScopeSuggestions([...state.scope_suggestions, ...migratedSuggestions], state.scope_questions)
    );
  } else {
    pruneScopeSuggestionsAgainstScopeQuestions(state);
  }
}

function rewriteRefundRateFormulaText(text: string, savedFormula: string): string {
  if (!/\brefund rate\b/i.test(text)) {
    return text;
  }

  let next = text;
  next = next.replace(/refund rate\s*=\s*[^,.]+/gi, `Refund rate = ${savedFormula}`);
  next = next.replace(/defined as\s+[^,.]+/gi, `defined as ${savedFormula}`);
  next = next.replace(/refunded orders\s*\/\s*total orders/gi, savedFormula);
  next = next.replace(
    /count of orders with status\s*=\s*['"`]?refunded['"`]?\s*\/\s*total count of all orders/gi,
    savedFormula
  );
  return next;
}

// ---------------------------------------------------------------------------
// applyLlmDraftUpdates — merges structured LLM draft updates into state
// ---------------------------------------------------------------------------

import type { DraftUpdates } from "./conversation";

export function applyLlmDraftUpdates(
  state: ChatState,
  updates: DraftUpdates,
  options?: { preserve_prepared_state?: boolean }
): ChatState {
  const next = parseChatState(state);
  let changed = false;
  const preservePreparedState = options?.preserve_prepared_state ?? false;
  const hasInProgressScopeState =
    next.scope_questions.length > 0 ||
    next.question_registry.length > 0 ||
    next.scope_clarification_pending ||
    next.scope_finalized;

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

  if (changed && !preservePreparedState && !hasInProgressScopeState) {
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

  const updateDraftScope = (nextRelations: string[]) => {
    draft.allowed_relations = nextRelations;
    draft.allowed_schemas = Array.from(
      new Set(
        nextRelations
          .map((relation) => relation.split(".")[0])
          .filter((schema): schema is string => typeof schema === "string" && schema.length > 0)
      )
    );
  };

  if (missingTables.length > 0) {
    const missingSet = new Set(missingTables.map((relation) => relation.toLowerCase()));
    const retained = draft.allowed_relations.filter((relation) => !missingSet.has(relation.toLowerCase()));
    if (retained.length > 0) {
      updateDraftScope(retained);
      warnings.push(`Ignored unavailable tables from scope: ${missingTables.join(", ")}.`);
    } else {
      return {
        ok: false,
        blocking_message: [
          `These tables don't exist in your connected database: ${missingTables.join(", ")}.`,
          "They may have been renamed or dropped. Update your table scope or say 'use connected tables'."
        ].join("\n"),
        warning_lines: []
      };
    }
  }

  if (blockedTables.length > 0) {
    const blockedSet = new Set(blockedTables.map((relation) => relation.toLowerCase()));
    const retained = draft.allowed_relations.filter((relation) => !blockedSet.has(relation.toLowerCase()));
    if (retained.length > 0) {
      updateDraftScope(retained);
      warnings.push(`Excluded tables without SELECT grant: ${blockedTables.join(", ")}.`);
    } else {
      return {
        ok: false,
        blocking_message: [
          `Cannot read these tables (no SELECT permission): ${blockedTables.join(", ")}.`,
          "Visit the connection wizard to generate a GRANT SQL fix script, or remove these tables from the scope."
        ].join("\n"),
        warning_lines: []
      };
    }
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
  const dynamicHeaders = options.header_provider ?? (() => ({}));
  const mergeHeaders = (init: RequestInit): RequestInit => {
    const extra = dynamicHeaders();
    if (Object.keys(extra).length === 0) return init;
    return { ...init, headers: { ...extra, ...(init.headers as Record<string, string> | undefined) } };
  };
  const requestWithRetry = async (
    path: string,
    init: RequestInit,
    options: { retries?: number; timeout_ms?: number } = {}
  ): Promise<Response> => {
    const retries = options.retries ?? 1;
    const timeoutMs = options.timeout_ms ?? DEFAULT_WEB_API_TIMEOUT_MS;
    const merged = mergeHeaders(init);
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fetchWithTimeout(
          fetcher,
          `${baseUrl}${path}`,
          merged,
          timeoutMs
        );
      } catch (error) {
        lastError = error;
        if (attempt >= retries || !isTransientNetworkError(error)) {
          throw error;
        }
        await sleep(250 * (attempt + 1));
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Network request failed");
  };

  return {
    async createContract(payload) {
      const response = await fetcher(`${baseUrl}/report-contracts`, mergeHeaders({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }));

      return parseJsonResponse(response, ReportContractSchema);
    },
    async listContracts() {
      const response = await fetcher(`${baseUrl}/report-contracts`, mergeHeaders({
        method: "GET"
      }));

      return parseJsonResponse(response, z.array(ReportContractSchema));
    },
    async approveContract(contractId) {
      const response = await fetcher(`${baseUrl}/report-contracts/${encodeURIComponent(contractId)}/approve`, mergeHeaders({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      }));

      return parseJsonResponse(response, ReportContractSchema);
    },
    async lockContract(contractId) {
      const response = await fetcher(`${baseUrl}/report-contracts/${encodeURIComponent(contractId)}/lock`, mergeHeaders({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      }));

      return parseJsonResponse(response, ReportContractSchema);
    },
    async prepareContract(contractId) {
      try {
        const response = await requestWithRetry(
          `/report-contracts/${encodeURIComponent(contractId)}/prepare`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}"
          },
          { retries: 0, timeout_ms: PREPARE_TIMEOUT_MS }
        );

        return parseJsonResponse(response, PrepareContractResponseSchema);
      } catch (error) {
        if ((error as { name?: string } | null)?.name === "AbortError") {
          const seconds = Math.max(1, Math.round(PREPARE_TIMEOUT_MS / 1_000));
          throw new Error(`Preparation timed out after ${seconds}s. Try narrowing the scope and run again.`);
        }
        throw error;
      }
    },
    async submitRun(contractId) {
      const response = await requestWithRetry(
        `/report-contracts/${encodeURIComponent(contractId)}/run`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}"
        },
        { retries: 0, timeout_ms: DEFAULT_WEB_API_TIMEOUT_MS }
      );
      return parseJsonResponse(response, z.object({ run_id: z.string().min(1), status: z.string() }));
    },
    async getRunStatus(runId) {
      const response = await requestWithRetry(
        `/report-runs/${encodeURIComponent(runId)}`,
        { method: "GET" },
        { retries: 1, timeout_ms: DEFAULT_WEB_API_TIMEOUT_MS }
      );
      return parseJsonResponse(response, RunStatusResponseSchema);
    },
    async downloadRunPdf(runId) {
      const response = await requestWithRetry(
        `/report-runs/${encodeURIComponent(runId)}/pdf`,
        {
          method: "GET"
        },
        { retries: 1, timeout_ms: PDF_TIMEOUT_MS }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text.length > 0 ? text : `Failed to download PDF (${response.status})`);
      }

      return response;
    },
    async downloadRunHtml(runId) {
      const response = await requestWithRetry(
        `/report-runs/${encodeURIComponent(runId)}/html`,
        {
          method: "GET"
        },
        { retries: 1, timeout_ms: PDF_TIMEOUT_MS }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text.length > 0 ? text : `Failed to download HTML report (${response.status})`);
      }

      return response;
    },
    async askRunQuestion(runId, question) {
      const response = await fetcher(`${baseUrl}/report-runs/${encodeURIComponent(runId)}/qa`, mergeHeaders({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question })
      }));

      return parseJsonResponse(response, z.object({
        answer: z.string().min(1),
        citations: z.array(z.string()).default([]),
        grounded: z.boolean().default(false),
        requires_new_analysis: z.boolean().default(false)
      }));
    },
    async askReportClarification(runId, question) {
      const response = await fetcher(`${baseUrl}/report-runs/${encodeURIComponent(runId)}/report-qa`, mergeHeaders({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question })
      }));

      return parseJsonResponse(response, ReportClarificationOutputSchema);
    },
    async listBusinessCaseCandidates(runId) {
      const response = await fetcher(
        `${baseUrl}/report-runs/${encodeURIComponent(runId)}/business-case/candidates`,
        mergeHeaders({ method: "GET" })
      );

      const parsed = await parseJsonResponse(response, BusinessCaseCandidatesResponseSchema);
      return parsed.candidates;
    },
    async buildBusinessCase(runId, payload) {
      const response = await fetcher(`${baseUrl}/report-runs/${encodeURIComponent(runId)}/business-case`, mergeHeaders({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidate_id: payload.candidate_id,
          question: payload.question,
          assumption_notes: payload.assumption_notes ?? []
        })
      }));

      return parseJsonResponse(response, BusinessCaseOutputSchema);
    },
    async saveRun(runId) {
      const response = await fetcher(`${baseUrl}/report-runs/${encodeURIComponent(runId)}/save`, mergeHeaders({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      }));

      return parseJsonResponse(response, SaveRunResponseSchema);
    },
    async scheduleContract(contractId, payload) {
      const response = await fetcher(`${baseUrl}/report-contracts/${encodeURIComponent(contractId)}/schedule`, mergeHeaders({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }));

      return parseJsonResponse(response, ScheduleContractResponseSchema);
    },
    async getConnectionContext() {
      const response = await fetcher(`${baseUrl}/connections/active`, mergeHeaders({
        method: "GET"
      }));

      return parseJsonResponse(response, ConnectionContextSchema);
    },
    async runSafeQuery(sql, limit) {
      const response = await fetcher(`${baseUrl}/connections/query`, mergeHeaders({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sql,
          limit
        })
      }));

      return parseJsonResponse(response, SafeQueryResponseSchema);
    },
    async getCatalog() {
      const response = await fetcher(`${baseUrl}/connections/catalog`, mergeHeaders({
        method: "GET"
      }));

      return parseJsonResponse(response, DataCatalogSchema);
    },
    async getTableHealth() {
      try {
        const response = await fetcher(`${baseUrl}/connections/tables`, mergeHeaders({
          method: "GET"
        }));

        if (!response.ok) return [];
        const result = await parseJsonResponse(response, TableHealthResponseSchema);
        return result.relations;
      } catch {
        return [];
      }
    },
    async getUserSettings() {
      try {
        const response = await fetcher(`${baseUrl}/config/user-settings`, mergeHeaders({
          method: "GET"
        }));

        if (!response.ok) return { metric_definitions: [], business_context: "" };
        const data = await response.json();
        return {
          metric_definitions: Array.isArray(data.metric_definitions) ? data.metric_definitions : [],
          business_context: typeof data.business_context === "string" ? data.business_context : ""
        };
      } catch {
        return { metric_definitions: [], business_context: "" };
      }
    },
    async saveUserSettings(settings) {
      try {
        await fetcher(`${baseUrl}/config/user-settings`, mergeHeaders({
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(settings)
        }));
      } catch {
        // Fire-and-forget — don't block the chat flow
      }
    },
    async indexRagTurn(payload) {
      if (!Array.isArray(payload.chunks) || payload.chunks.length === 0) {
        return;
      }

      await requestWithRetry(
        "/ui/rag/index-turn",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            session_id: payload.session_id ?? null,
            chunks: payload.chunks
          })
        },
        { retries: 1, timeout_ms: 20_000 }
      );
    },
    async searchRagMemory(payload) {
      const response = await requestWithRetry(
        "/ui/rag/search",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            session_id: payload.session_id ?? null,
            query_text: payload.query_text,
            limit: payload.limit ?? 12
          })
        },
        { retries: 1, timeout_ms: 20_000 }
      );
      const parsed = await parseJsonResponse(response, RagMemorySearchResponseSchema);
      return parsed.chunks;
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
  orchestrator_decision?: ConversationOrchestratorDecision | null;
}): Promise<ChatTurnResponse> {
  const rawMessage = input.message.trim();
  const command = rawMessage.toLowerCase();
  const hadScopeClarificationPendingBefore = input.state.scope_clarification_pending;
  const unansweredScopeCountBefore = input.state.scope_questions.filter(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  ).length;
  let nextState = parseChatState(input.state);

  if (input.orchestrator_decision) {
    nextState = applyConversationOrchestratorDecision(nextState, input.orchestrator_decision, command);
  }

  // --- Pending follow-up asks from multi-part single query messages ---
  if (nextState.pending_followup_asks.length > 0) {
    if (looksLikeConfirmation(command)) {
      // User confirmed — execute the next queued follow-up ask
      const nextAsk = nextState.pending_followup_asks[0]!;
      nextState.pending_followup_asks = nextState.pending_followup_asks.slice(1);
      const followupResult = await attemptSingleQueryOrAnalysisRouting(
        nextAsk,
        nextState,
        input.api_client,
        input.query_router,
        { orchestratorForcedSingleQuery: true }
      );
      if (followupResult) {
        // If more follow-ups remain, append acknowledgment
        if (nextState.pending_followup_asks.length > 0) {
          const remaining = nextState.pending_followup_asks
            .map((ask) => `- ${ask}`)
            .join("\n");
          followupResult.assistant_message +=
            `\n\nI also have another request queued:\n${remaining}\n\nWould you like me to run this next?`;
          followupResult.state = nextState;
        }
        return followupResult;
      }
      // Fallback: if routing failed, clear queue and fall through
      nextState.pending_followup_asks = [];
    } else if (looksLikeRejection(command)) {
      // User declined — clear the queue
      nextState.pending_followup_asks = [];
    } else {
      // User sent a new message — clear the queue (they moved on)
      nextState.pending_followup_asks = [];
    }
  }

  // --- Orchestrator-driven workflow routing (takes priority over legacy blocking gates) ---
  // Cast to string to allow comparison with new next_owner values that may not yet
  // be reflected in TypeScript's cached type resolution of the shared schema.
  const orchestratorRoute = nextState.last_orchestrator_decision?.next_owner as string | undefined;

  if (orchestratorRoute === "single_query_agent") {
    // Save pending clarification before clearing — the user may be answering a previous
    // clarification AND adding a follow-up in the same message.
    const pendingClarification = nextState.pending_single_query_request;
    nextState.pending_single_query_request = null;

    // Detect multi-part messages: if the orchestrator split the message into multiple
    // intent_parts, queue secondary asks and execute only the primary one first.
    const intentParts = nextState.last_orchestrator_decision?.intent_parts ?? [];

    // --- Clarification + follow-up handling ---
    // When a previous single query was awaiting clarification, separate the clarification
    // answer from any new follow-up requests so the original query executes first.
    if (pendingClarification) {
      const clarificationParts = intentParts.filter(
        (part) => part.type === "clarification_answer"
      );
      const followUpParts = intentParts.filter(
        (part) => part.type === "new_question" || part.type === "follow_up_request"
      );

      // Build clarification text — use tagged parts if available, otherwise full message
      const clarificationText = clarificationParts.length > 0
        ? clarificationParts.map((p) => p.text).join(". ")
        : rawMessage;

      // Merge clarification with the original pending query
      const mergedMessage = [
        pendingClarification,
        `Clarification: ${clarificationText}`
      ].join("\n");

      // Queue any follow-up asks for sequential execution after the primary query
      if (followUpParts.length > 0) {
        nextState.pending_followup_asks = followUpParts.map((p) => p.text);
      }

      const clarifiedResult = await attemptSingleQueryOrAnalysisRouting(
        mergedMessage,
        nextState,
        input.api_client,
        input.query_router,
        { orchestratorForcedSingleQuery: true }
      );
      if (clarifiedResult) {
        if (nextState.pending_followup_asks.length > 0) {
          const followupList = nextState.pending_followup_asks
            .map((ask, i) => `${nextState.pending_followup_asks.length > 1 ? `${i + 1}. ` : "- "}${ask}`)
            .join("\n");
          clarifiedResult.assistant_message +=
            `\n\nI also noted your next request:\n${followupList}\n\nWould you like me to run this next?`;
          clarifiedResult.state = nextState;
        }
        return clarifiedResult;
      }
      // Fallback: if clarification routing failed, fall through to fresh query logic
    }

    // --- Fresh query multi-part handling (no pending clarification) ---
    const distinctAsks = intentParts.filter(
      (part) => part.type === "new_question" || part.type === "follow_up_request"
    );

    // If there are 3+ distinct asks in one message, escalate to deep diagnostic mode
    // — this is clearly a multi-part analysis, not a series of single queries.
    if (distinctAsks.length >= 3) {
      const askList = distinctAsks.map((ask, i) => `${i + 1}. ${ask.text}`).join("\n");
      const escalationMessage = [
        "Your message contains multiple analytical questions. I'm switching to **deep diagnostic mode** to handle them together with a comprehensive analysis.",
        "",
        "Questions I identified:",
        askList,
        "",
        "Let me set up the scope for this analysis."
      ].join("\n");
      // Route to deep diagnostic: build scope clarification step
      const scopeResult = await buildScopeClarificationStep(
        nextState,
        rawMessage,
        input.api_client,
        input.query_router
      );
      if (scopeResult) {
        scopeResult.assistant_message = escalationMessage + "\n\n" + scopeResult.assistant_message;
        return scopeResult;
      }
    }

    const secondaryAsks = distinctAsks
      .slice(1)
      .map((part) => part.text);

    // Determine the effective message: use only the primary ask for SQL generation
    const primaryMessage = secondaryAsks.length > 0 && intentParts[0]
      ? intentParts[0].text
      : rawMessage;
    const effectiveMessage = secondaryAsks.length > 0 ? primaryMessage : rawMessage;

    if (secondaryAsks.length > 0) {
      nextState.pending_followup_asks = [...secondaryAsks];
    }

    // Use existing query router infrastructure to generate SQL + execute
    // Pass orchestratorForcedSingleQuery to prevent heuristic deep-analysis escalation
    const singleQueryResult = await attemptSingleQueryOrAnalysisRouting(
      effectiveMessage,
      nextState,
      input.api_client,
      input.query_router,
      { orchestratorForcedSingleQuery: true }
    );
    if (singleQueryResult) {
      // If there are queued follow-up asks, append acknowledgment to the response
      if (nextState.pending_followup_asks.length > 0) {
        const followupList = nextState.pending_followup_asks
          .map((ask, i) => `${nextState.pending_followup_asks.length > 1 ? `${i + 1}. ` : "- "}${ask}`)
          .join("\n");
        singleQueryResult.assistant_message +=
          `\n\nI also noted your next request:\n${followupList}\n\nWould you like me to run this next?`;
        singleQueryResult.state = nextState;
      }
      return singleQueryResult;
    }
    // Fallback: if routing failed, fall through to normal flow
  }

  if (orchestratorRoute === "data_architect_agent") {
    // Execution-first override: if the message is a direct single-query ask (or
    // single-query follow-up), run the query path instead of returning advisory text.
    if (looksLikeSingleQueryCandidate(rawMessage.toLowerCase(), nextState)) {
      const routed = await attemptSingleQueryOrAnalysisRouting(
        rawMessage,
        nextState,
        input.api_client,
        input.query_router,
        { orchestratorForcedSingleQuery: true }
      );
      if (routed) {
        return routed;
      }
    }

    const architectResult = await executeDataArchitectAgent(
      rawMessage,
      nextState,
      input.api_client,
      input.query_router
    );
    return architectResult;
  }

  // For all other next_owner values, fall through to existing blocking gates
  const scopeClarificationJustStartedThisTurn =
    !hadScopeClarificationPendingBefore &&
    unansweredScopeCountBefore === 0 &&
    nextState.scope_clarification_pending &&
    nextState.scope_questions.some((entry) => !entry.answer || entry.answer.trim().length === 0);

  // Legacy migration: fold pending metric confirmations into scope clarifications.
  if (nextState.pending_metric_confirmations.length > 0) {
    migratePendingMetricConfirmationsToScope(nextState);
  }

  // Recovery: if scope answers are already captured but the pending flags drifted,
  // restore the correct next decision so UI controls remain available.
  const hasAnsweredScopeItems =
    nextState.scope_questions.length > 0 &&
    nextState.scope_questions.every((entry) => Boolean(entry.answer && entry.answer.trim().length > 0));
  const hasScopeReadyContext = hasScopeReadyContextInHistory(nextState);
  const hasUnansweredScopeItems = nextState.scope_questions.some(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  );
  const hasPendingScopeInputs = Array.isArray(nextState.pending_inputs) && nextState.pending_inputs.length > 0;
  // Do not force scope_clarification_pending when the orchestrator explicitly routed
  // to single_query_agent or data_architect_agent — allow mid-conversation switching.
  if (
    hasUnansweredScopeItems &&
    orchestratorRoute !== "single_query_agent" &&
    orchestratorRoute !== "data_architect_agent"
  ) {
    nextState.scope_clarification_pending = true;
    nextState.scope_finalized = false;
    nextState.prep_pending = false;
    nextState.scope_pending = false;
  }
  const hasBlockingDecision =
    Boolean(nextState.pending_query_sql) ||
    nextState.pending_single_query_request !== null ||
    nextState.pending_metric_confirmations.length > 0 ||
    nextState.post_run_actions_pending ||
    nextState.report_clarification_active ||
    nextState.business_case_active ||
    nextState.awaiting_post_run_refinement ||
    nextState.refinement_active ||
    nextState.awaiting_pdf_confirmation ||
    nextState.awaiting_save_confirmation ||
    nextState.awaiting_schedule_confirmation ||
    nextState.awaiting_schedule_mode_selection ||
    nextState.awaiting_custom_day_input ||
    hasPendingScopeInputs ||
    (nextState.scope_clarification_pending && hasUnansweredScopeItems);
  const hasScopeQuestions = nextState.scope_questions.length > 0;
  const canPromoteToPrep =
    hasScopeQuestions
      ? hasAnsweredScopeItems && !hasUnansweredScopeItems && !hasPendingScopeInputs
      : hasScopeReadyContext;

  if (
    canPromoteToPrep &&
    (hasScopeReadyContext || nextState.scope_finalized) &&
    !hasBlockingDecision &&
    !nextState.prep_complete
  ) {
    nextState.pending_inputs = [];
    nextState.scope_finalized = true;
    nextState.scope_clarification_pending = false;
    nextState.scope_pending = false;
    nextState.prep_pending = true;
  }

  if (
    nextState.prep_complete &&
    nextState.prepared_payloads.length > 0 &&
    !nextState.scope_pending &&
    !nextState.prep_pending &&
    !nextState.post_run_actions_pending &&
    !nextState.report_clarification_active &&
    !nextState.business_case_active &&
    !nextState.awaiting_post_run_refinement &&
    !nextState.refinement_active &&
    !nextState.awaiting_pdf_confirmation &&
    !nextState.awaiting_save_confirmation &&
    !nextState.awaiting_schedule_confirmation &&
    !nextState.awaiting_schedule_mode_selection &&
    !nextState.awaiting_custom_day_input &&
    !nextState.schedule_pending
  ) {
    nextState.scope_pending = true;
  }

  // --- Query intent confirmation gate ---

  if (nextState.pending_query_sql) {
    if (isQueryExecutionChoice(command)) {
      return executePendingQuery(nextState, input.api_client, input.query_router);
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

  // --- Multi-question scope clarification gate ---

  if (nextState.scope_clarification_pending) {
    if (scopeClarificationJustStartedThisTurn) {
      return {
        assistant_message: buildScopeClarificationIntroMessage(nextState),
        state: nextState
      };
    }

    if (nextState.scope_questions.length === 0) {
      if (!isUiControlCommand(command) && rawMessage.trim().length > 0) {
        return buildScopeClarificationStep(nextState, rawMessage, input.api_client, input.query_router);
      }
      return {
        assistant_message: buildEmptyScopeClarificationMessage(),
        state: nextState
      };
    }

    reconcilePendingInputsToScopeQuestions(nextState);
    nextState.pending_inputs = nextState.pending_inputs.filter((entry) => {
      if (typeof entry.question_number !== "number") {
        return true;
      }
      const target = nextState.scope_questions.find((question) => question.question_number === entry.question_number);
      if (!target) {
        return true;
      }
      return !target.answer || target.answer.trim().length === 0;
    });
    const hasPendingScopeInputs = nextState.pending_inputs.some((entry) => {
      if (typeof entry.question_number !== "number") {
        return true;
      }
      const target = nextState.scope_questions.find((question) => question.question_number === entry.question_number);
      if (!target) {
        return true;
      }
      return !target.answer || target.answer.trim().length === 0;
    });
    const allScopeAnswersPresent =
      nextState.scope_questions.every((entry) => Boolean(entry.answer && entry.answer.trim().length > 0)) &&
      !hasPendingScopeInputs;
    if (!allScopeAnswersPresent) {
      nextState.prep_pending = false;
      nextState.scope_finalized = false;
      nextState.scope_pending = false;
    }
    if (isScopeContinueChoice(command)) {
      nextState.scope_clarification_pending = false;
      nextState.scope_questions = [];
      nextState.scope_business_context = null;
      nextState.scope_source_prompt = null;
      nextState.scope_suggestions = [];
      nextState.scope_finalized = false;
      nextState.question_registry = [];
      return {
        assistant_message:
          "Scope clarification paused. Tell me what to refine and I will restage the analysis questions.",
        state: nextState
      };
    }

    const shouldRouteScopeFinalizeThroughClarification =
      (isScopeFinalizeChoice(command) && !allScopeAnswersPresent && hadScopeClarificationPendingBefore) ||
      isConfirmAllScopeMessage(rawMessage) ||
      shouldConfirmRemainingScopeItems(rawMessage) ||
      shouldApplyDefaultsToRemainingScopeItems(rawMessage) ||
      (hadScopeClarificationPendingBefore && isPlainScopeAffirmation(rawMessage)) ||
      (hadScopeClarificationPendingBefore && looksLikeAffirmativeScopeConfirmation(rawMessage)) ||
      parseExplicitScopeAnswerAssignments(rawMessage).length > 0 ||
      looksLikeNewQuestionWhileClarifying(rawMessage);

    if (
      isRunPreparationChoice(command) ||
      (isScopeFinalizeChoice(command) && !shouldRouteScopeFinalizeThroughClarification) ||
      isExplicitScopeRunChoice(command) ||
      isUiControlCommand(command)
    ) {
      if (allScopeAnswersPresent) {
        nextState.scope_clarification_pending = false;
        nextState.scope_finalized = true;
        const preparation = await buildPreparationConfirmation(nextState, input.api_client);
        const answeredLines = nextState.scope_questions.map((entry) =>
          `- Q${entry.question_number}: ${entry.answer ?? ""}`
        );
        return {
          assistant_message: [
            "Scope clarifications captured for all questions.",
            answeredLines.join("\n"),
            "",
            preparation.assistant_message
          ].join("\n"),
          state: preparation.state
        };
      }
      return {
        assistant_message: buildScopeClarificationPendingMessage(nextState),
        state: nextState
      };
    }

    const clarification = await applyScopeClarificationAnswersWithLlm(
      nextState,
      rawMessage,
      input.api_client,
      input.query_router
    );

    if (clarification.all_answered) {
      nextState.scope_clarification_pending = false;
      nextState.scope_finalized = true;
      return buildPreparationConfirmation(nextState, input.api_client);
    }

    if (clarification.answered_count === 0) {
      return {
        assistant_message: buildScopeClarificationPendingMessage(nextState),
        state: nextState
      };
    }

    if (!clarification.all_answered) {
      return {
        assistant_message: buildScopeClarificationPendingMessage(nextState),
        state: nextState
      };
    }

    return {
      assistant_message: buildScopeClarificationPendingMessage(nextState),
      state: nextState
    };
  }

  // --- Post-run follow-up actions ---

  if (
    nextState.post_run_actions_pending ||
    nextState.report_clarification_active ||
    nextState.business_case_active
  ) {
    if (isPdfGenerateYesChoice(command)) {
      return completePdfGeneration(nextState);
    }

    if (isStartNewConversationChoice(command)) {
      resetPostRunFollowupState(nextState);
      return {
        assistant_message:
          "Understood. Start a new conversation for a fresh report scope whenever you're ready.",
        state: nextState
      };
    }

    if (isStartReportClarificationChoice(command)) {
      if (!nextState.last_run_id) {
        return {
          assistant_message: "No completed run found yet. Run analysis first.",
          state: nextState
        };
      }

      nextState.post_run_actions_pending = true;
      nextState.report_clarification_active = true;
      nextState.business_case_active = false;
      nextState.business_case_selected_candidate_id = null;
      nextState.business_case_assumption_notes = [];
      nextState.business_case_pending_clarification = null;
      return {
        assistant_message:
          "Report clarification mode is on. Ask any question about the generated report and I'll answer from the report, business context, and metric definitions.",
        state: nextState
      };
    }

    if (isStartBusinessCaseChoice(command)) {
      if (!nextState.last_run_id) {
        return {
          assistant_message: "No completed run found yet. Run analysis first.",
          state: nextState
        };
      }

      const candidates = await input.api_client.listBusinessCaseCandidates(nextState.last_run_id);
      nextState.post_run_actions_pending = true;
      nextState.report_clarification_active = false;
      nextState.business_case_active = candidates.length > 0;
      nextState.business_case_candidates = candidates;
      nextState.business_case_selected_candidate_id = null;
      nextState.business_case_assumption_notes = [];
      nextState.business_case_pending_clarification = null;
      return {
        assistant_message:
          candidates.length > 0
            ? formatBusinessCaseCandidateList(candidates)
            : "No recommendation candidates were generated in this run, so there is nothing to turn into a business case yet.",
        state: nextState
      };
    }

    if (
      nextState.report_clarification_active &&
      nextState.last_run_id &&
      !isUiControlCommand(command) &&
      rawMessage.length > 0
    ) {
      return executeReportClarificationQa(nextState, rawMessage, input.api_client, input.query_router);
    }

    if (
      nextState.business_case_active &&
      nextState.last_run_id &&
      !isUiControlCommand(command) &&
      rawMessage.length > 0
    ) {
      return executeBusinessCaseQa(nextState, rawMessage, input.api_client);
    }

    if (
      nextState.post_run_actions_pending &&
      nextState.last_run_id &&
      !isUiControlCommand(command) &&
      looksLikePayloadQaQuestion(rawMessage)
    ) {
      nextState.report_clarification_active = true;
      nextState.business_case_active = false;
      nextState.business_case_selected_candidate_id = null;
      nextState.business_case_assumption_notes = [];
      nextState.business_case_pending_clarification = null;
      return executeReportClarificationQa(nextState, rawMessage, input.api_client, input.query_router);
    }
  }

  // --- Post-analysis refinement gate ---

  if (nextState.awaiting_post_run_refinement) {
    if (isStartRefinementChoice(command)) {
      nextState.awaiting_post_run_refinement = false;
      nextState.refinement_active = true;
      nextState.refinement_questions_remaining = 2;
      return {
        assistant_message:
          "Refinement mode is on. Ask your first follow-up question (up to 2 total) and I'll answer from this run payload.",
        state: nextState
      };
    }

    if (isStartNewConversationChoice(command)) {
      nextState.awaiting_post_run_refinement = false;
      nextState.refinement_active = false;
      nextState.refinement_questions_remaining = 0;
      return {
        assistant_message:
          "Understood. Start a new conversation for a fresh report scope whenever you're ready.",
        state: nextState
      };
    }

    if (isPdfGenerateYesChoice(command)) {
      nextState.awaiting_post_run_refinement = false;
      nextState.refinement_active = false;
      nextState.refinement_questions_remaining = 0;
      return completePdfGeneration(nextState);
    }

    if (nextState.last_run_id && looksLikePayloadQaQuestion(rawMessage)) {
      nextState.awaiting_post_run_refinement = false;
      nextState.refinement_active = true;
      nextState.refinement_questions_remaining = 2;
      return executeRefinementQa(nextState, rawMessage, input.api_client, input.query_router);
    }

    return {
      assistant_message:
        "Before PDF, choose one path: ask follow-up questions (max 2), generate the PDF now, or start a new conversation.",
      state: nextState
    };
  }

  if (nextState.refinement_active) {
    if (isPdfGenerateYesChoice(command)) {
      nextState.refinement_active = false;
      nextState.refinement_questions_remaining = 0;
      return completePdfGeneration(nextState);
    }

    if (isStartNewConversationChoice(command)) {
      nextState.refinement_active = false;
      nextState.refinement_questions_remaining = 0;
      return {
        assistant_message:
          "Understood. Start a new conversation for a fresh report scope whenever you're ready.",
        state: nextState
      };
    }

    if (nextState.last_run_id && looksLikePayloadQaQuestion(rawMessage)) {
      return executeRefinementQa(nextState, rawMessage, input.api_client, input.query_router);
    }

    return {
      assistant_message:
        `Refinement mode is active. Ask a follow-up question (${nextState.refinement_questions_remaining} remaining), or choose Generate report PDF.`,
      state: nextState
    };
  }

  // --- PDF confirmation gate ---

  if (nextState.awaiting_pdf_confirmation) {
    if (isPdfGenerateYesChoice(command)) {
      return completePdfGeneration(nextState);
    }

    if (isPdfGenerateNoChoice(command)) {
      nextState.awaiting_pdf_confirmation = false;
      return {
        assistant_message: "Okay, PDF generation skipped for now. You can ask follow-up questions from this run payload.",
        state: nextState
      };
    }

    if (nextState.last_run_id && looksLikePayloadQaQuestion(rawMessage)) {
      return {
        assistant_message:
          "Refinement limit is reached for this run. Generate the PDF now, or start a new conversation for additional analysis questions.",
        state: nextState
      };
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

  // --- LLM schedule confirm/adjust gate ---

  if (nextState.schedule_pending === true && nextState.pending_schedule) {
    if (command === "__ui_confirm_llm_schedule__") {
      const params = nextState.pending_schedule;
      nextState.schedule_pending = false;
      nextState.pending_schedule = null;
      return executeSchedule(nextState, input.api_client, {
        frequency: params.frequency,
        day_of_week: params.day_of_week,
        day_of_month: params.day_of_month,
        hour_utc: params.hour_utc ?? 9,
        minute_utc: params.minute_utc ?? 0,
        timezone: params.timezone ?? "UTC",
        kpi_watchlist: params.kpi_watchlist ?? []
      });
    }

    if (command === "__ui_adjust_llm_schedule__") {
      nextState.schedule_pending = false;
      nextState.pending_schedule = null;
      return {
        assistant_message: "Sure, let\u2019s adjust. Tell me what frequency, day/time, or timezone you\u2019d like, and any KPI alerts to set up.",
        state: nextState
      };
    }
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
    reconcilePendingInputsToScopeQuestions(nextState);
    nextState.pending_inputs = nextState.pending_inputs.filter((entry) => {
      if (typeof entry.question_number !== "number") {
        return true;
      }
      const target = nextState.scope_questions.find((question) => question.question_number === entry.question_number);
      if (!target) {
        return true;
      }
      return !target.answer || target.answer.trim().length === 0;
    });
    const hasUnansweredScopeItems = nextState.scope_questions.some(
      (entry) => !entry.answer || entry.answer.trim().length === 0
    );
    const hasPendingScopeInputs = nextState.pending_inputs.some((entry) => {
      if (typeof entry.question_number !== "number") {
        return true;
      }
      const target = nextState.scope_questions.find((question) => question.question_number === entry.question_number);
      if (!target) {
        return true;
      }
      return !target.answer || target.answer.trim().length === 0;
    });

    if (hasUnansweredScopeItems || hasPendingScopeInputs) {
      nextState.prep_pending = false;
      nextState.scope_clarification_pending = true;
      nextState.scope_finalized = false;
      nextState.scope_pending = false;
      return {
        assistant_message: buildScopeClarificationPendingMessage(nextState),
        state: nextState
      };
    }

    // If the user sends refinement text while prep is pending, route to clarification first.
    // This prevents accidental "confirm all + add question" messages from executing prep.
    if (!isUiControlCommand(command) && rawMessage.trim().length > 0 && looksLikeScopeRefinementIntent(rawMessage)) {
      nextState.prep_pending = false;
      nextState.scope_clarification_pending = true;
      nextState.scope_finalized = false;
      return applyScopeClarificationFromPendingDecision(
        nextState,
        rawMessage,
        input.api_client,
        input.query_router
      );
    }

    if (isRunPreparationChoice(command)) {
      return executePreparation(nextState, input.api_client);
    }

    if (isScopeRunChoice(command) || looksLikeAffirmativeScopeConfirmation(rawMessage)) {
      const preparedResult = await executePreparation(nextState, input.api_client);
      const preparedState = parseChatState(preparedResult.state);
      if (preparedState.prep_complete && isExplicitScopeRunChoice(command)) {
        return executeRun(preparedState, input.api_client);
      }
      return preparedResult;
    }

    if (isScopeContinueChoice(command)) {
      nextState.prep_pending = false;
      nextState.scope_clarification_pending = true;
      nextState.scope_finalized = false;
      return {
        assistant_message: "Sounds good. Continue scoping and tell me what to refine before we prepare data.",
        state: nextState
      };
    }

    // Any other free text while prep decision is pending keeps the state explicit.
    if (!isUiControlCommand(command) && rawMessage.trim().length > 0) {
      return {
        assistant_message:
          "Scope is already locked. Choose Run Data Preparation, or say Continue scoping if you want to change scope.",
        state: nextState
      };
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
      nextState.scope_clarification_pending = true;
      nextState.scope_finalized = false;
      // User requested additional scoping after prep. Force a fresh prep pass.
      nextState.prep_pending = false;
      nextState.prep_complete = false;
      nextState.preparation_summary = null;
      nextState.prepared_payloads = [];
      return {
        assistant_message: [
          "Sounds good. Let's continue scoping before analysis.",
          "Tell me what looked off in the prepared data (for example: missing months, wrong filters, wrong joins, or a query result that looks incorrect).",
          "Once you confirm the fixes, I'll restage data preparation and ask you to run it again."
        ].join("\n"),
        state: nextState
      };
    }

    // Allow typed clarification while analysis decision is pending.
    // Route only into scope clarification handling (not generic query routing).
    if (!isUiControlCommand(command) && rawMessage.trim().length > 0) {
      nextState.scope_pending = false;
      nextState.scope_clarification_pending = true;
      nextState.scope_finalized = false;
      // Treat free-text while analysis is pending as scope refinement.
      // Require a fresh prep run after refinements are applied.
      nextState.prep_pending = false;
      nextState.prep_complete = false;
      nextState.preparation_summary = null;
      nextState.prepared_payloads = [];
      return applyScopeClarificationFromPendingDecision(
        nextState,
        rawMessage,
        input.api_client,
        input.query_router
      );
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

    const hasUnansweredScopeItems = nextState.scope_questions.some(
      (entry) => !entry.answer || entry.answer.trim().length === 0
    );
    if (
      nextState.scope_finalized &&
      !nextState.scope_clarification_pending &&
      !hasUnansweredScopeItems
    ) {
      const preparation = await buildPreparationConfirmation(nextState, input.api_client);
      const preparedState = parseChatState(preparation.state);
      if (preparedState.prep_pending) {
        return executePreparation(preparedState, input.api_client);
      }
      return preparation;
    }

    return maybePrepareOrRun(nextState, input.api_client);
  }

  if (/^__ui_finish_scoping_run_analysis__$/.test(command)) {
    if (nextState.prep_pending) {
      const preparedResult = await executePreparation(nextState, input.api_client);
      const preparedState = parseChatState(preparedResult.state);
      if (preparedState.prep_complete) {
        return executeRun(preparedState, input.api_client);
      }
      return preparedResult;
    }

    if (nextState.prep_complete) {
      return executeRun(nextState, input.api_client);
    }

    const hasUnansweredScopeItems = nextState.scope_questions.some(
      (entry) => !entry.answer || entry.answer.trim().length === 0
    );
    if (
      nextState.scope_finalized &&
      !nextState.scope_clarification_pending &&
      !hasUnansweredScopeItems
    ) {
      const preparation = await buildPreparationConfirmation(nextState, input.api_client);
      const preparedState = parseChatState(preparation.state);
      if (!preparedState.prep_complete && preparedState.prep_pending) {
        const preparedResult = await executePreparation(preparedState, input.api_client);
        const preparedStateAfterRun = parseChatState(preparedResult.state);
        if (preparedStateAfterRun.prep_complete) {
          return executeRun(preparedStateAfterRun, input.api_client);
        }
        return preparedResult;
      }
      if (preparedState.prep_complete) {
        return executeRun(preparedState, input.api_client);
      }
      return preparation;
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

async function executePendingQuery(
  state: ChatState,
  apiClient: WebApiClient,
  queryRouter?: QueryRouterClient
): Promise<ChatTurnResponse> {
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
    const compiled = await maybeCompileSqlForExecution({
      query_router: queryRouter,
      api_client: apiClient,
      state: nextState,
      user_message: "run pending query",
      source_sql: sql,
      purpose: "pending_sql_execution"
    });

    const startedAt = Date.now();
    const result = await apiClient.runSafeQuery(compiled.sql, limit);
    const elapsedMs = Date.now() - startedAt;
    const preview = result.rows.slice(0, 10);
    const combinedWarnings = filterUserVisibleWarnings(result.warnings);
    const warnings = combinedWarnings.length > 0 ? `\nWarnings: ${combinedWarnings.join("; ")}` : "";

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
    const compiled = await maybeCompileSqlForExecution({
      query_router: options.query_router,
      api_client: apiClient,
      state: nextState,
      user_message: options.user_message ?? "",
      source_sql: action.sql,
      purpose: action.explanation
    });

    const startedAt = Date.now();
    const result = await apiClient.runSafeQuery(compiled.sql, action.limit);
    const elapsedMs = Date.now() - startedAt;
    const summary = summarizeNaturalQueryResult(action, result.rows[0]);
    const method = summarizeSingleQueryMethod(
      compiled.note ? `${action.explanation} ${compiled.note}` : action.explanation,
      result.governed_sql
    );
    const warningLines = filterUserVisibleWarnings(result.warnings);
    const warnings = warningLines.length > 0 ? `\nWarnings: ${warningLines.join("; ")}` : "";
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
      warnings: warningLines
    });

    // Log to single_query_log for the Queries modal
    const logEntry = {
      query_id: queryId,
      question: options.user_message ?? normalizedRequest,
      governed_sql: result.governed_sql,
      row_count: result.row_count,
      elapsed_ms: elapsedMs,
      created_at: new Date().toISOString(),
      sample_rows: (result.rows ?? []).slice(0, 10)
    };
    nextState.single_query_log = [...(nextState.single_query_log ?? []), logEntry].slice(-20);

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

async function maybeCompileSqlForExecution(input: {
  query_router?: QueryRouterClient;
  api_client: WebApiClient;
  state: ChatState;
  user_message: string;
  source_sql: string;
  purpose: string;
}): Promise<{ sql: string; note: string | null }> {
  const fallbackSql = normalizeExecutableSql(input.source_sql);
  if (!input.query_router?.compile_sql) {
    return { sql: fallbackSql, note: null };
  }

  let context: ConnectionContextRecord | null = null;
  try {
    context = await input.api_client.getConnectionContext();
  } catch {
    context = null;
  }

  const dialect = mapProviderToSqlDialect(context?.provider);
  const catalog = await fetchCatalogContext(input.api_client).catch(() => ({
    catalog_summary: "",
    business_context: ""
  }));

  const allowedRelations =
    input.state.draft.allowed_relations.length > 0
      ? input.state.draft.allowed_relations
      : context?.allowed_relations ?? [];
  const allowedSchemas =
    input.state.draft.allowed_schemas.length > 0
      ? input.state.draft.allowed_schemas
      : context?.allowed_schemas ?? [];

  try {
    const compiled = await input.query_router.compile_sql({
      sql: fallbackSql,
      dialect,
      user_message: input.user_message || input.purpose,
      allowed_relations: [...allowedRelations],
      allowed_schemas: [...allowedSchemas],
      catalog_summary: catalog.catalog_summary
    });

    const compiledSql = normalizeExecutableSql(compiled.sql);
    if (!isLikelySingleSelectSql(compiledSql)) {
      return {
        sql: fallbackSql,
        note: null
      };
    }

    const changed = compiledSql !== fallbackSql;
    return {
      sql: compiledSql,
      note: changed ? `Dialect compiler adapted SQL for ${dialect}.` : null
    };
  } catch {
    return {
      sql: fallbackSql,
      note: null
    };
  }
}

function mapProviderToSqlDialect(
  provider: ConnectionContextRecord["provider"] | null | undefined
): SqlDialect {
  if (provider === "mysql") {
    return "mysql";
  }
  if (provider === "snowflake") {
    return "snowflake";
  }
  if (provider === "bigquery") {
    return "bigquery";
  }
  return "postgres";
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
  const connectionContext = await apiClient.getConnectionContext().catch(() => null);
  const sqlDialect = mapProviderToSqlDialect(connectionContext?.provider);

  try {
    const effectiveBusinessContext = resolveBusinessContextForAgents(state, catalog.business_context);
    return await queryRouter.decide({
      message: rawMessage,
      now_iso: new Date().toISOString(),
      sql_dialect: sqlDialect,
      business_context: effectiveBusinessContext,
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
        .slice(-20)
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
  queryRouter: QueryRouterClient | undefined,
  options?: { orchestratorForcedSingleQuery?: boolean }
): Promise<ChatTurnResponse | null> {
  const lower = rawMessage.toLowerCase();
  const llmQueryRouting = await inferLlmQueryRoutingDecision(
    rawMessage,
    state,
    apiClient,
    queryRouter
  );

  // When the orchestrator explicitly routed to single_query_agent, trust it —
  // do not override with the heuristic deep-analysis escalation.
  const forceDeepAnalysis = !options?.orchestratorForcedSingleQuery && looksLikeComplexMultiQuestionPrompt(lower);
  if (forceDeepAnalysis && llmQueryRouting?.route === "single_query") {
    return buildScopeClarificationStep(
      state,
      rawMessage,
      apiClient,
      queryRouter
    );
  }

  if (llmQueryRouting?.route === "single_query" && llmQueryRouting.sql) {
    const clarificationPrompt = await buildSingleQueryClarificationPrompt(
      rawMessage,
      state,
      apiClient,
      queryRouter
    );
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

  // When the orchestrator explicitly routed to single_query_agent, do not
  // escalate to deep analysis even if the query router LLM says deep_analysis.
  if (llmQueryRouting?.route === "deep_analysis" && !options?.orchestratorForcedSingleQuery) {
    const scopeClarification = await buildScopeClarificationStep(
      state,
      rawMessage,
      apiClient,
      queryRouter
    );
    return scopeClarification;
  }

  // Fallback hardening: if provider routing is unavailable/uncertain but the
  // user request is clearly multi-part analysis, force scoped clarification
  // instead of letting conversational text lock workflow heuristics.
  if (looksLikeComplexMultiQuestionPrompt(lower) && !options?.orchestratorForcedSingleQuery) {
    return buildScopeClarificationStep(
      state,
      rawMessage,
      apiClient,
      queryRouter
    );
  }

  const naturalQueryAction = await inferNaturalQueryAction(rawMessage, state, apiClient);
  if (!naturalQueryAction) {
    return null;
  }

  const clarificationPrompt = await buildSingleQueryClarificationPrompt(
    rawMessage,
    state,
    apiClient,
    queryRouter
  );
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

async function executeDataArchitectAgent(
  rawMessage: string,
  state: ChatState,
  apiClient: WebApiClient,
  queryRouter?: QueryRouterClient
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  const catalog = await fetchCatalogContext(apiClient).catch(() => ({
    catalog_summary: "",
    business_context: ""
  }));

  // Optionally run a probe query for questions needing live data (date ranges, counts, etc.)
  let probeResult: string | null = null;
  if (queryRouter) {
    const probeDecision = await inferLlmQueryRoutingDecision(
      rawMessage,
      nextState,
      apiClient,
      queryRouter
    ).catch(() => null);
    if (probeDecision?.route === "single_query" && probeDecision.sql) {
      try {
        const result = await apiClient.runSafeQuery(probeDecision.sql, 50);
        probeResult = JSON.stringify(
          Array.isArray(result.rows) ? result.rows.slice(0, 20) : []
        );
      } catch {
        // Probe failed — answer from catalog only
      }
    }
  }

  // Call the data architect LLM via the query router's OpenRouter connection
  let answer: string;
  if (queryRouter?.answer_data_question) {
    try {
      answer = await queryRouter.answer_data_question({
        message: rawMessage,
        catalog_summary: catalog.catalog_summary,
        business_context: resolveBusinessContextForAgents(nextState, catalog.business_context),
        probe_result: probeResult,
        conversation_history: nextState.conversation_history
          .slice(-10)
          .map((turn) => ({ role: turn.role, content: turn.content })),
        recent_query_context: (nextState.single_query_log ?? [])
          .slice(-3)
          .map((entry) => ({
            query_id: entry.query_id,
            question: entry.question,
            sql_executed: entry.governed_sql,
            row_count: entry.row_count
          }))
      });
    } catch {
      // Fallback: return a catalog-based summary if the LLM call fails
      answer = buildDataArchitectFallback(rawMessage, catalog, probeResult);
    }
  } else {
    answer = buildDataArchitectFallback(rawMessage, catalog, probeResult);
  }

  const finalState = appendConversationTurn(nextState, rawMessage, answer);

  return { assistant_message: answer, state: finalState };
}

function buildDataArchitectFallback(
  rawMessage: string,
  catalog: { catalog_summary: string; business_context: string },
  probeResult: string | null
): string {
  const parts: string[] = [];
  if (catalog.catalog_summary) {
    parts.push("Here is the available data catalog:\n");
    parts.push(catalog.catalog_summary);
  } else {
    parts.push("No data catalog is currently available. Please connect a database first.");
  }
  if (probeResult) {
    parts.push("\n\nProbe query result:\n" + probeResult);
  }
  return parts.join("");
}

async function buildScopeClarificationStep(
  state: ChatState,
  rawMessage: string,
  apiClient: WebApiClient,
  queryRouter: QueryRouterClient | undefined
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  const catalogCtx = await fetchCatalogContext(apiClient).catch(() => ({
    catalog_summary: "",
    business_context: ""
  }));
  nextState.scope_business_context =
    catalogCtx.business_context && catalogCtx.business_context.trim().length > 0
      ? catalogCtx.business_context.trim()
      : null;
  const llmQuestions = await generateLlmScopeQuestions(
    rawMessage,
    state,
    apiClient,
    queryRouter,
    "deep_analysis",
    catalogCtx
  );
  const fallbackQuestions = isTestRuntime()
    ? formulateScopeQuestions(rawMessage).map((entry, index) => ({
        question_number: index + 1,
        question: entry.question,
        clarification: entry.clarification,
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }))
    : [];
  const scopeQuestions = selectScopeQuestionsForClarification({
    raw_message: rawMessage,
    llm_questions: llmQuestions,
    fallback_questions: fallbackQuestions
  });
  if (scopeQuestions.length === 0 && !isTestRuntime()) {
    throw new Error("scope_clarification_generation_failed: llm returned no scope questions");
  }
  const extractedSuggestedQuestions = scopeQuestions
    .filter((entry) => /^\s*\[suggested\]/i.test(entry.question))
    .map((entry) => ({
      suggestion_number: 0,
      question: entry.question.replace(/^\s*\[suggested\]\s*/i, "").trim(),
      reason:
        entry.clarification && entry.clarification.trim().length > 0
          ? entry.clarification.trim()
          : "Optional supporting analysis."
    }));
  const coreQuestions = normalizeScopeQuestionsForPlanning(
    scopeQuestions.filter((entry) => !/^\s*\[suggested\]/i.test(entry.question))
  );
  const suggestedQuestions = buildSuggestedScopeQuestions(coreQuestions);
  const allSuggestions = removeDuplicateScopeSuggestions(
    [...suggestedQuestions, ...extractedSuggestedQuestions],
    coreQuestions
  );

  nextState.scope_questions = coreQuestions;
  nextState.scope_suggestions = allSuggestions;
  applySavedMetricDefinitionsToScopeQuestions(nextState);
  nextState.scope_source_prompt = rawMessage;
  nextState.scope_clarification_pending = true;
  nextState.prep_pending = false;
  nextState.scope_pending = false;
  nextState.scope_finalized = false;

  syncQuestionRegistryFromScope(nextState);
  return {
    assistant_message: buildScopeClarificationIntroMessage(nextState),
    state: nextState
  };
}

async function applyScopeClarificationFromPendingDecision(
  state: ChatState,
  rawMessage: string,
  apiClient: WebApiClient,
  queryRouter: QueryRouterClient | undefined
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  nextState.scope_clarification_pending = true;
  nextState.scope_finalized = false;

  // If scope questions are missing, rebuild the clarification step from this message
  // instead of routing to single-query execution while a decision is pending.
  if (nextState.scope_questions.length === 0) {
    return buildScopeClarificationStep(nextState, rawMessage, apiClient, queryRouter);
  }

  const clarification = await applyScopeClarificationAnswersWithLlm(
    nextState,
    rawMessage,
    apiClient,
    queryRouter
  );

  if (clarification.all_answered) {
    nextState.scope_clarification_pending = false;
    syncQuestionRegistryFromScope(nextState);
    return buildPreparationConfirmation(nextState, apiClient);
  }

  syncQuestionRegistryFromScope(nextState);
  return {
    assistant_message: buildScopeClarificationPendingMessage(nextState),
    state: nextState
  };
}

function selectScopeQuestionsForClarification(input: {
  raw_message: string;
  llm_questions: Array<{
    question_number: number;
    question: string;
    clarification: string;
    answer: string | null;
    metric_key: string | null;
    metric_display_name: string | null;
    metric_definition_draft: string | null;
    metric_source_columns: string[];
  }>;
  fallback_questions: Array<{
    question_number: number;
    question: string;
    clarification: string;
    answer: string | null;
    metric_key: string | null;
    metric_display_name: string | null;
    metric_definition_draft: string | null;
    metric_source_columns: string[];
  }>;
}): Array<{
  question_number: number;
  question: string;
  clarification: string;
  answer: string | null;
  metric_key: string | null;
  metric_display_name: string | null;
  metric_definition_draft: string | null;
  metric_source_columns: string[];
}> {
  const llmQuestions = input.llm_questions.map(sanitizeScopeQuestionLanguage);
  const fallbackQuestions = input.fallback_questions.map(sanitizeScopeQuestionLanguage);
  if (!isTestRuntime()) {
    return llmQuestions.slice(0, 6);
  }

  if (llmQuestions.length === 0) {
    return fallbackQuestions;
  }
  if (fallbackQuestions.length === 0) {
    return llmQuestions;
  }

  const lower = input.raw_message.toLowerCase();
  const looksComplex = looksLikeComplexMultiQuestionPrompt(lower);
  const llmLooksGeneric =
    llmQuestions.length === 1 &&
    /\b(latest available date|today|timeframe|scope|data available)\b/i.test(
      `${llmQuestions[0].question} ${llmQuestions[0].clarification}`
    );

  if (looksComplex && (llmLooksGeneric || llmQuestions.length < Math.min(3, fallbackQuestions.length))) {
    return fallbackQuestions;
  }

  if (looksComplex) {
    const llmCoverageStrong =
      llmQuestions.length >= Math.max(3, Math.min(4, fallbackQuestions.length)) && !llmLooksGeneric;
    if (llmCoverageStrong) {
      return llmQuestions.slice(0, 6);
    }
    return fallbackQuestions;
  }

  return llmQuestions;
}

async function generateLlmScopeQuestions(
  rawMessage: string,
  state: ChatState,
  apiClient: WebApiClient,
  queryRouter: QueryRouterClient | undefined,
  mode: "single_query" | "deep_analysis",
  catalogContext?: { catalog_summary: string; business_context: string }
): Promise<
  Array<{
    question_number: number;
    question: string;
    clarification: string;
    answer: null;
    metric_key: null;
    metric_display_name: null;
    metric_definition_draft: null;
    metric_source_columns: string[];
  }>
> {
  if (!queryRouter?.scope_clarifications) {
    return [];
  }

  const catalog =
    catalogContext ??
    (await fetchCatalogContext(apiClient).catch(() => ({
      catalog_summary: "",
      business_context: ""
    })));
  if (!catalog.catalog_summary || catalog.catalog_summary.trim().length === 0) {
    return [];
  }

  try {
    const effectiveBusinessContext = resolveBusinessContextForAgents(state, catalog.business_context);
    const response = await queryRouter.scope_clarifications({
      user_message: rawMessage,
      mode,
      now_iso: new Date().toISOString(),
      business_context: effectiveBusinessContext,
      catalog_summary: catalog.catalog_summary,
      allowed_relations: [...state.draft.allowed_relations],
      allowed_schemas: [...state.draft.allowed_schemas],
      draft_metrics: [...state.draft.metric_ids],
      draft_dimensions: [...state.draft.dimension_ids],
      confirmed_metric_definitions: selectRelevantMetricDefinitionsForText(
        state.metric_definitions,
        rawMessage,
        state.conversation_history
      ).map((m) => ({ metric_key: m.metric_key, display_name: m.display_name, definition: m.definition })),
      conversation_history: state.conversation_history
        .slice(-20)
        .map((turn) => ({ role: turn.role, content: turn.content }))
    });

    return response.questions
      .slice(0, mode === "single_query" ? 1 : 6)
      .map((entry, index) => ({
        question_number: index + 1,
        question: entry.question.trim(),
        clarification: entry.clarification.trim(),
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }))
      .filter(
        (entry) =>
          entry.question.length > 0 &&
          entry.clarification.length > 0 &&
          !looksLikeInternalScopeReasoning(entry.question, entry.clarification)
      );
  } catch {
    return [];
  }
}

async function inferMetricDefinitionsFromLlm(input: {
  state: ChatState;
  raw_message: string;
  mode: "single_query" | "deep_analysis";
  sql?: string;
  api_client: WebApiClient;
  query_router: QueryRouterClient | undefined;
}): Promise<ChatMetricDefinition[]> {
  if (!input.query_router?.propose_metrics) {
    return [];
  }

  const catalog = await fetchCatalogContext(input.api_client).catch(() => ({
    catalog_summary: "",
    business_context: ""
  }));
  if (!catalog.catalog_summary || catalog.catalog_summary.trim().length === 0) {
    return [];
  }

  try {
    const effectiveBusinessContext = resolveBusinessContextForAgents(input.state, catalog.business_context);
    const response = await input.query_router.propose_metrics({
      user_message: input.raw_message,
      mode: input.mode,
      now_iso: new Date().toISOString(),
      sql: input.sql,
      business_context: effectiveBusinessContext,
      catalog_summary: catalog.catalog_summary,
      allowed_relations: [...input.state.draft.allowed_relations],
      allowed_schemas: [...input.state.draft.allowed_schemas],
      existing_metric_definitions: selectRelevantMetricDefinitionsForText(
        input.state.metric_definitions,
        input.raw_message,
        input.state.conversation_history
      ).map((m) => ({ metric_key: m.metric_key, display_name: m.display_name, definition: m.definition })),
      conversation_history: input.state.conversation_history
        .slice(-20)
        .map((turn) => ({ role: turn.role, content: turn.content }))
    });

    const normalized = response.metrics
      .slice(0, 6)
      .map((entry) => normalizeMetricDefinition(entry, input.mode))
      .filter((entry): entry is ChatMetricDefinition => entry !== null);
    return prioritizeMetricDefinitionsForWorkflow(normalized, input.raw_message, input.mode);
  } catch {
    return [];
  }
}

async function buildMetricScopeQuestions(input: {
  state: ChatState;
  raw_message: string;
  existing_scope_questions: Array<{
    question_number: number;
    question: string;
    clarification: string;
    answer: string | null;
    metric_key: string | null;
    metric_display_name: string | null;
    metric_definition_draft: string | null;
    metric_source_columns: string[];
  }>;
  api_client: WebApiClient;
  query_router: QueryRouterClient | undefined;
}): Promise<
  Array<{
    question_number: number;
    question: string;
    clarification: string;
    answer: null;
    metric_key: string | null;
    metric_display_name: string | null;
    metric_definition_draft: string | null;
    metric_source_columns: string[];
  }>
> {
  const proposed = await inferMetricDefinitionsFromLlm({
    state: input.state,
    raw_message: input.raw_message,
    mode: "deep_analysis",
    api_client: input.api_client,
    query_router: input.query_router
  });

  if (proposed.length === 0) {
    return [];
  }

  // Global Config is the only source of truth for metric definitions.
  // Chat flow must not persist or mutate metric definitions.
  void proposed;
  return [];
}
void buildMetricScopeQuestions;

function isMetricClarificationAlreadyCovered(
  metric: ChatMetricDefinition,
  scopeQuestions: Array<{
    question_number: number;
    question: string;
    clarification: string;
    answer: string | null;
    metric_key: string | null;
    metric_display_name: string | null;
    metric_definition_draft: string | null;
    metric_source_columns: string[];
  }>
): boolean {
  const directKey = metric.metric_key.trim().toLowerCase();
  const metricTokens = tokenizeForSimilarity(metric.display_name);
  if (metricTokens.length === 0) {
    return false;
  }

  for (const scope of scopeQuestions) {
    if (scope.metric_key && scope.metric_key.trim().toLowerCase() === directKey) {
      return true;
    }
    const text = `${scope.question} ${scope.clarification}`.toLowerCase();
    const matchCount = metricTokens.filter((token) => text.includes(token)).length;
    const hasFormulaLanguage =
      /\b(rate|ratio|percent|percentage|formula|denominator|numerator|count-based|value-based|calculated|calculation)\b/i.test(
        text
      );
    if (matchCount >= Math.min(2, metricTokens.length) && hasFormulaLanguage) {
      return true;
    }
  }

  return false;
}
void isMetricClarificationAlreadyCovered;

function selectRelevantMetricDefinitionsForText(
  metricDefinitions: Array<{ metric_key: string; display_name: string; definition: string }>,
  userMessage: string,
  history: Array<{ content: string }>
): Array<{ metric_key: string; display_name: string; definition: string }> {
  if (!Array.isArray(metricDefinitions) || metricDefinitions.length === 0) {
    return [];
  }

  const recentHistory = history
    .slice(-20)
    .map((entry) => entry.content)
    .join("\n");
  const haystack = `${userMessage}\n${recentHistory}`.toLowerCase();

  return metricDefinitions.filter((entry) => {
    const phrases = collectMetricMatchPhrases(entry);
    const identityText = `${entry.metric_key} ${entry.display_name}`.toLowerCase().replace(/[_-]+/g, " ");
    const metricTypeRequiresExplicitCue = /\b(rate|ratio|percent|percentage)\b/.test(identityText);
    const textHasMetricTypeCue =
      /\b(rate|ratio|percent|percentage|formula|numerator|denominator)\b/.test(haystack) ||
      /\bdivided by\b/.test(haystack);
    if (metricTypeRequiresExplicitCue && !textHasMetricTypeCue) {
      return false;
    }

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
}

function resolveBusinessContextForAgents(
  state: ChatState,
  catalogBusinessContext: string
): string {
  const scoped = (state.scope_business_context ?? "").trim();
  if (scoped.length > 0) {
    return scoped;
  }
  return catalogBusinessContext;
}

export type ScopeQuestionEntry = {
  question_number: number;
  question: string;
  clarification: string;
  answer: string | null;
  metric_key: string | null;
  metric_display_name: string | null;
  metric_definition_draft: string | null;
  metric_source_columns: string[];
};

type ScopeSuggestionEntry = {
  suggestion_number: number;
  question: string;
  reason: string;
};

/**
 * Detect and split compound scope questions that contain multiple analytical asks.
 * E.g. "4-month refund trend + latest 2 months vs prior 2 months comparison" should
 * become two separate questions.
 */
function splitCompoundScopeQuestions(questions: ScopeQuestionEntry[]): ScopeQuestionEntry[] {
  const splitOnce = (entries: ScopeQuestionEntry[]): ScopeQuestionEntry[] => {
    const result: ScopeQuestionEntry[] = [];
    for (const entry of entries) {
      const parts = trySplitCompoundQuestion(entry.question);
      if (parts.length <= 1) {
        result.push(entry);
        continue;
      }
      const normalizedParts =
        parts.length > 1 ? normalizeMultiClauseScopeSegments(parts) : parts;
      // Split into multiple entries, first inherits the answer/metric, rest get null
      for (let i = 0; i < normalizedParts.length; i++) {
        const normalizedQuestion = normalizedParts[i]!;
        result.push({
          ...entry,
          question_number: 0, // will be renumbered later
          question: normalizedQuestion,
          clarification: deriveClarificationForQuestion(normalizedQuestion),
          answer: i === 0 ? entry.answer : null,
          metric_key: i === 0 ? entry.metric_key : null,
          metric_display_name: i === 0 ? entry.metric_display_name : null,
          metric_definition_draft: null,
          metric_source_columns: i === 0 ? entry.metric_source_columns : []
        });
      }
    }
    return result;
  };

  // Run a few passes so nested compound asks are fully split.
  let current = questions;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = splitOnce(current);
    if (next.length === current.length) {
      return next;
    }
    current = next;
  }

  return current;
}

function normalizeScopeQuestionsForPlanning(questions: ScopeQuestionEntry[]): ScopeQuestionEntry[] {
  const sanitized = questions.map(sanitizeScopeQuestionLanguage);
  const split = splitCompoundScopeQuestions(sanitized);
  const folded = foldClarificationStyleQuestions(split);
  const deduped = removeDuplicateScopeQuestions(folded.map(sanitizeScopeQuestionLanguage));
  return renumberScopeQuestions(deduped.map(sanitizeScopeQuestionLanguage));
}

function foldClarificationStyleQuestions(questions: ScopeQuestionEntry[]): ScopeQuestionEntry[] {
  const result: ScopeQuestionEntry[] = [];
  for (const entry of questions) {
    if (!isClarificationStyleScopeQuestion(entry.question)) {
      result.push(entry);
      continue;
    }

    const targetIndex = findClarificationTargetIndex(result, entry.question);
    if (targetIndex < 0) {
      result.push(entry);
      continue;
    }

    const target = result[targetIndex]!;
    const mergedClarification = mergeClarificationPromptText(target.clarification, entry.question);
    result[targetIndex] = {
      ...target,
      clarification: mergedClarification
    };
  }
  return result;
}

function mergeClarificationLikeScopeEntries(
  scopeQuestions: ScopeQuestionEntry[],
  clarificationEntries: Array<{
    question: string;
    clarification: string;
  }>
): boolean {
  if (scopeQuestions.length === 0 || clarificationEntries.length === 0) {
    return false;
  }

  let changed = false;
  for (const entry of clarificationEntries) {
    const targetIndex = findClarificationTargetIndex(
      scopeQuestions,
      `${entry.question} ${entry.clarification}`
    );
    if (targetIndex < 0) {
      continue;
    }

    const target = scopeQuestions[targetIndex]!;
    const questionText = (entry.question ?? "").trim();
    const clarificationText = (entry.clarification ?? "").trim();
    const mergedSource =
      questionText.length > 0 && clarificationText.length > 0
        ? `${questionText}. ${clarificationText}`
        : questionText.length > 0
          ? questionText
          : clarificationText;
    const mergedClarification = mergeClarificationPromptText(
      target.clarification,
      mergedSource
    );
    if (mergedClarification !== target.clarification) {
      scopeQuestions[targetIndex] = {
        ...target,
        clarification: mergedClarification
      };
      changed = true;
    }
  }

  return changed;
}

function reconcilePendingInputsToScopeQuestions(state: ChatState): void {
  if (state.pending_inputs.length === 0 || state.scope_questions.length === 0) {
    return;
  }

  const byNumber = new Set(state.scope_questions.map((entry) => entry.question_number));
  const remapped = state.pending_inputs
    .map((entry) => {
      if (
        typeof entry.question_number === "number" &&
        Number.isFinite(entry.question_number) &&
        byNumber.has(entry.question_number)
      ) {
        return entry;
      }

      const targetIndex = findClarificationTargetIndex(
        state.scope_questions,
        `${entry.prompt ?? ""} ${entry.reason ?? ""}`
      );
      if (targetIndex < 0) {
        return null;
      }

      const targetQuestion = state.scope_questions[targetIndex]!;
      return {
        ...entry,
        question_number: targetQuestion.question_number
      };
    })
    .filter((entry): entry is (typeof state.pending_inputs)[number] => Boolean(entry));

  const deduped = new Map<string, (typeof state.pending_inputs)[number]>();
  for (const entry of remapped) {
    const key = `${entry.input_key}|${entry.question_number ?? "none"}|${entry.prompt}`;
    deduped.set(key, entry);
  }
  state.pending_inputs = Array.from(deduped.values());
}

const SCOPE_QUESTION_ORDINALS = new Map<string, number>([
  ["first", 1],
  ["1st", 1],
  ["second", 2],
  ["2nd", 2],
  ["third", 3],
  ["3rd", 3],
  ["fourth", 4],
  ["4th", 4],
  ["fifth", 5],
  ["5th", 5],
  ["sixth", 6],
  ["6th", 6],
  ["seventh", 7],
  ["7th", 7],
  ["eighth", 8],
  ["8th", 8],
  ["ninth", 9],
  ["9th", 9],
  ["tenth", 10],
  ["10th", 10]
]);

const OPTIONAL_SCOPE_SUGGESTION_REFERENCE_PATTERN =
  /\b(?:suggested|suggestion|optional|extra|additional|add[- ]?on|addon)\b/i;
const OPTIONAL_SCOPE_SUGGESTION_NUMBER_PATTERN = /\b(?:suggestion\s*|s)(\d{1,2})\b/i;

function getScopeSuggestionDisplayQuestionNumber(
  state: Pick<ChatState, "scope_questions">,
  suggestionNumber: number
): number {
  return state.scope_questions.length + suggestionNumber;
}

function getScopeSuggestionDisplayLabel(
  state: Pick<ChatState, "scope_questions">,
  suggestionNumber: number
): string {
  return `Q${getScopeSuggestionDisplayQuestionNumber(state, suggestionNumber)} (suggested)`;
}

function getScopeSuggestionReferenceLabel(
  state: Pick<ChatState, "scope_questions">,
  suggestionNumber: number
): string {
  return `Q${getScopeSuggestionDisplayQuestionNumber(state, suggestionNumber)}`;
}

function buildScopeSuggestionIncludeInstruction(state: Pick<ChatState, "scope_questions" | "scope_suggestions">): string {
  if (state.scope_suggestions.length === 0) {
    return "";
  }

  const labels = state.scope_suggestions.map((entry) =>
    getScopeSuggestionReferenceLabel(state, entry.suggestion_number)
  );
  const joinedLabels =
    labels.length === 1
      ? labels[0]!
      : `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
  return `Say include ${joinedLabels} (or restate the suggestion) if you want one added to scope.`;
}

function findScopeSuggestionNumberByDisplayQuestionNumber(
  state: Pick<ChatState, "scope_questions" | "scope_suggestions">,
  displayQuestionNumber: number
): number | null {
  for (const entry of state.scope_suggestions) {
    if (getScopeSuggestionDisplayQuestionNumber(state, entry.suggestion_number) === displayQuestionNumber) {
      return entry.suggestion_number;
    }
  }

  return null;
}

function mentionsOptionalScopeSuggestion(rawMessage: string): boolean {
  return (
    OPTIONAL_SCOPE_SUGGESTION_REFERENCE_PATTERN.test(rawMessage) ||
    OPTIONAL_SCOPE_SUGGESTION_NUMBER_PATTERN.test(rawMessage)
  );
}

function stripScopeSuggestionDecisionClauses(
  rawMessage: string,
  state?: Pick<ChatState, "scope_questions" | "scope_suggestions">
): string {
  let stripped = rawMessage
    .replace(
      /(?:^|[\n\r]|[;,.]|\band\b)\s*(?:please\s+)?(?:(?:and\s+)?also\s+)?(?:include|add|keep|use|take)\s+(?:the\s+)?(?:(?:suggestion|suggested|optional|extra|additional|add[- ]?on|addon)\s*(?:question|questions|analysis|analyses|ask|asks|item|items)?|s\d{1,2}|suggestion\s*\d{1,2})\b[\s.!?]*/gi,
      " "
    )
    .replace(
      /(?:^|[\n\r]|[;,.]|\band\b)\s*(?:please\s+)?(?:(?:and\s+)?also\s+)?(?:don't|do not|not)\s+(?:add|include|keep|use|want|need)\s+(?:the\s+)?(?:(?:suggestion|suggested|optional|extra|additional|add[- ]?on|addon)\s*(?:question|questions|analysis|analyses|ask|asks|item|items)?|s\d{1,2}|suggestion\s*\d{1,2})\b[\s.!?]*/gi,
      " "
    )
    .replace(
      /(?:^|[\n\r]|[;,.]|\band\b)\s*(?:please\s+)?(?:(?:and\s+)?also\s+)?(?:exclude|remove|drop|delete|skip|omit|cancel|decline|reject|ignore)\s+(?:the\s+)?(?:(?:suggestion|suggested|optional|extra|additional|add[- ]?on|addon)\s*(?:question|questions|analysis|analyses|ask|asks|item|items)?|s\d{1,2}|suggestion\s*\d{1,2})\b[\s.!?]*/gi,
      " "
    );

  if (state && state.scope_suggestions.length > 0) {
    for (const entry of state.scope_suggestions) {
      const displayQuestionNumber = getScopeSuggestionDisplayQuestionNumber(
        state,
        entry.suggestion_number
      );
      const displayToken = `q\\s*${displayQuestionNumber}(?:\\s*\\(\\s*suggested\\s*\\))?`;
      const qPatterns = [
        new RegExp(
          `(?:^|[\\n\\r]|[;,.]|\\band\\b)\\s*(?:please\\s+)?(?:(?:and\\s+)?also\\s+)?(?:include|add|keep|use|take)\\s+${displayToken}\\b[\\s.!?]*`,
          "gi"
        ),
        new RegExp(
          `(?:^|[\\n\\r]|[;,.]|\\band\\b)\\s*(?:please\\s+)?(?:(?:and\\s+)?also\\s+)?(?:don't|do not|not)\\s+(?:add|include|keep|use|want|need)\\s+${displayToken}\\b[\\s.!?]*`,
          "gi"
        ),
        new RegExp(
          `(?:^|[\\n\\r]|[;,.]|\\band\\b)\\s*(?:please\\s+)?(?:(?:and\\s+)?also\\s+)?(?:exclude|remove|drop|delete|skip|omit|cancel|decline|reject|ignore)\\s+${displayToken}\\b[\\s.!?]*`,
          "gi"
        )
      ];
      for (const pattern of qPatterns) {
        stripped = stripped.replace(pattern, " ");
      }
    }
  }

  return stripped
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

function dedupePendingInputs(
  entries: ChatState["pending_inputs"]
): ChatState["pending_inputs"] {
  const deduped = new Map<string, ChatState["pending_inputs"][number]>();
  for (const entry of entries) {
    const key = `${entry.input_key}|${entry.question_number ?? "none"}|${entry.prompt}`;
    deduped.set(key, entry);
  }
  return Array.from(deduped.values());
}

function findScopeSuggestionNumberByDescriptor(
  state: ChatState,
  descriptor: string
): number | null {
  const descriptorTokens = tokenizeForSimilarity(descriptor).filter(
    (token) =>
      !SCOPE_DEDUP_STOP_WORDS.has(token) &&
      ![
        "include",
        "included",
        "add",
        "added",
        "keep",
        "kept",
        "use",
        "using",
        "suggested",
        "suggestion",
        "optional",
        "extra",
        "analysis",
        "question"
      ].includes(token)
  );
  if (descriptorTokens.length === 0) {
    return null;
  }

  let bestSuggestionNumber: number | null = null;
  let bestScore = 0;
  for (const entry of state.scope_suggestions) {
    const candidateTokens = new Set(
      tokenizeForSimilarity(`${entry.question} ${entry.reason}`)
    );
    let score = 0;
    for (const token of descriptorTokens) {
      if (candidateTokens.has(token)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSuggestionNumber = entry.suggestion_number;
    }
  }

  if (bestSuggestionNumber === null) {
    return null;
  }

  if (bestScore >= Math.min(2, descriptorTokens.length)) {
    return bestSuggestionNumber;
  }

  if (descriptorTokens.length === 1 && bestScore === 1 && descriptorTokens[0]!.length >= 5) {
    return bestSuggestionNumber;
  }

  return null;
}

function parseScopeSuggestionNumbersToInclude(
  state: ChatState,
  rawMessage: string
): number[] {
  if (state.scope_suggestions.length === 0) {
    return [];
  }
  if (declinesSuggestedScopeItems(rawMessage)) {
    return [];
  }

  const lower = rawMessage.toLowerCase();
  const hasIncludeVerb = /\b(include|add|keep|use|take)\b/.test(lower);
  const matches = new Set<number>();

  const explicitIdPatterns = [
    /\b(?:include|add|keep|use|take)\b[\s:,-]*(?:the\s+)?(?:suggestion|suggested|optional|extra)\s*(\d{1,2})\b/gi,
    /\b(?:include|add|keep|use|take)\b[\s:,-]*(?:the\s+)?(?:add[- ]?on|addon)\s*(\d{1,2})\b/gi,
    /\b(?:include|add|keep|use|take)\b[\s:,-]*s\s*(\d{1,2})\b/gi
  ];
  for (const pattern of explicitIdPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(rawMessage);
    while (match !== null) {
      const suggestionNumber = Number.parseInt(match[1] ?? "", 10);
      if (Number.isInteger(suggestionNumber) && suggestionNumber > 0) {
        matches.add(suggestionNumber);
      }
      match = pattern.exec(rawMessage);
    }
  }

  const explicitQuestionPatterns = [
    /\b(?:include|add|keep|use|take)\b[\s:,-]*q\s*(\d{1,2})(?:\s*\(\s*suggested\s*\))?\b/gi
  ];
  for (const pattern of explicitQuestionPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(rawMessage);
    while (match !== null) {
      const displayQuestionNumber = Number.parseInt(match[1] ?? "", 10);
      if (Number.isInteger(displayQuestionNumber) && displayQuestionNumber > 0) {
        const suggestionNumber = findScopeSuggestionNumberByDisplayQuestionNumber(
          state,
          displayQuestionNumber
        );
        if (suggestionNumber !== null) {
          matches.add(suggestionNumber);
        }
      }
      match = pattern.exec(rawMessage);
    }
  }

  const hasIncludeIntent =
    hasIncludeVerb &&
    (mentionsOptionalScopeSuggestion(rawMessage) || matches.size > 0);

  if (hasIncludeIntent) {
    const descriptorPatterns = [
      /\b(?:include|add|keep|use|take)\b[\s:,-]*(?:the\s+)?(?:suggested|suggestion|optional|extra|additional|add[- ]?on|addon)\s+(?:analysis|question|cut|breakdown)?\s*(?:about|for|on)?\s+([^.;\n]+)/i,
      /\b(?:include|add|keep|use|take)\b[\s:,-]*(?:the\s+)?([^.;\n]+?)\s+(?:suggested|suggestion|optional|extra|additional|add[- ]?on|addon)\b/i
    ];
    for (const pattern of descriptorPatterns) {
      const match = rawMessage.match(pattern);
      if (!match) {
        continue;
      }
      const suggestionNumber = findScopeSuggestionNumberByDescriptor(state, match[1] ?? "");
      if (suggestionNumber !== null) {
        matches.add(suggestionNumber);
      }
    }

    if (matches.size === 0 && state.scope_suggestions.length === 1) {
      matches.add(state.scope_suggestions[0]!.suggestion_number);
    }
  }

  const existingSuggestionNumbers = new Set(
    state.scope_suggestions.map((entry) => entry.suggestion_number)
  );
  return Array.from(matches.values())
    .filter((suggestionNumber) => existingSuggestionNumbers.has(suggestionNumber))
    .sort((left, right) => left - right);
}

function parseScopeSuggestionNumbersToDecline(
  state: ChatState,
  rawMessage: string
): number[] {
  if (state.scope_suggestions.length === 0) {
    return [];
  }

  const lower = rawMessage.toLowerCase();
  const hasDeclineVerb =
    /\b(?:don't|do not|not)\s+(?:add|include|keep|use|want|need)\b/.test(lower) ||
    /\b(?:exclude|remove|drop|delete|skip|omit|cancel|decline|reject|ignore)\b/.test(lower);
  if (!hasDeclineVerb) {
    return [];
  }

  const matches = new Set<number>();
  const explicitQuestionPatterns = [
    /\b(?:don't|do not|not)\s+(?:add|include|keep|use|want|need)\s+q\s*(\d{1,2})(?:\s*\(\s*suggested\s*\))?\b/gi,
    /\b(?:exclude|remove|drop|delete|skip|omit|cancel|decline|reject|ignore)\s+q\s*(\d{1,2})(?:\s*\(\s*suggested\s*\))?\b/gi
  ];
  for (const pattern of explicitQuestionPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(rawMessage);
    while (match !== null) {
      const displayQuestionNumber = Number.parseInt(match[1] ?? "", 10);
      if (Number.isInteger(displayQuestionNumber) && displayQuestionNumber > 0) {
        const suggestionNumber = findScopeSuggestionNumberByDisplayQuestionNumber(
          state,
          displayQuestionNumber
        );
        if (suggestionNumber !== null) {
          matches.add(suggestionNumber);
        }
      }
      match = pattern.exec(rawMessage);
    }
  }

  return Array.from(matches.values()).sort((left, right) => left - right);
}

function appendIncludedScopeSuggestionsToState(
  state: ChatState,
  suggestionNumbers: number[]
): number {
  if (suggestionNumbers.length === 0 || state.scope_suggestions.length === 0) {
    return 0;
  }

  const suggestionSet = new Set(suggestionNumbers);
  const suggestionsToInclude = state.scope_suggestions.filter((entry) =>
    suggestionSet.has(entry.suggestion_number)
  );
  if (suggestionsToInclude.length === 0) {
    return 0;
  }

  const appendedQuestions = suggestionsToInclude.map((entry, index) =>
    sanitizeScopeQuestionLanguage({
      question_number: state.scope_questions.length + index + 1,
      question: entry.question,
      clarification: buildClarificationForScopeQuestion(entry.question),
      answer: null,
      metric_key: null,
      metric_display_name: null,
      metric_definition_draft: null,
      metric_source_columns: []
    })
  );

  const normalizedQuestions = renumberScopeQuestions(
    removeDuplicateScopeQuestions([...state.scope_questions, ...appendedQuestions]).map(
      sanitizeScopeQuestionLanguage
    )
  );
  const appendedCount = normalizedQuestions.length - state.scope_questions.length;
  state.scope_questions = normalizedQuestions;
  state.scope_suggestions = renumberScopeSuggestions(
    state.scope_suggestions.filter((entry) => !suggestionSet.has(entry.suggestion_number))
  );
  state.scope_finalized = false;
  pruneScopeSuggestionsAgainstScopeQuestions(state);
  syncQuestionRegistryFromScope(state);
  return Math.max(0, appendedCount);
}

function findScopeQuestionNumberByDescriptor(
  state: ChatState,
  descriptor: string
): number | null {
  const descriptorTokens = tokenizeForSimilarity(descriptor).filter(
    (token) =>
      !SCOPE_DEDUP_STOP_WORDS.has(token) &&
      ![
        "remove",
        "removed",
        "exclude",
        "excluded",
        "drop",
        "dropped",
        "delete",
        "deleted",
        "skip",
        "skipped",
        "omit",
        "omitted",
        "cancel",
        "cancelled",
        "canceled",
        "scope",
        "question",
        "questions",
        "ask",
        "analysis",
        "item"
      ].includes(token)
  );
  if (descriptorTokens.length === 0) {
    return null;
  }

  let bestQuestionNumber: number | null = null;
  let bestScore = 0;
  for (const entry of state.scope_questions) {
    const candidateTokens = new Set(
      tokenizeForSimilarity(`${entry.question} ${entry.clarification}`)
    );
    let score = 0;
    for (const token of descriptorTokens) {
      if (candidateTokens.has(token)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestQuestionNumber = entry.question_number;
    }
  }

  if (bestQuestionNumber === null) {
    return null;
  }

  if (bestScore >= Math.min(2, descriptorTokens.length)) {
    return bestQuestionNumber;
  }

  if (descriptorTokens.length === 1 && bestScore === 1 && descriptorTokens[0]!.length >= 5) {
    return bestQuestionNumber;
  }

  return null;
}

function parseScopeQuestionNumbersToRemove(
  state: ChatState,
  rawMessage: string
): number[] {
  if (state.scope_questions.length === 0) {
    return [];
  }

  if (!hasExplicitScopeRemovalIntent(rawMessage)) {
    return [];
  }

  const matches = new Set<number>();
  const explicitIdPatterns = [
    /\b(?:exclude|remove|drop|delete|skip|omit|cancel|(?:do not|don't)\s+include)\b[\s:,-]*(?:the\s+)?(?:(?:questions?|qs?)\s*|q\s*)\s*((?:q?\s*\d{1,2}\s*(?:,|\band\b)?\s*){1,6})/gi,
    /\b(?:i\s+)?(?:do not|don't)\s+(?:want|need)\b[\s:,-]*(?:the\s+)?(?:(?:questions?|qs?)\s*|q\s*)\s*((?:q?\s*\d{1,2}\s*(?:,|\band\b)?\s*){1,6})/gi,
    /\b(?:no need for|not interested in)\b[\s:,-]*(?:the\s+)?(?:(?:questions?|qs?)\s*|q\s*)\s*((?:q?\s*\d{1,2}\s*(?:,|\band\b)?\s*){1,6})/gi,
    /\b(?:q(?:uestion)?\s*(\d{1,2}))\b[\s\S]{0,32}\b(?:excluded|removed|dropped|deleted|skipped|omitted|cancelled|canceled)\b/gi
  ];

  for (const pattern of explicitIdPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(rawMessage);
    while (match !== null) {
      const candidateText = match[1] ?? "";
      const numbers = candidateText.match(/\d{1,2}/g) ?? [];
      for (const rawNumber of numbers) {
        const questionNumber = Number.parseInt(rawNumber, 10);
        if (Number.isInteger(questionNumber) && questionNumber > 0) {
          matches.add(questionNumber);
        }
      }
      match = pattern.exec(rawMessage);
    }
  }

  for (const [ordinal, questionNumber] of SCOPE_QUESTION_ORDINALS.entries()) {
    const ordinalPattern = new RegExp(
      `\\b(?:exclude|remove|drop|delete|skip|omit|cancel|(?:do not|don't)\\s+include|(?:do not|don't)\\s+(?:want|need)|no need for|not interested in)\\b[\\s:,-]*(?:the\\s+)?${ordinal}\\s+question\\b`,
      "i"
    );
    if (ordinalPattern.test(rawMessage)) {
      matches.add(questionNumber);
    }
  }

  const descriptorPatterns = [
    /\b(?:exclude|remove|drop|delete|skip|omit|cancel|(?:do not|don't)\s+include)\b[\s:,-]*(?:the\s+)?(?:question|ask|analysis|scope item)\s+(?:about|on|for)?\s+([^.;\n]+)/i,
    /\b(?:the\s+)?(?:question|ask|analysis|scope item)\s+(?:about|on|for)\s+([^.;\n]+?)\s+(?:should be|to be)?\s*(?:excluded|removed|dropped|deleted|skipped|omitted|cancelled|canceled)\b/i
  ];
  for (const pattern of descriptorPatterns) {
    const match = rawMessage.match(pattern);
    if (!match) {
      continue;
    }
    const questionNumber = findScopeQuestionNumberByDescriptor(state, match[1] ?? "");
    if (questionNumber !== null) {
      matches.add(questionNumber);
    }
  }

  const existingQuestionNumbers = new Set(state.scope_questions.map((entry) => entry.question_number));
  return Array.from(matches.values())
    .filter((questionNumber) => existingQuestionNumbers.has(questionNumber))
    .sort((left, right) => left - right);
}

function hasExplicitScopeRemovalIntent(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase();
  return (
    /\b(exclude|remove|drop|delete|skip|omit|cancel)\b/.test(lower) ||
    /\b(?:do not|don't)\s+include\b/.test(lower) ||
    /\b(?:do not|don't)\s+(?:want|need)\b/.test(lower) ||
    /\b(?:no need for|not interested in)\b/.test(lower)
  );
}

function declinesSuggestedScopeItems(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase();
  const mentionsSuggested =
    mentionsOptionalScopeSuggestion(rawMessage) &&
    (
      /\b(question|questions|analysis|analyses|ask|asks|item|items)\b/.test(lower) ||
      OPTIONAL_SCOPE_SUGGESTION_NUMBER_PATTERN.test(rawMessage)
    );
  if (!mentionsSuggested) {
    return false;
  }

  return (
    /\b(?:don't|do not|not)\s+(?:add|include|keep|use|want|need)\b/.test(lower) ||
    /\b(?:exclude|remove|drop|delete|skip|omit|cancel|decline|reject|ignore)\b/.test(lower)
  );
}

function parseSuggestedScopeQuestionNumbersToRemove(
  state: ChatState,
  rawMessage: string
): number[] {
  if (!declinesSuggestedScopeItems(rawMessage)) {
    return [];
  }

  return state.scope_questions
    .filter((entry) => /^\s*\[suggested\]/i.test(entry.question))
    .map((entry) => entry.question_number)
    .sort((left, right) => left - right);
}

function removeScopeQuestionsFromState(
  state: ChatState,
  questionNumbers: number[]
): number {
  if (questionNumbers.length === 0 || state.scope_questions.length === 0) {
    return 0;
  }

  const removalSet = new Set(questionNumbers);
  const retained = state.scope_questions.filter(
    (entry) => !removalSet.has(entry.question_number)
  );
  if (retained.length === state.scope_questions.length) {
    return 0;
  }

  const oldToNewQuestionNumbers = new Map<number, number>();
  retained.forEach((entry, index) => {
    oldToNewQuestionNumbers.set(entry.question_number, index + 1);
  });

  state.scope_questions = retained.map((entry, index) => ({
    ...entry,
    question_number: index + 1
  }));
  state.pending_inputs = dedupePendingInputs(
    state.pending_inputs.flatMap((entry) => {
      if (typeof entry.question_number !== "number") {
        return [entry];
      }
      const mappedQuestionNumber = oldToNewQuestionNumbers.get(entry.question_number);
      if (!mappedQuestionNumber) {
        return [];
      }
      return [
        {
          ...entry,
          question_number: mappedQuestionNumber
        }
      ];
    })
  );
  state.question_registry = [];
  syncQuestionRegistryFromScope(state);
  return removalSet.size;
}

function isClarificationStyleScopeQuestion(question: string): boolean {
  const lower = question.toLowerCase().replace(/[?!.]+$/g, "").trim();
  if (lower.length === 0) {
    return false;
  }

  // Keep core analytical "how many <business event>" asks as questions.
  if (
    /\bhow many\b/.test(lower) &&
    /\b(order|orders|ticket|tickets|refund|refunds|issue|issues|city|cities|product|products|category|categories)\b/.test(
      lower
    ) &&
    !/\bshould\b/.test(lower) &&
    !/\bprefer\b/.test(lower) &&
    !/\bconfirm\b/.test(lower)
  ) {
    return false;
  }

  if (/\bhow many\b[\s\S]{0,80}\bshould\b[\s\S]{0,40}\b(?:be\s+)?shown\b/.test(lower)) {
    return true;
  }

  if (
    /^(confirm|should we|do you want|would you|can you confirm|do we|should i|do you prefer)\b/.test(lower) ||
    /\bwould you prefer\b/.test(lower) ||
    /\bhappy to show\b/.test(lower)
  ) {
    return true;
  }

  if (
    /\b(which statuses count|which status should|date column should|which date column|include partial|exclude partial|ranking cutoff|top\s*\d+|display cutoff|threshold)\b/.test(
      lower
    )
  ) {
    return true;
  }

  if (
    /^(which|what)\b/.test(lower) &&
    /\b(show|shown|display|include|exclude|anchor|window|period|column|join key|scope)\b/.test(lower)
  ) {
    return true;
  }

  return false;
}

function findClarificationTargetIndex(entries: ScopeQuestionEntry[], clarificationQuestion: string): number {
  if (entries.length === 0) {
    return -1;
  }

  const clarificationTokens = tokenizeForSimilarity(clarificationQuestion).filter(
    (token) =>
      !SCOPE_DEDUP_STOP_WORDS.has(token) &&
      !["show", "shown", "include", "exclude", "confirm", "should", "would", "which", "what", "how"].includes(token)
  );

  let bestIndex = -1;
  let bestScore = -1;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const candidate = entries[index]!;
    const candidateTokens = tokenizeForSimilarity(`${candidate.question} ${candidate.clarification}`);
    const score = clarificationTokens.reduce(
      (acc, token) => acc + (candidateTokens.includes(token) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (bestScore <= 0) {
    return entries.length - 1;
  }
  return bestIndex;
}

function mergeClarificationPromptText(base: string, extraQuestion: string): string {
  const normalizedExtra = extraQuestion.replace(/[?!.]+$/g, "").trim();
  if (normalizedExtra.length === 0) {
    return base;
  }
  if (base.toLowerCase().includes(normalizedExtra.toLowerCase())) {
    return base;
  }
  const prefix = base.trim().endsWith(".") ? base.trim() : `${base.trim()}.`;
  return `${prefix} Also clarify: ${normalizedExtra}.`;
}

function deriveClarificationForQuestion(question: string): string {
  const text = question.toLowerCase();

  if (/\b(refund|refunded)\b/.test(text) && /\b(rate|ratio|percent|percentage)\b/.test(text)) {
    return "Confirm refund-rate formula (count-based vs value-based), scope window, and ranking cutoff.";
  }

  if (/\b(compare|comparison|vs|versus|prior|previous)\b/.test(text)) {
    return "Confirm exact period A vs period B windows and whether to show absolute delta, percentage delta, or both.";
  }

  if (/\b(support|ticket|issue|reason)\b/.test(text)) {
    return "Confirm join keys, ticket inclusion rules, and ranking method for top issues.";
  }

  if (/\b(trend|month|months|week|weeks|quarter|quarters)\b/.test(text)) {
    return "Confirm date anchor, date column, and reporting granularity for the trend.";
  }

  return "Confirm final filters, timeframe, and grouping before data preparation.";
}

/**
 * Try to detect if a question contains multiple distinct analytical asks joined by
 * connectors like "+", "and", "as well as", "also".  Only split when each part
 * contains a recognizable analytical keyword (trend, compare, breakdown, rank, etc.).
 */
function trySplitCompoundQuestion(question: string): string[] {
  const normalizedQuestion = question
    .replace(/^\s*q\s*\d+\s*(?:\+|\/|&|and)\s*q?\s*\d+\s*(?:[-:]\s*)?/i, "")
    .replace(/^\s*q\s*\d+\s*(?:[-:]\s*)?/i, "")
    .trim();

  // Force split for common "support ticket count + top issue type/reason" compound asks.
  const supportTopIssueMatch = normalizedQuestion.match(
    /^(.*?\b(?:support|ticket|tickets)\b[\s\S]*?)\s*(?:\+|,\s*and|and)\s*(.*?\b(?:top|issue|issues|reason|reasons)\b[\s\S]*)$/i
  );
  if (supportTopIssueMatch) {
    const left = supportTopIssueMatch[1]!.trim();
    const right = supportTopIssueMatch[2]!.trim();
    const leftHasCountIntent = /\b(count|volume|how many|number of)\b/i.test(left);
    const rightHasTopIntent = /\b(top|rank|highest|dominant|issue|reason)\b/i.test(right);
    if (left.length >= 12 && right.length >= 10 && (leftHasCountIntent || rightHasTopIntent)) {
      const normalizePart = (value: string) => {
        const trimmed = value.replace(/[.?!]+$/, "").trim();
        if (trimmed.length === 0) {
          return "";
        }
        return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}?`;
      };
      const parts = [normalizePart(left), normalizePart(right)].filter((part) => part.length > 0);
      if (parts.length >= 2) {
        return parts;
      }
    }
  }

  // Patterns that indicate distinct analytical asks
  const analyticalKeywords =
    /\b(trend|compare|comparison|vs|versus|breakdown|rank|top|highest|lowest|rate|ratio|correlation|distribution|count|amount|value|ticket|issue|city|product|revenue|refund)\b/i;
  const isAnalyticalSegment = (value: string): boolean => {
    const trimmed = value.trim();
    if (trimmed.length < 12) {
      return false;
    }
    if (isClarificationStyleScopeQuestion(trimmed)) {
      return false;
    }
    return analyticalKeywords.test(trimmed) || /^(?:what|which|how|for)\b/i.test(trimmed);
  };

  // Try splitting on " + ", " and also ", " as well as ", "; also "
  const splitters = [
    /\s*\+\s*/,
    /\s*;\s*(?:also\s+)?/,
    /,\s*and\s+also\s+/i,
    /,\s*as well as\s+/i,
    /\s*,?\s+and\s+(?=what\b|which\b|how\b|for\b|tell\b|show\b)/i
  ];

  for (const splitter of splitters) {
    const parts = normalizedQuestion.split(splitter).map((p) => p.trim()).filter((p) => p.length > 10);
    if (parts.length >= 2 && parts.every((p) => isAnalyticalSegment(p))) {
      return parts.map((p) => {
        // Ensure each part ends with ?
        const trimmed = p.replace(/[.?!]+$/, "").trim();
        return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}?`;
      });
    }
  }

  const explicitCompoundMatch = normalizedQuestion.match(
    /^(.*?)(?:,\s*|\s+)and\s+(what\s+(?:are|is|was|were)\b[\s\S]+)$/i
  );
  if (explicitCompoundMatch) {
    const first = explicitCompoundMatch[1].trim();
    const second = explicitCompoundMatch[2].trim();
    if (isAnalyticalSegment(first) && isAnalyticalSegment(second)) {
      return [first, second].map((p) => {
        const trimmed = p.replace(/[.?!]+$/, "").trim();
        return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}?`;
      });
    }
  }

  // Try splitting on " and " but only when both halves have analytical keywords,
  // the split occurs outside parentheses, and the RHS starts a new clause.
  // This avoids bad splits like:
  // "refund count and refunded revenue per month" -> two broken questions.
  if (normalizedQuestion.length > 40) {
    const andParts = splitOnAndOutsideParentheses(normalizedQuestion).map((p) => p.trim()).filter((p) => p.length > 15);
    if (andParts.length === 2 && andParts.every((p) => isAnalyticalSegment(p))) {
      const [, right] = andParts;
      const rightStartsClause = /^(?:what|which|how|for|compare|comparison|show|list|rank|identify|find|analy[sz]e|break(?:\s+down)?|tell|top|highest|lowest|city|cities|support|ticket|tickets|issue|issues|reason|reasons|product|products|category|categories|trend)\b/i.test(
        right
      );
      if (!rightStartsClause) {
        return [normalizedQuestion];
      }
      return andParts.map((p) => {
        const trimmed = p.replace(/[.?!]+$/, "").trim();
        return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}?`;
      });
    }
  }

  return [normalizedQuestion];
}

function splitOnAndOutsideParentheses(value: string): string[] {
  const lowered = value.toLowerCase();
  let depth = 0;
  const parts: string[] = [];
  let lastIndex = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")" && depth > 0) {
      depth -= 1;
      continue;
    }

    if (depth !== 0) {
      continue;
    }

    if (lowered.startsWith(" and ", i)) {
      parts.push(value.slice(lastIndex, i).trim());
      lastIndex = i + 5;
      i += 4;
    }
  }

  if (parts.length === 0) {
    return [value];
  }

  parts.push(value.slice(lastIndex).trim());
  return parts.filter((part) => part.length > 0);
}

function renumberScopeQuestions(
  questions: Array<{
    question_number: number;
    question: string;
    clarification: string;
    answer: string | null;
    metric_key: string | null;
    metric_display_name: string | null;
    metric_definition_draft: string | null;
    metric_source_columns: string[];
  }>
): Array<{
  question_number: number;
  question: string;
  clarification: string;
  answer: string | null;
  metric_key: string | null;
  metric_display_name: string | null;
  metric_definition_draft: string | null;
  metric_source_columns: string[];
}> {
  return questions.map((entry, index) => ({
    ...entry,
    question_number: index + 1
  }));
}

function removeDuplicateScopeQuestions(
  questions: Array<{
    question_number: number;
    question: string;
    clarification: string;
    answer: string | null;
    metric_key: string | null;
    metric_display_name: string | null;
    metric_definition_draft: string | null;
    metric_source_columns: string[];
  }>
): Array<{
  question_number: number;
  question: string;
  clarification: string;
  answer: string | null;
  metric_key: string | null;
  metric_display_name: string | null;
  metric_definition_draft: string | null;
  metric_source_columns: string[];
}> {
  const kept: Array<{
    question_number: number;
    question: string;
    clarification: string;
    answer: string | null;
    metric_key: string | null;
    metric_display_name: string | null;
    metric_definition_draft: string | null;
    metric_source_columns: string[];
  }> = [];

  for (const question of questions) {
    const duplicate = kept.some((existing) => areScopeQuestionsEquivalent(existing, question));
    if (duplicate) {
      continue;
    }
    kept.push(question);
  }

  return kept;
}

function renumberScopeSuggestions(
  suggestions: ScopeSuggestionEntry[]
): ScopeSuggestionEntry[] {
  return suggestions.map((entry, index) => ({
    ...entry,
    suggestion_number: index + 1
  }));
}

function removeDuplicateScopeSuggestions(
  suggestions: ScopeSuggestionEntry[],
  scopeQuestions: ScopeQuestionEntry[]
): ScopeSuggestionEntry[] {
  const kept: ScopeSuggestionEntry[] = [];
  for (const suggestion of suggestions) {
    const duplicateInScope = scopeQuestions.some(
      (entry) =>
        areScopeQuestionTextsSimilar(entry.question, suggestion.question) &&
        !suggestionAddsDistinctAnalyticalFocus(entry.question, suggestion.question)
    );
    if (duplicateInScope) {
      continue;
    }
    const duplicateSuggestion = kept.some(
      (entry) =>
        areScopeQuestionTextsSimilar(entry.question, suggestion.question) &&
        !suggestionAddsDistinctAnalyticalFocus(entry.question, suggestion.question)
    );
    if (duplicateSuggestion) {
      continue;
    }
    kept.push(suggestion);
  }
  return renumberScopeSuggestions(kept);
}

function pruneScopeSuggestionsAgainstScopeQuestions(state: ChatState): void {
  if (state.scope_suggestions.length === 0) {
    return;
  }
  state.scope_suggestions = removeDuplicateScopeSuggestions(
    state.scope_suggestions,
    state.scope_questions
  );
}

/**
 * Build up to 2 optional suggested analyses based on the confirmed core scope.
 * Suggestions are advisory only and must not enter the real scope until the user includes them.
 */
function buildSuggestedScopeQuestions(
  coreQuestions: ScopeQuestionEntry[]
): ScopeSuggestionEntry[] {
  const suggestions: ScopeSuggestionEntry[] = [];
  const coreText = coreQuestions.map((q) => q.question.toLowerCase()).join(" ");

  const hasTrend = /\b(trend|monthly|weekly|over time|timeline)\b/.test(coreText);
  const hasComparison = /\b(vs|versus|compare|comparison|prior|previous)\b/.test(coreText);
  const hasRefund = /\b(refund|refunded|return|cancel)\b/.test(coreText);
  const hasRevenue = /\b(revenue|sales|gmv|gross)\b/.test(coreText);
  const hasTopN = /\b(top|highest|lowest|rank|ranking)\b/.test(coreText);
  const hasGeo = /\b(city|cities|region|state|country|location)\b/.test(coreText);
  const hasProduct = /\b(product|category|sku|item)\b/.test(coreText);
  const hasSupport = /\b(support|ticket|issue|complaint)\b/.test(coreText);
  const hasResolutionTime = /\b(resolution|resolve|resolved|turnaround|sla|hours)\b/.test(coreText);

  // Suggest a comparison if they only asked for a trend
  if (hasTrend && !hasComparison) {
    suggestions.push({
      suggestion_number: 0,
      question: "How does the most recent period compare to the prior equivalent period (percentage and absolute change)?",
      reason: "A period-over-period view gives context to the trend direction instead of leaving it as a raw time series."
    });
  }

  // Suggest a breakdown if they have a trend/comparison but no dimension split
  if ((hasTrend || hasComparison) && !hasTopN && !hasGeo && !hasProduct) {
    const dimension = hasRefund
      ? "refund reason or product category"
      : hasRevenue
        ? "product category or region"
        : "key dimension (e.g., category, region, or channel)";
    suggestions.push({
      suggestion_number: 0,
      question: `What is the breakdown by ${dimension} for the analyzed metric?`,
      reason: "A dimensional breakdown usually shows which segments are driving the overall movement."
    });
  }

  // Suggest support ticket correlation for refund analyses
  if (hasRefund && !hasSupport) {
    suggestions.push({
      suggestion_number: 0,
      question: "What are the top support ticket reasons linked to refunded orders?",
      reason: "Support-ticket linkage often reveals root causes behind the refund pattern."
    });
  }

  // Suggest operational-effort analysis when the scope already includes refund-linked
  // support activity but does not yet cover how hard those issues are to resolve.
  if (hasRefund && hasSupport && !hasResolutionTime) {
    suggestions.push({
      suggestion_number: 0,
      question:
        "What is the average support ticket resolution time for tickets linked to refunded orders, broken down by issue type?",
      reason:
        "Resolution-time analysis shows whether refund-linked issues are operationally expensive or getting harder to close."
    });
  }

  return removeDuplicateScopeSuggestions(suggestions.slice(0, 2), coreQuestions);
}

function areScopeQuestionsEquivalent(
  left: {
    question: string;
    clarification: string;
    metric_key: string | null;
  },
  right: {
    question: string;
    clarification: string;
    metric_key: string | null;
  }
): boolean {
  const leftText = normalizeSimilarityText(`${left.question} ${left.clarification}`);
  const rightText = normalizeSimilarityText(`${right.question} ${right.clarification}`);
  const leftQuestionText = normalizeSimilarityText(left.question);
  const rightQuestionText = normalizeSimilarityText(right.question);
  if (leftText.length === 0 || rightText.length === 0) {
    return false;
  }
  if (leftText === rightText) {
    return true;
  }

  // Never dedupe distinct support intents: ticket-volume/count vs top issue/reason ranking.
  // Use question text (not clarification text), because clarification templates can
  // share vocabulary and otherwise cause distinct split questions to collapse.
  const leftHasSupportTicket = /\b(support|ticket|tickets)\b/.test(leftQuestionText);
  const rightHasSupportTicket = /\b(support|ticket|tickets)\b/.test(rightQuestionText);
  const leftHasIssueReason = /\b(issue|issues|reason|reasons)\b/.test(leftQuestionText);
  const rightHasIssueReason = /\b(issue|issues|reason|reasons)\b/.test(rightQuestionText);
  const leftIssueRankingIntent =
    leftHasIssueReason && /\b(top|rank|highest|dominant|breakdown)\b/.test(leftQuestionText);
  const rightIssueRankingIntent =
    rightHasIssueReason && /\b(top|rank|highest|dominant|breakdown)\b/.test(rightQuestionText);
  const leftTicketVolumeIntent = leftHasSupportTicket && !leftHasIssueReason;
  const rightTicketVolumeIntent = rightHasSupportTicket && !rightHasIssueReason;
  if (
    (leftTicketVolumeIntent && rightIssueRankingIntent) ||
    (rightTicketVolumeIntent && leftIssueRankingIntent)
  ) {
    return false;
  }

  const leftCountSupportIntent =
    /\b(support|ticket|tickets)\b/.test(leftText) &&
    /\b(count|volume|how many|number)\b/.test(leftText);
  const rightCountSupportIntent =
    /\b(support|ticket|tickets)\b/.test(rightText) &&
    /\b(count|volume|how many|number)\b/.test(rightText);
  const leftTopIssueIntent =
    /\b(issue|issues|reason|reasons)\b/.test(leftText) &&
    /\b(top|rank|highest|dominant|breakdown)\b/.test(leftText);
  const rightTopIssueIntent =
    /\b(issue|issues|reason|reasons)\b/.test(rightText) &&
    /\b(top|rank|highest|dominant|breakdown)\b/.test(rightText);
  if ((leftCountSupportIntent && rightTopIssueIntent) || (rightCountSupportIntent && leftTopIssueIntent)) {
    return false;
  }

  if ((leftText.includes(rightText) || rightText.includes(leftText)) && Math.min(leftText.length, rightText.length) > 40) {
    return true;
  }

  const leftTokens = tokenizeForSimilarity(leftText);
  const rightTokens = tokenizeForSimilarity(rightText);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  if (hasDistinctQuestionFocus(leftTokens, rightTokens)) {
    return false;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }
  const union = leftSet.size + rightSet.size - intersection;
  if (union === 0) {
    return false;
  }
  const jaccard = intersection / union;
  if (jaccard >= 0.72 && intersection >= 5) {
    return true;
  }

  const smallerSetSize = Math.max(1, Math.min(leftSet.size, rightSet.size));
  const overlapCoefficient = intersection / smallerSetSize;
  if (overlapCoefficient >= 0.8 && intersection >= 3) {
    return true;
  }

  // Catch vague short questions that are subsets of more specific ones.
  // E.g. "What are the top cities?" is a vague subset of
  //      "Which cities have the highest refund rate over the past 4 months?"
  const leftQTokens = tokenizeForSimilarity(left.question);
  const rightQTokens = tokenizeForSimilarity(right.question);
  const leftQFiltered = leftQTokens.filter((t) => !SCOPE_DEDUP_STOP_WORDS.has(t));
  const rightQFiltered = rightQTokens.filter((t) => !SCOPE_DEDUP_STOP_WORDS.has(t));
  if (leftQFiltered.length > 0 && rightQFiltered.length > 0) {
    const shorter = leftQFiltered.length <= rightQFiltered.length ? leftQFiltered : rightQFiltered;
    const longerSet = new Set(leftQFiltered.length > rightQFiltered.length ? leftQFiltered : rightQFiltered);
    // If the shorter question is very vague (<=4 meaningful tokens) and all its tokens appear in the longer one
    if (shorter.length <= 4) {
      const allContained = shorter.every((t) => longerSet.has(t));
      if (allContained && shorter.length >= 1) {
        return true;
      }
    }
  }

  const leftQuestionTokens = tokenizeForSimilarity(left.question).filter(
    (token) => !isGenericScopeToken(token)
  );
  const rightQuestionTokens = tokenizeForSimilarity(right.question).filter(
    (token) => !isGenericScopeToken(token)
  );
  if (leftQuestionTokens.length === 0 || rightQuestionTokens.length === 0) {
    return false;
  }

  const leftQuestionSet = new Set(leftQuestionTokens);
  const rightQuestionSet = new Set(rightQuestionTokens);
  let questionIntersection = 0;
  for (const token of leftQuestionSet) {
    if (rightQuestionSet.has(token)) {
      questionIntersection += 1;
    }
  }
  const minQuestionSize = Math.max(1, Math.min(leftQuestionSet.size, rightQuestionSet.size));
  const questionOverlap = questionIntersection / minQuestionSize;
  return questionOverlap >= 0.8 && questionIntersection >= 2;
}

function hasDistinctQuestionFocus(leftTokens: string[], rightTokens: string[]): boolean {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  const focusGroups: string[][] = [
    ["city", "cities", "region", "regions", "state", "states", "country", "countries"],
    ["product", "products", "category", "categories", "sku", "item", "items"],
    ["issue", "issues", "reason", "reasons", "support", "ticket", "tickets"],
    ["resolution", "resolved", "pending", "closed", "open", "status", "priority", "sla"],
    ["trend", "month", "months", "week", "weeks", "quarter", "quarters", "timeline", "period", "window"],
    ["compare", "comparison", "vs", "versus", "delta", "change", "changed", "growth"]
  ];

  let mismatchedGroups = 0;
  for (const group of focusGroups) {
    const leftHas = group.some((token) => left.has(token));
    const rightHas = group.some((token) => right.has(token));
    if (leftHas !== rightHas) {
      mismatchedGroups += 1;
    }
  }

  return mismatchedGroups >= 1;
}

function sanitizeScopeQuestionLanguage(entry: {
  question_number: number;
  question: string;
  clarification: string;
  answer: string | null;
  metric_key: string | null;
  metric_display_name: string | null;
  metric_definition_draft: string | null;
  metric_source_columns: string[];
}): {
  question_number: number;
  question: string;
  clarification: string;
  answer: string | null;
  metric_key: string | null;
  metric_display_name: string | null;
  metric_definition_draft: string | null;
  metric_source_columns: string[];
} {
  const rewrite = (value: string): string =>
    value
      .replace(/^routing decision\s*:\s*/i, "")
      .replace(/^analysis task\s*:\s*/i, "")
      .replace(/^data[_\s-]*analysis task\s*:\s*/i, "")
      // Strip merged question prefixes like "Q4 + Q5 - ..." so each scope item stays atomic.
      .replace(
        /^\s*q\s*\d+\s*(?:\+|\/|&|and)\s*q?\s*\d+\s*(?:[-:]\s*)?/i,
        ""
      )
      .replace(/^\s*q\s*\d+\s*(?:[-:]\s*)?/i, "")
      .replace(/\bmetric definition\b/gi, "calculation")
      .replace(/^calculation\s*:\s*/i, "")
      // Strip leading conversational fragments (e.g. ", its a full month now...")
      .replace(/^[,;:.\s]+/, "")
      // Remove leading conversational prefixes the LLM might dump from user text
      .replace(/^(?:can you|could you|please|i want|i'd like|also|and also|hey|hi)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();

  let question = rewrite(entry.question);

  // If the question still looks like raw conversational text rather than an
  // analytical question, attempt to extract the core ask.  A well-formed scope
  // question should contain a question mark or start with an interrogative word.
  if (
    question.length > 0 &&
    !/\?/.test(question) &&
    !/^(?:what|which|how|why|where|when|who|is|are|do|does|compare|show|list|rank|calculate|determine)\b/i.test(question)
  ) {
    // Wrap the raw text into a question form so it reads properly in the scope list
    question = `${question.charAt(0).toUpperCase()}${question.slice(1)}${question.endsWith("?") ? "" : "?"}`;
  }

  return {
    ...entry,
    question,
    clarification: rewrite(entry.clarification)
  };
}

function normalizeSimilarityText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSimilarityToken(token: string): string {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

function suggestionAddsDistinctAnalyticalFocus(
  existingQuestion: string,
  suggestedQuestion: string
): boolean {
  const existing = normalizeSimilarityText(existingQuestion);
  const suggested = normalizeSimilarityText(suggestedQuestion);
  const analyticalTokenGroups = [
    ["average", "avg", "median", "mean"],
    ["resolution", "resolve", "resolved", "turnaround", "duration", "latency", "sla"],
    ["hour", "hours", "day", "days", "time"],
    ["delta", "change", "growth"]
  ];

  return analyticalTokenGroups.some((group) => {
    const suggestedHasGroup = group.some((token) => suggested.includes(token));
    const existingHasGroup = group.some((token) => existing.includes(token));
    return suggestedHasGroup && !existingHasGroup;
  });
}

function looksLikeInternalScopeReasoning(question: string, clarification: string): boolean {
  const text = `${question} ${clarification}`.toLowerCase();
  return (
    /\brouting decision\b/.test(text) ||
    /\bthis requires multiple queries\b/.test(text) ||
    /\bcomparison diagnostics\b/.test(text) ||
    /\bdata[_\s-]*analysis task\b/.test(text)
  );
}

const SCOPE_DEDUP_STOP_WORDS = new Set([
  "what", "which", "how", "are", "is", "the", "a", "an", "do", "does",
  "in", "of", "to", "for", "by", "on", "at", "from", "with", "and",
  "or", "that", "this", "over", "past", "last", "recent", "months",
  "month", "days", "weeks", "question", "please", "tell", "me", "show"
]);

function isGenericScopeToken(token: string): boolean {
  return (
    token === "question" ||
    token === "clarification" ||
    token === "confirm" ||
    token === "should" ||
    token === "would" ||
    token === "calculation"
  );
}

function tokenizeForSimilarity(value: string): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "your",
    "into",
    "then",
    "also",
    "please",
    "confirm",
    "question",
    "clarification",
    "should",
    "would"
  ]);

  return Array.from(
    new Set(
      normalizeSimilarityText(value)
        .split(" ")
        .map((token) => normalizeSimilarityToken(token.trim()))
        .filter((token) => token.length >= 3 && !stopWords.has(token))
    )
  );
}

function areScopeQuestionTextsSimilar(leftQuestion: string, rightQuestion: string): boolean {
  const left = normalizeSimilarityText(leftQuestion);
  const right = normalizeSimilarityText(rightQuestion);
  if (left.length === 0 || right.length === 0) {
    return false;
  }
  if (left === right) {
    return true;
  }
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) >= 24;
  }

  const leftTokens = tokenizeForSimilarity(left).filter((token) => !isGenericScopeToken(token));
  const rightTokens = tokenizeForSimilarity(right).filter((token) => !isGenericScopeToken(token));
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }
  if (intersection < 2) {
    return false;
  }
  const minSize = Math.max(1, Math.min(leftSet.size, rightSet.size));
  return intersection / minSize >= 0.6;
}

function migratePendingMetricConfirmationsToScope(state: ChatState): void {
  // Metric definitions are now saved directly — no confirmation scope injection needed.
  state.pending_metric_confirmations = [];
  state.pending_metric_resume_message = null;
  state.pending_metric_resume_mode = null;
}

function prioritizeMetricDefinitionsForWorkflow(
  definitions: ChatMetricDefinition[],
  _rawMessage: string,
  _mode: "single_query" | "deep_analysis"
): ChatMetricDefinition[] {
  void _rawMessage;
  void _mode;
  const deduped: ChatMetricDefinition[] = [];
  const seen = new Set<string>();

  for (const definition of definitions) {
    const fingerprint = `${definition.metric_key.trim().toLowerCase()}|${definition.definition
      .trim()
      .toLowerCase()}`;
    if (seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    deduped.push(definition);
  }

  return deduped;
}

function metricMentionedByUser(definition: ChatMetricDefinition, rawMessage: string): boolean {
  const user = rawMessage.toLowerCase();
  const display = definition.display_name.toLowerCase().trim();
  if (display.length > 0 && user.includes(display)) {
    return true;
  }

  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "past",
    "last",
    "this",
    "that",
    "trend",
    "comparison",
    "metric"
  ]);
  const tokens = Array.from(
    new Set(
      `${definition.display_name} ${definition.metric_key}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !stopWords.has(token))
    )
  );

  if (tokens.length === 0) {
    return false;
  }
  const overlap = tokens.filter((token) => user.includes(token)).length;
  return overlap >= Math.min(2, tokens.length);
}

function normalizeMetricDefinition(
  entry: {
    metric_key: string;
    display_name: string;
    definition: string;
    source_type?: string;
    source_columns?: string[];
    requires_confirmation?: boolean;
    confirmation_question?: string;
  },
  _context: "single_query" | "deep_analysis"
): ChatMetricDefinition | null {
  void _context;
  const metricKey = sanitizeMetricKey(entry.metric_key || entry.display_name);
  const displayName = entry.display_name?.trim();
  const definition = entry.definition?.trim();
  if (!metricKey || !displayName || !definition) {
    return null;
  }

  return {
    metric_key: metricKey,
    display_name: displayName,
    definition
  };
}

function sanitizeMetricKey(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return normalized.length > 0 ? normalized : `metric_${randomUUID().slice(0, 8)}`;
}

function hasConfirmedMetricDefinition(
  state: ChatState,
  metricKey: string,
  _definition: string
): boolean {
  void _definition;
  const normalizedKey = metricKey.trim().toLowerCase();
  return state.metric_definitions.some(
    (entry) => entry.metric_key.trim().toLowerCase() === normalizedKey
  );
}

function formulateScopeQuestions(
  rawMessage: string
): Array<{ question: string; clarification: string }> {
  const normalized = rawMessage
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length === 0) {
    return [
      {
        question: "Primary analysis question",
        clarification: "Confirm exact timeframe and the date column to use."
      }
    ];
  }

  const numbered: Array<{ question: string; clarification: string }> = [];
  const numberedRegex = /\bq\s*(\d+)\s*[:.)-]\s*([^?!.]+(?:[?!.][^?!.]+)*)/gi;
  let numberedMatch: RegExpExecArray | null;
  while ((numberedMatch = numberedRegex.exec(normalized)) !== null) {
    const question = cleanScopeQuestionText(numberedMatch[2] ?? "");
    if (question.length === 0) {
      continue;
    }
    numbered.push({
      question,
      clarification: buildClarificationForScopeQuestion(question)
    });
  }
  if (numbered.length > 0) {
    return numbered.slice(0, 5);
  }

  let segments = normalized
    .split(/\?\s+|;\s+|(?:\.\s+)(?=(?:also|plus)\b)/i)
    .map((segment) => cleanScopeQuestionText(segment))
    .filter((segment) => segment.length > 0);

  if (segments.length <= 1 && looksLikeComplexMultiQuestionPrompt(normalized.toLowerCase())) {
    const commaSegments = normalized
      .split(/,\s+(?:and\s+)?/i)
      .map((segment) => cleanScopeQuestionText(segment))
      .filter((segment) => segment.length > 0);
    const scopedClauses = commaSegments.filter((segment) => looksLikeStandaloneScopeClause(segment));
    if (scopedClauses.length >= 2) {
      segments = scopedClauses;
    }
  }

  if (segments.length <= 1) {
    segments = normalized
      .split(/\b(?:also|plus|and also)\b/gi)
      .map((segment) => cleanScopeQuestionText(segment))
      .filter((segment) => segment.length > 0);
  }

  if (segments.length === 0) {
    segments = [cleanScopeQuestionText(normalized)];
  }

  if (segments.length > 1) {
    segments = normalizeMultiClauseScopeSegments(segments);
  }

  const baseQuestions = segments.slice(0, 5).map((question) => ({
    question,
    clarification: buildClarificationForScopeQuestion(question)
  }));

  return baseQuestions;
}

function normalizeMultiClauseScopeSegments(segments: string[]): string[] {
  return segments.map((segment, index) => {
    if (index !== 0) {
      return segment;
    }

    if (/\b(vs|versus|prior|previous|comparison)\b/i.test(segment)) {
      return segment;
    }

    const stripped = segment.replace(
      /^(?:compare|show|analy[sz]e|review|list|find|give me|tell me|help me understand|break down)\s+/i,
      ""
    ).trim();
    return stripped.length >= 10 ? stripped : segment;
  });
}

function looksLikeStandaloneScopeClause(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower.length < 10) {
    return false;
  }

  return /\b(compare|comparison|vs|trend|top|highest|lowest|city|cities|issue|issues|reason|reasons|ticket|tickets|refund|revenue|sales|month|months|quarter|quarters|year|years|by)\b/.test(
    lower
  );
}

function cleanScopeQuestionText(value: string): string {
  return value
    .replace(
      /^\s*(?:confirm(?:ed)?\s+all|all\s+confirmed|confirm\s+everything|approve\s+all|yes\s+to\s+all)\b\s*(?:,|;|-|:)?\s*(?:and\s+also|also|and)?\s*/i,
      ""
    )
    .replace(/^\s*(and|also|plus)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.?!]+$/g, "")
    .trim();
}

function buildClarificationForScopeQuestion(question: string): string {
  const lower = question.toLowerCase();
  const isComparison = /\b(vs|versus|compare|comparison|prior|previous)\b/.test(lower);
  const isTrend = /\b(trend|month|months|week|weeks|quarter|quarters|timeline|period|window)\b/.test(lower);
  const isRefund = /\b(refund|refunded|cancell|return)\b/.test(lower);
  const isRate = /\b(rate|ratio|percentage|percent)\b/.test(lower);
  const isGeo = /\b(city|cities|region|state|country|location)\b/.test(lower);
  const isSupport = /\b(support|ticket|tickets|issue|issues|reason|reasons|resolution)\b/.test(lower);
  const isTopN = /\b(top|highest|lowest|rank|ranking)\b/.test(lower);
  const isProduct = /\b(product|category|sku|item)\b/.test(lower);

  if (isSupport) {
    return "Confirm how support tickets should be linked to refunded orders and what ticket set to include.";
  }

  if (isRefund && isRate && isGeo) {
    return "Confirm the refund-rate formula and how many cities to rank.";
  }

  if (isRefund && isRate && isProduct && isTrend) {
    return "Confirm the refund-rate formula, the product/category cutoff, and the time grain.";
  }

  if (isRefund && isRate && isProduct) {
    return "Confirm the refund-rate formula and the product/category cutoff.";
  }

  if (isComparison && isTrend) {
    return "Confirm the two periods being compared and whether to use completed months only.";
  }

  if (isComparison) {
    return "Confirm the comparison windows.";
  }

  if (isTrend) {
    return "Confirm the date range and time grain.";
  }

  if (isRefund) {
    return "Confirm how refunded orders should be identified.";
  }

  if (isTopN && (isProduct || isGeo)) {
    return "Confirm the ranking metric and cutoff.";
  }

  return "Confirm the key filters and time range.";
}

function getCurrentYearMonthInTimezone(
  timezone: string
): { year: number; month: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit"
    }).formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
    const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
    if (!Number.isInteger(year) || !Number.isInteger(month) || year <= 0 || month < 1 || month > 12) {
      return null;
    }
    return { year, month };
  } catch {
    return null;
  }
}

function shiftUtcMonth(date: Date, monthDelta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthDelta, 1));
}

function formatMonthYearLabel(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      month: "short",
      year: "numeric"
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 7);
  }
}

function buildCompleteMonthWindowLabel(months: number, timezone: string): string | null {
  if (!Number.isInteger(months) || months <= 0) {
    return null;
  }

  const currentYearMonth = getCurrentYearMonthInTimezone(timezone);
  if (!currentYearMonth) {
    return null;
  }

  const currentMonthStart = new Date(
    Date.UTC(currentYearMonth.year, currentYearMonth.month - 1, 1)
  );
  const lastCompleteMonthStart = shiftUtcMonth(currentMonthStart, -1);
  const firstMonthStart = shiftUtcMonth(lastCompleteMonthStart, -(months - 1));
  return `${formatMonthYearLabel(firstMonthStart, timezone)} to ${formatMonthYearLabel(lastCompleteMonthStart, timezone)}`;
}

function buildComparisonMonthWindowLabel(months: number, timezone: string): string | null {
  if (!Number.isInteger(months) || months <= 0) {
    return null;
  }

  const currentYearMonth = getCurrentYearMonthInTimezone(timezone);
  if (!currentYearMonth) {
    return null;
  }

  const currentMonthStart = new Date(
    Date.UTC(currentYearMonth.year, currentYearMonth.month - 1, 1)
  );
  const currentWindowEnd = shiftUtcMonth(currentMonthStart, -1);
  const currentWindowStart = shiftUtcMonth(currentWindowEnd, -(months - 1));
  const priorWindowEnd = shiftUtcMonth(currentWindowStart, -1);
  const priorWindowStart = shiftUtcMonth(priorWindowEnd, -(months - 1));
  return `${formatMonthYearLabel(currentWindowStart, timezone)} to ${formatMonthYearLabel(currentWindowEnd, timezone)} vs ${formatMonthYearLabel(priorWindowStart, timezone)} to ${formatMonthYearLabel(priorWindowEnd, timezone)}`;
}

function describeRefundRateFormulaForAssumption(
  state: ChatState,
  question: ScopeQuestionEntry
): string {
  const matchedMetric = findSavedMetricDefinitionForText(
    state.metric_definitions,
    `${question.question} ${question.clarification}`
  );
  const rawFormula =
    matchedMetric?.definition?.trim() ||
    (/\b(revenue|value|gmv|sales)\b/i.test(`${question.question} ${question.clarification}`)
      ? "refunded revenue / total revenue"
      : "refunded orders / total orders");
  const cleaned = rawFormula.replace(/\s+/g, " ").trim();
  return cleaned.length > 80 ? matchedMetric?.display_name?.trim() || "the saved refund-rate formula" : cleaned;
}

function buildAssumptionPromptForScopeQuestion(
  state: ChatState,
  question: ScopeQuestionEntry
): string {
  const lower = `${question.question} ${question.clarification}`.toLowerCase();
  const questionText = question.question.toLowerCase();
  const timezone = state.draft.timezone || "UTC";
  const requestedMonths = getRequestedMonthWindowFromScope(state, lower);
  const monthWindowLabel =
    requestedMonths !== null ? buildCompleteMonthWindowLabel(requestedMonths, timezone) : null;
  const compareMonths =
    Number.parseInt(
      /\b(?:past|last|previous|recent|most recent)\s+(\d{1,2})(?:\s+complete|\s+full|\s+calendar)?\s+months?\b/.exec(questionText)?.[1] ?? "",
      10
    ) || 2;
  const comparisonWindowLabel = buildComparisonMonthWindowLabel(compareMonths, timezone);
  const topN = /\btop\s+(\d{1,2})\b/i.exec(question.question)?.[1] ?? "5";

  if (/\bresolution\b/.test(lower) && /\bissue\b/.test(lower)) {
    const timeline = monthWindowLabel ? ` for ${monthWindowLabel}` : "";
    return `I assumed we should use only support tickets directly linked to refunded orders${timeline} and look at average resolution time by issue type. Is that fine, or do you want a change?`;
  }

  if (/\b(?:support|ticket|tickets)\b/.test(lower) && /\b(?:issue|reason)\b/.test(lower)) {
    const timeline = monthWindowLabel ? ` for ${monthWindowLabel}` : "";
    return `I assumed we should use only support tickets directly linked to refunded orders${timeline} and rank issue types by ticket count. Is that fine, or do you want a change?`;
  }

  if (/\b(?:support|ticket|tickets)\b/.test(lower)) {
    const timeline = monthWindowLabel ? ` for ${monthWindowLabel}` : "";
    return `I assumed we should count only support tickets directly linked to refunded orders${timeline}. Is that fine, or do you want a change?`;
  }

  if (
    /\b(refund|refunded|return|cancel)\b/.test(lower) &&
    /\b(rate|ratio|percentage|percent)\b/.test(lower) &&
    /\b(product|category|sku|item)\b/.test(lower)
  ) {
    const formula = describeRefundRateFormulaForAssumption(state, question);
    const timeline = monthWindowLabel ? ` over ${monthWindowLabel}` : "";
    return `I assumed refund rate should mean ${formula} and we should rank the top ${topN} product categories${timeline}. Is that fine, or do you want a change?`;
  }

  if (
    /\b(refund|refunded|return|cancel)\b/.test(lower) &&
    /\b(rate|ratio|percentage|percent)\b/.test(lower) &&
    /\b(city|cities|region|regions|state|states|country|countries|location)\b/.test(lower)
  ) {
    const formula = describeRefundRateFormulaForAssumption(state, question);
    const timeline = monthWindowLabel ? ` over ${monthWindowLabel}` : "";
    return `I assumed refund rate should mean ${formula} and we should rank the top ${topN} cities${timeline}. Is that fine, or do you want a change?`;
  }

  if (/\b(vs|versus|compare|comparison|prior|previous)\b/.test(lower)) {
    const comparisonWindow =
      comparisonWindowLabel ??
      `the latest ${compareMonths}-month period vs the prior ${compareMonths}-month period`;
    return `I assumed this should compare ${comparisonWindow} and show both absolute and percentage change. Is that fine, or do you want a change?`;
  }

  if (/\b(trend|month|months|week|weeks|quarter|quarters)\b/.test(lower)) {
    const windowText =
      monthWindowLabel ??
      (requestedMonths !== null ? `the last ${requestedMonths} complete months` : "the recent complete period");
    const grain = /\bweek|weeks|weekly\b/.test(lower) ? "weekly" : "monthly";
    return `I assumed this should use ${windowText} with ${grain} buckets. Is that fine, or do you want a change?`;
  }

  if (/\b(refund|refunded|return|cancel)\b/.test(lower)) {
    const timeline = monthWindowLabel ? ` for ${monthWindowLabel}` : "";
    return `I assumed refunded orders should be identified using the standard refunded status${timeline}. Is that fine, or do you want a change?`;
  }

  if (/\b(top|highest|lowest|rank|ranking)\b/.test(lower)) {
    return `I assumed we should use a top ${topN} cutoff by the requested metric. Is that fine, or do you want a change?`;
  }

  return "I assumed the standard interpretation of the remaining filters and time range from your request. Is that fine, or do you want a change?";
}

function getRequestedMonthWindowFromScope(state: ChatState, questionText: string): number | null {
  const fromQuestion = extractRequestedMonths(questionText.toLowerCase());
  if (fromQuestion !== null) {
    return fromQuestion;
  }
  if (state.scope_source_prompt) {
    return extractRequestedMonths(state.scope_source_prompt.toLowerCase());
  }
  return null;
}

function buildProposedDefaultForScopeQuestion(
  state: ChatState,
  question: {
    question_number: number;
    question: string;
    clarification: string;
    answer: string | null;
    metric_key: string | null;
    metric_display_name: string | null;
    metric_definition_draft: string | null;
    metric_source_columns: string[];
  }
): string {
  const text = `${question.question} ${question.clarification}`.toLowerCase();
  const questionText = question.question.toLowerCase();
  const matchedMetric = findSavedMetricDefinitionForText(
    state.metric_definitions,
    `${question.question} ${question.clarification}`
  );
  const timezone = state.draft.timezone || "UTC";
  const todayLocal = getTodayDateStringInTimezone(timezone);
  const requestedMonths = getRequestedMonthWindowFromScope(state, text);

  const currentMonth = getCurrentMonthName(timezone);
  const monthComplete = isCurrentMonthComplete(timezone);
  const monthStatus = monthComplete
    ? `use full completed months only (${currentMonth} just started, use the previous ${requestedMonths} complete months)`
    : `${currentMonth} is in progress — include partial data through ${todayLocal} if user requested it, otherwise use only completed months`;
  const baseTimeline = requestedMonths
    ? `Use a ${requestedMonths}-month window anchored to today ${todayLocal} (${timezone}). ${monthStatus}.`
    : `Anchor relative windows to ${todayLocal} (${timezone}) using the primary date column from catalog.`;

  if (/\b(support|ticket|tickets|issue|issues|reason|reasons|resolution)\b/.test(questionText)) {
    return [
      baseTimeline,
      "Join support tickets to refunded orders via order_id when available.",
      "Use only linked refunded-order tickets and rank top issue types by ticket count."
    ].join(" ");
  }

  if (
    /\b(refund|refunded|return|cancel)\b/.test(questionText) &&
    /\b(product|category|sku|item)\b/.test(questionText) &&
    /\b(rate|ratio|percentage|percent)\b/.test(questionText)
  ) {
    const topN = /\btop\s+(\d{1,2})\b/.exec(questionText)?.[1] ?? "5";
    const savedFormula =
      matchedMetric && matchedMetric.definition.trim().length > 0
        ? matchedMetric.definition.trim()
        : "refunded_orders / total_orders";
    return [
      baseTimeline,
      `Default refund-rate formula: ${savedFormula}.`,
      `Rank top ${topN} product categories by refund rate and show the trend at the requested grain unless you want a different cutoff or formula.`
    ].join(" ");
  }

  if (
    /\b(refund|refunded|return|cancel)\b/.test(questionText) &&
    /\b(rate|ratio|percentage|percent)\b/.test(questionText)
  ) {
    const topN = /\btop\s+(\d{1,2})\b/.exec(questionText)?.[1] ?? "5";
    const savedFormula =
      matchedMetric && matchedMetric.definition.trim().length > 0
        ? matchedMetric.definition.trim()
        : "refunded_orders / total_orders";
    return [
      baseTimeline,
      `Default refund-rate formula: ${savedFormula}.`,
      `Rank top ${topN} cities/regions by refund rate unless you choose a value-based formula.`
    ].join(" ");
  }

  if (/\b(vs|versus|compare|comparison|prior|previous)\b/.test(questionText)) {
    const compareMonths =
      /\b(?:past|last|previous)\s+(\d{1,2})\s+months?\b/.exec(questionText)?.[1] ?? "2";
    return [
      `Compare latest ${compareMonths}-month window vs the prior ${compareMonths}-month window anchored to ${todayLocal} (${timezone}).`,
      "Return both absolute and percentage delta by default."
    ].join(" ");
  }

  if (/\b(trend|month|months|week|weeks|quarter|quarters)\b/.test(questionText)) {
    return [
      baseTimeline,
      "Use monthly granularity by default for trend readability."
    ].join(" ");
  }

  if (/\b(top|highest|lowest|rank|ranking)\b/.test(questionText)) {
    return "Use top-5 ranking by the primary requested metric unless you specify another cutoff.";
  }

  const businessContext = state.scope_business_context?.trim();
  const contextHint =
    businessContext && businessContext.length > 0
      ? ` Business context is applied when selecting conservative defaults (${businessContext.slice(0, 120)}${businessContext.length > 120 ? "..." : ""}).`
      : "";

  return `${baseTimeline}${contextHint}`.trim();
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

  return Array.from(phrases).filter((phrase) => phrase.length > 0);
}

function findSavedMetricDefinitionForText(
  metricDefinitions: Array<{ metric_key: string; display_name: string; definition: string }>,
  text: string
): { metric_key: string; display_name: string; definition: string } | null {
  const matches = selectRelevantMetricDefinitionsForText(metricDefinitions, text, []);
  return matches.length > 0 ? matches[0] : null;
}

function isCurrentMonthComplete(timezone: string): boolean {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const day = Number(parts.find((p) => p.type === "day")?.value ?? "0");
    // The previous month is always complete once we're in a new month (day >= 1).
    // "Current month complete" means: should we treat the trailing month as full?
    // If we're early in the month (1st-3rd), the previous month just finished,
    // so a "last N months" window should use full completed months only.
    return day <= 3;
  } catch {
    return false;
  }
}

function getCurrentMonthName(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      month: "long",
      year: "numeric"
    }).format(new Date());
  } catch {
    return "the current month";
  }
}

function getTodayDateStringInTimezone(timezone: string): string {
  try {
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // fallback below
  }
  return new Date().toISOString().slice(0, 10);
}

async function applyScopeClarificationAnswersWithLlm(
  state: ChatState,
  rawMessage: string,
  apiClient: WebApiClient,
  queryRouter: QueryRouterClient | undefined
): Promise<{ answered_count: number; all_answered: boolean }> {
  if (state.scope_questions.length === 0) {
    return { answered_count: 0, all_answered: true };
  }

  const uniqueSortedQuestionNumbers = (values: number[]): number[] =>
    Array.from(new Set(values.filter((value) => Number.isInteger(value) && value > 0))).sort(
      (left, right) => left - right
    );

  const suggestionNumbersToDecline = parseScopeSuggestionNumbersToDecline(state, rawMessage);
  const declineSuggestedScopeQuestions =
    suggestionNumbersToDecline.length > 0 || declinesSuggestedScopeItems(rawMessage);
  const suggestionNumbersToInclude = parseScopeSuggestionNumbersToInclude(state, rawMessage);
  const answerResolutionMessage = stripScopeSuggestionDecisionClauses(rawMessage, state);
  const explicitAssignments = parseExplicitScopeAnswerAssignments(answerResolutionMessage);
  const explicitAssignmentNumbers = new Set(explicitAssignments.map((entry) => entry.question_number));
  const pendingInputQuestionNumbers = new Set(
    state.pending_inputs
      .map((entry) => entry.question_number)
      .filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value > 0)
  );
  const messageHasNewQuestionIntent =
    !declineSuggestedScopeQuestions &&
    suggestionNumbersToInclude.length === 0 &&
    (
      hasExplicitNewQuestionDirectiveWhileClarifying(answerResolutionMessage) ||
      /\b(add|also add|another|one more|new question|add question|follow[- ]?up|what about)\b/i.test(
        answerResolutionMessage
      )
    );
  const semanticSkipQuestionNumbers = new Set<number>();
  if (explicitAssignments.length > 0) {
    for (const question of state.scope_questions) {
      if (!explicitAssignmentNumbers.has(question.question_number)) {
        semanticSkipQuestionNumbers.add(question.question_number);
      }
    }
    for (const questionNumber of pendingInputQuestionNumbers) {
      if (!explicitAssignmentNumbers.has(questionNumber)) {
        semanticSkipQuestionNumbers.add(questionNumber);
      }
    }
  }
  if (messageHasNewQuestionIntent) {
    for (const pending of state.pending_inputs) {
      if (
        typeof pending.question_number === "number" &&
        /newly added scope question/i.test(String(pending.reason ?? ""))
      ) {
        semanticSkipQuestionNumbers.add(pending.question_number);
      }
    }
  }
  const explicitApplyToAll =
    /\b(same for all|all questions|for all questions|apply to all|across all questions|for each question)\b/i.test(
      rawMessage
    );
  const questionNumbersExcludedFromBlanketConfirmation =
    parseScopeQuestionNumbersExcludedFromBlanketConfirmation(state, rawMessage);
  let questionNumbersToRemove = uniqueSortedQuestionNumbers([
    ...parseScopeQuestionNumbersToRemove(state, rawMessage),
    ...parseSuggestedScopeQuestionNumbersToRemove(state, rawMessage)
  ]);
  for (const questionNumber of questionNumbersToRemove) {
    semanticSkipQuestionNumbers.add(questionNumber);
  }

  const questionNumbersBeforeAppend = new Set(state.scope_questions.map((entry) => entry.question_number));
  // Capture unanswered questions before potential appends so "confirm all"
  // can keep newly added follow-up questions open for explicit confirmation.
  const unansweredBeforeAppend = new Set(
    state.scope_questions
      .filter((entry) => !entry.answer || entry.answer.trim().length === 0)
      .map((entry) => entry.question_number)
  );
  const appendedSuggestedQuestionsCount = appendIncludedScopeSuggestionsToState(
    state,
    suggestionNumbersToInclude
  );
  if (suggestionNumbersToDecline.length > 0) {
    const suggestionSet = new Set(suggestionNumbersToDecline);
    state.scope_suggestions = renumberScopeSuggestions(
      state.scope_suggestions.filter((entry) => !suggestionSet.has(entry.suggestion_number))
    );
  }
  const questionNumbersAfterSuggestionAppend = new Set(
    state.scope_questions.map((entry) => entry.question_number)
  );
  const appendedSuggestedQuestionNumbers = new Set(
    Array.from(questionNumbersAfterSuggestionAppend).filter(
      (questionNumber) => !questionNumbersBeforeAppend.has(questionNumber)
    )
  );
  const appendedImpromptuQuestion = maybeAppendImpromptuScopeQuestionFromClarification(
    state,
    answerResolutionMessage
  );
  const appendedQuestionNumbers = new Set(
    state.scope_questions
      .map((entry) => entry.question_number)
      .filter((questionNumber) => !questionNumbersBeforeAppend.has(questionNumber))
  );
  for (const questionNumber of appendedQuestionNumbers) {
    semanticSkipQuestionNumbers.add(questionNumber);
  }

  const applyAssignment = (questionNumber: number, answer: string): number => {
    if (appendedQuestionNumbers.has(questionNumber)) {
      return 0;
    }
    const target = state.scope_questions.find((entry) => entry.question_number === questionNumber);
    if (!target) {
      return 0;
    }
    const normalized = answer.replace(/\s+/g, " ").trim();
    if (normalized.length === 0) {
      return 0;
    }
    const wasEmpty = !target.answer || target.answer.trim().length === 0;
    target.answer = normalized;
    return wasEmpty ? 1 : 0;
  };

  const pruneResolvedPendingInputs = () => {
    if (state.pending_inputs.length > 0) {
      reconcilePendingInputsToScopeQuestions(state);
      state.pending_inputs = state.pending_inputs.filter((entry) => {
        if (typeof entry.question_number !== "number") {
          return true;
        }
        const target = state.scope_questions.find((question) => question.question_number === entry.question_number);
        if (!target) {
          return true;
        }
        return !target.answer || target.answer.trim().length === 0;
      });
    }
    pruneScopeSuggestionsAgainstScopeQuestions(state);
  };

  const hasOutstandingPendingInputs = () =>
    state.pending_inputs.some((entry) => {
      if (typeof entry.question_number !== "number") {
        return true;
      }
      const target = state.scope_questions.find((question) => question.question_number === entry.question_number);
      if (!target) {
        return true;
      }
      return !target.answer || target.answer.trim().length === 0;
    });

  pruneResolvedPendingInputs();

  const shouldBulkConfirmScopeItems =
    (isScopeFinalizeChoice(rawMessage) &&
      state.scope_questions.some(
        (entry) => (!entry.answer || entry.answer.trim().length === 0) && !/^\s*\[suggested\]/i.test(entry.question)
      )) ||
    isConfirmAllScopeMessage(rawMessage) ||
    shouldConfirmScopeItemsExceptSpecificQuestions(
      rawMessage,
      questionNumbersExcludedFromBlanketConfirmation
    ) ||
    shouldConfirmRemainingScopeItems(rawMessage) ||
    isPlainScopeAffirmation(rawMessage) ||
    looksLikeAffirmativeScopeConfirmation(rawMessage) ||
    shouldTreatAffirmativeAsBulkScopeConfirmation(state, rawMessage);
  const shouldAutoConfirmSuggestedScopeItems = shouldAffirmSuggestedScopeItems(rawMessage);

  let answeredCount = 0;
  for (const assignment of explicitAssignments) {
    answeredCount += applyAssignment(assignment.question_number, assignment.answer);
  }

  if (!queryRouter?.resolve_scope_answers) {
    if (!isTestRuntime()) {
      throw new Error("scope_answer_resolver_unavailable: LLM resolver is required in provider mode");
    }
    console.warn("[scope-resolver] No LLM resolver available - using best-effort assignment only");
  } else {
    const catalogContext = await fetchCatalogContext(apiClient).catch(() => ({
      catalog_summary: "",
      business_context: ""
    }));
    const relevantMetricDefinitions = selectRelevantMetricDefinitionsForText(
      state.metric_definitions,
      rawMessage,
      state.conversation_history
    );

    try {
      const response = await queryRouter.resolve_scope_answers({
        user_message: answerResolutionMessage,
        now_iso: new Date().toISOString(),
        business_context: resolveBusinessContextForAgents(state, catalogContext.business_context),
        catalog_summary: catalogContext.catalog_summary,
        relevant_metric_definitions: relevantMetricDefinitions,
        pending_inputs: state.pending_inputs.map((entry) => ({
          question_number: entry.question_number ?? null,
          prompt: entry.prompt,
          reason: entry.reason ?? null
        })),
        scope_suggestions: state.scope_suggestions.map((entry) => ({
          suggestion_number: entry.suggestion_number,
          question: entry.question,
          reason: entry.reason
        })),
        scope_questions: state.scope_questions.map((entry) => ({
          question_number: entry.question_number,
          question: entry.question,
          clarification: entry.clarification,
          proposed_default: buildProposedDefaultForScopeQuestion(state, entry),
          is_suggested: /^\s*\[suggested\]/i.test(entry.question),
          answer: entry.answer
        })),
        conversation_history: state.conversation_history
          .slice(-20)
          .map((turn) => ({ role: turn.role, content: turn.content }))
      });

      const shouldTrustResolverQuestionRemovals =
        questionNumbersToRemove.length === 0 &&
        (hasExplicitScopeRemovalIntent(rawMessage) || declinesSuggestedScopeItems(rawMessage));
      const resolverQuestionNumbersToRemove = shouldTrustResolverQuestionRemovals
        ? (response.remove_question_numbers ?? [])
        : [];
      questionNumbersToRemove = uniqueSortedQuestionNumbers([
        ...questionNumbersToRemove,
        ...resolverQuestionNumbersToRemove
      ]);
      for (const questionNumber of resolverQuestionNumbersToRemove) {
        semanticSkipQuestionNumbers.add(questionNumber);
      }

      for (const assignment of response.assignments) {
        const target = state.scope_questions.find(
          (entry) => entry.question_number === assignment.question_number
        );
        if (
          target &&
          !shouldAcceptResolvedScopeAssignment({
            raw_message: rawMessage,
            target_question: target,
            explicit_assignment_numbers: explicitAssignmentNumbers,
            explicit_apply_to_all: explicitApplyToAll
          })
        ) {
          continue;
        }
        answeredCount += applyAssignment(assignment.question_number, assignment.answer ?? "");
      }
    } catch (error) {
      if (!isTestRuntime()) {
        throw new Error(
          `scope_answer_resolver_failed: ${
            error instanceof Error ? error.message : "unknown LLM resolver error"
          }`
        );
      }
      console.error("[scope-resolver] LLM call failed:", error instanceof Error ? error.message : error);
    }
  }

  let handledSinglePendingWholeMessage = false;
  const singlePendingQuestionBeforeFallback = state.scope_questions.filter(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  );
  if (singlePendingQuestionBeforeFallback.length === 1 && explicitAssignments.length === 0) {
    const pendingQuestion = singlePendingQuestionBeforeFallback[0]!;
    const normalizedSinglePendingAnswer = normalizeScopeAnswer(answerResolutionMessage);
    const pendingIsSuggested = /^\s*\[suggested\]/i.test(pendingQuestion.question);
    const canApplyWholeMessageToSinglePending =
      normalizedSinglePendingAnswer.length > 0 &&
      !hasExplicitNewQuestionDirectiveWhileClarifying(normalizedSinglePendingAnswer) &&
      (
        !pendingIsSuggested ||
        shouldAffirmSuggestedScopeItems(normalizedSinglePendingAnswer) ||
        looksLikePureAffirmativeScopeMessage(normalizedSinglePendingAnswer)
      );
    if (canApplyWholeMessageToSinglePending) {
      const singlePendingFallbackAnswer = looksLikePureAffirmativeScopeMessage(
        normalizedSinglePendingAnswer
      )
        ? "Confirmed: use the proposed clarification/default for this pending question."
        : normalizedSinglePendingAnswer;
      answeredCount += applyAssignment(pendingQuestion.question_number, singlePendingFallbackAnswer);
      handledSinglePendingWholeMessage = true;
    }
  }

  if (!handledSinglePendingWholeMessage) {
    // Always run semantic reconciliation pass so natural-language clarification replies
    // still map correctly even when LLM assignments are sparse.
    answeredCount += applySemanticScopeFallback(state, answerResolutionMessage, applyAssignment, {
      skip_question_numbers: semanticSkipQuestionNumbers
    });

    if (isTestRuntime()) {
      answeredCount += applyBestEffortScopeAssignments(state, answerResolutionMessage, applyAssignment);
    }
  }

  if (!handledSinglePendingWholeMessage) {
    answeredCount += applySinglePendingScopeConfirmationFallback(
      state,
      answerResolutionMessage,
      applyAssignment,
      explicitAssignments.length
    );
  }

  if (shouldBulkConfirmScopeItems) {
    const newestUnansweredQuestionNumber = (() => {
      const unansweredNow = state.scope_questions
        .filter((entry) => !entry.answer || entry.answer.trim().length === 0)
        .map((entry) => entry.question_number);
      return unansweredNow.length > 0 ? Math.max(...unansweredNow) : null;
    })();

    for (const entry of state.scope_questions) {
      if (entry.answer && entry.answer.trim().length > 0) {
        continue;
      }
      if (questionNumbersToRemove.includes(entry.question_number)) {
        continue;
      }
      if (questionNumbersExcludedFromBlanketConfirmation.includes(entry.question_number)) {
        continue;
      }
      if (/^\s*\[suggested\]/i.test(entry.question) && !shouldAutoConfirmSuggestedScopeItems) {
        continue;
      }
      const isFreshlyAddedPending =
        state.pending_inputs.some(
          (pending) =>
            pending.question_number === entry.question_number &&
            typeof pending.reason === "string" &&
            /newly added scope question/i.test(pending.reason)
        );
      if (isFreshlyAddedPending) {
        continue;
      }
      if (appendedImpromptuQuestion && !unansweredBeforeAppend.has(entry.question_number)) {
        continue;
      }
      if (
        messageHasNewQuestionIntent &&
        newestUnansweredQuestionNumber !== null &&
        entry.question_number === newestUnansweredQuestionNumber
      ) {
        continue;
      }
      const proposedDefault = buildProposedDefaultForScopeQuestion(state, entry);
      entry.answer = `Confirmed: ${proposedDefault}`;
      answeredCount += 1;
    }
  }

  const shouldConfirmIncludedSuggestionsWithDefaults =
    suggestionNumbersToInclude.length > 0 &&
    shouldAffirmSuggestedScopeItems(rawMessage) &&
    answerResolutionMessage.trim().length > 0;
  if (shouldConfirmIncludedSuggestionsWithDefaults) {
    for (const entry of state.scope_questions) {
      if (!appendedSuggestedQuestionNumbers.has(entry.question_number)) {
        continue;
      }
      if (entry.answer && entry.answer.trim().length > 0) {
        continue;
      }
      if (questionNumbersToRemove.includes(entry.question_number)) {
        continue;
      }
      entry.answer = `Confirmed: ${buildProposedDefaultForScopeQuestion(state, entry)}`;
      answeredCount += 1;
    }
  }

  if (
    declineSuggestedScopeQuestions &&
    suggestionNumbersToInclude.length === 0 &&
    suggestionNumbersToDecline.length === 0
  ) {
    state.scope_suggestions = [];
  }

  const scopeOrClarificationChanged =
    answeredCount > 0 ||
    appendedSuggestedQuestionsCount > 0 ||
    appendedImpromptuQuestion ||
    questionNumbersToRemove.length > 0;

  if (questionNumbersToRemove.length > 0) {
    removeScopeQuestionsFromState(state, questionNumbersToRemove);
  }
  if (scopeOrClarificationChanged) {
    invalidatePreparedStateForScopeChange(state);
  }
  pruneResolvedPendingInputs();
  if (state.scope_questions.length === 0) {
    return {
      answered_count: answeredCount + appendedSuggestedQuestionsCount,
      all_answered: false
    };
  }

  return {
    answered_count: answeredCount + appendedSuggestedQuestionsCount,
    all_answered:
      state.scope_questions.every((entry) => Boolean(entry.answer && entry.answer.trim().length > 0)) &&
      !hasOutstandingPendingInputs()
  };
}

function shouldAcceptResolvedScopeAssignment(input: {
  raw_message: string;
  target_question: {
    question_number: number;
    question: string;
    clarification: string;
  };
  explicit_assignment_numbers: Set<number>;
  explicit_apply_to_all: boolean;
}): boolean {
  if (input.explicit_assignment_numbers.has(input.target_question.question_number)) {
    return true;
  }

  const message = normalizeScopeAnswer(input.raw_message).toLowerCase();
  const isSuggested = /^\s*\[suggested\]/i.test(input.target_question.question);
  const score = scoreScopeAnswerClauseAgainstQuestion(
    message,
    input.target_question.question,
    input.target_question.clarification
  );
  if (isSuggested && !isClauseCompatibleWithScopeQuestion(message, input.target_question.question)) {
    return false;
  }

  if (input.explicit_apply_to_all) {
    return score >= 1.4;
  }

  return score >= 1.2;
}

function shouldApplyOrchestratorResolvedScopeAnswers(input: {
  raw_message: string;
  in_clarification_phase: boolean;
  explicit_assignment_count: number;
  explicit_apply_to_all: boolean;
  has_new_question_intent: boolean;
}): boolean {
  if (input.explicit_assignment_count > 0 || input.explicit_apply_to_all) {
    return true;
  }

  if (!input.in_clarification_phase) {
    return false;
  }

  const normalized = normalizeScopeAnswer(input.raw_message);
  if (normalized.length === 0) {
    return false;
  }

  if (input.has_new_question_intent || looksLikeNewQuestionWhileClarifying(normalized)) {
    return false;
  }

  if (/\?/.test(normalized)) {
    return false;
  }

  if (looksLikeAffirmativeScopeConfirmation(normalized) || isConfirmAllScopeMessage(normalized)) {
    return true;
  }

  return /\b(include|exclude|use|show|rank|top|window|period|compare|anchor|status|join|only|all)\b/i.test(
    normalized
  );
}

const SUGGESTED_SCOPE_GENERIC_TOKENS = new Set([
  "what",
  "which",
  "are",
  "the",
  "with",
  "for",
  "from",
  "past",
  "last",
  "month",
  "months",
  "order",
  "orders",
  "refund",
  "refunded",
  "rate",
  "count",
  "counts",
  "value",
  "values",
  "support",
  "ticket",
  "tickets",
  "top",
  "highest",
  "linked"
]);

function maybeAppendImpromptuScopeQuestionFromClarification(
  state: ChatState,
  rawMessage: string
): boolean {
  const explicitAssignments = parseExplicitScopeAnswerAssignments(rawMessage);
  const candidate = extractImpromptuScopeQuestionFromClarification(
    state,
    rawMessage,
    explicitAssignments
  );
  if (!candidate) {
    return false;
  }
  if (
    state.scope_questions.some((entry) => {
      if (!areScopeQuestionTextsSimilar(entry.question, candidate)) {
        return false;
      }
      return !hasDistinctQuestionFocus(
        tokenizeForSimilarity(entry.question),
        tokenizeForSimilarity(candidate)
      );
    })
  ) {
    return false;
  }

  const nextQuestion = sanitizeScopeQuestionLanguage({
    question_number: state.scope_questions.length + 1,
    question: candidate,
    clarification: buildClarificationForScopeQuestion(candidate),
    answer: null,
    metric_key: null,
    metric_display_name: null,
    metric_definition_draft: null,
    metric_source_columns: []
  });

  const normalized = renumberScopeQuestions(
    removeDuplicateScopeQuestions([...state.scope_questions, nextQuestion]).map(
      sanitizeScopeQuestionLanguage
    )
  );
  if (normalized.length === state.scope_questions.length) {
    return false;
  }

  state.scope_questions = normalized;
  state.scope_finalized = false;
  pruneScopeSuggestionsAgainstScopeQuestions(state);
  syncQuestionRegistryFromScope(state);
  return true;
}

function applyBestEffortScopeAssignments(
  state: ChatState,
  rawMessage: string,
  applyAssignment: (questionNumber: number, answer: string) => number
): number {
  const trimmed = rawMessage.trim();
  if (trimmed.length === 0) {
    return 0;
  }

  let assigned = 0;
  const explicitAssignments = parseExplicitScopeAnswerAssignments(trimmed);
  if (explicitAssignments.length > 0) {
    for (const item of explicitAssignments) {
      assigned += applyAssignment(item.question_number, item.answer);
    }
  }

  const unanswered = state.scope_questions.filter((entry) => !entry.answer || entry.answer.trim().length === 0);
  if (unanswered.length === 0) {
    return assigned;
  }

  if (shouldApplyDefaultsToRemainingScopeItems(trimmed)) {
    for (const entry of unanswered) {
      assigned += applyAssignment(
        entry.question_number,
        "Use default assumptions from the stated clarification for this question."
      );
    }
    return assigned;
  }

  if (shouldAffirmSuggestedScopeItems(trimmed)) {
    const suggested = unanswered.filter((entry) => /^\s*\[suggested\]/i.test(entry.question));
    for (const entry of suggested) {
      assigned += applyAssignment(
        entry.question_number,
        "Include this suggested analysis with the default assumptions in scope."
      );
    }
  }

  if (unanswered.length === 1 && explicitAssignments.length === 0) {
    const normalized = normalizeScopeAnswer(trimmed);
    const onlyPendingQuestion = unanswered[0]!;
    const onlyPendingIsSuggested = /^\s*\[suggested\]/i.test(onlyPendingQuestion.question);
    if (
      normalized.length > 0 &&
      !hasExplicitNewQuestionDirectiveWhileClarifying(normalized) &&
      (
        !onlyPendingIsSuggested ||
        shouldAffirmSuggestedScopeItems(normalized) ||
        looksLikePureAffirmativeScopeMessage(normalized)
      )
    ) {
      assigned += applyAssignment(onlyPendingQuestion.question_number, normalized);
    }
    return assigned;
  }

  return assigned;
}

function applySinglePendingScopeConfirmationFallback(
  state: ChatState,
  rawMessage: string,
  applyAssignment: (questionNumber: number, answer: string) => number,
  explicitAssignmentCount: number
): number {
  const pending = state.scope_questions.filter((entry) => !entry.answer || entry.answer.trim().length === 0);
  if (pending.length !== 1 || explicitAssignmentCount > 0) {
    return 0;
  }

  const normalized = normalizeScopeAnswer(rawMessage);
  if (normalized.length === 0 || hasExplicitNewQuestionDirectiveWhileClarifying(normalized)) {
    return 0;
  }
  const pendingQuestion = pending[0]!;
  const pendingIsSuggested = /^\s*\[suggested\]/i.test(pendingQuestion.question);
  if (
    pendingIsSuggested &&
    !shouldAffirmSuggestedScopeItems(normalized) &&
    !looksLikePureAffirmativeScopeMessage(normalized)
  ) {
    return 0;
  }

  const fallbackAnswer = looksLikeAffirmativeScopeConfirmation(normalized)
    ? "Confirmed: use the proposed clarification/default for this pending question."
    : normalized;

  return applyAssignment(pendingQuestion.question_number, fallbackAnswer);
}

function looksLikeAffirmativeScopeConfirmation(message: string): boolean {
  const lower = message.toLowerCase();
  if (/\b(?:not|don't|do not|skip|cancel|hold|wait)\b/.test(lower)) {
    return false;
  }
  return /\b(?:yes|yep|yeah|ok|okay|looks good|sounds good|go ahead(?: with (?:it|this|that|these|them))?|proceed|works|that works|approved|confirm(?:ed)?|use it|use that|use these|do it|all set|all good|all fine|i like (?:the|this|your) (?:flow|plan|proposal|approach|scope|clarification|defaults?|assumptions?)|i like (?:these|them)|happy with (?:these|them)|these (?:look|sound) (?:good|fine))\b/.test(
    lower
  );
}

function isPlainScopeAffirmation(message: string): boolean {
  const lower = normalizeScopeAnswer(message).toLowerCase();
  if (/\b(?:not|don't|do not|skip|cancel|hold|wait)\b/.test(lower)) {
    return false;
  }
  return /^(?:yes|yep|yeah|ok|okay|looks good|sounds good|go ahead|go ahead with (?:it|this|that|these|them)|proceed|works|that works|approved|confirm(?:ed)?|use it|use that|use these|do it|all set|all good|all fine|i like (?:the|this|your) (?:flow|plan|proposal|approach|scope|clarification|defaults?|assumptions?)|i like (?:these|them)|happy with (?:these|them)|these (?:look|sound) (?:good|fine))\s*[.!?]*$/.test(
    lower
  );
}

function looksLikePureAffirmativeScopeMessage(message: string): boolean {
  const normalized = normalizeScopeAnswer(message).toLowerCase();
  if (!isPlainScopeAffirmation(normalized) && !looksLikeAffirmativeScopeConfirmation(normalized)) {
    return false;
  }

  return !/\b(order|date|window|period|month|months|granularity|refund|refunded|rate|revenue|count|delta|compare|comparison|city|cities|support|ticket|tickets|issue|issues|category|categories|product|products)\b/.test(
    normalized
  );
}

function looksLikeScopeRefinementIntent(message: string): boolean {
  const lower = message.toLowerCase();
  if (parseExplicitScopeAnswerAssignments(message).length > 0) {
    return true;
  }
  if (looksLikeNewQuestionWhileClarifying(message)) {
    return true;
  }
  return /\b(?:scope|clarif|clarification|change|update|adjust|refine|edit|modify|exclude|include|add|remove|replace|for q\d+|q\d+)\b/.test(
    lower
  );
}

function getLastAssistantConversationMessage(state: ChatState): string {
  const lastAssistant = [...state.conversation_history]
    .reverse()
    .find((turn) => turn.role === "assistant");
  return lastAssistant?.content ?? "";
}

function shouldTreatAffirmativeAsBulkScopeConfirmation(
  state: ChatState,
  rawMessage: string
): boolean {
  if (!looksLikeAffirmativeScopeConfirmation(rawMessage)) {
    return false;
  }

  const pendingQuestions = state.scope_questions.filter(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  );
  if (pendingQuestions.length === 0) {
    return false;
  }

  const normalized = normalizeScopeAnswer(rawMessage).toLowerCase();
  if (
    /\bq(?:uestion)?\s*\d+\b/.test(normalized) ||
    looksLikeNewQuestionWhileClarifying(normalized)
  ) {
    return false;
  }

  const nonSuggestedPending = pendingQuestions.filter(
    (entry) => !/^\s*\[suggested\]/i.test(entry.question)
  );
  if (nonSuggestedPending.length === 0) {
    return false;
  }

  const lastAssistant = getLastAssistantConversationMessage(state).toLowerCase();
  const hasGroupedPendingPrompt = (
    /\bneed clarification for \d+ item(?:s)? before data preparation\b/.test(lastAssistant) ||
    /\bplease confirm or edit the pending items\b/.test(lastAssistant) ||
    /\bbefore data preparation, please confirm\b/.test(lastAssistant) ||
    /\bare you okay with these (?:defaults|assumptions)\b/.test(lastAssistant) ||
    /\bdoes that work\b/.test(lastAssistant) ||
    /\bboth are derived from the same\b/.test(lastAssistant) ||
    /\bapplies uniformly across all questions\b/.test(lastAssistant)
  );
  if (hasGroupedPendingPrompt) {
    return true;
  }

  return nonSuggestedPending.length > 1;
}

/**
 * Detect "confirm all" / "ok with everything" style blanket confirmations.
 * These should apply the proposed default to every unanswered scope question.
 */
function isConfirmAllScopeMessage(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase().trim();
  if (
    /\b(?:don't|do not|not)\s+(?:confirm(?:ed)?|approve|accept)\s+all\b/.test(lower) ||
    /\b(?:don't|do not|not)\s+(?:go\s+ahead|use|apply)\s+with\s+everything\b/.test(lower)
  ) {
    return false;
  }
  const naturalGlobalApproval =
    /\b(i\s+like\s+(?:the|this|your)\s+(?:flow|plan|proposal|approach|scope|clarification|defaults?|assumptions?)|i\s+like\s+(?:these|them)|looks?\s+(?:good|great|fine)|sounds?\s+(?:good|great|fine)|go\s+ahead\s+with\s+(?:it|this|that|these|them)|happy\s+with\s+(?:these|them)|works?\s+for\s+me|all\s+set)\b/.test(
      lower
    );
  return (
    /\b(confirm(?:ed)?\s*all|all\s+confirmed|confirmed\s+all(?:\s+questions?)?|all\s+questions?\s+(?:are|is)\s+confirmed|ok\s*with\s*everything|okay\s*with\s*everything|yes\s*to\s*all|accept\s*all|approve\s*all|defaults?\s*(?:are|is|look|looks)?\s*fine|assumptions?\s*(?:are|is|look|looks)?\s*fine|all\s*(?:good|fine|ok|okay|looks?\s*good|sounds?\s*good))\b/.test(lower) ||
    /^(confirm(?:ed)? all|all confirmed|confirmed all(?: questions?)?|all questions (?:are|is) confirmed|yes to all|accept all|approve all|all good|all fine|defaults are fine|assumptions are fine|ok with everything|okay with everything)\s*[.!]?$/.test(lower) ||
    naturalGlobalApproval
  );
}

function parseScopeQuestionNumbersExcludedFromBlanketConfirmation(
  state: ChatState,
  rawMessage: string
): number[] {
  if (state.scope_questions.length === 0) {
    return [];
  }

  const matches = new Set<number>();
  const explicitIdPatterns = [
    /\b(?:all|everything|the rest|rest|remaining(?:\s+questions?)?|others|these|them)\b[\s\S]{0,40}\b(?:except|but(?:\s+not)?|other than)\b[\s:,-]*(?:the\s+)?(?:(?:questions?|qs?)\s*|q\s*)\s*((?:q?\s*\d{1,2}\s*(?:,|\band\b)?\s*){1,6})/gi,
    /\b(?:except|but(?:\s+not)?|other than)\b[\s:,-]*(?:the\s+)?(?:(?:questions?|qs?)\s*|q\s*)\s*((?:q?\s*\d{1,2}\s*(?:,|\band\b)?\s*){1,6})/gi
  ];

  for (const pattern of explicitIdPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(rawMessage);
    while (match !== null) {
      const candidateText = match[1] ?? "";
      const numbers = candidateText.match(/\d{1,2}/g) ?? [];
      for (const rawNumber of numbers) {
        const questionNumber = Number.parseInt(rawNumber, 10);
        if (Number.isInteger(questionNumber) && questionNumber > 0) {
          matches.add(questionNumber);
        }
      }
      match = pattern.exec(rawMessage);
    }
  }

  const descriptorPattern =
    /\b(?:all|everything|the rest|rest|remaining(?:\s+questions?)?|others|these|them)\b[\s\S]{0,40}\b(?:except|but(?:\s+not)?|other than)\b[\s:,-]*(?:the\s+)?(?:question|ask|analysis|scope item)\s+(?:about|on|for)?\s+([^.;\n]+)/i;
  const descriptorMatch = rawMessage.match(descriptorPattern);
  if (descriptorMatch) {
    const questionNumber = findScopeQuestionNumberByDescriptor(state, descriptorMatch[1] ?? "");
    if (questionNumber !== null) {
      matches.add(questionNumber);
    }
  }

  const existingQuestionNumbers = new Set(state.scope_questions.map((entry) => entry.question_number));
  return Array.from(matches.values())
    .filter((questionNumber) => existingQuestionNumbers.has(questionNumber))
    .sort((left, right) => left - right);
}

function shouldConfirmScopeItemsExceptSpecificQuestions(
  rawMessage: string,
  excludedQuestionNumbers: number[]
): boolean {
  if (excludedQuestionNumbers.length === 0) {
    return false;
  }
  if (hasExplicitScopeRemovalIntent(rawMessage)) {
    return false;
  }

  const lower = rawMessage.toLowerCase();
  const hasAffirmativeIntent =
    /\b(?:confirm|confirmed|approve|accept|yes|ok|okay|looks good|sounds good|go ahead|proceed|works|all good|all fine|i like|happy with)\b/.test(
      lower
    );
  const hasExceptionIntent =
    /\b(?:except|but(?:\s+not)?|other than)\b/.test(lower) &&
    /\b(?:all|everything|the rest|rest|remaining(?:\s+questions?)?|others|these|them)\b/.test(lower);
  return hasAffirmativeIntent && hasExceptionIntent;
}

function shouldConfirmRemainingScopeItems(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase().trim();
  if (
    /\b(?:don't|do not|not)\s+(?:confirm(?:ed)?|approve|accept|use\s+defaults?\s+for)\s+(?:the\s+)?(?:rest|remaining(?:\s+questions?)?|others|everything\s+else)\b/.test(
      lower
    )
  ) {
    return false;
  }

  return /\b(?:confirm(?:ed)?|approve|accept|yes(?:\s+to)?|ok(?:ay)?(?:\s+with)?|go\s+ahead\s+with|use\s+defaults?\s+for)\s+(?:the\s+)?(?:rest|remaining(?:\s+questions?)?|others|everything\s+else)\b/.test(
    lower
  );
}

function shouldApplyDefaultsToRemainingScopeItems(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase();
  const asksForDefaults =
    /\b(default|defaults|default assumptions|standard assumptions|safe assumptions|assumption|assumptions)\b/.test(lower) &&
    /\b(remaining|pending|rest|left)\b/.test(lower);
  const proceedIntent = /\b(proceed|go ahead|continue|apply|use|yes|ok|okay|works|do it)\b/.test(lower);
  return asksForDefaults && proceedIntent;
}

function shouldAffirmSuggestedScopeItems(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase();
  const mentionsSuggested = mentionsOptionalScopeSuggestion(rawMessage);
  const affirmative = /\b(include|keep|add|yes|yep|yeah|ok|okay|go ahead|proceed|works|fine)\b/.test(lower);
  return mentionsSuggested && affirmative;
}

function applySemanticScopeFallback(
  state: ChatState,
  rawMessage: string,
  applyAssignment: (questionNumber: number, answer: string) => number,
  options?: { skip_question_numbers?: Set<number> }
): number {
  const unanswered = state.scope_questions.filter((entry) => !entry.answer || entry.answer.trim().length === 0);
  if (unanswered.length === 0) {
    return 0;
  }
  const clauses = extractScopeAnswerClauses(rawMessage);
  if (clauses.length === 0) {
    return 0;
  }

  let assigned = 0;
  const usedQuestionNumbers = new Set<number>();
  for (const clause of clauses) {
    const normalized = normalizeScopeAnswer(clause);
    const clauseEditsExistingQuestion = looksLikeExistingScopeQuestionEditClause(clause);
    const clauseLooksLikeOpenQuestion =
      /\?/.test(clause) ||
      /^(?:can you|could you|would you|will you|show me|tell me)\b/i.test(normalized) ||
      (/^give me\b/i.test(normalized) && /\?/.test(clause));
    const looksLikeFollowUpQuestion =
      !clauseEditsExistingQuestion &&
      looksLikePureNewQuestionClause(normalized) &&
      (
        !looksLikeScopeAnswerDirective(normalized) ||
        clauseLooksLikeOpenQuestion ||
        /\b(?:also|and also|another|one more|new question|follow[- ]?up|what about)\b/i.test(normalized)
      );
    if (normalized.length < 8 || looksLikeFollowUpQuestion) {
      continue;
    }

    const hasRefundRateFormulaSignal =
      /\brefund\s+rate\b/i.test(normalized) ||
      /\brefunded\s+revenue\s*\/\s*total\s+revenue\b/i.test(normalized) ||
      /\brefunded\s+orders\s*\/\s*total\s+orders\b/i.test(normalized);
    if (hasRefundRateFormulaSignal) {
      const directFormulaCandidates = unanswered
        .filter((entry) => !usedQuestionNumbers.has(entry.question_number))
        .filter((entry) =>
          /\b(rate|ratio|formula)\b/i.test(`${entry.question} ${entry.clarification}`)
        )
        .map((entry) => ({
          question_number: entry.question_number,
          score: scoreScopeAnswerClauseAgainstQuestion(
            normalized,
            entry.question,
            entry.clarification
          )
        }))
        .sort((a, b) => b.score - a.score);
      if (directFormulaCandidates.length > 0) {
        const chosen = directFormulaCandidates[0]!;
        assigned += applyAssignment(chosen.question_number, normalized);
        usedQuestionNumbers.add(chosen.question_number);
        continue;
      }
    }

    let bestMatch: { question_number: number; score: number } | null = null;
    for (const entry of unanswered) {
      if (options?.skip_question_numbers?.has(entry.question_number)) {
        continue;
      }
      if (usedQuestionNumbers.has(entry.question_number)) {
        continue;
      }
      if (!isClauseCompatibleWithScopeQuestion(normalized, entry.question, entry.clarification)) {
        continue;
      }
      const score = scoreScopeAnswerClauseAgainstQuestion(normalized, entry.question, entry.clarification);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { question_number: entry.question_number, score };
      }
    }

    if (!bestMatch) {
      continue;
    }

    const matchedQuestion = unanswered.find(
      (entry) => entry.question_number === bestMatch.question_number
    );
    const isSuggestedMatch = Boolean(
      matchedQuestion && /^\s*\[suggested\]/i.test(matchedQuestion.question)
    );
    const minScore = isSuggestedMatch ? 2.8 : 1.2;
    if (bestMatch.score < minScore) {
      continue;
    }

    assigned += applyAssignment(bestMatch.question_number, normalized);
    usedQuestionNumbers.add(bestMatch.question_number);
  }

  return assigned;
}

function isClauseCompatibleWithScopeQuestion(
  clause: string,
  question: string,
  clarification = ""
): boolean {
  const normalizedClause = normalizeScopeAnswer(clause).toLowerCase();
  if (normalizedClause.length === 0) {
    return false;
  }

  const targetText = `${question} ${clarification}`.toLowerCase();
  const hasRefundRateFormulaSignal =
    /\brefund\s+rate\b/.test(normalizedClause) ||
    /\brefunded\s+revenue\s*\/\s*total\s+revenue\b/.test(normalizedClause) ||
    /\brefunded\s+orders\s*\/\s*total\s+orders\b/.test(normalizedClause);

  if (hasRefundRateFormulaSignal && !/\b(rate|ratio|formula)\b/.test(targetText)) {
    return false;
  }

  const clauseLooksLikeTimeOnlyApproval =
    /\b(time|window|period|month|months|date|dates|granularity|timeframe|anchor)\b/.test(
      normalizedClause
    ) &&
    !/\b(city|cities|region|state|country|support|ticket|tickets|issue|issues|reason|reasons|resolution|rate|ratio|formula|top\s+\d+|count|value|revenue)\b/.test(
      normalizedClause
    );
  if (clauseLooksLikeTimeOnlyApproval) {
    const clarificationNeedsTimeDecision = /\b(date|window|period|month|months|granularity|timeframe|anchor)\b/.test(
      clarification.toLowerCase()
    );
    if (!clarificationNeedsTimeDecision) {
      return false;
    }
  }

  const isSuggested = /^\s*\[suggested\]/i.test(question);
  if (!isSuggested) {
    return true;
  }

  if (
    /\b(include|keep|retain|add)\b/.test(normalizedClause) &&
    /\b(suggested|extra|additional)\b/.test(normalizedClause)
  ) {
    return true;
  }

  const userTokens = new Set(tokenizeForSimilarity(normalizedClause));
  const targetTokens = tokenizeForSimilarity(
    question.replace(/^\s*\[suggested\]\s*/i, "")
  );
  const nonGenericTokens = targetTokens.filter(
    (token) => !SUGGESTED_SCOPE_GENERIC_TOKENS.has(token)
  );
  if (nonGenericTokens.length === 0) {
    return false;
  }

  return nonGenericTokens.some((token) => userTokens.has(token));
}

function extractScopeAnswerClauses(rawMessage: string): string[] {
  const normalized = rawMessage
    .replace(/\r\n/g, "\n")
    .replace(/(?:^|[\n\r;,])\s*(?:[-*]\s*)?q(?:uestion)?\s*\d{1,2}\s*/gim, "\n")
    .replace(/[.;]\s+/g, "\n")
    .replace(
      /,\s+(?=(?:top\s+\d+\b|use\s+only\b|include\s+only\b|same\s+as\b|for\s+q(?:uestion)?\s*\d+\b|q(?:uestion)?\s*\d+\b|only\s+\w+\b))/gi,
      "\n"
    )
    .replace(/\s+(?:and also|plus)\s+/gi, "\n")
    .replace(
      /\s+also\s+(?=(?:include\b|add\b|keep\b|use\b|take\b|for\b|q(?:uestion)?\s*\d+\b|top\s+\d+\b|same\s+as\b|only\b|show\b|give\b|tell\b|what\b|which\b|how\b|can\s+you\b|could\s+you\b|would\s+you\b))/gi,
      "\n"
    );

  return normalized
    .split(/\n+/g)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .map((line) => line.replace(/^(?:q(?:uestion)?\s*\d{1,2}\s*[:\-)\]]\s*)/i, ""))
    .map((line) => stripScopeManagementPhrasesFromClause(line).trim())
    .flatMap((line) => splitCompoundScopeClause(line))
    .map((line) => line.trim())
    .filter((line) => line.length >= 8);
}

function stripScopeManagementPhrasesFromClause(value: string): string {
  return value
    .replace(
      /^(?:confirm(?:ed)?|approve|accept|yes(?:\s+to)?|ok(?:ay)?(?:\s+with)?|go\s+ahead(?:\s+with)?|use\s+(?:defaults?|assumptions?)\s+for|i\s+like|happy\s+with)\s+(?:the\s+)?(?:all|rest|remaining(?:\s+questions?)?|others|everything(?:\s+else)?|these|them|your\s+assumptions?)\s*[,;:-]*/i,
      ""
    )
    .replace(/^(?:all\s+(?:good|fine|set)|defaults?\s+(?:are|look|looks)\s+fine|assumptions?\s+(?:are|look|looks)\s+fine)\s*[,;:-]*/i, "")
    .replace(
      /(?:,|;)?\s*(?:(?:and\s+)?also\s+|and\s+)?(?:don't|do not|not)\s+(?:add|include|keep|use|want|need)\s+(?:the\s+)?(?:suggested|optional|extra|additional)\s+(?:question|questions|analysis|analyses|ask|asks|item|items)\b.*$/i,
      ""
    )
    .replace(
      /(?:,|;)?\s*(?:(?:and\s+)?also\s+|and\s+)?(?:exclude|remove|drop|delete|skip|omit|cancel|decline|reject|ignore)\s+(?:the\s+)?(?:suggested|optional|extra|additional)\s+(?:question|questions|analysis|analyses|ask|asks|item|items)\b.*$/i,
      ""
    )
    .replace(
      /(?:,|;)?\s*(?:(?:and\s+)?also\s+|and\s+)?(?:include|add|keep|use|take)\s+(?:the\s+)?(?:suggested|suggestion|optional|extra|additional|add[- ]?on|addon)\s+(?:question|questions|analysis|analyses|ask|asks|item|items)?\b.*$/i,
      ""
    )
    .trim();
}

function detectScopeClauseDomains(value: string): Set<string> {
  const lower = value.toLowerCase();
  const domains = new Set<string>();
  if (/\b(top|rank|ranking)\s+\d+\b/.test(lower)) {
    domains.add("ranking");
  }
  if (/\b(city|cities|region|state|country|location)\b/.test(lower)) {
    domains.add("geo");
  }
  if (/\b(issue|issues|reason|reasons|ticket|tickets|support|resolution)\b/.test(lower)) {
    domains.add("support");
  }
  if (/\b(category|categories|product|products|sku|skus)\b/.test(lower)) {
    domains.add("product");
  }
  if (/\b(date|window|period|month|months|weekly|monthly|daily|quarter|year|granularity|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(lower)) {
    domains.add("time");
  }
  if (/\b(rate|ratio|formula|delta|compare|comparison|trend|revenue|value|count|refund|refunded)\b/.test(lower)) {
    domains.add("metric");
  }
  return domains;
}

function splitCompoundScopeClause(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.length < 8 || !/\band\b/i.test(trimmed)) {
    return [trimmed];
  }

  const parts = trimmed
    .split(/\s+\band\b\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8);
  if (parts.length < 2) {
    return [trimmed];
  }

  const repeatedRankingParts = parts.filter((part) => /\b(top|rank|ranking)\s+\d+\b/i.test(part)).length;
  const domainSignatures = parts.map((part) =>
    Array.from(detectScopeClauseDomains(part))
      .filter((domain) => domain !== "ranking" && domain !== "metric" && domain !== "time")
      .sort()
      .join("|")
  );
  const hasDistinctSubstantiveDomains =
    domainSignatures.filter((signature) => signature.length > 0).length >= 2 &&
    new Set(domainSignatures.filter((signature) => signature.length > 0)).size >= 2;

  if (repeatedRankingParts >= 2 || hasDistinctSubstantiveDomains) {
    return parts;
  }

  return [trimmed];
}

function looksLikeScopeAnswerDirective(clause: string): boolean {
  const lower = clause.toLowerCase();
  return /\b(?:top\s+\d+|same as|only|just|use|window|windows|period|periods|month|months|weekly|monthly|daily|granularity|delta|count|value|revenue|rate|formula|cities|city|issue|issues|support|ticket|tickets|category|categories|product|products|refunded|refund)\b/.test(
    lower
  );
}

function looksLikePureNewQuestionClause(clause: string): boolean {
  const lower = clause.toLowerCase().trim();
  if (lower.length === 0) {
    return true;
  }
  if (lower.includes("?")) {
    return true;
  }
  if (/^(?:can you|could you|would you|will you|show me|give me|tell me|what|which|who|why|how|add|new question|follow[- ]?up|what about)\b/.test(lower)) {
    return true;
  }
  if (/^(?:also|and also|plus|another|one more|new question|follow[- ]?up|what about)\b/.test(lower) && /\b(add|show|give|tell|include|analysis|breakdown|question)\b/.test(lower)) {
    return true;
  }
  if (/\b(can you|could you|would you|show me|give me|tell me|add another|one more|new question|follow[- ]?up|what about)\b/.test(lower)) {
    return true;
  }
  return false;
}

function extractReferencedScopeQuestionNumbers(clause: string): number[] {
  const matches = clause.matchAll(/\bq(?:uestion)?\s*(\d{1,2})\b/gi);
  const numbers = new Set<number>();
  for (const match of matches) {
    const questionNumber = Number.parseInt(match[1] ?? "", 10);
    if (Number.isInteger(questionNumber) && questionNumber > 0) {
      numbers.add(questionNumber);
    }
  }
  return Array.from(numbers.values()).sort((left, right) => left - right);
}

function stripReferencedScopeQuestionFromClause(clause: string, questionNumber: number): string {
  return clause
    .replace(new RegExp(`\\b(?:for|on|in|about)\\s+q(?:uestion)?\\s*${questionNumber}\\b`, "gi"), " ")
    .replace(new RegExp(`^\\s*q(?:uestion)?\\s*${questionNumber}\\b\\s*[:\\-)\\]]?\\s*`, "i"), "")
    .replace(new RegExp(`\\bq(?:uestion)?\\s*${questionNumber}\\b`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExplicitScopeClauseAnswer(clause: string, questionNumber: number): string {
  return normalizeScopeAnswer(
    stripTrailingScopeManagementFromAnswer(
      stripReferencedScopeQuestionFromClause(clause, questionNumber)
        .replace(/^(?:please\s+)?(?:show|give|tell)\s+me\s+/i, "")
        .replace(/^(?:please\s+)?(?:make it|keep it|set it to)\s+/i, "")
    )
  );
}

function looksLikeExistingScopeQuestionEditClause(clause: string): boolean {
  const questionNumbers = extractReferencedScopeQuestionNumbers(clause);
  if (questionNumbers.length !== 1) {
    return false;
  }

  const normalized = normalizeExplicitScopeClauseAnswer(clause, questionNumbers[0]!);
  if (normalized.length === 0) {
    return false;
  }

  return (
    looksLikeScopeAnswerDirective(normalized) ||
    /^(?:show|give|tell)\b/i.test(normalized) ||
    /\b(?:change|adjust|edit|update|use|keep|set|only|just|same as|top\s+\d+|rank|cutoff)\b/i.test(
      normalized
    )
  );
}

function hasExplicitNewQuestionDirectiveWhileClarifying(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  const declinesSuggestedAdd =
    /\b(?:don't|do not|not)\s+add\b/.test(lower) &&
    mentionsOptionalScopeSuggestion(message);
  const isScopeSuggestionDecision =
    mentionsOptionalScopeSuggestion(message) &&
    (
      /\b(?:include|add|keep|use|take|exclude|remove|drop|delete|skip|omit|cancel|decline|reject|ignore)\b/.test(
        lower
      ) ||
      /\b(?:don't|do not|not)\s+(?:add|include|keep|use|want|need)\b/.test(lower)
    );
  const clauses = extractScopeAnswerClauses(trimmed);
  const hasStandaloneNewQuestionClause = clauses.some(
    (clause) =>
      !looksLikeExistingScopeQuestionEditClause(clause) &&
      !mentionsOptionalScopeSuggestion(clause) &&
      looksLikePureNewQuestionClause(clause)
  );

  if (trimmed.includes("?") && hasStandaloneNewQuestionClause) {
    return true;
  }

  if (
    /\b(can you|could you|would you|show me|give me|tell me)\b/.test(lower) &&
    hasStandaloneNewQuestionClause
  ) {
    return true;
  }

  if (
    !declinesSuggestedAdd &&
    !isScopeSuggestionDecision &&
    (
      /\b(add|also add|another|one more|new question|add question|follow[- ]?up|what about)\b/.test(lower) ||
      hasStandaloneNewQuestionClause
    )
  ) {
    return true;
  }

  return /^(what|which|how|who|why)\b/.test(lower) && !/\bq(?:uestion)?\s*\d+\b/.test(lower);
}

function scoreScopeAnswerClauseAgainstQuestion(
  clause: string,
  question: string,
  clarification: string
): number {
  const clauseTokens = tokenizeForSimilarity(clause);
  const targetTokens = tokenizeForSimilarity(`${question} ${clarification}`);
  if (clauseTokens.length === 0 || targetTokens.length === 0) {
    return 0;
  }

  const clauseSet = new Set(clauseTokens);
  const targetSet = new Set(targetTokens);

  let overlap = 0;
  for (const token of clauseSet) {
    if (targetSet.has(token)) {
      overlap += 1;
    }
  }

  let score = overlap;
  const lowerClause = clause.toLowerCase();
  const lowerTarget = `${question} ${clarification}`.toLowerCase();

  const timelineSignal = /\b(date|timeline|window|period|month|months|week|weeks|quarter|year|today|feb|jan|nov|dec)\b/;
  const metricSignal = /\b(metric|rate|count|value|amount|revenue|refunded|refund|percentage|ratio)\b/;
  const geoSignal = /\b(city|cities|region|state|country|location)\b/;
  const supportSignal = /\b(support|ticket|issue|reason|resolution|order_id|customer_id)\b/;
  const approvalSignal = /\b(yes|approved|confirm|confirmed|go ahead|works|that works|looks good|proceed)\b/;
  const refundRateFormulaSignal =
    /\brefund\s+rate\b|\brefunded\s+revenue\s*\/\s*total\s+revenue\b|\brefunded\s+orders\s*\/\s*total\s+orders\b/;

  if (timelineSignal.test(lowerClause) && timelineSignal.test(lowerTarget)) {
    score += 1.2;
  }
  if (metricSignal.test(lowerClause) && metricSignal.test(lowerTarget)) {
    score += 1.2;
  }
  if (geoSignal.test(lowerClause) && geoSignal.test(lowerTarget)) {
    score += 0.8;
  }
  if (supportSignal.test(lowerClause) && supportSignal.test(lowerTarget)) {
    score += 0.8;
  }
  if (refundRateFormulaSignal.test(lowerClause) && refundRateFormulaSignal.test(lowerTarget)) {
    score += 1.4;
  }
  if (approvalSignal.test(lowerClause)) {
    score += 0.4;
  }

  return score;
}

function looksLikeNewQuestionWhileClarifying(message: string): boolean {
  const lower = message.trim().toLowerCase();
  if (hasExplicitNewQuestionDirectiveWhileClarifying(message)) {
    return true;
  }

  if (looksLikeAnalysisIntent(lower) && !looksLikeAffirmativeScopeConfirmation(lower)) {
    return true;
  }

  return false;
}

function parseExplicitScopeAnswerAssignments(
  rawMessage: string
): Array<{ question_number: number; answer: string }> {
  const patterns = [
    /(?:^|[\n\r]|[,;])\s*(?:[-*]\s*)?q(?:uestion)?\s*(\d{1,2})\s*(?:[:\-)\]]\s*|\s+)([\s\S]*?)(?=(?:^|[\n\r]|[,;])\s*(?:[-*]\s*)?q(?:uestion)?\s*\d{1,2}\s*(?:[:\-)\]]\s*|\s+)|$)/gim,
    /(?:^|[\n\r]|\b)\s*q(?:uestion)?\s*(\d{1,2})\s*[:\-)\]]\s*([\s\S]*?)(?=(?:\s*q(?:uestion)?\s*\d{1,2}\s*[:\-)\]])|$)/gi,
    /(?:^|[\n\r;,])\s*q(?:uestion)?\s*(\d{1,2})\s*(?:[:\-)\]]\s*)?([\s\S]*?)(?=(?:^|[\n\r;,])\s*q(?:uestion)?\s*\d{1,2}\b|$)/gim
  ];

  const assignments = new Map<number, string>();
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    match = pattern.exec(rawMessage);
    while (match !== null) {
      const questionNumber = Number.parseInt(match[1] ?? "", 10);
      const matchedInstruction = match[0] ?? "";
      const rawAnswer = (match[2] ?? "").replace(/^(?:and|also|plus|then)\b[:\s-]*/i, "");
      const looksLikeGroupedQuestionReferenceTail =
        /^(?:and|&|\/|\+)\s*(?:q(?:uestion)?\s*)?\d+\b/i.test((match[2] ?? "").trim()) ||
        /^and\s+\d+\b/i.test((match[2] ?? "").trim());
      const splitAnswer = splitScopeAnswerAndImpromptuQuestion(rawAnswer);
      const answer = normalizeScopeAnswer(
        stripTrailingScopeManagementFromAnswer(splitAnswer.primary_answer)
      );
      const looksLikeConnectorOnly =
        /^(?:and|or|plus|also|&|,|\.)+\s*(?:\d{1,2}|q(?:uestion)?\s*\d{1,2})?$/i.test(answer);
      const looksLikeRemovalInstruction =
        /\b(?:exclude|remove|drop|delete|skip|omit|cancel|(?:do not|don't)\s+include)\b/i.test(
          matchedInstruction
        ) &&
        (/^from\s+(?:the\s+)?scope\b/i.test(answer) ||
          /\b(?:should be|to be)\s*(?:excluded|removed|dropped|deleted|skipped|omitted|cancelled|canceled)\b/i.test(
            answer
          ));
      if (
        Number.isFinite(questionNumber) &&
        questionNumber > 0 &&
        answer.length > 0 &&
        !looksLikeGroupedQuestionReferenceTail &&
        !looksLikeConnectorOnly &&
        !looksLikeRemovalInstruction
      ) {
        assignments.set(questionNumber, answer);
      }
      match = pattern.exec(rawMessage);
    }
  }

  const clauses = extractScopeAnswerClauses(rawMessage);
  for (const clause of clauses) {
    const referencedQuestionNumbers = extractReferencedScopeQuestionNumbers(clause);
    if (referencedQuestionNumbers.length !== 1) {
      continue;
    }

    const questionNumber = referencedQuestionNumbers[0]!;
    if (assignments.has(questionNumber)) {
      continue;
    }

    if (
      /\b(?:exclude|remove|drop|delete|skip|omit|cancel|decline|reject|ignore)\b/i.test(clause) ||
      mentionsOptionalScopeSuggestion(clause)
    ) {
      continue;
    }

    const splitAnswer = splitScopeAnswerAndImpromptuQuestion(
      normalizeExplicitScopeClauseAnswer(clause, questionNumber)
    );
    const answer = normalizeScopeAnswer(
      stripTrailingScopeManagementFromAnswer(splitAnswer.primary_answer)
    );
    const looksLikeConnectorOnly =
      /^(?:and|or|plus|also|&|,|\.)+\s*(?:\d{1,2}|q(?:uestion)?\s*\d{1,2})?$/i.test(answer);
    if (answer.length === 0 || looksLikeConnectorOnly) {
      continue;
    }

    assignments.set(questionNumber, answer);
  }

  return Array.from(assignments.entries())
    .map(([question_number, answer]) => ({ question_number, answer }))
    .sort((left, right) => left.question_number - right.question_number);
}

function extractImpromptuScopeQuestionFromClarification(
  state: ChatState,
  rawMessage: string,
  explicitAssignments: Array<{ question_number: number; answer: string }>
): string | null {
  for (const assignment of explicitAssignments) {
    const split = splitScopeAnswerAndImpromptuQuestion(assignment.answer);
    if (!split.impromptu_question) {
      continue;
    }

    const target = state.scope_questions.find((entry) => entry.question_number === assignment.question_number);
    if (target && split.primary_answer.length > 0) {
      target.answer = split.primary_answer;
    }
    return split.impromptu_question;
  }

  if (!/\b(also|and also|plus|additionally|one more|another)\b/i.test(rawMessage)) {
    return extractPrefixedImpromptuQuestion(rawMessage);
  }

  const extractedClause = extractImpromptuQuestionClause(rawMessage);
  if (extractedClause) {
    return extractedClause;
  }

  const directPrefixedQuestion = extractPrefixedImpromptuQuestion(rawMessage);
  if (directPrefixedQuestion) {
    return directPrefixedQuestion;
  }

  const remainder = rawMessage
    .replace(
      /(?:^|[\n\r]|\b)\s*q(?:uestion)?\s*\d{1,2}\s*[:\-)\]]\s*[\s\S]*?(?=(?:\s*q(?:uestion)?\s*\d{1,2}\s*[:\-)\]])|$)/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
  if (remainder.length === 0) {
    return null;
  }

  const normalized = cleanScopeQuestionText(
    remainder.replace(/^(?:also|and also|plus|additionally|one more|another)\b[:\s-]*/i, "")
  );
  if (normalized.length < 16) {
    return null;
  }
  if (looksLikeExistingScopeQuestionEditClause(normalized)) {
    return null;
  }
  if (!looksLikePureNewQuestionClause(normalized)) {
    return null;
  }
  return normalized;
}

function extractPrefixedImpromptuQuestion(rawMessage: string): string | null {
  const match = /(?:^|[.;]\s+)(?:new question|follow[- ]?up(?: question)?|add (?:another |one more )?(?:question|analysis|ask)|what about)\s*[:-]?\s*([\s\S]+)$/i.exec(
    rawMessage
  );
  if (!match) {
    return null;
  }

  const candidate = cleanScopeQuestionText(match[1] ?? "");
  if (candidate.length < 16) {
    return null;
  }
  if (looksLikeExistingScopeQuestionEditClause(candidate)) {
    return null;
  }
  if (!looksLikePureNewQuestionClause(candidate) && !looksLikeStandaloneScopeClause(candidate)) {
    return null;
  }
  return candidate;
}

function extractImpromptuQuestionClause(rawMessage: string): string | null {
  const markerPattern = /\b(?:also|and also|plus|additionally|one more|another|new question|follow[- ]?up(?: question)?|what about)\b/gi;
  const clauses = rawMessage
    .replace(/\r\n/g, "\n")
    .split(markerPattern)
    .map((part) => cleanScopeQuestionText(part))
    .filter((part) => part.length >= 12);

  if (clauses.length <= 1) {
    return null;
  }

  for (let index = 1; index < clauses.length; index += 1) {
    const clause = clauses[index]!;
    const normalized = cleanScopeQuestionText(
      clause
        .replace(/^(?:can you|could you|would you|please|show me|give me|tell me)\s+/i, "")
        .replace(/^(?:add (?:another |one more )?(?:question|analysis|ask)|new question|follow[- ]?up(?: question)?)\s*[:-]?\s*/i, "")
    );
    if (normalized.length < 16) {
      continue;
    }
    if (looksLikeExistingScopeQuestionEditClause(clause) || looksLikeExistingScopeQuestionEditClause(normalized)) {
      continue;
    }
    if (!looksLikePureNewQuestionClause(clause)) {
      continue;
    }
    return normalized;
  }

  return null;
}

function splitScopeAnswerAndImpromptuQuestion(answer: string): {
  primary_answer: string;
  impromptu_question: string | null;
} {
  const match = /(?:^|[.;]\s+|,\s+|\n+)(?:and also add (?:another |one more )?(?:question|analysis|ask)|also add (?:another |one more )?(?:question|analysis|ask)|add (?:another |one more )?(?:question|analysis|ask)|also|and also|plus|additionally|one more|another|new question|follow[- ]?up(?: question)?|what about)\s*[:-]?\s*([\s\S]+)$/i.exec(
    answer
  );
  if (!match || typeof match.index !== "number") {
    return {
      primary_answer: stripTrailingScopeManagementFromAnswer(answer),
      impromptu_question: null
    };
  }

  const primary = cleanScopeQuestionText(
    stripTrailingScopeManagementFromAnswer(answer.slice(0, match.index))
  );
  const candidate = cleanScopeQuestionText(match[1] ?? "");
  if (primary.length === 0 || candidate.length < 16) {
    return {
      primary_answer: stripTrailingScopeManagementFromAnswer(answer),
      impromptu_question: null
    };
  }
  if (looksLikeExistingScopeQuestionEditClause(candidate)) {
    return {
      primary_answer: stripTrailingScopeManagementFromAnswer(answer),
      impromptu_question: null
    };
  }
  if (!looksLikeStandaloneScopeClause(candidate) && !looksLikeAnalysisIntent(candidate.toLowerCase())) {
    return {
      primary_answer: stripTrailingScopeManagementFromAnswer(answer),
      impromptu_question: null
    };
  }

  return {
    primary_answer: primary,
    impromptu_question: candidate
  };
}

function stripTrailingScopeManagementFromAnswer(value: string): string {
  return value
    .replace(
      /(?:,|;|\band\b)?\s*(?:confirm(?:ed)?|approve|accept|yes(?:\s+to)?|ok(?:ay)?(?:\s+with)?|go\s+ahead(?:\s+with)?|use\s+(?:defaults?|assumptions?)\s+for|i\s+like|happy\s+with)\s+(?:the\s+)?(?:all|rest|remaining(?:\s+questions?)?|others|everything\s+else|these|them|your\s+assumptions?)[.!?]*\s*$/i,
      ""
    )
    .trim();
}

function normalizeScopeAnswer(value: string): string {
  return value
    .replace(/^\s*q(?:uestion)?\s*\d+\s*(?:\+|\/|&|and)\s*q(?:uestion)?\s*\d+\s*[:\-)\]]?\s*/i, "")
    .replace(/^\s*(q(?:uestion)?\s*\d+|[1-9]\d*)\s*[):.-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getStandalonePendingClarificationPrompts(state: ChatState): string[] {
  const questionNumbers = new Set(state.scope_questions.map((entry) => entry.question_number));
  const prompts = state.pending_inputs
    .filter(
      (entry) =>
        typeof entry.question_number !== "number" ||
        !questionNumbers.has(entry.question_number)
    )
    .map((entry) => entry.prompt.trim())
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(prompts));
}

function buildScopeSuggestionLines(state: ChatState): string[] {
  if (state.scope_suggestions.length === 0) {
    return [];
  }

  return state.scope_suggestions.map((entry) =>
    `- ${getScopeSuggestionDisplayLabel(state, entry.suggestion_number)}: ${entry.question}`
  );
}

function buildVisibleScopeQuestionLines(
  state: ChatState,
  options: { include_suggestions: boolean }
): string[] {
  const scopedLines = state.scope_questions.map(
    (entry) => `- Q${entry.question_number}: ${entry.question}`
  );
  if (!options.include_suggestions || state.scope_suggestions.length === 0) {
    return scopedLines;
  }

  return [
    ...scopedLines,
    ...buildScopeSuggestionLines(state)
  ];
}

export function buildDisplayClarificationPromptForScopeQuestion(
  state: ChatState,
  question: ScopeQuestionEntry
): string {
  return buildAssumptionPromptForScopeQuestion(state, question);
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  return trimmed[0]!.toUpperCase() + trimmed.slice(1);
}

function buildFallbackScopeResolutionSummary(
  state: ChatState,
  entry: ScopeQuestionEntry
): string {
  const lower = `${entry.question} ${entry.clarification}`.toLowerCase();
  const requestedMonths = getRequestedMonthWindowFromScope(state, lower);
  const explicitTopN = /\btop\s+(\d{1,2})\b/i.exec(entry.question)?.[1] ?? null;
  const matchedMetric = findSavedMetricDefinitionForText(
    state.metric_definitions,
    `${entry.question} ${entry.clarification}`
  );

  if (/\bresolution\b/.test(lower) && /\bissue\b/.test(lower)) {
    return "Tickets linked to refunded orders, broken down by issue type.";
  }

  if (/\b(?:support|ticket|tickets)\b/.test(lower) && /\b(?:issue|reason)\b/.test(lower)) {
    return "Tickets linked to refunded orders, ranked by issue type.";
  }

  if (/\b(?:support|ticket|tickets)\b/.test(lower)) {
    return "Tickets linked to refunded orders only.";
  }

  if (/\brefund\b/.test(lower) && /\b(?:rate|ratio|percent|percentage)\b/.test(lower) && /\b(?:city|cities|region|regions)\b/.test(lower)) {
    const metricLabel = matchedMetric?.display_name?.trim() || "Refund rate";
    return `${metricLabel} by city${explicitTopN ? `, top ${explicitTopN}` : ""}.`;
  }

  if (/\b(?:compare|comparison|vs|versus|prior|previous)\b/.test(lower)) {
    if (requestedMonths !== null) {
      return `Latest ${requestedMonths} months vs the prior ${requestedMonths} months.`;
    }
    return "Use the agreed comparison windows.";
  }

  if (/\b(?:trend|month|months|week|weeks|quarter|quarters|timeline|period|window)\b/.test(lower)) {
    if (requestedMonths !== null) {
      return `Last ${requestedMonths} complete months with monthly buckets.`;
    }
    return "Use the agreed trend window.";
  }

  if (/\b(?:top|highest|lowest|rank|ranking)\b/.test(lower)) {
    return `Use the agreed ranking cutoff${explicitTopN ? ` (top ${explicitTopN})` : ""}.`;
  }

  return "Use the agreed filters and time range.";
}

function buildDisplayScopeResolutionSummary(
  state: ChatState,
  entry: ScopeQuestionEntry
): string {
  const raw =
    entry.answer && entry.answer.trim().length > 0
      ? entry.answer.trim()
      : buildProposedDefaultForScopeQuestion(state, entry);

  let cleaned = raw
    .replace(/^Confirmed:\s*/i, "")
    .replace(/\bUsing saved metric:\s*.+$/i, "")
    .replace(/Anchor relative windows to [^.]+?\.\s*/gi, "")
    .replace(/Use a \d+-month window anchored to today [^.]+?\.\s*/gi, "")
    .replace(/[A-Z][a-z]+ \d{4} is in progress[^.]*\.\s*/g, "")
    .replace(/Use monthly granularity by default for trend readability\.?/gi, "Monthly buckets.")
    .replace(/Return both absolute and percentage delta by default\.?/gi, "")
    .replace(/Return [^.]+ by default\.?/gi, "")
    .replace(/Will compute [^.]+\.?/gi, "")
    .replace(/show the trend at the requested grain unless you want a different cutoff or formula\.?/gi, "")
    .replace(/unless you (?:want|choose|specify) [^.]+\.?/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  cleaned = cleaned
    .split(/(?<=[.])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .join(" ");

  if (cleaned.length === 0) {
    cleaned = buildFallbackScopeResolutionSummary(state, entry);
  }

  return sentenceCase(cleaned);
}

function buildPendingScopeClarificationLines(state: ChatState): {
  with_defaults: string[];
  without_defaults: string[];
} {
  const pendingQuestions = state.scope_questions.filter(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  );
  const withDefaults = pendingQuestions.map((entry) => {
    const clarification = buildDisplayClarificationPromptForScopeQuestion(state, entry);
    return `- Q${entry.question_number}: ${clarification}`;
  });

  const standalonePrompts = getStandalonePendingClarificationPrompts(state).map(
    (prompt) => `- ${prompt}`
  );

  return {
    with_defaults: withDefaults,
    without_defaults: standalonePrompts
  };
}

function buildConfirmedScopeAnswerLines(state: ChatState): string[] {
  return state.scope_questions.map((entry) => {
    return `- Q${entry.question_number}: ${buildDisplayScopeResolutionSummary(state, entry)}`;
  });
}

function buildEmptyScopeClarificationMessage(): string {
  return "No scoped questions remain. Tell me the question or questions you want to analyze, and I'll rebuild the clarifications before data preparation.";
}

function buildScopeClarificationIntroMessage(state: ChatState): string {
  if (state.scope_questions.length === 0) {
    return buildEmptyScopeClarificationMessage();
  }

  const pendingSections = buildPendingScopeClarificationLines(state);
  if (pendingSections.with_defaults.length === 0 && pendingSections.without_defaults.length === 0) {
    return "All scope clarifications are captured.";
  }
  return [
    "Before data preparation, let’s close the remaining scope details.",
    "If you add or remove a question, the scope list below updates immediately.",
    "",
    "Questions in scope:",
    buildVisibleScopeQuestionLines(state, { include_suggestions: true }).join("\n"),
    pendingSections.with_defaults.length > 0 ? "" : null,
    pendingSections.with_defaults.length > 0 ? "Clarifications to confirm:" : null,
    pendingSections.with_defaults.length > 0 ? pendingSections.with_defaults.join("\n\n") : null,
    pendingSections.without_defaults.length > 0 ? "" : null,
    pendingSections.without_defaults.length > 0 ? "Other open clarifications:" : null,
    pendingSections.without_defaults.length > 0 ? pendingSections.without_defaults.join("\n") : null,
    "",
    state.scope_suggestions.length > 0
      ? buildScopeSuggestionIncludeInstruction(state)
      : "You can add a new question in plain English or remove a scoped question by saying remove Q3.",
    "You can reply naturally, for example: confirm all, go ahead with these, or all good except Q2.",
    "Run Data Preparation will appear once these are closed."
  ]
    .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    .join("\n");
}

function buildScopeClarificationPendingMessage(state: ChatState): string {
  if (state.scope_questions.length === 0) {
    return buildEmptyScopeClarificationMessage();
  }

  const pendingSections = buildPendingScopeClarificationLines(state);
  if (pendingSections.with_defaults.length === 0 && pendingSections.without_defaults.length === 0) {
    return "All scope clarifications are captured.";
  }
  const totalPendingCount =
    pendingSections.with_defaults.length + pendingSections.without_defaults.length;

  return [
    `Still need clarification on ${totalPendingCount} item${totalPendingCount === 1 ? "" : "s"} before data preparation.`,
    "The scope list below is the exact set of questions that will be prepared.",
    "",
    "Questions in scope:",
    buildVisibleScopeQuestionLines(state, { include_suggestions: true }).join("\n"),
    "",
    pendingSections.with_defaults.length > 0 ? "Clarifications to confirm:" : null,
    pendingSections.with_defaults.length > 0 ? pendingSections.with_defaults.join("\n\n") : null,
    pendingSections.without_defaults.length > 0 ? "" : null,
    pendingSections.without_defaults.length > 0 ? "Other open clarifications:" : null,
    pendingSections.without_defaults.length > 0 ? pendingSections.without_defaults.join("\n") : null,
    "",
    state.scope_suggestions.length > 0
      ? buildScopeSuggestionIncludeInstruction(state)
      : "You can add a new question in plain English or remove a scoped question by saying remove Q3.",
    "Reply naturally and I’ll keep this scope updated. Run Data Preparation will appear once these are closed."
  ]
    .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    .join("\n");
}

function buildLockedScopeMessage(
  state: ChatState,
  options?: {
    intro_lines?: string[];
    footer_lines?: string[];
  }
): string {
  const introLines = options?.intro_lines ?? [];
  const footerLines = options?.footer_lines ?? [];

  return [
    ...introLines,
    introLines.length > 0 ? "" : null,
    "Questions in scope:",
    buildVisibleScopeQuestionLines(state, { include_suggestions: false }).join("\n"),
    "",
    "Resolved scope:",
    buildConfirmedScopeAnswerLines(state).join("\n"),
    ...(
      footerLines.length > 0
        ? ["", ...footerLines]
        : []
    )
  ]
    .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    .join("\n");
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

  const baseSql = decision.sql ? normalizeExecutableSql(decision.sql) : "";
  const compiled = await maybeCompileSqlForExecution({
    query_router: queryRouter,
    api_client: apiClient,
    state: nextState,
    user_message: userMessage,
    source_sql: baseSql,
    purpose: decision.reason
  });
  const sql = compiled.sql;
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
    const method = summarizeSingleQueryMethod(
      compiled.note ? `${decision.reason} ${compiled.note}` : decision.reason,
      result.governed_sql || sql
    );
    // Only surface critical warnings to the user — filter out informational notes
    // like dialect compiler adaptations that are harmless implementation details.
    const warningLines = filterUserVisibleWarnings(result.warnings);
    const warnings = warningLines.length > 0 ? `\nWarnings: ${warningLines.join("; ")}` : "";
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
      warnings: warningLines
    });

    // Log to single_query_log for the Queries modal
    const logEntry = {
      query_id: queryId,
      question: userMessage,
      governed_sql: result.governed_sql || sql,
      row_count: result.row_count,
      elapsed_ms: elapsedMs,
      created_at: new Date().toISOString(),
      sample_rows: (result.rows ?? []).slice(0, 10)
    };
    nextState.single_query_log = [...(nextState.single_query_log ?? []), logEntry].slice(-20);

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
    .slice(0, 10)
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
      rows_preview: input.rows.slice(0, 20)
    });

    // Only show critical warnings to the user — skip minor informational notes
    const criticalWarnings = filterUserVisibleWarnings(input.warnings);
    const warningLine =
      criticalWarnings.length > 0 ? `Warnings: ${criticalWarnings.join("; ")}` : null;
    return [
      `Query completed. Query ID: ${input.query_id}.`,
      sanitizeSingleQueryNarration(narration) ?? input.result_summary,
      warningLine
    ]
      .filter((line): line is string => Boolean(line && line.trim().length > 0))
      .join("\n");
  } catch {
    return null;
  }
}

function sanitizeSingleQueryNarration(narration: string): string | null {
  const trimmed = narration.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const invalidPatterns: RegExp[] = [
    /\brunning now\b/i,
    /\bwant me to run\b/i,
    /\bwould you like me to run\b/i,
    /\bbefore i run\b/i,
    /\brun that query\b/i,
    /\brun this query\b/i,
    /\blet me pull that for you\b/i
  ];

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !invalidPatterns.some((pattern) => pattern.test(line)));

  if (lines.length === 0) {
    return null;
  }

  return lines.join("\n");
}

/**
 * Filter warnings to only include those relevant to the user.
 * Suppress minor informational notes (dialect compiler adaptations, etc.)
 * that are implementation details the user doesn't need to see.
 */
function looksLikeConfirmation(lower: string): boolean {
  if (/\b(?:not|don't|do not|skip|cancel|hold|wait|no)\b/.test(lower)) {
    return false;
  }
  return /\b(?:yes|yep|yeah|ok|okay|sure|go ahead|proceed|do it|run it|go for it|please|let's go)\b/.test(lower);
}

function looksLikeRejection(lower: string): boolean {
  return /\b(?:no|nope|skip|cancel|never mind|forget it|don't|do not)\b/.test(lower);
}

function filterUserVisibleWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => {
    const lower = w.toLowerCase();
    // Suppress dialect compiler notes — harmless SQL compatibility tweaks
    if (lower.includes("dialect compiler") || lower.includes("adapted sql for")) {
      return false;
    }
    // Suppress compile/rewrite informational notes
    if (lower.includes("rewritten for") || lower.includes("sql was adapted")) {
      return false;
    }
    return true;
  });
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
  if (state.prep_complete && state.prepared_payloads.length > 0) {
    // Already confirmed scope in a previous turn with prepared payloads — run now.
    return buildAnalysisConfirmation(state);
  }

  // Either preparation has not run yet, or payloads were not produced successfully.
  const normalized = parseChatState(state);
  normalized.prep_complete = false;
  normalized.scope_pending = false;
  return buildPreparationConfirmation(normalized, apiClient);
}

async function buildPreparationConfirmation(state: ChatState, apiClient: WebApiClient): Promise<ChatTurnResponse> {
  const missing = getMissingDraftFields(state);
  if (missing.length > 0) {
    return { assistant_message: `Cannot run yet: ${missing.join(", ")}.`, state };
  }

  const gatedState = parseChatState(state);
  reconcilePendingInputsToScopeQuestions(gatedState);
  gatedState.pending_inputs = gatedState.pending_inputs.filter((entry) => {
    if (typeof entry.question_number !== "number") {
      return true;
    }
    const target = gatedState.scope_questions.find((question) => question.question_number === entry.question_number);
    if (!target) {
      return true;
    }
    return !target.answer || target.answer.trim().length === 0;
  });
  const hasUnansweredScopeItems = gatedState.scope_questions.some(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  );
  const hasPendingScopeInputs = gatedState.pending_inputs.some((entry) => {
    if (typeof entry.question_number !== "number") {
      return true;
    }
    const target = gatedState.scope_questions.find((question) => question.question_number === entry.question_number);
    if (!target) {
      return true;
    }
    return !target.answer || target.answer.trim().length === 0;
  });
  if (hasUnansweredScopeItems || hasPendingScopeInputs) {
    gatedState.scope_clarification_pending = true;
    gatedState.scope_finalized = false;
    gatedState.prep_pending = false;
    gatedState.scope_pending = false;
    return {
      assistant_message: buildScopeClarificationPendingMessage(gatedState),
      state: gatedState
    };
  }

  // Verify data scope before showing confirmation
  const verification = await verifyDataScope(gatedState.draft, apiClient);
  if (!verification.ok) {
    gatedState.scope_finalized = false;
    gatedState.scope_pending = false;
    gatedState.prep_pending = false;
    return {
      assistant_message: verification.blocking_message!,
      state: gatedState
    };
  }

  const nextState = gatedState;
  nextState.pending_inputs = [];
  nextState.scope_finalized = true;
  nextState.scope_clarification_pending = false;
  nextState.prep_pending = true;
  nextState.scope_pending = false;
  syncQuestionRegistryFromScope(nextState);

  const reportName =
    nextState.draft.name.trim().length > 0 ? nextState.draft.name.trim() : "Untitled Report";
  const verificationLines = verification.warning_lines.length > 0
    ? ["Data verification:", ...verification.warning_lines.map((w) => `- ${w}`)]
    : [];

  return {
    assistant_message: buildLockedScopeMessage(nextState, {
      intro_lines: [`Scope is locked for "${reportName}".`],
      footer_lines: [...verificationLines, "Run Data Preparation when you're ready."]
    }),
    state: nextState
  };
}

function buildAnalysisConfirmation(state: ChatState): ChatTurnResponse {
  const nextState = parseChatState(state);
  const payloadCount = nextState.prepared_payloads.length;
  if (payloadCount === 0) {
    nextState.prep_complete = false;
    nextState.prep_pending = true;
    nextState.scope_pending = false;
    return {
      assistant_message: [
        "Data preparation has not produced validated payloads yet.",
        "Run Data Preparation to generate payloads before starting analysis."
      ].join("\n"),
      state: nextState
    };
  }

  nextState.scope_pending = true;
  nextState.prep_pending = false;
  const payloadLine = payloadCount > 0
    ? `Prepared payloads: ${payloadCount} question${payloadCount === 1 ? "" : "s"}.`
    : "Prepared payloads are not available yet.";

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
  const normalized = command.trim();
  return (
    /^__ui_finish_scoping_run_analysis__$/.test(normalized) ||
    /^(finish scoping and run analysis|run analysis|execute analysis|run report|execute report)\b/.test(
      normalized
    ) ||
    /^(confirm|yes|go ahead|proceed|looks good|lgtm|run it|do it|execute|approved|ok|okay|sure|start)\s*[.!]?$/.test(
      normalized
    )
  );
}

function isExplicitScopeRunChoice(command: string): boolean {
  const normalized = command.trim();
  return (
    /^__ui_finish_scoping_run_analysis__$/.test(normalized) ||
    /^(finish scoping and run analysis|run analysis|execute analysis|run report|execute report)\b/.test(
      normalized
    )
  );
}

function isScopeContinueChoice(command: string): boolean {
  return (
    /^__ui_continue_scoping__$/.test(command) ||
    /^(continue scoping|keep scoping|adjust scope)\b/.test(command)
  );
}

function isRunPreparationChoice(command: string): boolean {
  const normalized = command.trim();
  return (
    /^__ui_run_data_preparation__$/.test(normalized) ||
    /^(run data preparation|prepare data|run preparation)\b/.test(normalized)
  );
}

function isScopeFinalizeChoice(command: string): boolean {
  const normalized = command.trim();
  return (
    /^__ui_run_data_preparation__$/.test(normalized) ||
    /^(looks good|scope looks good|finalize scope|lock scope|ready|all set|proceed|go ahead|go ahead with these|yes|ok|okay|confirm|confirm all|yes to all|accept all|approve all|all good|all fine|defaults are fine|assumptions are fine|i like your assumptions|ok with everything|okay with everything)\s*[.!]?$/.test(
      normalized
    )
  );
}

function isStartReportClarificationChoice(command: string): boolean {
  return (
    /^__ui_report_clarifications__$/.test(command) ||
    /^(ask clarifications on the report|report clarifications|clarify report|ask report questions)\b/.test(command)
  );
}

function isStartBusinessCaseChoice(command: string): boolean {
  return (
    /^__ui_business_case_analysis__$/.test(command) ||
    /^(ask for business case analysis|business case analysis|build business case|business case)\b/.test(command)
  );
}

function isStartRefinementChoice(command: string): boolean {
  return (
    /^__ui_refine_report__$/.test(command) ||
    /^(ask follow-up|refine|continue refinement|continue with refinements|ask questions)\b/.test(command)
  );
}

function isStartNewConversationChoice(command: string): boolean {
  return (
    /^__ui_start_new_conversation__$/.test(command) ||
    /^(start new conversation|new conversation|new report)\b/.test(command)
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

function formatReportClarificationAnswer(
  response: z.output<typeof ReportClarificationOutputSchema>
): string {
  const citationLine = response.citations.length > 0
    ? `References: ${response.citations.join(", ")}`
    : "";
  return [response.answer, citationLine].filter((line) => line.length > 0).join("\n\n");
}

function formatBusinessCaseCandidateList(
  candidates: z.output<typeof BusinessCaseCandidateSchema>[]
): string {
  const lines = candidates.map((candidate) =>
    `Q${candidate.question_number} R${candidate.recommendation_index}: ${candidate.recommendation} (${candidate.question_text})`
  );
  return [
    "Select a recommendation for business case analysis by replying with Qn Rn.",
    lines.join("\n"),
    "",
    "You can add assumptions in the same message, for example: Q1 R1 assume a $50k rollout cost and 2 analysts."
  ].join("\n");
}

function formatBusinessCaseClarificationRequest(
  response: Extract<z.output<typeof BusinessCaseOutputSchema>, { status: "needs_clarification" }>
): string {
  const missingInputs = response.missing_inputs.length > 0
    ? `Missing inputs: ${response.missing_inputs.join("; ")}`
    : "";
  return [response.clarification_prompt, missingInputs].filter((line) => line.length > 0).join("\n\n");
}

function formatBusinessCaseOutput(
  response: Extract<z.output<typeof BusinessCaseOutputSchema>, { status: "complete" }>
): string {
  const timelineLines = response.timeline_impact.map((entry) => `- ${entry.period_label}: ${entry.impact}`);
  const section = (title: string, lines: string[]) =>
    lines.length > 0 ? `${title}\n${lines.map((line) => `- ${line}`).join("\n")}` : "";

  return [
    response.title,
    "",
    `Executive summary: ${response.executive_summary}`,
    "",
    `Recommendation: ${response.recommendation}`,
    "",
    section("Baseline", response.baseline),
    section("Assumptions", response.assumptions),
    section("Implementation plan", response.implementation_plan),
    timelineLines.length > 0 ? `Impact over time\n${timelineLines.join("\n")}` : "",
    section("Financial view", response.financial_view),
    section("Operational view", response.operational_view),
    section("Risks", response.risks),
    section("KPIs to track", response.kpis_to_track),
    response.citations.length > 0 ? `References: ${response.citations.join(", ")}` : ""
  ].filter((line) => line.length > 0).join("\n\n");
}

function parseBusinessCaseCandidateSelection(
  message: string,
  candidates: z.output<typeof BusinessCaseCandidateSchema>[]
): z.output<typeof BusinessCaseCandidateSchema> | null {
  const normalized = message.trim().toLowerCase();
  const pairMatch =
    normalized.match(/\bq(?:uestion)?\s*(\d+)\s*[-,:/ ]+\s*r(?:ecommendation)?\s*(\d+)\b/i) ??
    normalized.match(/\bq(?:uestion)?\s*(\d+)\b[\s,;:-]*\br(?:ecommendation)?\s*(\d+)\b/i);
  if (pairMatch) {
    const questionNumber = Number.parseInt(pairMatch[1] ?? "", 10);
    const recommendationIndex = Number.parseInt(pairMatch[2] ?? "", 10);
    return candidates.find((candidate) =>
      candidate.question_number === questionNumber &&
      candidate.recommendation_index === recommendationIndex
    ) ?? null;
  }

  return candidates.find((candidate) => normalized.includes(candidate.candidate_id.toLowerCase())) ?? null;
}

function stripBusinessCaseSelection(message: string): string {
  return message
    .replace(/\bq(?:uestion)?\s*\d+\s*[-,:/ ]+\s*r(?:ecommendation)?\s*\d+\b/ig, " ")
    .replace(/\bq(?:uestion)?\s*\d+\b[\s,;:-]*\br(?:ecommendation)?\s*\d+\b/ig, " ")
    .trim();
}

function buildBusinessCaseQuestion(message: string): string {
  const stripped = stripBusinessCaseSelection(message);
  return stripped.length > 0
    ? stripped
    : "Build a detailed business case for the selected recommendation.";
}

function extractBusinessCaseAssumptionNotes(message: string): string[] {
  const stripped = stripBusinessCaseSelection(message);
  if (stripped.length === 0) {
    return [];
  }

  if (
    /\b(?:assum|cost|budget|price|headcount|fte|staff|team|workforce|hire|month|months|week|weeks|quarter|quarters|year|years|timeline|rollout|implementation)\b/i.test(stripped) ||
    /\$|\b\d+\b/.test(stripped)
  ) {
    return [stripped];
  }

  return [];
}

function appendBusinessCaseAssumptionNotes(existing: string[], additions: string[]): string[] {
  return Array.from(
    new Set(
      [...existing, ...additions]
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  ).slice(0, 8);
}

function completePdfGeneration(state: ChatState): ChatTurnResponse {
  const nextState = parseChatState(state);
  resetPostRunFollowupState(nextState);
  nextState.awaiting_pdf_confirmation = false;
  nextState.awaiting_post_run_refinement = false;
  nextState.refinement_active = false;
  nextState.refinement_questions_remaining = 0;
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

async function executeReportClarificationQa(
  state: ChatState,
  question: string,
  apiClient: WebApiClient,
  queryRouter?: QueryRouterClient
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  if (!nextState.last_run_id) {
    return {
      assistant_message: "No completed run found yet. Run analysis first.",
      state: nextState
    };
  }

  const response = await apiClient.askReportClarification(nextState.last_run_id, question);
  if (!response.grounded || response.requires_new_analysis) {
    if (!queryRouter) {
      return {
        assistant_message:
          "That question needs fresh analysis rather than a report clarification. Start a new scoped analysis for it.",
        state: nextState
      };
    }
    return stageRefinementAsScopedQuestion(nextState, question, apiClient, queryRouter);
  }

  nextState.post_run_actions_pending = true;
  nextState.report_clarification_active = true;
  nextState.business_case_active = false;
  nextState.business_case_selected_candidate_id = null;
  nextState.business_case_assumption_notes = [];
  nextState.business_case_pending_clarification = null;
  return {
    assistant_message: formatReportClarificationAnswer(response),
    state: nextState
  };
}

async function executeBusinessCaseQa(
  state: ChatState,
  message: string,
  apiClient: WebApiClient
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  if (!nextState.last_run_id) {
    return {
      assistant_message: "No completed run found yet. Run analysis first.",
      state: nextState
    };
  }

  const candidates = nextState.business_case_candidates;
  if (candidates.length === 0) {
    return {
      assistant_message: "No business case candidates are loaded for this run yet.",
      state: nextState
    };
  }

  const explicitCandidate = parseBusinessCaseCandidateSelection(message, candidates);
  const selectedCandidateId = explicitCandidate?.candidate_id ?? nextState.business_case_selected_candidate_id;
  if (!selectedCandidateId) {
    return {
      assistant_message: formatBusinessCaseCandidateList(candidates),
      state: nextState
    };
  }

  if (explicitCandidate && explicitCandidate.candidate_id !== nextState.business_case_selected_candidate_id) {
    nextState.business_case_assumption_notes = [];
    nextState.business_case_pending_clarification = null;
  }

  const question = nextState.business_case_pending_clarification
    ? "Update the business case with the clarified assumptions."
    : buildBusinessCaseQuestion(message);
  const assumptionNotes = nextState.business_case_pending_clarification
    ? appendBusinessCaseAssumptionNotes(nextState.business_case_assumption_notes, [message])
    : appendBusinessCaseAssumptionNotes(
        nextState.business_case_assumption_notes,
        extractBusinessCaseAssumptionNotes(message)
      );

  nextState.post_run_actions_pending = true;
  nextState.report_clarification_active = false;
  nextState.business_case_active = true;
  nextState.business_case_selected_candidate_id = selectedCandidateId;
  nextState.business_case_assumption_notes = assumptionNotes;

  const response = await apiClient.buildBusinessCase(nextState.last_run_id, {
    candidate_id: selectedCandidateId,
    question,
    assumption_notes: assumptionNotes
  });

  if (response.status === "needs_clarification") {
    nextState.business_case_pending_clarification = response.clarification_prompt;
    return {
      assistant_message: formatBusinessCaseClarificationRequest(response),
      state: nextState
    };
  }

  nextState.business_case_selected_candidate_id = null;
  nextState.business_case_assumption_notes = [];
  nextState.business_case_pending_clarification = null;
  return {
    assistant_message: formatBusinessCaseOutput(response),
    state: nextState
  };
}

async function executeRefinementQa(
  state: ChatState,
  question: string,
  apiClient: WebApiClient,
  queryRouter?: QueryRouterClient
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  if (!nextState.last_run_id) {
    nextState.refinement_active = false;
    nextState.refinement_questions_remaining = 0;
    nextState.awaiting_pdf_confirmation = true;
    return {
      assistant_message: "No completed run found yet. Generate the report again before follow-up refinement.",
      state: nextState
    };
  }

  const response = await apiClient.askRunQuestion(nextState.last_run_id, question);
  if (!response.grounded || response.requires_new_analysis) {
    return stageRefinementAsScopedQuestion(nextState, question, apiClient, queryRouter);
  }

  const citationLine = response.citations.length > 0
    ? `\nReferences: ${response.citations.join(", ")}`
    : "";

  const remaining = Math.max(0, (nextState.refinement_questions_remaining ?? 0) - 1);
  nextState.refinement_questions_remaining = remaining;

  if (remaining > 0) {
    nextState.refinement_active = true;
    nextState.awaiting_pdf_confirmation = false;
    return {
      assistant_message: [
        `${response.answer}${citationLine}`,
        `You can ask ${remaining} more follow-up question${remaining === 1 ? "" : "s"} before PDF, or choose Generate report PDF now.`
      ].join("\n\n"),
      state: nextState
    };
  }

  nextState.refinement_active = false;
  nextState.awaiting_pdf_confirmation = true;
  return {
    assistant_message: [
      `${response.answer}${citationLine}`,
      "Refinement limit reached for this run. PDF decision is now pending."
    ].join("\n\n"),
    state: nextState
  };
}

async function stageRefinementAsScopedQuestion(
  state: ChatState,
  followUpQuestion: string,
  apiClient: WebApiClient,
  queryRouter: QueryRouterClient | undefined
): Promise<ChatTurnResponse> {
  const nextState = parseChatState(state);
  resetPostRunFollowupState(nextState);
  nextState.awaiting_post_run_refinement = false;
  nextState.refinement_active = false;
  nextState.refinement_questions_remaining = 0;
  nextState.awaiting_pdf_confirmation = false;
  nextState.prep_pending = false;
  nextState.prep_complete = false;
  nextState.scope_pending = false;
  nextState.scope_finalized = false;
  nextState.preparation_summary = null;
  nextState.prepared_payloads = [];
  const catalogCtx = await fetchCatalogContext(apiClient).catch(() => ({
    catalog_summary: "",
    business_context: ""
  }));
  nextState.scope_business_context =
    catalogCtx.business_context && catalogCtx.business_context.trim().length > 0
      ? catalogCtx.business_context.trim()
      : nextState.scope_business_context;

  const generated = await generateLlmScopeQuestions(
    followUpQuestion,
    nextState,
    apiClient,
    queryRouter,
    "deep_analysis",
    catalogCtx
  );
  if (generated.length === 0 && !isTestRuntime()) {
    throw new Error("scope_clarification_generation_failed: llm returned no follow-up scope questions");
  }
  const incoming = (generated.length > 0 ? generated : [])
    .map(sanitizeScopeQuestionLanguage)
    .slice(0, 3);

  const baseIndex = nextState.scope_questions.length;
  const appended = incoming.map((entry, index) => ({
    ...entry,
    question_number: baseIndex + index + 1
  }));
  const dedupedAppended = removeDuplicateScopeQuestions(appended).map(sanitizeScopeQuestionLanguage);
  nextState.scope_questions = normalizeScopeQuestionsForPlanning([
    ...nextState.scope_questions,
    ...dedupedAppended
  ]);
  applySavedMetricDefinitionsToScopeQuestions(nextState);
  nextState.scope_source_prompt = [nextState.scope_source_prompt, followUpQuestion]
    .filter((entry): entry is string => Boolean(entry && entry.trim().length > 0))
    .join("\n");
  nextState.scope_clarification_pending = true;
  nextState.scope_finalized = false;
  syncQuestionRegistryFromScope(nextState);

  return {
    assistant_message: [
      "That follow-up needs fresh scoped analysis to stay grounded.",
      buildScopeClarificationPendingMessage(nextState)
    ].join("\n\n"),
    state: nextState
  };
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

const ScheduleParamsSchema = z.object({
  frequency: z.enum(["weekly", "monthly", "quarterly"]),
  day_of_week: z.number().int().min(0).max(6).optional(),
  day_of_month: z.number().int().min(1).max(28).optional(),
  hour_utc: z.number().int().min(0).max(23).default(9),
  minute_utc: z.number().int().min(0).max(59).default(0),
  timezone: z.string().default("UTC"),
  kpi_watchlist: z
    .array(
      z.object({
        metric_key: z.string(),
        display_name: z.string(),
        threshold_value: z.number(),
        direction: z.enum(["above", "below"]),
        alert_message: z.string()
      })
    )
    .default([])
});

export function parseScheduleParams(text: string): z.output<typeof ScheduleParamsSchema> | null {
  const match = text.match(/<<<SCHEDULE_PARAMS>>>([\s\S]*?)<<<END_SCHEDULE_PARAMS>>>/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[1].trim());
    const result = ScheduleParamsSchema.safeParse(raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
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
  const nextStateForGate = parseChatState(state);
  reconcilePendingInputsToScopeQuestions(nextStateForGate);
  nextStateForGate.pending_inputs = nextStateForGate.pending_inputs.filter((entry) => {
    if (typeof entry.question_number !== "number") {
      return true;
    }
    const target = nextStateForGate.scope_questions.find(
      (question) => question.question_number === entry.question_number
    );
    if (!target) {
      return true;
    }
    return !target.answer || target.answer.trim().length === 0;
  });
  const hasUnansweredScopeItems = nextStateForGate.scope_questions.some(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  );
  const hasPendingScopeInputs = nextStateForGate.pending_inputs.some((entry) => {
    if (typeof entry.question_number !== "number") {
      return true;
    }
    const target = nextStateForGate.scope_questions.find(
      (question) => question.question_number === entry.question_number
    );
    if (!target) {
      return true;
    }
    return !target.answer || target.answer.trim().length === 0;
  });
  const allowLegacyPrepWithoutScope =
    nextStateForGate.prep_pending &&
    nextStateForGate.scope_questions.length === 0 &&
    !nextStateForGate.scope_clarification_pending;
  if (
    !allowLegacyPrepWithoutScope &&
    (!nextStateForGate.scope_finalized || hasUnansweredScopeItems || hasPendingScopeInputs)
  ) {
    return {
      assistant_message:
        "Scope is not finalized yet. Please confirm the scope details first, then run data preparation.",
      state: nextStateForGate
    };
  }

  const nextState = nextStateForGate;
  nextState.prep_pending = false;

  if (!nextState.contract_id) {
    try {
      const contract = buildContractPayload(nextState);
      const created = await apiClient.createContract(contract);
      nextState.contract_id = created.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save contract before preparation.";
      nextState.prep_pending = true;
      return {
        assistant_message: `Preparation could not start yet. ${message}`,
        state: nextState
      };
    }
  }

  let prepared: Awaited<ReturnType<WebApiClient["prepareContract"]>>;
  try {
    prepared = await apiClient.prepareContract(nextState.contract_id!);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data preparation failed.";
    nextState.prep_pending = true;
    return {
      assistant_message: `Data preparation did not complete. ${message}`,
      state: nextState
    };
  }
  nextState.prep_complete = true;
  nextState.scope_pending = true;
  nextState.scope_clarification_pending = false;
  const preparedPayloads =
    nextState.scope_questions.length === 0
      ? [...prepared.prepared_payloads]
      : prepared.prepared_payloads
          .filter((payload) => {
            if (typeof payload.question_number !== "number") {
              return true;
            }
            return nextState.scope_questions.some(
              (entry) => entry.question_number === payload.question_number
            );
          })
          .sort((left, right) => {
            const leftNumber =
              typeof left.question_number === "number" ? left.question_number : Number.MAX_SAFE_INTEGER;
            const rightNumber =
              typeof right.question_number === "number" ? right.question_number : Number.MAX_SAFE_INTEGER;
            return leftNumber - rightNumber;
          });
  nextState.prepared_payloads = preparedPayloads;
  nextState.preparation_summary = prepared.planner_summary ?? null;
  syncQuestionRegistryFromScope(nextState);
  if (nextState.question_registry.length > 0 && preparedPayloads.length > 0) {
    const byNumber = new Map(
      nextState.question_registry.map((entry) => [entry.question_number, entry])
    );
    for (const payload of preparedPayloads) {
      if (!payload.question_number) {
        continue;
      }
      const target = byNumber.get(payload.question_number);
      if (!target) {
        continue;
      }
      target.status = "prepared";
      target.question_id = payload.question_id ?? target.question_id;
      target.group_id = payload.group_id ?? target.group_id;
    }
    nextState.question_registry = Array.from(byNumber.values()).sort(
      (left, right) => left.question_number - right.question_number
    );
  }
  if (prepared.token_usage) {
    nextState.last_token_usage = prepared.token_usage;
  }

  if (preparedPayloads.length === 0) {
    nextState.prep_complete = false;
    nextState.scope_pending = false;
    nextState.prep_pending = true;
    return {
      assistant_message: [
        "Data preparation did not produce validated payloads yet.",
        prepared.planner_summary ? `Preparation note: ${prepared.planner_summary}` : "",
        "Analysis cannot start until payloads are generated. Please run Data Preparation again."
      ]
        .filter((line) => line.length > 0)
        .join("\n"),
      state: nextState
    };
  }

  const payloadLines = preparedPayloads.map((payload) =>
    formatPreparedPayloadSummary(payload)
  );

  return {
    assistant_message: [
      "Data preparation is complete for the locked scope.",
      "",
      "Prepared questions:",
      buildVisibleScopeQuestionLines(nextState, { include_suggestions: false }).join("\n"),
      "",
      payloadLines.length > 0 ? payloadLines.join("\n") : "- No prepared payloads.",
      "",
      "Ready to run analysis."
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
  resetPostRunFollowupState(nextState);
  nextState.prep_pending = false;
  nextState.scope_pending = false;
  nextState.pending_query_sql = null;
  nextState.pending_query_limit = null;

  if (!nextState.contract_id) {
    try {
      const contract = buildContractPayload(nextState);
      const created = await apiClient.createContract(contract);
      nextState.contract_id = created.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save contract before run.";
      nextState.scope_pending = true;
      return {
        assistant_message: `Run could not start. ${message}`,
        state: nextState
      };
    }
  }

  let submitted: Awaited<ReturnType<WebApiClient["submitRun"]>>;
  try {
    submitted = await apiClient.submitRun(nextState.contract_id!);
  } catch (error) {
    const message = formatRunExecutionFailure(error);
    nextState.scope_pending = true;
    return {
      assistant_message: `Run could not be submitted. ${message}`,
      state: nextState
    };
  }

  nextState.pending_run_id = submitted.run_id;

  return {
    assistant_message:
      "I'm generating your report — this usually takes 10–15 minutes. " +
      "The results will appear here once it's ready.",
    state: nextState
  };
}

async function executeSchedule(
  state: ChatState,
  apiClient: WebApiClient,
  payload: {
    frequency: "weekly" | "monthly" | "quarterly";
    day_of_week?: number;
    day_of_month?: number;
    hour_utc?: number;
    minute_utc?: number;
    timezone?: string;
    kpi_watchlist?: Array<{
      metric_key: string;
      display_name: string;
      threshold_value: number;
      direction: "above" | "below";
      alert_message: string;
    }>;
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
      hour_utc: payload.hour_utc,
      minute_utc: payload.minute_utc,
      timezone: payload.timezone ?? nextState.draft.timezone,
      kpi_watchlist: payload.kpi_watchlist
    });

    nextState.draft.timezone = scheduled.timezone;
    nextState.draft.schedule_cron = scheduled.schedule_cron;
    nextState.awaiting_schedule_confirmation = false;
    nextState.awaiting_schedule_mode_selection = false;
    nextState.schedule_mode_pending = null;
    nextState.schedule_day_kind = null;
    nextState.awaiting_custom_day_input = false;

    const kpiCount = Array.isArray(payload.kpi_watchlist) ? payload.kpi_watchlist.length : 0;
    const kpiNote = kpiCount > 0 ? ` I\u2019ll flag KPI breaches and compare against the previous run each time.` : "";
    return {
      assistant_message: `Scheduled! This report will run ${scheduled.frequency} in ${scheduled.timezone} (cron: \`${scheduled.schedule_cron}\`).${kpiNote}`,
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
  return `- ${label}: ${payload.question}`;
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
void metricMentionedByUser;
void hasConfirmedMetricDefinition;
void collectAutoCorrections;
void collectUnresolvedWarnings;

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

  if (state.pending_metric_confirmations.length > 0) {
    parts.push(`Metric calculation confirmation pending (${state.pending_metric_confirmations.length}).`);
  }

  if (state.metric_definitions.length > 0) {
    const metrics = state.metric_definitions
      .slice(0, 4)
      .map((entry) => `${entry.display_name}: ${entry.definition}`)
      .join(" | ");
    if (metrics.length > 0) {
      parts.push(`Metric definitions: ${metrics}`);
    }
  }

  if (state.scope_clarification_pending) {
    parts.push("Scope clarification is pending for multi-question analysis.");
  }

  if (state.prep_pending) {
    parts.push("Data preparation is waiting for confirmation.");
  }

  if (state.scope_pending) {
    parts.push("Analysis execution is waiting for scope confirmation.");
  }

  if (state.post_run_actions_pending) {
    parts.push("Post-run follow-up actions are available.");
  }

  if (state.report_clarification_active) {
    parts.push("Report clarification mode is active.");
  }

  if (state.business_case_active) {
    parts.push("Business case analysis mode is active.");
  }

  if (state.business_case_pending_clarification) {
    parts.push(`Business case clarification needed: ${state.business_case_pending_clarification}`);
  }

  if (state.awaiting_post_run_refinement) {
    parts.push("Post-analysis refinement decision is waiting.");
  }

  if (state.refinement_active) {
    parts.push(`Refinement mode is active (${state.refinement_questions_remaining} follow-up question(s) remaining).`);
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

async function buildSingleQueryClarificationPrompt(
  rawMessage: string,
  state: ChatState,
  apiClient: WebApiClient,
  queryRouter: QueryRouterClient | undefined
): Promise<string | null> {
  // For follow-ups on a previous single query, skip clarification — just execute.
  if (state.last_single_query_snapshot && looksLikeSingleQueryFollowUp(rawMessage)) {
    return null;
  }

  const llmQuestions = await generateLlmScopeQuestions(
    rawMessage,
    state,
    apiClient,
    queryRouter,
    "single_query"
  );
  if (llmQuestions.length > 0) {
    const first = llmQuestions[0]!;
    return [
      "Before I run this query, I want to lock one detail for accuracy:",
      `- ${first.clarification}`
    ].join("\n");
  }

  return buildSingleQueryClarificationPromptFallback(rawMessage, state);
}

function looksLikeSingleQueryFollowUp(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase().trim();
  if (
    /^(split|break|group|filter|exclude|include|show|what about|by\s|can you split|can you break|and\s+(by|split|break|group|filter|exclude))/i.test(
      lower
    )
  ) {
    return true;
  }

  // Common status-filter follow-ups after a previous single-query answer.
  return (
    /\bonly\s+(paid|delivered|shipped|refunded|cancelled)\b/.test(lower) ||
    /\bpaid\s+and\s+delivered\b/.test(lower) ||
    /\bstatus(?:es)?\b/.test(lower)
  );
}

function buildSingleQueryClarificationPromptFallback(rawMessage: string, state: ChatState): string | null {
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
    .slice(-20)
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

  const analyticalMentions =
    lower.match(
      /\b(refund|refunded|return|cancel|revenue|sales|gmv|support|ticket|issue|reason|city|cities|region|regions|product|products|category|categories|trend|comparison|compare|rate|drivers?|breakdown)\b/g
    ) ?? [];
  if (/\band\b/.test(lower) && analyticalMentions.length >= 4 && lower.length >= 45) {
    return true;
  }

  // Long requests with multiple clauses should be treated as scoped analysis, not a simple number query.
  return lower.length > 160 && /,|\band\b/.test(lower);
}

function extractRequestedMonths(lower: string): number | null {
  if (/\b(?:past|last|previous)\s+month\b/.test(lower) || /\bthis\s+month\b/.test(lower)) {
    return 1;
  }

  const match = lower.match(
    /\b(?:past|last|previous|recent|most recent)\s+(\d{1,2})(?:\s+complete|\s+full|\s+calendar)?\s+months?\b/
  );
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
    .slice(-20)
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
    .slice(-20)
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
    .slice(-20)
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
    .slice(-20)
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
  state.scope_finalized = false;
  state.pending_metric_confirmations = [];
  state.pending_metric_resume_message = null;
  state.pending_metric_resume_mode = null;
  state.scope_clarification_pending = false;
  state.scope_business_context = null;
  state.scope_source_prompt = null;
  state.scope_suggestions = [];
  state.scope_questions = [];
  state.pending_inputs = [];
  state.question_registry = [];
  state.orchestrator_summary = null;
  state.last_orchestrator_decision = null;
  state.preparation_summary = null;
  state.prepared_payloads = [];
  resetPostRunFollowupState(state);
  state.awaiting_pdf_confirmation = false;
  state.awaiting_post_run_refinement = false;
  state.refinement_active = false;
  state.refinement_questions_remaining = 0;
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
  const metricDefinitions = state.metric_definitions
    .map((entry) => ({
      metric_key: entry.metric_key,
      display_name: entry.display_name,
      definition: entry.definition
    }));

  return ReportContractSchema.parse({
    id: state.contract_id ?? `contract_${randomUUID()}`,
    name,
    audience: draft.audience.trim().length > 0 ? draft.audience.trim() : "Executive",
    timezone: draft.timezone.trim().length > 0 ? draft.timezone.trim() : "UTC",
    schedule_cron: draft.schedule_cron,
    sql_template: sql,
    metric_ids: draft.metric_ids,
    metric_definitions: metricDefinitions,
    dimension_ids: draft.dimension_ids,
    insight_mode: draft.insight_mode ?? "business",
    scope_clarifications: state.scope_questions.map((q) => ({
      question_number: q.question_number,
      question: q.question,
      answer: (q.answer && q.answer.trim().length > 0)
        ? q.answer.trim()
        : `[No specific clarification — use best judgment for: ${q.question}]`
    })),
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

function hasPreparationBlockedCue(message: string): boolean {
  return /\bno data to analyze\b|\bthere'?s no data\b|\bappears to be empty\b|\bno tables are scoped\b|\bcannot run yet\b|\bcheck that data is being loaded\b|\bdoes not exist\b|\bnot accessible\b/i.test(
    message
  );
}

function hasScopeReadyContextInHistory(state: ChatState): boolean {
  const lastAssistant = [...state.conversation_history]
    .reverse()
    .find((turn) => turn.role === "assistant");
  if (!lastAssistant) {
    return false;
  }

  const text = lastAssistant.content.toLowerCase();
  if (hasPreparationBlockedCue(text)) {
    return false;
  }
  return (
    text.includes("scope clarifications captured for all questions") ||
    text.includes("ready to prepare data for:") ||
    /\ball\s+\w+\s+questions?\s+(?:are|is)\s+(?:fully\s+)?confirmed\b/.test(text) ||
    text.includes("scope is locked and waiting on the current workflow decision") ||
    text.includes("ready to move to data preparation") ||
    text.includes("ready to move to data prep") ||
    /\bscope is locked\b.*\bdata prep(?:aration)?\b/.test(text) ||
    /\bscope is locked\b/.test(text)
  );
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

function isTransientNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|network|socket|timed out|timeout|econn|enotfound|aborted/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// JSON response parser
// ---------------------------------------------------------------------------

async function parseJsonResponse<TSchema extends z.ZodTypeAny>(
  response: Response,
  schema: TSchema
): Promise<z.output<TSchema>> {
  const text = await response.text();
  const trimmed = text.trim();
  let payload: unknown = {};
  if (trimmed.length > 0) {
    try {
      payload = JSON.parse(trimmed);
    } catch {
      const isHtmlPayload = /^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed);
      const formatIssue = isHtmlPayload
        ? "Service returned an HTML error page instead of JSON"
        : "Service returned a non-JSON response";
      if (!response.ok) {
        throw new Error(`${formatIssue} (${response.status}).`);
      }
      throw new Error(`${formatIssue}. Please retry once.`);
    }
  }

  if (!response.ok) {
    const payloadRecord =
      typeof payload === "object" && payload !== null
        ? payload as Record<string, unknown>
        : null;
    const message =
      typeof payloadRecord?.message === "string"
        ? payloadRecord.message
        : `API request failed with status ${response.status}`;
    throw new Error(message);
  }

  return schema.parse(payload);
}

function formatRunExecutionFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : "Run execution failed.";
  if (
    /unexpected token|not valid json|doctype|<html|service returned an html error page|service returned a non-json response/i.test(
      message
    )
  ) {
    return "The final analysis response came back in an invalid format. Please try again once.";
  }

  if (/fetch failed|network|socket|timed out|timeout|econn|enotfound|aborted|502|503|504/i.test(message)) {
    return "There was a temporary connectivity issue while generating the final analysis. Please try again once.";
  }

  return message;
}

