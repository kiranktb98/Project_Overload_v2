import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { DataPlane } from "@project-overload/dataplane";
import type {
  BusinessCaseClient,
  QueryStrategistClient,
  ReportClarificationClient
} from "@project-overload/llm-client";
import {
  BusinessCaseCandidateSchema,
  BusinessCaseOutputSchema,
  ReportClarificationOutputSchema,
  type BusinessCaseCandidate,
  type BusinessCaseOutput,
  type ReportContract,
  type ReportRun,
  type SqlDialect
} from "@project-overload/shared";
import type { MetadataStore } from "../store";

const MetricDefinitionSchema = z.object({
  metric_key: z.string().min(1),
  display_name: z.string().min(1),
  definition: z.string().min(1)
});

const AnalysisPayloadSchema = z.object({
  question_id: z.string().min(1),
  question: z.string().min(1),
  data_summary: z.string().min(1),
  highlights: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  recommendations: z.array(z.string().min(1)).default([])
});

const PerQuestionSummarySchema = z.object({
  question_id: z.string().min(1),
  question_text: z.string().min(1),
  findings: z.array(z.string().min(1)).default([]),
  drivers: z.array(z.string().min(1)).default([]),
  anomalies: z.array(z.string().min(1)).default([]),
  coverage_status: z.enum(["complete", "partial", "insufficient"]),
  coverage_notes: z.array(z.string().min(1)).default([]),
  evidence_refs: z.array(z.string().min(1)).default([]),
  confidence_notes: z.array(z.string().min(1)).default([])
});

const PreparedPayloadSchema = z.object({
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
});

const QueryPlanFollowupSchema = z.object({
  analysis_payloads: z.array(AnalysisPayloadSchema).default([]),
  per_question_summaries: z.array(PerQuestionSummarySchema).default([]),
  prepared_payloads: z.array(PreparedPayloadSchema).default([]),
  metric_definitions: z.array(MetricDefinitionSchema).default([]),
  business_context: z.string().default(""),
  catalog_summary: z.string().default("")
});

type QueryPlanFollowups = z.infer<typeof QueryPlanFollowupSchema>;

export async function answerReportQuestionWithAgent(input: {
  run: ReportRun;
  contract: ReportContract;
  question: string;
  report_qa_client: ReportClarificationClient;
}): Promise<z.infer<typeof ReportClarificationOutputSchema>> {
  const parsed = parseQueryPlanFollowups(input.run);
  return ReportClarificationOutputSchema.parse(
    await input.report_qa_client.answerQuestion({
      report_title: input.contract.name,
      question: input.question,
      report_html: input.run.report_html ?? "",
      exec_brief: input.run.exec_brief,
      per_question_summaries: parsed.per_question_summaries,
      analysis_payloads: parsed.analysis_payloads,
      prepared_payloads: parsed.prepared_payloads,
      metric_definitions: parsed.metric_definitions,
      business_context: parsed.business_context
    })
  );
}

export function listBusinessCaseCandidates(run: ReportRun): BusinessCaseCandidate[] {
  const parsed = parseQueryPlanFollowups(run);
  const preparedByQuestionId = new Map(parsed.prepared_payloads.map((payload) => [payload.question_id, payload]));
  const summariesByQuestionId = new Map(parsed.per_question_summaries.map((summary) => [summary.question_id, summary]));
  const candidates: BusinessCaseCandidate[] = [];

  for (const analysis of parsed.analysis_payloads) {
    const prepared = preparedByQuestionId.get(analysis.question_id);
    const summary = summariesByQuestionId.get(analysis.question_id);
    for (const [index, recommendation] of analysis.recommendations.entries()) {
      if (!isBusinessCaseRecommendation(recommendation)) {
        continue;
      }
      candidates.push(
        BusinessCaseCandidateSchema.parse({
          candidate_id: `${analysis.question_id}_r${index + 1}`,
          question_id: analysis.question_id,
          question_number: prepared?.question_number ?? index + 1,
          question_text: prepared?.question ?? summary?.question_text ?? stripQuestionLabel(analysis.question),
          recommendation_index: index + 1,
          recommendation,
          highlights: analysis.highlights,
          risks: analysis.risks
        })
      );
    }
  }

  return candidates;
}

