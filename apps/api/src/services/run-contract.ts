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

  // Step 2: Execute queries and analyze — supports both Case 1 (grouped) and Case 2 (standalone)
  const analyses: ReportComposerInput["analyses"] = [];
  const queryDetails: Array<{ question: string; sql: string; row_count: number; group_id?: string }> = [];

  // Separate queries into groups (Case 1) and standalone (Case 2)
  const groups = new Map<string, typeof strategy.queries>();
  const standalone: typeof strategy.queries = [];

  for (const planned of strategy.queries) {
    if (planned.group_id) {
      const existing = groups.get(planned.group_id) ?? [];
      existing.push(planned);
      groups.set(planned.group_id, existing);
    } else {
      standalone.push(planned);
    }
  }

  // --- Case 2: Standalone queries — each query gets its own analyst call ---
  for (const planned of standalone) {
    const { rows, error } = await executeQuery(input, planned);
    queryDetails.push({ question: planned.question, sql: sanitizeLlmSql(planned.sql), row_count: rows.length });

    if (error || rows.length === 0) {
      analyses.push({
        question: planned.question,
        highlights: [],
        risks: [error ?? "No data returned for this query."],
        recommendations: ["Verify the query or check that the relevant tables contain data."],
        data_summary: `Query for "${planned.question}" returned no results. ${error ?? ""}`
      });
      continue;
    }

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

  // --- Case 1: Grouped queries — execute all in group, merge rows, one analyst call per group ---
  for (const [groupId, groupQueries] of groups) {
    const mergedRows: Record<string, unknown>[] = [];
    const groupQuestions: string[] = [];
    const groupPurposes: string[] = [];
    let groupError: string | null = null;

    for (const planned of groupQueries) {
      const { rows, error } = await executeQuery(input, planned);
      queryDetails.push({ question: planned.question, sql: sanitizeLlmSql(planned.sql), row_count: rows.length, group_id: groupId });

      if (error) {
        groupError = groupError ? `${groupError}; ${error}` : error;
        continue;
      }

      // Tag each row with source query for the analyst's context
      for (const row of rows) {
        mergedRows.push({ _source_query: planned.question, ...row });
      }

      groupQuestions.push(planned.question);
      groupPurposes.push(planned.purpose);
    }

    const combinedQuestion = groupQuestions.join(" + ");

    if (mergedRows.length === 0) {
      analyses.push({
        question: combinedQuestion || `Group ${groupId}`,
        highlights: [],
        risks: [groupError ?? "No data returned for any query in this group."],
        recommendations: ["Verify the queries or check that the relevant tables contain data."],
        data_summary: `Grouped queries for "${combinedQuestion}" returned no results. ${groupError ?? ""}`
      });
      continue;
    }

    // Cap merged rows to evidence_row_cap
    const cappedRows = mergedRows.slice(0, input.contract.guardrails.evidence_row_cap);

    const analysis = await input.analyst_client.analyzeBatch({
      request_id: `${input.contract.id}_group_${groupId}`,
      batch_index: 0,
      total_batches: 1,
      summary_word_budget: 400, // larger budget for combined analysis
      question: combinedQuestion,
      insight_mode: insightMode,
      evidence_packet: {
        request_id: `${input.contract.id}_evidence_group_${groupId}`,
        batch_index: 0,
        total_batches: 1,
        rows: cappedRows,
        row_count: cappedRows.length
      }
    });

    analyses.push({
      question: combinedQuestion,
      highlights: analysis.highlights,
      risks: analysis.risks,
      recommendations: analysis.recommendations,
      data_summary: `${cappedRows.length} merged rows from ${groupQueries.length} queries (group: ${groupId}). Confidence: ${(analysis.confidence_score * 100).toFixed(0)}%. ${groupPurposes.join("; ")}`
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
 * Execute a single planned query against the data plane with sanitization and audit logging.
 */
async function executeQuery(
  input: {
    contract: ReportContract;
    store: MetadataStore;
    data_plane: DataPlane;
  },
  planned: { question: string; sql: string }
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
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

    await input.store.appendAuditLog("dataplane_execute", {
      question: planned.question,
      sql: safeSql,
      row_count: result.rows.length
    });

    return { rows: result.rows, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query execution failed";
    await input.store.appendAuditLog("dataplane_error", {
      question: planned.question,
      sql: safeSql,
      error: message
    });
    return { rows: [], error: message };
  }
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
