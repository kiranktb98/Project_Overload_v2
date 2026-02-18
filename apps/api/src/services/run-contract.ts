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
  PlannerClient,
  QueryStrategistClient,
  ReportComposerClient,
  ReportComposerInput
} from "@project-overload/llm-client";
import type { PlannerOutput } from "@project-overload/shared";
import type { MetadataStore } from "../store";

export type RunReportContractResult = {
  run: ReportRun;
  exec_brief: ExecBrief;
  html: string;
  planner_summary?: string;
};

export async function runReportContractPipeline(input: {
  contract: ReportContract;
  store: MetadataStore;
  data_plane: DataPlane;
  analyst_client: AnalystClient;
  query_strategist: QueryStrategistClient;
  report_composer: ReportComposerClient;
  planner_client: PlannerClient;
  catalog_summary: string;
}): Promise<RunReportContractResult> {
  const startedAt = new Date().toISOString();
  const insightMode = input.contract.insight_mode ?? "business";

  // Step 0: Planner — explore data, build informed plan
  const { plannerContext, plannerSummary } = await runPlannerPhase(input, insightMode);

  // Step 1: Query Strategist — LLM generates targeted SQL from catalog + planner context
  const strategy = await input.query_strategist.planQueries({
    catalog_summary: input.catalog_summary || "No catalog available.",
    report_goal: `${input.contract.name} — ${insightMode} analysis`,
    audience: input.contract.audience,
    insight_mode: insightMode,
    metric_ids: input.contract.metric_ids,
    dimension_ids: input.contract.dimension_ids,
    allowed_relations: input.contract.guardrails.allowed_relations,
    planner_context: plannerContext
  });

  await input.store.appendAuditLog("query_strategy", {
    contract_id: input.contract.id,
    query_count: strategy.queries.length,
    questions: strategy.queries.map((q) => q.question)
  });

  // Step 2: Execute queries and analyze — supports both Case 1 (grouped) and Case 2 (standalone)
  type ScoredAnalysis = {
    entry: ReportComposerInput["analyses"][number];
    confidence_score: number;
  };
  const scoredAnalyses: ScoredAnalysis[] = [];
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
      scoredAnalyses.push({
        entry: {
          question: planned.question,
          highlights: [],
          risks: [error ?? "No data returned for this query."],
          recommendations: ["Verify the query or check that the relevant tables contain data."],
          data_summary: `Query for "${planned.question}" returned no results. ${error ?? ""}`
        },
        confidence_score: 0
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

    scoredAnalyses.push({
      entry: {
        question: planned.question,
        highlights: analysis.highlights,
        risks: analysis.risks,
        recommendations: analysis.recommendations,
        data_summary: `${rows.length} rows analyzed. ${planned.purpose}`
      },
      confidence_score: analysis.confidence_score
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
      scoredAnalyses.push({
        entry: {
          question: combinedQuestion || `Group ${groupId}`,
          highlights: [],
          risks: [groupError ?? "No data returned for any query in this group."],
          recommendations: ["Verify the queries or check that the relevant tables contain data."],
          data_summary: `Grouped queries for "${combinedQuestion}" returned no results. ${groupError ?? ""}`
        },
        confidence_score: 0
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

    scoredAnalyses.push({
      entry: {
        question: combinedQuestion,
        highlights: analysis.highlights,
        risks: analysis.risks,
        recommendations: analysis.recommendations,
        data_summary: `${cappedRows.length} merged rows from ${groupQueries.length} queries (group: ${groupId}). ${groupPurposes.join("; ")}`
      },
      confidence_score: analysis.confidence_score
    });
  }
  // Step 3: Keep all analysis sections (no confidence-threshold filtering).
  const analyses: ReportComposerInput["analyses"] = scoredAnalyses.length > 0
    ? scoredAnalyses.map((s) => s.entry)
    : [{
        question: "Analysis unavailable",
        highlights: [],
        risks: ["No analysis sections were produced for this run."],
        recommendations: ["Review the configured queries and data availability, then run again."],
        data_summary: "No sections produced."
      }];

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
    exec_brief: execBrief,
    report_html: html
  });

  await input.store.createReportRun(run);

  return {
    run,
    exec_brief: execBrief,
    html,
    planner_summary: plannerSummary
  };
}

/**
 * Step 0: Planner phase — explores data with lightweight queries, then builds an informed plan.
 */
async function runPlannerPhase(
  input: {
    contract: ReportContract;
    store: MetadataStore;
    data_plane: DataPlane;
    planner_client: PlannerClient;
    catalog_summary: string;
  },
  insightMode: "business" | "data"
): Promise<{ plannerContext: string; plannerSummary: string }> {
  const plannerInput = {
    catalog_summary: input.catalog_summary || "No catalog available.",
    user_goal: input.contract.name,
    audience: input.contract.audience,
    insight_mode: insightMode,
    allowed_relations: input.contract.guardrails.allowed_relations,
    allowed_schemas: input.contract.guardrails.allowed_schemas
  };

  // Phase 1: LLM generates exploratory queries
  const exploration = await input.planner_client.explore(plannerInput);

  await input.store.appendAuditLog("planner_explore", {
    contract_id: input.contract.id,
    query_count: exploration.queries.length,
    purposes: exploration.queries.map(q => q.purpose)
  });

  // Execute exploratory queries (short timeout, small row cap, error-tolerant)
  const explorationResults: string[] = [];
  for (const eq of exploration.queries) {
    try {
      const safeSql = sanitizeLlmSql(eq.sql);
      const result = await input.data_plane.execute({
        request_id: `${input.contract.id}_explore_${randomUUID().slice(0, 8)}`,
        sql: safeSql,
        policy: {
          allowed_relations: input.contract.guardrails.allowed_relations,
          allowed_schemas: input.contract.guardrails.allowed_schemas,
          timeout_ms: 5000,
          row_cap: 50,
          pii_fields: []
        }
      });

      const preview = result.rows.slice(0, 20)
        .map(r => JSON.stringify(r))
        .join("\n");
      explorationResults.push(
        `--- ${eq.purpose} (${eq.query_type}) ---\n${eq.sql}\nRows returned: ${result.row_count}\n${preview}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "query failed";
      explorationResults.push(`--- ${eq.purpose} --- ERROR: ${msg}`);
    }
  }

  // Phase 2: LLM reads exploration results, produces concrete plan
  const plan = await input.planner_client.plan({
    ...plannerInput,
    exploration_results: explorationResults.join("\n\n")
  });

  await input.store.appendAuditLog("planner_plan", {
    contract_id: input.contract.id,
    discoveries: plan.data_discoveries.length,
    approaches: plan.recommended_approaches.length,
    warnings: plan.data_warnings
  });

  return {
    plannerContext: serializePlannerContext(plan),
    plannerSummary: plan.plan_summary
  };
}

function serializePlannerContext(plan: PlannerOutput): string {
  const lines: string[] = [];

  lines.push("═══ DATA DISCOVERIES (from exploratory queries) ═══");
  for (const d of plan.data_discoveries) {
    lines.push(`${d.table}.${d.column}: ${d.finding}`);
  }

  lines.push("");
  lines.push("═══ RECOMMENDED QUERY APPROACHES ═══");
  for (const a of plan.recommended_approaches) {
    lines.push(`Q: ${a.question}`);
    lines.push(`  Approach: ${a.approach}`);
    if (a.key_columns.length > 0) lines.push(`  Key columns: ${a.key_columns.join(", ")}`);
    if (a.relevant_tables.length > 0) lines.push(`  Tables: ${a.relevant_tables.join(", ")}`);
  }

  if (plan.data_warnings.length > 0) {
    lines.push("");
    lines.push("═══ DATA WARNINGS ═══");
    for (const w of plan.data_warnings) lines.push(`- ${w}`);
  }

  return lines.join("\n");
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
