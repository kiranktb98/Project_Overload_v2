import { z } from "zod";
import { EVIDENCE_ROW_CAP, MAX_BATCHES } from "./constants";

export const EvidenceRequestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sql: z.string().min(1),
  metric_ids: z.array(z.string().min(1)).default([]),
  dimension_ids: z.array(z.string().min(1)).default([])
});

export const JoinPlanSchema = z.object({
  mode: z.enum(["db_join", "two_query_merge"]),
  left_request_id: z.string().min(1),
  right_request_id: z.string().min(1),
  join_keys: z
    .array(
      z.object({
        left_key: z.string().min(1),
        right_key: z.string().min(1)
      })
    )
    .min(1),
  join_type: z.enum(["inner", "left", "right", "full"]),
  dedup_policy: z.enum(["keep_first", "drop_duplicates", "error"]),
  missing_key_policy: z.enum(["drop", "keep_null"])
});

export const BatchPlanSchema = z
  .object({
    method: z.enum(["time_window", "dimension_partition", "offset_limit"]),
    partition_field: z.string().min(1),
    partitions: z.array(z.string().min(1)).min(1),
    total_batches: z.number().int().min(1).max(MAX_BATCHES)
  })
  .refine((value) => value.partitions.length === value.total_batches, {
    message: "partitions must match total_batches"
  });

export const QueryPlanSchema = z.object({
  id: z.string().min(1),
  contract_id: z.string().min(1),
  evidence_requests: z.array(EvidenceRequestSchema).min(1),
  join_plan: JoinPlanSchema.optional(),
  batch_plan: BatchPlanSchema.optional(),
  budgets: z.object({
    evidence_row_cap: z.number().int().min(1).max(EVIDENCE_ROW_CAP).default(EVIDENCE_ROW_CAP),
    max_batches: z.number().int().min(1).max(MAX_BATCHES).default(MAX_BATCHES)
  })
});

export type EvidenceRequest = z.infer<typeof EvidenceRequestSchema>;
export type JoinPlan = z.infer<typeof JoinPlanSchema>;
export type BatchPlan = z.infer<typeof BatchPlanSchema>;
export type QueryPlan = z.infer<typeof QueryPlanSchema>;