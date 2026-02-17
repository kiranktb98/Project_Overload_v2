import { z } from "zod";
import { EVIDENCE_ROW_CAP, MAX_BATCHES } from "./constants";

const NonEmptyStringSchema = z.string().trim().min(1);

export const ContractMetricSchema = z
  .object({
    metric_id: NonEmptyStringSchema.optional(),
    draft_definition: NonEmptyStringSchema.optional()
  })
  .refine((value) => Boolean(value.metric_id ?? value.draft_definition), {
    message: "Either metric_id or draft_definition is required."
  });

export const ContractFilterSchema = z.object({
  field: NonEmptyStringSchema,
  operator: z.enum([
    "=",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "in",
    "not_in",
    "contains",
    "starts_with",
    "ends_with",
    "between"
  ]),
  value: z.unknown()
});

export const ContractThresholdSchema = z.object({
  metric_id: NonEmptyStringSchema,
  comparator: z.enum([">", ">=", "<", "<=", "="]),
  value: z.number()
});

export const ContractDeliverySchema = z.object({
  emails: z.array(z.string().email()).default([]),
  slack_channel: NonEmptyStringSchema.optional()
});

export const ContractDraftGuardrailsSchema = z.object({
  evidence_row_cap: z.number().int().min(1).max(EVIDENCE_ROW_CAP).default(EVIDENCE_ROW_CAP),
  max_batches: z.number().int().min(1).max(MAX_BATCHES).default(MAX_BATCHES),
  deny_write: z.literal(true).default(true),
  timeout_ms: z.number().int().min(100).max(120000).default(15000),
  allowed_sources: z.array(NonEmptyStringSchema).default([])
});

export const ReportContractDraftSchema = z.object({
  contract_name: NonEmptyStringSchema,
  audience: NonEmptyStringSchema,
  decision_use: NonEmptyStringSchema,
  timezone: NonEmptyStringSchema,
  schedule_nl: NonEmptyStringSchema,
  schedule_cron: z.string().trim().min(1).nullable(),
  delivery: ContractDeliverySchema.default({ emails: [] }),
  metrics: z.array(ContractMetricSchema).default([]),
  dimensions: z.array(NonEmptyStringSchema).default([]),
  filters: z.array(ContractFilterSchema).default([]),
  thresholds: z.array(ContractThresholdSchema).default([]),
  guardrails: ContractDraftGuardrailsSchema
});

export const ContractJoinKeySchema = z.object({
  left_key: NonEmptyStringSchema,
  right_key: NonEmptyStringSchema
});

export const ContractJoinPlanSchema = z.object({
  left_request_id: NonEmptyStringSchema,
  right_request_id: NonEmptyStringSchema,
  join_keys: z.array(ContractJoinKeySchema).min(1),
  join_type: z.enum(["inner", "left", "right", "full"]),
  dedup_policy: z.enum(["keep_first", "drop_duplicates", "error"]),
  missing_key_policy: z.enum(["drop", "keep_null"])
});

export const ContractReductionPlanSchema = z.object({
  aggregate_first: z.boolean().default(true),
  top_k: z.number().int().min(1).optional(),
  grain: NonEmptyStringSchema.optional()
});

export const ContractBatchPlanSchema = z.object({
  method: z.enum(["time_window", "dimension_partition", "offset_limit"]),
  total_batches_estimate: z.number().int().min(1).max(MAX_BATCHES),
  max_batches_cap: z.number().int().min(1).max(MAX_BATCHES).default(MAX_BATCHES)
});

export const ContractEvidenceRequestSchema = z.object({
  request_id: NonEmptyStringSchema,
  purpose: NonEmptyStringSchema,
  strategy: z.enum(["db_join", "two_query_merge", "separate_packets"]),
  sql: z.array(NonEmptyStringSchema).min(1),
  join_plan: ContractJoinPlanSchema.optional(),
  reduction_plan: ContractReductionPlanSchema,
  batch_plan: ContractBatchPlanSchema.optional(),
  expected_row_count_estimate: z.number().int().min(0)
});

