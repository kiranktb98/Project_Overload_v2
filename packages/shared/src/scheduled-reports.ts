import { z } from "zod";

export const ScheduledReportFrequencySchema = z.enum(["weekly", "monthly", "quarterly"]);
export type ScheduledReportFrequency = z.infer<typeof ScheduledReportFrequencySchema>;

export const ScheduledReportStatusSchema = z.enum(["active", "paused"]);
export type ScheduledReportStatus = z.infer<typeof ScheduledReportStatusSchema>;

export const ScheduledReportQueryTemplateSchema = z.object({
  question_id: z.string().min(1).nullable().default(null),
  question_number: z.number().int().min(1),
  question: z.string().min(1),
  purpose: z.string().min(1),
  sql: z.string().min(1),
  group_id: z.string().min(1).nullable().default(null)
});
export type ScheduledReportQueryTemplate = z.infer<typeof ScheduledReportQueryTemplateSchema>;

export const ScheduledReportQuestionPlanSchema = z.object({
  question_id: z.string().min(1).nullable().default(null),
  question_number: z.number().int().min(1),
  question_text: z.string().min(1),
  current_scope_summary: z.string().min(1),
  next_run_behavior: z.string().min(1),
  query_template_count: z.number().int().min(0).default(0)
});
export type ScheduledReportQuestionPlan = z.infer<typeof ScheduledReportQuestionPlanSchema>;

export const ScheduledReportProfileSchema = z.object({
  id: z.string().min(1),
  tenant_id: z.string().min(1).optional(),
  contract_id: z.string().min(1),
  source_run_id: z.string().min(1),
  report_title: z.string().min(1),
  frequency: ScheduledReportFrequencySchema,
  timezone: z.string().min(1),
  day_of_week: z.number().int().min(0).max(6).nullable().default(null),
  day_of_month: z.number().int().min(1).max(28).nullable().default(null),
  hour_local: z.number().int().min(0).max(23).default(9),
  minute_local: z.number().int().min(0).max(59).default(0),
  hour_utc: z.number().int().min(0).max(23).default(9),
  minute_utc: z.number().int().min(0).max(59).default(0),
  schedule_cron: z.string().min(1),
  windowing_instructions: z.string().min(1),
  additional_instructions: z.string().default(""),
  question_execution_plan: z.array(ScheduledReportQuestionPlanSchema).min(1),
  query_template_snapshot: z.array(ScheduledReportQueryTemplateSchema).default([]),
  report_template_html: z.string().default(""),
  status: ScheduledReportStatusSchema.default("active"),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
});
export type ScheduledReportProfile = z.infer<typeof ScheduledReportProfileSchema>;
