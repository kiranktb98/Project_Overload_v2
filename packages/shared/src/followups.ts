import { z } from "zod";
import { AnalystAdditionalQueryRequestSchema } from "./evidence";

export const ReportClarificationInputSchema = z.object({
  report_title: z.string().min(1),
  question: z.string().min(1),
  report_html: z.string().default(""),
  exec_brief: z.record(z.string(), z.unknown()).default({}),
  per_question_summaries: z
    .array(
      z.object({
        question_id: z.string().min(1),
        question_text: z.string().min(1),
        findings: z.array(z.string().min(1)).default([]),
        drivers: z.array(z.string().min(1)).default([]),
        anomalies: z.array(z.string().min(1)).default([]),
        coverage_status: z.enum(["complete", "partial", "insufficient"]),
        coverage_notes: z.array(z.string().min(1)).default([]),
        evidence_refs: z.array(z.string().min(1)).default([]),
        confidence_notes: z.array(z.string().min(1)).default([])
      })
    )
    .default([]),
  analysis_payloads: z
    .array(
      z.object({
        question_id: z.string().min(1),
        question: z.string().min(1),
        data_summary: z.string().min(1),
        highlights: z.array(z.string().min(1)).default([]),
        risks: z.array(z.string().min(1)).default([]),
        recommendations: z.array(z.string().min(1)).default([])
      })
    )
    .default([]),
  metric_definitions: z
    .array(
      z.object({
        metric_key: z.string().min(1),
        display_name: z.string().min(1),
        definition: z.string().min(1)
      })
    )
    .default([]),
  business_context: z.string().default("")
});

export const ReportClarificationOutputSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(z.string().min(1)).default([]),
  grounded: z.boolean().default(true),
  requires_new_analysis: z.boolean().default(false)
});

export const BusinessCaseCandidateSchema = z.object({
  candidate_id: z.string().min(1),
  question_id: z.string().min(1),
  question_number: z.number().int().min(1),
  question_text: z.string().min(1),
  recommendation_index: z.number().int().min(1),
  recommendation: z.string().min(1),
  highlights: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([])
});

export const BusinessCaseSupportingDataSchema = z.object({
  label: z.string().min(1),
  sql: z.string().min(1).optional(),
  row_count: z.number().int().min(0),
  sample_rows: z.array(z.record(z.string(), z.unknown())).max(20).default([])
});

export const BusinessCaseContextSchema = z.object({
  candidate_id: z.string().min(1),
  assumption_notes: z.array(z.string().min(1)).max(8).default([]),
  clarification_round: z.number().int().min(0).max(3).default(0)
});

export const BusinessCaseInputSchema = z.object({
  report_title: z.string().min(1),
  question: z.string().min(1),
  candidate: BusinessCaseCandidateSchema,
  user_message: z.string().min(1),
  assumption_notes: z.array(z.string().min(1)).max(8).default([]),
  business_context: z.string().default(""),
  metric_definitions: z
    .array(
      z.object({
        metric_key: z.string().min(1),
        display_name: z.string().min(1),
        definition: z.string().min(1)
      })
    )
    .default([]),
  analysis_payload: z
    .object({
      question_id: z.string().min(1),
      question: z.string().min(1),
      data_summary: z.string().min(1),
      highlights: z.array(z.string().min(1)).default([]),
      risks: z.array(z.string().min(1)).default([]),
      recommendations: z.array(z.string().min(1)).default([])
    })
    .nullable()
    .default(null),
  prepared_payload: z
    .object({
      question_id: z.string().min(1),
      question_number: z.number().int().min(1),
      question: z.string().min(1),
      purpose: z.string().min(1),
      prepared_row_count: z.number().int().min(0),
      warnings: z.array(z.string().min(1)).default([]),
      validation: z
        .object({
          expected_months: z.number().int().min(1).nullable().optional(),
          observed_months: z.number().int().min(0),
          missing_months: z.array(z.string().min(1)).default([]),
          monthly_row_counts: z
            .array(
              z.object({
                month: z.string().min(1),
                row_count: z.number().int().min(0)
              })
            )
            .default([]),
          metric_column: z.string().nullable().optional(),
          monthly_metric_totals: z
            .array(
              z.object({
                month: z.string().min(1),
                total: z.number()
              })
            )
            .default([])
        })
        .optional(),
      sample_rows: z.array(z.record(z.string(), z.unknown())).max(5).default([])
    })
    .nullable()
    .default(null),
  supporting_data: z.array(BusinessCaseSupportingDataSchema).max(4).default([])
});

const BusinessCaseBaseSchema = z.object({
  additional_query_requests: z.array(AnalystAdditionalQueryRequestSchema).max(2).default([])
});

export const BusinessCaseNeedsClarificationSchema = BusinessCaseBaseSchema.extend({
  status: z.literal("needs_clarification"),
  clarification_prompt: z.string().min(1),
  missing_inputs: z.array(z.string().min(1)).max(4).default([])
});

export const BusinessCaseCompleteSchema = BusinessCaseBaseSchema.extend({
  status: z.literal("complete"),
  title: z.string().min(1),
  executive_summary: z.string().min(1),
  recommendation: z.string().min(1),
  baseline: z.array(z.string().min(1)).min(1).max(8),
  assumptions: z.array(z.string().min(1)).min(1).max(8),
  implementation_plan: z.array(z.string().min(1)).min(2).max(8),
  timeline_impact: z
    .array(
      z.object({
        period_label: z.string().min(1),
        impact: z.string().min(1)
      })
    )
    .min(2)
    .max(6),
  financial_view: z.array(z.string().min(1)).max(8).default([]),
  operational_view: z.array(z.string().min(1)).max(8).default([]),
  risks: z.array(z.string().min(1)).max(8).default([]),
  kpis_to_track: z.array(z.string().min(1)).max(8).default([]),
  citations: z.array(z.string().min(1)).default([])
});

export const BusinessCaseOutputSchema = z.discriminatedUnion("status", [
  BusinessCaseNeedsClarificationSchema,
  BusinessCaseCompleteSchema
]);

export type ReportClarificationInput = z.infer<typeof ReportClarificationInputSchema>;
export type ReportClarificationOutput = z.infer<typeof ReportClarificationOutputSchema>;
export type BusinessCaseCandidate = z.infer<typeof BusinessCaseCandidateSchema>;
export type BusinessCaseSupportingData = z.infer<typeof BusinessCaseSupportingDataSchema>;
export type BusinessCaseContext = z.infer<typeof BusinessCaseContextSchema>;
export type BusinessCaseInput = z.infer<typeof BusinessCaseInputSchema>;
export type BusinessCaseOutput = z.infer<typeof BusinessCaseOutputSchema>;
