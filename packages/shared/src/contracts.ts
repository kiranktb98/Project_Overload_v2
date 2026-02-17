import { z } from "zod";
import { EVIDENCE_ROW_CAP, MAX_BATCHES } from "./constants";

export const ReportGuardrailsSchema = z.object({
  evidence_row_cap: z.number().int().min(1).max(EVIDENCE_ROW_CAP).default(EVIDENCE_ROW_CAP),
  max_batches: z.number().int().min(1).max(MAX_BATCHES).default(MAX_BATCHES),
  allowed_relations: z.array(z.string().min(1)).default([]),
  allowed_schemas: z.array(z.string().min(1)).default([]),
  timeout_ms: z.number().int().min(100).max(120000).default(15000),
  deny_write: z.literal(true).default(true)
});

export const InsightModeSchema = z.enum(["business", "data"]).default("business");
export type InsightMode = z.infer<typeof InsightModeSchema>;

export const ReportContractSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  audience: z.string().min(1),
  timezone: z.string().min(1),
  schedule_cron: z.string().min(1).nullable(),
  sql_template: z.string().min(1),
  metric_ids: z.array(z.string().min(1)).default([]),
  dimension_ids: z.array(z.string().min(1)).default([]),
  insight_mode: InsightModeSchema,
  guardrails: ReportGuardrailsSchema
});

export const ReportRunSchema = z.object({
  id: z.string().min(1),
  contract_id: z.string().min(1),
  status: z.enum(["pending", "running", "succeeded", "failed"]),
  started_at: z.string().datetime(),
  finished_at: z.string().datetime().nullable(),
  query_plan: z.record(z.string(), z.unknown()),
  exec_brief: z.record(z.string(), z.unknown()),
  report_html: z.string().optional()
});

export type ReportGuardrails = z.infer<typeof ReportGuardrailsSchema>;
export type ReportContract = z.infer<typeof ReportContractSchema>;
export type ReportRun = z.infer<typeof ReportRunSchema>;