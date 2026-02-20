import { z } from "zod";
import { EVIDENCE_ROW_CAP, MAX_BATCHES } from "./constants";

export const ReportGuardrailsSchema = z.object({
  evidence_row_cap: z.number().int().min(1).max(EVIDENCE_ROW_CAP).default(EVIDENCE_ROW_CAP),
  max_batches: z.number().int().min(1).max(MAX_BATCHES).default(MAX_BATCHES),
  allowed_relations: z.array(z.string().min(1)).default([]),
  allowed_schemas: z.array(z.string().min(1)).default([]),
  timeout_ms: z.number().int().min(100).max(900000).default(900000),
  deny_write: z.literal(true).default(true)
});

export const InsightModeSchema = z.enum(["business", "data"]).default("business");
export type InsightMode = z.infer<typeof InsightModeSchema>;

export const ContractLifecycleStatusSchema = z.enum(["draft", "approved", "locked"]);
export type ContractLifecycleStatus = z.infer<typeof ContractLifecycleStatusSchema>;

export const ReportContractDeliverySchema = z.object({
  emails: z.array(z.string().email()).default([]),
  slack_channel: z.string().min(1).optional()
});

export const ReportContractSchema = z.object({
  id: z.string().min(1),
  tenant_id: z.string().min(1).optional(),
  name: z.string().min(1),
  audience: z.string().min(1),
  timezone: z.string().min(1),
  schedule_cron: z.string().min(1).nullable(),
  sql_template: z.string().min(1),
  metric_ids: z.array(z.string().min(1)).default([]),
  metric_definitions: z
    .array(
      z.object({
        metric_key: z.string().min(1),
        display_name: z.string().min(1),
        definition: z.string().min(1),
        source_type: z.enum(["column", "derived"]).default("derived"),
        source_columns: z.array(z.string().min(1)).default([])
      })
    )
    .optional(),
  dimension_ids: z.array(z.string().min(1)).default([]),
  insight_mode: InsightModeSchema,
  delivery: ReportContractDeliverySchema.optional(),
  lifecycle_status: ContractLifecycleStatusSchema.optional(),
  contract_version: z.number().int().min(1).optional(),
  approved_by: z.string().min(1).nullable().optional(),
  approved_at: z.string().datetime().nullable().optional(),
  locked_by: z.string().min(1).nullable().optional(),
  locked_at: z.string().datetime().nullable().optional(),
  guardrails: ReportGuardrailsSchema
});

export const ReportRunDeliverySchema = z.object({
  status: z.enum(["not_configured", "queued", "sent", "failed"]).default("not_configured"),
  recipients: z.array(z.string().email()).default([]),
  provider: z.string().min(1).default("none"),
  sent_at: z.string().datetime().nullable().default(null),
  error: z.string().min(1).nullable().default(null)
});

export const ReportRunSchema = z.object({
  id: z.string().min(1),
  tenant_id: z.string().min(1).optional(),
  contract_id: z.string().min(1),
  status: z.enum(["pending", "running", "succeeded", "failed"]),
  trigger: z.enum(["manual", "scheduled", "retry"]).default("manual"),
  attempt: z.number().int().min(1).default(1),
  retry_of_run_id: z.string().min(1).nullable().optional(),
  started_at: z.string().datetime(),
  finished_at: z.string().datetime().nullable(),
  query_plan: z.record(z.string(), z.unknown()),
  exec_brief: z.record(z.string(), z.unknown()),
  report_html: z.string().optional(),
  delivery: ReportRunDeliverySchema.optional()
});

export type ReportGuardrails = z.infer<typeof ReportGuardrailsSchema>;
export type ReportContract = z.infer<typeof ReportContractSchema>;
export type ReportRun = z.infer<typeof ReportRunSchema>;
export type ReportContractDelivery = z.infer<typeof ReportContractDeliverySchema>;
export type ReportRunDelivery = z.infer<typeof ReportRunDeliverySchema>;