export const ContractQueryPlanSchema = z.object({
  plan_id: NonEmptyStringSchema,
  contract_id: NonEmptyStringSchema,
  approval_required: z.boolean().default(true),
  evidence_requests: z.array(ContractEvidenceRequestSchema).min(1)
});

export const ContractEvidenceRowSchema = z.record(z.string(), z.unknown());

export const ContractEvidencePacketSchema = z
  .object({
    request_id: NonEmptyStringSchema,
    batch_index: z.number().int().min(0),
    total_batches: z.number().int().min(1).max(MAX_BATCHES),
    columns: z.array(NonEmptyStringSchema).default([]),
    rows: z.array(ContractEvidenceRowSchema).max(EVIDENCE_ROW_CAP),
    notes: z.array(NonEmptyStringSchema).default([]),
    query_hash: NonEmptyStringSchema,
    data_freshness: NonEmptyStringSchema,
    warnings: z.array(NonEmptyStringSchema).default([])
  })
  .refine((value) => value.batch_index < value.total_batches, {
    message: "batch_index must be less than total_batches"
  });

export const ContractBatchAnalysisSchema = z
  .object({
    request_id: NonEmptyStringSchema,
    batch_index: z.number().int().min(0),
    total_batches: z.number().int().min(1).max(MAX_BATCHES),
    findings: z.array(NonEmptyStringSchema).default([]),
    drivers: z.array(NonEmptyStringSchema).default([]),
    anomalies: z.array(NonEmptyStringSchema).default([]),
    confidence: z.number().min(0).max(1),
    evidence_refs: z.array(NonEmptyStringSchema).default([])
  })
  .refine((value) => value.batch_index < value.total_batches, {
    message: "batch_index must be less than total_batches"
  });

export const ContractExecBriefSchema = z.object({
  title: NonEmptyStringSchema,
  period: NonEmptyStringSchema,
  headline: NonEmptyStringSchema,
  what_changed: z.array(NonEmptyStringSchema).min(1),
  why_changed: z.array(NonEmptyStringSchema).min(1),
  so_what: z.array(NonEmptyStringSchema).min(1),
  actions: z.array(NonEmptyStringSchema).min(1),
  confidence_notes: z.array(NonEmptyStringSchema).default([]),
  appendix: z.object({
    evidence_packet_refs: z.array(NonEmptyStringSchema).default([]),
    query_hashes: z.array(NonEmptyStringSchema).default([])
  })
});

export const QualityEvalSchema = z.object({
  pass: z.boolean(),
  score_0_100: z.number().int().min(0).max(100),
  issues: z.array(NonEmptyStringSchema).default([]),
  fix_instructions: z.array(NonEmptyStringSchema).default([])
});

export type ContractMetric = z.infer<typeof ContractMetricSchema>;
export type ContractFilter = z.infer<typeof ContractFilterSchema>;
export type ContractThreshold = z.infer<typeof ContractThresholdSchema>;
export type ContractDelivery = z.infer<typeof ContractDeliverySchema>;
export type ContractDraftGuardrails = z.infer<typeof ContractDraftGuardrailsSchema>;
export type ReportContractDraft = z.infer<typeof ReportContractDraftSchema>;
export type ContractJoinPlan = z.infer<typeof ContractJoinPlanSchema>;
export type ContractReductionPlan = z.infer<typeof ContractReductionPlanSchema>;
export type ContractBatchPlan = z.infer<typeof ContractBatchPlanSchema>;
export type ContractEvidenceRequest = z.infer<typeof ContractEvidenceRequestSchema>;
export type ContractQueryPlan = z.infer<typeof ContractQueryPlanSchema>;
export type ContractEvidencePacket = z.infer<typeof ContractEvidencePacketSchema>;
export type ContractBatchAnalysis = z.infer<typeof ContractBatchAnalysisSchema>;
export type ContractExecBrief = z.infer<typeof ContractExecBriefSchema>;
export type QualityEval = z.infer<typeof QualityEvalSchema>;
