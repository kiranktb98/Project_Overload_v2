import { randomUUID } from "node:crypto";
import {
  ExecBriefSchema,
  type ExecBrief,
  ReportRunSchema,
  type ReportContract,
  type ReportRun
} from "@project-overload/shared";
import type { DataPlane } from "@project-overload/dataplane";
import type {
  AnalystClient,
  QueryStrategistClient,
  ReportComposerClient,
  ReportComposerInput
} from "@project-overload/llm-client";
import type { MetadataStore } from "../store";

export type RunReportContractResult = {
  run: ReportRun;
  exec_brief: ExecBrief;
  html: string;
};

export async function runReportContractPipeline(input: {
  contract: ReportContract;
  store: MetadataStore;
  data_plane: DataPlane;
  analyst_client: AnalystClient;
  query_strategist: QueryStrategistClient;
  report_composer: ReportComposerClient;
  catalog_summary: string;
}): Promise<RunReportContractResult> {
  const startedAt = new Date().toISOString();
  const insightMode = input.contract.insight_mode ?? "business";

  // Step 1: Query Strategist — LLM generates targeted SQL from catalog
  const strategy = await input.query_strategist.planQueries({
    catalog_summary: input.catalog_summary || "No catalog available.",
    report_goal: `${input.contract.name} — ${insightMode} analysis`,
    audience: input.contract.audience,
    insight_mode: insightMode,
    metric_ids: input.contract.metric_ids,
    dimension_ids: input.contract.dimension_ids,
    allowed_relations: input.contract.guardrails.allowed_relations
  });

  await input.store.appendAuditLog("query_strategy", {
    contract_id: input.contract.id,
    query_count: strategy.queries.length,
    questions: strategy.queries.map((q) => q.question)
  });

  // Step 2: Execute each query and analyze results
  const analyses: ReportComposerInput["analyses"] = [];
  const queryDetails: Array<{ question: string; sql: string; row_count: number }> = [];

  for (const planned of strategy.queries) {
    let rows: Record<string, unknown>[] = [];
    let queryError: string | null = null;

    // Safety: extract only the first SELECT statement if LLM returned multiple
    const safeSql = sanitizeLlmSql(planned.sql);

    try {
      const result = await input.data_plane.execute({
        request_id: `${input.contract.id}_${randomUUID().slice(0, 8)}`,
        sql: safeSql,
        policy: {
          allowed_relations: input.contract.guardrails.allowed_relations,
          allowed_schemas: input.contract.guardrails.allowed_schemas,
          timeout_ms: input.contract.guardrails.timeout_ms,
          row_cap: input.contract.guardrails.evidence_row_cap,
          pii_fields: []
        }
      });

      rows = result.rows;

      await input.store.appendAuditLog("dataplane_execute", {
        question: planned.question,
        sql: safeSql,
        row_count: rows.length
      });
    } catch (error) {
      queryError = error instanceof Error ? error.message : "Query execution failed";
      await input.store.appendAuditLog("dataplane_error", {
        question: planned.question,
        sql: safeSql,
        error: queryError
      });
    }

    if (queryError || rows.length === 0) {
      analyses.push({
        question: planned.question,
        highlights: [],
        risks: [queryError ?? "No data returned for this query."],
        recommendations: ["Verify the query or check that the relevant tables contain data."],
        data_summary: `Query for "${planned.question}" returned no results. ${queryError ?? ""}`
      });
      queryDetails.push({ question: planned.question, sql: safeSql, row_count: 0 });
      continue;
    }

    queryDetails.push({ question: planned.question, sql: safeSql, row_count: rows.length });

    // Step 3: Analyst — analyze this specific dataset for its specific question
    const analysis = await input.analyst_client.analyzeBatch({
      request_id: `${input.contract.id}_analysis`,
      batch_index: 0,
      total_batches: 1,
      summary_word_budget: 250,
      question: planned.question,
      insight_mode: insightMode,
      evidence_packet: {
        request_id: `${input.contract.id}_evidence`,
        batch_index: 0,
        total_batches: 1,
        rows,
        row_count: rows.length
      }
    });

    analyses.push({
      question: planned.question,
      highlights: analysis.highlights,
      risks: analysis.risks,
      recommendations: analysis.recommendations,
      data_summary: `${rows.length} rows analyzed. Confidence: ${(analysis.confidence_score * 100).toFixed(0)}%. ${planned.purpose}`
    });
  }

  // Step 4: Report Composer — LLM generates rich HTML report
  const html = await input.report_composer.composeReport({
    title: input.contract.name,
    audience: input.contract.audience,
    insight_mode: insightMode,
    analyses,
    catalog_summary: input.catalog_summary || ""
  });

  // Build exec brief for storage
  const execBrief = buildExecBrief(analyses, input.contract.name, startedAt);

  const run = ReportRunSchema.parse({
    id: randomUUID(),
    contract_id: input.contract.id,
    status: "succeeded",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    query_plan: {
      strategy_queries: queryDetails,
      insight_mode: insightMode
    },
    exec_brief: execBrief
  });

  await input.store.createReportRun(run);

  return {
    run,
    exec_brief: execBrief,
    html
  };
}

/**
 * Sanitize LLM-generated SQL to ensure it's a single SELECT statement.
 * - Strips trailing semicolons
 * - If multiple statements separated by semicolons, takes only the first
 * - Ensures it starts with SELECT (or WITH for CTEs)
 */
function sanitizeLlmSql(rawSql: string): string {
  let sql = rawSql.trim();

  // Remove markdown code fences if the LLM wrapped it
  const fenceMatch = sql.match(/```(?:sql)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    sql = fenceMatch[1].trim();
  }

  // Split on semicolons and take only the first non-empty statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  sql = statements[0] ?? sql;

  // Remove any trailing semicolons
  sql = sql.replace(/;\s*$/, "").trim();

  // Validate it starts with SELECT or WITH (for CTEs)
  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
    throw new Error(`LLM generated non-SELECT SQL: ${sql.slice(0, 80)}...`);
  }

  // Ensure LIMIT exists — append if missing
  if (!/\bLIMIT\b/i.test(sql)) {
    sql = `${sql} LIMIT 200`;
  }

  return sql;
}

function buildExecBrief(
  analyses: ReportComposerInput["analyses"],
  contractName: string,
  startedAt: string
): ExecBrief {
  const allHighlights = analyses.flatMap((a) => a.highlights);
  const allRisks = analyses.flatMap((a) => a.risks);
  const allRecs = analyses.flatMap((a) => a.recommendations);

  return ExecBriefSchema.parse({
    what_changed: allHighlights.length > 0 ? allHighlights.slice(0, 5) : [`${contractName} analysis completed`],
    why: analyses.map((a) => a.question).slice(0, 5),
    so_what: allRisks.length > 0 ? allRisks.slice(0, 5) : ["No significant risks identified"],
    what_to_do: allRecs.length > 0 ? allRecs.slice(0, 5) : ["Continue monitoring key metrics"],
    confidence: {
      score: analyses.length > 0 ? 0.8 : 0.3,
      rationale: `Based on ${analyses.length} analysis section(s) covering ${analyses.filter((a) => a.highlights.length > 0).length} with findings.`
    },
    appendix_refs: analyses.map((a) => a.question),
    deltas_vs_last_run: [],
    generated_at: startedAt
  });
}