const NON_BUSINESS_CASE_RECOMMENDATION_PATTERNS = [
  /\bfinal report review\b/i,
  /\bvalidate key findings\b/i,
  /\bappendix evidence\b/i,
  /\bevidence refs?\b/i,
  /\brefresh source data\b/i,
  /\badjust scope\b/i,
  /\bverify source tables?\b/i,
  /\bre-?run\b/i,
  /\breview (the )?(report|brief)\b/i,
  /\bresolve preparation warnings\b/i,
  /\bvalidate .*metric definition/i
];

const BUSINESS_CASE_ACTION_PATTERNS = [
  /\bimplement\b/i,
  /\bpilot\b/i,
  /\broll ?out\b/i,
  /\btighten\b/i,
  /\brelax\b/i,
  /\bintroduce\b/i,
  /\blaunch\b/i,
  /\bexpand\b/i,
  /\bconsolidate\b/i,
  /\boptimi[sz]e\b/i,
  /\bautomate\b/i,
  /\bprioriti[sz]e\b/i,
  /\breduce\b/i,
  /\bincrease\b/i,
  /\bshift\b/i,
  /\bmove\b/i,
  /\bimprove\b/i,
  /\bstandardi[sz]e\b/i,
  /\bchange\b/i,
  /\bupdate policy\b/i,
  /\bhire\b/i,
  /\btrain\b/i,
  /\binvest\b/i,
  /\brenegotiat/i
];

function isBusinessCaseRecommendation(recommendation: string): boolean {
  const normalized = recommendation.trim();
  if (normalized.length === 0) {
    return false;
  }

  if (NON_BUSINESS_CASE_RECOMMENDATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  return BUSINESS_CASE_ACTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export async function buildBusinessCaseAnalysis(input: {
  run: ReportRun;
  contract: ReportContract;
  tenant_id: string;
  candidate_id: string;
  question: string;
  assumption_notes: string[];
  business_case_client: BusinessCaseClient;
  query_strategist: QueryStrategistClient;
  data_plane: DataPlane;
  store: MetadataStore;
  catalog_summary: string;
  sql_dialect: SqlDialect;
}): Promise<BusinessCaseOutput> {
  const followups = parseQueryPlanFollowups(input.run);
  const candidates = listBusinessCaseCandidates(input.run);
  const candidate = candidates.find((entry) => entry.candidate_id === input.candidate_id);
  if (!candidate) {
    throw new Error("Business case recommendation was not found for this run.");
  }

  const analysis = followups.analysis_payloads.find((entry) => entry.question_id === candidate.question_id) ?? null;
  const prepared = followups.prepared_payloads.find((entry) => entry.question_id === candidate.question_id) ?? null;
  const assumptionNotes = dedupeNotes(input.assumption_notes);

  let output = await input.business_case_client.buildCase({
    report_title: input.contract.name,
    question: input.question,
    candidate,
    user_message: input.question,
    assumption_notes: assumptionNotes,
    business_context: followups.business_context,
    metric_definitions: followups.metric_definitions,
    analysis_payload: analysis,
    prepared_payload: prepared,
    supporting_data: []
  });

  if (output.status === "needs_clarification") {
    return BusinessCaseOutputSchema.parse(output);
  }

  if (output.additional_query_requests.length === 0) {
    return BusinessCaseOutputSchema.parse(output);
  }

  const supportingData = await executeBusinessCaseSupportQueries({
    run: input.run,
    contract: input.contract,
    tenant_id: input.tenant_id,
    candidate,
    assumption_notes: assumptionNotes,
    query_requests: output.additional_query_requests,
    query_strategist: input.query_strategist,
    data_plane: input.data_plane,
    store: input.store,
    catalog_summary: followups.catalog_summary || input.catalog_summary,
    sql_dialect: input.sql_dialect
  });

  output = await input.business_case_client.buildCase({
    report_title: input.contract.name,
    question: input.question,
    candidate,
    user_message: input.question,
    assumption_notes: assumptionNotes,
    business_context: followups.business_context,
    metric_definitions: followups.metric_definitions,
    analysis_payload: analysis,
    prepared_payload: prepared,
    supporting_data: supportingData
  });

  return BusinessCaseOutputSchema.parse({
    ...output,
    additional_query_requests: []
  });
}

function parseQueryPlanFollowups(run: ReportRun): QueryPlanFollowups {
  return QueryPlanFollowupSchema.parse(run.query_plan ?? {});
}

async function executeBusinessCaseSupportQueries(input: {
  run: ReportRun;
  contract: ReportContract;
  tenant_id: string;
  candidate: BusinessCaseCandidate;
  assumption_notes: string[];
  query_requests: BusinessCaseOutput["additional_query_requests"];
  query_strategist: QueryStrategistClient;
  data_plane: DataPlane;
  store: MetadataStore;
  catalog_summary: string;
  sql_dialect: SqlDialect;
}) {
  const strategy = await input.query_strategist.planQueries({
    catalog_summary: input.catalog_summary || "No catalog summary available.",
    report_goal: [
      `Business case support for Q${input.candidate.question_number}: ${input.candidate.question_text}`,
      `Recommendation: ${input.candidate.recommendation}`,
      `Assumptions: ${input.assumption_notes.join(" | ") || "None provided"}`,
      ...input.query_requests.map((request, index) => [
        `Request ${index + 1}: ${request.reason}`,
        `Question: ${request.question}`,
        request.required_fields.length > 0
          ? `Required fields: ${request.required_fields.join(", ")}`
          : "Required fields: not specified"
      ].join("\n"))
    ].join("\n\n"),
    audience: input.contract.audience,
    insight_mode: input.contract.insight_mode ?? "business",
    sql_dialect: input.sql_dialect,
    metric_ids: input.contract.metric_ids,
    dimension_ids: input.contract.dimension_ids,
    allowed_relations: input.contract.guardrails.allowed_relations,
    planner_context: `Business case support planning for ${input.candidate.candidate_id}`,
    metric_definitions: parseQueryPlanFollowups(input.run).metric_definitions,
    business_context: parseQueryPlanFollowups(input.run).business_context
  });

  const plannedQueries = strategy.queries.slice(0, 2);
  const results: Array<{
    label: string;
    sql?: string;
    row_count: number;
    sample_rows: Array<Record<string, unknown>>;
  }> = [];

  for (const [index, planned] of plannedQueries.entries()) {
    let sql = planned.sql;
    if (input.query_strategist.compileSql) {
      try {
        const compiled = await input.query_strategist.compileSql({
          sql,
          dialect: input.sql_dialect,
          allowed_relations: input.contract.guardrails.allowed_relations,
          allowed_schemas: input.contract.guardrails.allowed_schemas,
          catalog_summary: input.catalog_summary,
          question: planned.question
        });
        sql = compiled.sql;
      } catch {
        // Keep original SQL if dialect compilation fails.
      }
    }

    try {
      const execution = await input.data_plane.execute({
        request_id: `business_case_${input.candidate.candidate_id}_${index + 1}_${randomUUID()}`,
        sql,
        policy: {
          allowed_relations: input.contract.guardrails.allowed_relations,
          allowed_schemas: input.contract.guardrails.allowed_schemas,
          timeout_ms: input.contract.guardrails.timeout_ms,
          row_cap: Math.min(input.contract.guardrails.evidence_row_cap, 200),
          pii_fields: []
        }
      });

      results.push({
        label: planned.purpose || planned.question,
        sql: execution.governed_sql,
        row_count: execution.row_count,
        sample_rows: execution.rows.slice(0, 10)
      });
      await input.store.appendAuditLog(
        "business_case_support_query_executed",
        {
          run_id: input.run.id,
          candidate_id: input.candidate.candidate_id,
          question_id: input.candidate.question_id,
          sql: execution.governed_sql,
          row_count: execution.row_count
        },
        { tenant_id: input.tenant_id }
      );
    } catch (error) {
      await input.store.appendAuditLog(
        "business_case_support_query_failed",
        {
          run_id: input.run.id,
          candidate_id: input.candidate.candidate_id,
          question_id: input.candidate.question_id,
          sql,
          error: error instanceof Error ? error.message : "Unknown error"
        },
        { tenant_id: input.tenant_id }
      );
    }
  }

  return results;
}

function stripQuestionLabel(value: string): string {
  return value.replace(/^Q\d+\.\s*/i, "").replace(/\n[\s\S]*$/m, "").trim();
}

function dedupeNotes(notes: string[]): string[] {
  return Array.from(
    new Set(
      notes
        .map((note) => note.trim())
        .filter((note) => note.length > 0)
    )
  ).slice(0, 8);
}
