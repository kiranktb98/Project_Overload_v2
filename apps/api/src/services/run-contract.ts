import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ExecBriefSchema,
  type ExecBrief,
  ReportRunSchema,
  type ReportContract,
  type ReportRun,
  GlobalConfigSchema,
  GLOBAL_CONFIG_STATE_KEY,
  type MetricDefinition,
  migrateMetricDefinition
} from "@project-overload/shared";
import { renderExecBriefHtml } from "@project-overload/report-render";
import type { DataPlane } from "@project-overload/dataplane";
import type {
  AnalystClient,
  PlannerClient,
  QueryStrategistClient,
  ReportComposerClient,
  ReportComposerInput,
  TokenUsageEvent
} from "@project-overload/llm-client";
import { extractReferencedRelations } from "@project-overload/sql-guard";
import type { BatchAnalysis, KpiWatchlistItem, PlannerOutput, QueryStrategyOutput, SqlDialect } from "@project-overload/shared";
import type { MetadataStore } from "../store";

const PREPARATION_ROW_CAP = 10_000;
const PREPARATION_LOCAL_CAP = 1_000;
const PREPARATION_PREFLIGHT_ROW_CAP = 1;
const PREPARATION_SAMPLE_ROW_CAP = 5;
const MAX_SQL_REPAIR_ATTEMPTS = 3;
const MIN_QUERY_QUALITY_SCORE = 45;
const MIN_ANALYSIS_GROUNDING_SCORE = 0.45;
const DEFAULT_SQL_DIALECT: SqlDialect = "postgres";
const ANALYST_ROW_CAP = 200; // Max rows sent to analyst per call; batch if exceeded

type CatalogModel = {
  table_columns: Map<string, Set<string>>;
};

type QueryQualityScore = {
  score: number;
  issues: string[];
  referenced_relations: string[];
};

type TemporalSampleProfile = {
  hinted_date_columns: string[];
  notes: string[];
  warnings: string[];
};

type MonthKeyOptions = {
  strict?: boolean;
  allow_numeric_epoch?: boolean;
};

const PreparedQuestionPayloadSchema = z.object({
  question_id: z.string().min(1),
  question_number: z.number().int().min(1),
  question: z.string().min(1),
  purpose: z.string().min(1),
  group_id: z.string().min(1).optional(),
  source_query_count: z.number().int().min(1),
  primary_sql: z.string().min(1),
  preparation_sqls: z.array(z.string().min(1)).default([]),
  row_count_before_reduction: z.number().int().min(0),
  prepared_row_count: z.number().int().min(0),
  prepared_rows: z.array(z.record(z.string(), z.unknown())).max(PREPARATION_LOCAL_CAP),
  validation: z
    .object({
      expected_months: z.number().int().min(1).nullable().default(null),
      observed_months: z.number().int().min(0),
      missing_months: z.array(z.string().regex(/^\d{4}-\d{2}$/)).default([]),
      monthly_row_counts: z
        .array(
          z.object({
            month: z.string().regex(/^\d{4}-\d{2}$/),
            row_count: z.number().int().min(0)
          })
        )
        .max(24)
        .default([]),
      metric_column: z.string().nullable().default(null),
      monthly_metric_totals: z
        .array(
          z.object({
            month: z.string().regex(/^\d{4}-\d{2}$/),
            total: z.number()
          })
        )
        .max(24)
        .default([])
    })
    .optional(),
  preparation_notes: z.array(z.string().min(1)).default([]),
  warnings: z.array(z.string().min(1)).default([])
});

const PreparedQuestionPayloadPublicSchema = PreparedQuestionPayloadSchema.omit({
  prepared_rows: true,
  primary_sql: true
}).extend({
  sample_rows: z.array(z.record(z.string(), z.unknown())).max(5).default([])
});

const AnalysisPayloadSchema = z.object({
  question_id: z.string().min(1),
  question: z.string().min(1),
  data_summary: z.string().min(1),
  highlights: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  recommendations: z.array(z.string().min(1)).default([])
});

const TokenUsageReportSchema = z.object({
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
  by_agent: z.record(
    z.string(),
    z.object({
      input_tokens: z.number().int().min(0),
      output_tokens: z.number().int().min(0),
      total_tokens: z.number().int().min(0)
    })
  )
});

export type PreparedQuestionPayload = z.infer<typeof PreparedQuestionPayloadSchema>;
export type PreparedQuestionPayloadPublic = z.infer<typeof PreparedQuestionPayloadPublicSchema>;
export type AnalysisPayload = z.infer<typeof AnalysisPayloadSchema>;
export type TokenUsageReport = z.infer<typeof TokenUsageReportSchema>;
type PlannedStrategyQuery = QueryStrategyOutput["queries"][number];

export type DataPreparationResult = {
  planner_summary: string;
  planner_context: string;
  prepared_payloads: PreparedQuestionPayload[];
  query_details: Array<{
    question_id: string;
    question_number: number;
    question: string;
    sql: string;
    row_count: number;
    group_id?: string;
  }>;
  token_usage: TokenUsageReport;
};

export type KpiCheckResult = {
  metric_key: string;
  display_name: string;
  status: "pass" | "fail";
  actual: number | null;
  threshold: number;
  direction: "above" | "below";
  alert_message: string;
};

export type RunReportContractResult = {
  run: ReportRun;
  exec_brief: ExecBrief;
  html: string;
  planner_summary?: string;
  concise_summary: string;
  prepared_payloads: PreparedQuestionPayloadPublic[];
  kpi_results: KpiCheckResult[];
  token_usage: TokenUsageReport;
};

export type RunPayloadQaResult = {
  answer: string;
  citations: string[];
  grounded: boolean;
};

function parseCatalogSummary(catalogSummary: string): CatalogModel {
  const tableColumns = new Map<string, Set<string>>();

  for (const rawLine of catalogSummary.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("BUSINESS_ID:") || line.startsWith("summary:") || line.startsWith("sample:")) {
      continue;
    }

    const tableMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*)\s+\[[^\]]+\](?:[^:]*):\s*(.+)$/);
    if (!tableMatch) {
      continue;
    }

    const relation = tableMatch[1].toLowerCase();
    const columnsPart = tableMatch[2];
    const columns = new Set<string>();
    for (const columnMatch of columnsPart.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)) {
      columns.add(columnMatch[1].toLowerCase());
    }

    if (columns.size > 0) {
      tableColumns.set(relation, columns);
    }
  }

  return { table_columns: tableColumns };
}

function resolveCatalogColumnsForRelation(catalogModel: CatalogModel, relation: string): Set<string> | null {
  const normalized = relation.toLowerCase();
  const direct = catalogModel.table_columns.get(normalized);
  if (direct) {
    return direct;
  }

  const suffix = normalized.includes(".") ? normalized.split(".").pop() ?? normalized : normalized;
  const matches: Set<string>[] = [];
  for (const [tableName, columns] of catalogModel.table_columns.entries()) {
    if (tableName.endsWith(`.${suffix}`)) {
      matches.push(columns);
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  return null;
}

function normalizeSqlDialect(value: SqlDialect | string | undefined): SqlDialect {
  if (!value) {
    return DEFAULT_SQL_DIALECT;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "mysql") {
    return "mysql";
  }
  if (normalized === "snowflake") {
    return "snowflake";
  }
  if (normalized === "bigquery") {
    return "bigquery";
  }
  return "postgres";
}

export async function prepareReportContractData(input: {
  contract: ReportContract;
  tenant_id?: string;
  store: MetadataStore;
  data_plane: DataPlane;
  query_strategist: QueryStrategistClient;
  planner_client: PlannerClient;
  catalog_summary: string;
  sql_dialect?: SqlDialect;
}): Promise<DataPreparationResult> {
  const tenantId = input.tenant_id ?? input.contract.tenant_id ?? "default";
  const tokenUsage = createTokenUsageAccumulator();
  const insightMode = input.contract.insight_mode ?? "business";
  const sqlDialect = normalizeSqlDialect(input.sql_dialect);
  const catalogModel = parseCatalogSummary(input.catalog_summary);

  const storeContext = { tenant_id: tenantId };
  const { plannerContext, plannerSummary } = await runPlannerPhase(
    {
      ...input,
      tenant_id: tenantId,
      sql_dialect: sqlDialect
    },
    insightMode
  );
  collectClientUsage(input.planner_client, tokenUsage);

  // Load global metric definitions to enrich the query strategist context
  const globalMetricDefs = await loadGlobalMetricDefinitions(input.store, storeContext);
  const allMetricDefs = buildRunMetricDefinitions(input.contract, globalMetricDefs);
  const metricDefsContext = allMetricDefs.length > 0
    ? "\nMETRIC DEFINITIONS (use these exact formulas and auto-apply the filters):\n" +
      allMetricDefs.map((m) => {
        const parts = [`- ${m.display_name} (${m.metric_key}): ${m.definition}`];
        if (m.filter_description.length > 0) {
          parts.push(`  intent: ${m.filter_description}`);
        }
        const sqlFilter = buildMetricSqlFilter(m);
        if (sqlFilter.length > 0) {
          parts.push(`  [auto-filter: WHERE ${sqlFilter}]`);
        }
        return parts.join("\n");
      }).join("\n")
    : "";

  // Build scope clarifications context if available
  const scopeClarifications = input.contract.scope_clarifications ?? [];
  console.log("[data-prep] scope_clarifications count=%d", scopeClarifications.length);
  if (scopeClarifications.length > 0) {
    for (const sc of scopeClarifications) {
      console.log("[data-prep]   Q%d: %s | answer: %s", sc.question_number, sc.question, sc.answer?.substring(0, 80));
    }
  }
  const scopeContext = scopeClarifications.length > 0
    ? "\n\nSCOPED QUESTIONS (you MUST generate queries for EACH of these):\n" +
      scopeClarifications.map((sc) =>
        `Q${sc.question_number}: ${sc.question}\n   Clarification: ${sc.answer}`
      ).join("\n")
    : "";

  const strategy = await input.query_strategist.planQueries({
    catalog_summary: input.catalog_summary || "No catalog available.",
    report_goal: [
      input.contract.name,
      `Mode: ${insightMode}`,
      `Audience: ${input.contract.audience}`,
      `Contract SQL: ${input.contract.sql_template}`
    ].join(" | ") + metricDefsContext + scopeContext,
    audience: input.contract.audience,
    insight_mode: insightMode,
    metric_ids: input.contract.metric_ids,
    dimension_ids: input.contract.dimension_ids,
    allowed_relations: input.contract.guardrails.allowed_relations,
    planner_context: plannerContext,
    sql_dialect: sqlDialect
  });
  collectClientUsage(input.query_strategist, tokenUsage);
  console.log("[data-prep] strategist returned %d queries, groups: %s",
    strategy.queries.length,
    groupPlannedQueries(strategy.queries).map((g) => `${g.group_id ?? "no-group"}(${g.queries.length})`).join(", "));

  await input.store.appendAuditLog(
    "query_strategy",
    {
      contract_id: input.contract.id,
      query_count: strategy.queries.length,
      questions: strategy.queries.map((q) => q.question),
      grouped: groupPlannedQueries(strategy.queries).map((group) => ({
        question_number: group.question_number,
        group_id: group.group_id ?? null,
        source_queries: group.queries.length
      }))
    },
    storeContext
  );

  const preparedPayloads: PreparedQuestionPayload[] = [];
  const queryDetails: DataPreparationResult["query_details"] = [];

  for (const grouped of groupPlannedQueries(strategy.queries)) {
    const prepared = await runDataPreparationAgent({
      tenant_id: tenantId,
      question_number: grouped.question_number,
      contract: input.contract,
      data_plane: input.data_plane,
      store: input.store,
      planned_queries: grouped.queries,
      group_id: grouped.group_id,
      catalog_model: catalogModel,
      query_strategist: input.query_strategist,
      sql_dialect: sqlDialect,
      catalog_summary: input.catalog_summary
    });
    preparedPayloads.push(prepared.payload);
    queryDetails.push(...prepared.query_details);
  }

  return {
    planner_summary: plannerSummary,
    planner_context: plannerContext,
    prepared_payloads: preparedPayloads,
    query_details: queryDetails,
    token_usage: tokenUsage.snapshot()
  };
}

export async function runReportContractPipeline(input: {
  contract: ReportContract;
  run_id?: string;
  tenant_id?: string;
  trigger?: "manual" | "scheduled" | "retry";
  attempt?: number;
  retry_of_run_id?: string | null;
  store: MetadataStore;
  data_plane: DataPlane;
  analyst_client: AnalystClient;
  query_strategist: QueryStrategistClient;
  report_composer: ReportComposerClient;
  planner_client: PlannerClient;
  catalog_summary: string;
  sql_dialect?: SqlDialect;
}): Promise<RunReportContractResult> {
  const tenantId = input.tenant_id ?? input.contract.tenant_id ?? "default";
  const startedAt = new Date().toISOString();
  const insightMode = input.contract.insight_mode ?? "business";
  const tokenUsage = createTokenUsageAccumulator();
  const storeContext = { tenant_id: tenantId };

  const preparation = await prepareReportContractData({
    contract: input.contract,
    tenant_id: tenantId,
    store: input.store,
    data_plane: input.data_plane,
    query_strategist: input.query_strategist,
    planner_client: input.planner_client,
    catalog_summary: input.catalog_summary,
    sql_dialect: normalizeSqlDialect(input.sql_dialect)
  });
  tokenUsage.addReport(preparation.token_usage);

  type ScoredAnalysis = {
    question_id: string;
    entry: ReportComposerInput["analyses"][number];
    confidence_score: number;
  };

  const scoredAnalyses: ScoredAnalysis[] = [];

  for (const payload of preparation.prepared_payloads) {
    const questionLabel = [
      `Q${payload.question_number}. ${payload.question}`,
      `Report: "${input.contract.name}" | Audience: ${input.contract.audience} | Mode: ${insightMode}`
    ].join("\n");
    const coverageGap = describeCoverageGap(payload);

    if (payload.prepared_rows.length === 0) {
      scoredAnalyses.push({
        question_id: payload.question_id,
        entry: {
          question: questionLabel,
          highlights: [],
          risks: payload.warnings.length > 0 ? payload.warnings : [`No rows were available for ${questionLabel}.`],
          recommendations: ["Refine scope and verify source tables before re-running this question."],
          data_summary: buildPayloadDataSummary(payload)
        },
        confidence_score: 0
      });
      continue;
    }

    if (coverageGap) {
      scoredAnalyses.push({
        question_id: payload.question_id,
        entry: {
          question: questionLabel,
          highlights: [coverageGap.highlight],
          risks: [...coverageGap.risks, ...payload.warnings],
          recommendations: [
            "Re-scope timeline or refresh source data to cover the full requested period before final decisioning."
          ],
          data_summary: buildPayloadDataSummary(payload)
        },
        confidence_score: 0.2
      });
      continue;
    }

    const analysis = await runAnalystWithBatching({
      analyst_client: input.analyst_client,
      payload,
      question_label: questionLabel,
      insight_mode: insightMode,
      contract_id: input.contract.id,
      data_context: buildAnalystDataContext(payload)
    });
    collectClientUsage(input.analyst_client, tokenUsage);
    const hardened = hardenBatchAnalysisOutput(payload, analysis, questionLabel);

    scoredAnalyses.push({
      question_id: payload.question_id,
      entry: hardened.entry,
      confidence_score: hardened.confidence_score
    });
  }

  const analyses: ReportComposerInput["analyses"] = scoredAnalyses.length > 0
    ? scoredAnalyses.map((item) => item.entry)
    : [{
        question: "Analysis unavailable",
        highlights: [],
        risks: ["No analysis sections were produced for this run."],
        recommendations: ["Review query strategy and data scope, then run again."],
        data_summary: "No sections produced."
      }];

  const conciseSummary = buildConciseSummary(input.contract.name, analyses);
  const globalMetricDefs = await loadGlobalMetricDefinitions(input.store, storeContext);
  const metricDefinitions = buildRunMetricDefinitions(input.contract, globalMetricDefs);
  const kpiResults = checkKpiWatchlist(
    (input.contract.kpi_watchlist ?? []) as KpiWatchlistItem[],
    preparation.prepared_payloads
  );
  const previousRun = await input.store.getLatestReportRun(input.contract.id, storeContext);
  const execBrief = buildExecBrief(analyses, input.contract.name, startedAt, previousRun);

  let html = await composeReportHtmlWithFallback({
    report_composer: input.report_composer,
    compose_input: {
      title: input.contract.name,
      audience: input.contract.audience,
      insight_mode: insightMode,
      metric_definitions: metricDefinitions,
      analyses,
      catalog_summary: input.catalog_summary || ""
    },
    fallback_exec_brief: execBrief,
    metric_definitions: metricDefinitions
  });
  collectClientUsage(input.report_composer, tokenUsage);

  if (kpiResults.length > 0) {
    html = injectKpiResultsIntoHtml(html, kpiResults);
  }

  const analysisPayloads: AnalysisPayload[] = scoredAnalyses.map((item) => ({
    question_id: item.question_id,
    question: item.entry.question,
    data_summary: item.entry.data_summary,
    highlights: [...item.entry.highlights],
    risks: [...item.entry.risks],
    recommendations: [...item.entry.recommendations]
  }));

  const run = ReportRunSchema.parse({
    id: input.run_id ?? randomUUID(),
    tenant_id: tenantId,
    contract_id: input.contract.id,
    status: "succeeded",
    trigger: input.trigger ?? "manual",
    attempt: input.attempt ?? 1,
    retry_of_run_id: input.retry_of_run_id ?? null,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    query_plan: {
      strategy_queries: preparation.query_details,
      insight_mode: insightMode,
      previous_run_id: previousRun?.id ?? null,
      metric_definitions: metricDefinitions,
      prepared_payloads: preparation.prepared_payloads.map(toPreparedPayloadPublic),
      analysis_payloads: analysisPayloads,
      kpi_results: kpiResults
    },
    exec_brief: execBrief,
    report_html: html
  });

  await input.store.createReportRun(run, storeContext);

  return {
    run,
    exec_brief: execBrief,
    html,
    planner_summary: preparation.planner_summary,
    concise_summary: conciseSummary,
    prepared_payloads: preparation.prepared_payloads.map(toPreparedPayloadPublic),
    kpi_results: kpiResults,
    token_usage: tokenUsage.snapshot()
  };
}

export function answerRunPayloadQuestion(input: {
  run: ReportRun;
  question: string;
}): RunPayloadQaResult {
  const analyses = parseAnalysisPayloads(input.run.query_plan);
  if (analyses.length === 0) {
    return {
      grounded: false,
      citations: [],
      answer: "I don't have prepared payloads for this run yet. Please run analysis first."
    };
  }

  const ranked = rankAnalysesByQuestion(analyses, input.question);
  const selected = ranked.slice(0, 2).map((entry) => entry.analysis);
  if (selected.length === 0) {
    return {
      grounded: false,
      citations: [],
      answer: "I can't answer that from this run payload. Ask about one of the analyzed questions."
    };
  }

  const lines: string[] = [];
  for (const section of selected) {
    const topFinding = section.highlights[0] ?? "No highlight captured for this section.";
    lines.push(`- ${section.question}: ${topFinding}`);
    if (section.risks.length > 0) {
      lines.push(`  Risk: ${section.risks[0]}`);
    }
    if (section.recommendations.length > 0) {
      lines.push(`  Action: ${section.recommendations[0]}`);
    }
  }

  return {
    grounded: true,
    citations: selected.map((entry) => entry.question_id),
    answer: lines.join("\n")
  };
}

function parseAnalysisPayloads(queryPlan: Record<string, unknown>): AnalysisPayload[] {
  const payload = queryPlan["analysis_payloads"];
  const parsed = z.array(AnalysisPayloadSchema).safeParse(payload);
  return parsed.success ? parsed.data : [];
}

function rankAnalysesByQuestion(
  analyses: AnalysisPayload[],
  question: string
): Array<{ analysis: AnalysisPayload; score: number }> {
  const queryTokens = tokenize(question);
  return analyses
    .map((analysis) => {
      const haystack = [
        analysis.question,
        analysis.data_summary,
        ...analysis.highlights,
        ...analysis.risks,
        ...analysis.recommendations
      ].join(" ").toLowerCase();

      let score = 0;
      for (const token of queryTokens) {
        if (haystack.includes(token)) {
          score += 1;
        }
      }
      if (question.toLowerCase().includes(analysis.question.toLowerCase())) {
        score += 3;
      }

      return { analysis, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
}

function tokenize(value: string): string[] {
  return Array.from(new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9_]+/g)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3)
  ));
}

function groupPlannedQueries(queries: QueryStrategyOutput["queries"]): Array<{
  question_number: number;
  group_id?: string;
  queries: PlannedStrategyQuery[];
}> {
  const byKey = new Map<string, { group_id?: string; queries: PlannedStrategyQuery[] }>();
  const orderedKeys: string[] = [];

  for (const [index, query] of queries.entries()) {
    const key = query.group_id ? `group:${query.group_id}` : `single:${index}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        group_id: query.group_id,
        queries: []
      });
      orderedKeys.push(key);
    }
    byKey.get(key)!.queries.push(query);
  }

  return orderedKeys.map((key, index) => {
    const grouped = byKey.get(key)!;
    return {
      question_number: index + 1,
      group_id: grouped.group_id,
      queries: grouped.queries
    };
  });
}

async function runDataPreparationAgent(input: {
  tenant_id: string;
  question_number: number;
  contract: ReportContract;
  data_plane: DataPlane;
  store: MetadataStore;
  planned_queries: PlannedStrategyQuery[];
  group_id?: string;
  catalog_model: CatalogModel;
  query_strategist: QueryStrategistClient;
  sql_dialect: SqlDialect;
  catalog_summary: string;
}): Promise<{
  payload: PreparedQuestionPayload;
  query_details: DataPreparationResult["query_details"];
}> {
  const firstPlanned = input.planned_queries[0];
  if (!firstPlanned) {
    throw new Error("Data preparation requires at least one planned query.");
  }

  const questionId = `q${input.question_number}_${randomUUID().slice(0, 6)}`;
  const preparationSqls: string[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  const queryDetails: DataPreparationResult["query_details"] = [];

  let totalRowsBeforeReduction = 0;
  const mergedRows: Record<string, unknown>[] = [];
  const plannedQueries = input.planned_queries;
  const temporalProfile = await profileTemporalColumnsForPreparation({
    tenant_id: input.tenant_id,
    contract: input.contract,
    data_plane: input.data_plane,
    store: input.store,
    planned_queries: plannedQueries
  });
  notes.push(...temporalProfile.notes);
  warnings.push(...temporalProfile.warnings);
  const hintedDateColumns = temporalProfile.hinted_date_columns;

  for (const [index, planned] of plannedQueries.entries()) {
    const result = await runPreparedQueryWithHardening({
      tenant_id: input.tenant_id,
      contract: input.contract,
      data_plane: input.data_plane,
      store: input.store,
      question: planned.question,
      source_sql: planned.sql,
      row_cap: PREPARATION_ROW_CAP,
      catalog_model: input.catalog_model,
      query_strategist: input.query_strategist,
      sql_dialect: input.sql_dialect,
      catalog_summary: input.catalog_summary
    });

    preparationSqls.push(result.sql);
    totalRowsBeforeReduction += result.rows.length;

    notes.push(
      `Source query ${index + 1}/${plannedQueries.length} (${planned.question}) returned ${result.rows.length} row(s).`
    );
    notes.push(`Source query ${index + 1} quality score: ${result.quality.score}/100.`);

    if (result.warnings.length > 0) {
      warnings.push(...result.warnings.map((warning) => `Source query ${index + 1}: ${warning}`));
    }

    if (result.error) {
      warnings.push(`Source query ${index + 1} failed: ${result.error}`);
    }

    for (const row of result.rows) {
      const tagged: Record<string, unknown> = { ...row };
      // Only tag rows when multiple sub-queries feed one question (group_id scenario)
      if (plannedQueries.length > 1) {
        tagged._sub_query = `${planned.purpose} (${index + 1}/${plannedQueries.length})`;
      }
      mergedRows.push(tagged);
    }

    queryDetails.push({
      question_id: questionId,
      question_number: input.question_number,
      question: planned.question,
      sql: result.sql,
      row_count: result.rows.length,
      group_id: input.group_id ?? planned.group_id
    });
  }

  let preparedRows = mergedRows;
  const primarySql = preparationSqls[0] ?? sanitizeLlmSql(firstPlanned.sql, PREPARATION_ROW_CAP);
  if (preparedRows.length > input.contract.guardrails.evidence_row_cap && plannedQueries.length === 1) {
    const aggregateSql = buildAggregationSql(primarySql, preparedRows, input.contract.guardrails.evidence_row_cap);
    if (aggregateSql) {
      preparationSqls.push(aggregateSql);
      const aggregateResult = await executeQueryWithPolicy({
        tenant_id: input.tenant_id,
        contract: input.contract,
        store: input.store,
        data_plane: input.data_plane,
        question: `${firstPlanned.question} (aggregation)`,
        sql: aggregateSql,
        row_cap: input.contract.guardrails.evidence_row_cap
      });

      if (!aggregateResult.error && aggregateResult.rows.length > 0) {
        preparedRows = aggregateResult.rows;
        notes.push("Applied aggregation-first reduction in data preparation.");
      } else if (aggregateResult.error) {
        warnings.push(`Aggregation query failed: ${aggregateResult.error}`);
      }
    }
  }

  if (preparedRows.length > input.contract.guardrails.evidence_row_cap) {
    const reduced = reduceRowsDeterministic(preparedRows, input.contract.guardrails.evidence_row_cap);
    preparedRows = reduced.rows;
    notes.push(...reduced.notes);
  }

  const comparisonMonths = extractExplicitMonthComparison(firstPlanned.question);
  if (comparisonMonths) {
    const coverage = detectMonthCoverage(preparedRows, hintedDateColumns);
    if (coverage.unique_months < comparisonMonths * 2) {
      warnings.push(
        `Requested ${comparisonMonths} months vs prior ${comparisonMonths}, but prepared data currently covers ${coverage.unique_months} month(s).`
      );
      const enrichmentSql = buildMonthCoverageSqlFromBase(
        primarySql,
        coverage.date_column,
        comparisonMonths * 2
      );
      if (enrichmentSql) {
        preparationSqls.push(enrichmentSql);
        const enrichmentResult = await executeQueryWithPolicy({
          tenant_id: input.tenant_id,
          contract: input.contract,
          store: input.store,
          data_plane: input.data_plane,
          question: `${firstPlanned.question} (comparison coverage)`,
          sql: enrichmentSql,
          row_cap: input.contract.guardrails.evidence_row_cap
        });
        if (!enrichmentResult.error && enrichmentResult.rows.length > 0) {
          preparedRows = enrichmentResult.rows;
          notes.push("Re-prepared dataset to enforce requested month-over-month comparison coverage.");
        } else if (enrichmentResult.error) {
          warnings.push(`Comparison coverage query failed: ${enrichmentResult.error}`);
        }
      }
    }
  }

  const validation = buildPreparedDataValidation(
    preparedRows,
    firstPlanned.question,
    comparisonMonths,
    hintedDateColumns
  );
  if (validation.expected_months !== null) {
    if (validation.missing_months.length === 0) {
      notes.push(
        `Timeline validation passed: observed ${validation.observed_months}/${validation.expected_months} expected months.`
      );
    } else {
      warnings.push(
        `Timeline validation: observed ${validation.observed_months}/${validation.expected_months} expected months; missing ${validation.missing_months.join(", ")}.`
      );
    }
  } else if (validation.observed_months > 0) {
    notes.push(`Timeline coverage detected: ${validation.observed_months} month(s) in prepared data.`);
  }

  const boundedRows = preparedRows.slice(0, PREPARATION_LOCAL_CAP);
  if (preparedRows.length > PREPARATION_LOCAL_CAP) {
    notes.push(`Stored first ${PREPARATION_LOCAL_CAP} rows for payload QA.`);
  }

  const payload = PreparedQuestionPayloadSchema.parse({
    question_id: questionId,
    question_number: input.question_number,
    question: firstPlanned.question,
    purpose: firstPlanned.purpose,
    group_id: input.group_id,
    source_query_count: plannedQueries.length,
    primary_sql: primarySql,
    preparation_sqls: preparationSqls,
    row_count_before_reduction: totalRowsBeforeReduction,
    prepared_row_count: preparedRows.length,
    prepared_rows: boundedRows,
    validation,
    preparation_notes: notes,
    warnings
  });

  return {
    payload,
    query_details: queryDetails
  };
}

type PreparedQueryExecutionResult = {
  sql: string;
  rows: Record<string, unknown>[];
  error: string | null;
  warnings: string[];
  quality: QueryQualityScore;
  attempts: number;
};

type HardenedBatchAnalysisOutput = {
  entry: ReportComposerInput["analyses"][number];
  confidence_score: number;
};

async function runPreparedQueryWithHardening(input: {
  tenant_id: string;
  contract: ReportContract;
  data_plane: DataPlane;
  store: MetadataStore;
  question: string;
  source_sql: string;
  row_cap: number;
  catalog_model: CatalogModel;
  query_strategist: QueryStrategistClient;
  sql_dialect: SqlDialect;
  catalog_summary: string;
}): Promise<PreparedQueryExecutionResult> {
  const candidates = buildQueryCandidates(input.source_sql, input.contract, input.row_cap);
  if (candidates.length === 0) {
    return {
      sql: input.source_sql,
      rows: [],
      error: "No valid SELECT query candidate was produced by strategy or fallback.",
      warnings: ["Query repair pipeline could not build a valid SELECT candidate."],
      quality: { score: 0, issues: ["No valid query candidates."], referenced_relations: [] },
      attempts: 0
    };
  }

  const warnings: string[] = [];
  let attempts = 0;
  let lastError: string | null = null;
  let lastQuality = scoreQueryQuality({
    sql: candidates[0],
    question: input.question,
    contract: input.contract,
    catalog_model: input.catalog_model
  });

  for (const [index, candidateSql] of candidates.slice(0, MAX_SQL_REPAIR_ATTEMPTS).entries()) {
    attempts += 1;
    const compiledCandidate = await compileSqlForDialect({
      query_strategist: input.query_strategist,
      sql: candidateSql,
      dialect: input.sql_dialect,
      question: input.question,
      contract: input.contract,
      catalog_summary: input.catalog_summary
    });

    let executableCandidateSql: string;
    try {
      executableCandidateSql = sanitizeLlmSql(compiledCandidate.sql, input.row_cap);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dialect compiler output was not executable.";
      warnings.push(`Candidate ${index + 1} compiler output rejected: ${message}`);
      lastError = message;
      continue;
    }

    // Dialect compilation is a normal step, not a warning — omit from warnings

    const quality = scoreQueryQuality({
      sql: executableCandidateSql,
      question: input.question,
      contract: input.contract,
      catalog_model: input.catalog_model
    });
    lastQuality = quality;

    if (quality.score < MIN_QUERY_QUALITY_SCORE) {
      warnings.push(
        `Candidate ${index + 1} rejected by quality gate (${quality.score}/100): ${quality.issues.join("; ")}`
      );
      lastError = `Quality gate rejected candidate ${index + 1}.`;
      continue;
    }

    const preflight = await preflightQueryWithPolicy({
      tenant_id: input.tenant_id,
      contract: input.contract,
      data_plane: input.data_plane,
      store: input.store,
      question: input.question,
      sql: executableCandidateSql
    });
    if (preflight.error) {
      warnings.push(`Candidate ${index + 1} preflight failed: ${preflight.error}`);
      lastError = preflight.error;
      continue;
    }

    const execution = await executeQueryWithPolicy({
      tenant_id: input.tenant_id,
      contract: input.contract,
      data_plane: input.data_plane,
      store: input.store,
      question: input.question,
      sql: executableCandidateSql,
      row_cap: input.row_cap
    });

    if (!execution.error) {
      if (index > 0) {
        warnings.push(`Auto-repaired SQL using fallback candidate ${index + 1}.`);
      }
      return {
        sql: executableCandidateSql,
        rows: execution.rows,
        error: null,
        warnings,
        quality,
        attempts
      };
    }

    warnings.push(`Candidate ${index + 1} execution failed: ${execution.error}`);
    lastError = execution.error;
  }

  return {
    sql: candidates[0],
    rows: [],
    error: lastError ?? "All SQL candidates failed after hardening retries.",
    warnings,
    quality: lastQuality,
    attempts
  };
}

async function compileSqlForDialect(input: {
  query_strategist: QueryStrategistClient;
  sql: string;
  dialect: SqlDialect;
  question: string;
  contract: ReportContract;
  catalog_summary: string;
}): Promise<{ sql: string; compiled: boolean }> {
  const normalizedSql = input.sql.trim();
  if (!input.query_strategist.compileSql) {
    return { sql: normalizedSql, compiled: false };
  }

  try {
    const compiled = await input.query_strategist.compileSql({
      sql: normalizedSql,
      dialect: normalizeSqlDialect(input.dialect),
      question: input.question,
      allowed_relations: [...input.contract.guardrails.allowed_relations],
      allowed_schemas: [...input.contract.guardrails.allowed_schemas],
      catalog_summary: input.catalog_summary
    });

    return {
      sql: compiled.sql,
      compiled: compiled.sql.trim() !== normalizedSql
    };
  } catch {
    return { sql: normalizedSql, compiled: false };
  }
}

function buildQueryCandidates(sourceSql: string, contract: ReportContract, rowCap: number): string[] {
  const candidates: string[] = [];
  const pushCandidate = (sql: string): void => {
    try {
      const sanitized = sanitizeLlmSql(sql, rowCap);
      if (!candidates.includes(sanitized)) {
        candidates.push(sanitized);
      }
    } catch {
      // Ignore invalid candidate and move to next fallback.
    }
  };

  pushCandidate(sourceSql);
  pushCandidate(contract.sql_template);

  const firstAllowlistedRelation = contract.guardrails.allowed_relations[0];
  if (firstAllowlistedRelation) {
    pushCandidate(`SELECT * FROM ${firstAllowlistedRelation} LIMIT ${Math.min(rowCap, 500)}`);
  }

  return candidates;
}

async function preflightQueryWithPolicy(input: {
  tenant_id: string;
  contract: ReportContract;
  data_plane: DataPlane;
  store: MetadataStore;
  question: string;
  sql: string;
}): Promise<{ error: string | null }> {
  const storeContext = { tenant_id: input.tenant_id };
  try {
    const timeoutMs = Math.max(1_000, Math.min(input.contract.guardrails.timeout_ms, 5_000));
    await input.data_plane.execute({
      request_id: `${input.contract.id}_preflight_${randomUUID().slice(0, 8)}`,
      sql: input.sql,
      policy: {
        allowed_relations: input.contract.guardrails.allowed_relations,
        allowed_schemas: input.contract.guardrails.allowed_schemas,
        timeout_ms: timeoutMs,
        row_cap: PREPARATION_PREFLIGHT_ROW_CAP,
        pii_fields: []
      }
    });

    await input.store.appendAuditLog(
      "query_preflight_ok",
      {
        question: input.question,
        sql: input.sql
      },
      storeContext
    );

    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query preflight failed";
    await input.store.appendAuditLog(
      "query_preflight_error",
      {
        question: input.question,
        sql: input.sql,
        error: message
      },
      storeContext
    );
    return { error: message };
  }
}

function scoreQueryQuality(input: {
  sql: string;
  question: string;
  contract: ReportContract;
  catalog_model: CatalogModel;
}): QueryQualityScore {
  const issues: string[] = [];
  let score = 100;
  let referencedRelations: string[] = [];

  try {
    referencedRelations = extractReferencedRelations(input.sql);
  } catch {
    issues.push("SQL is not parseable as a valid SELECT statement.");
    return { score: 0, issues, referenced_relations: [] };
  }

  if (referencedRelations.length === 0) {
    issues.push("Query does not reference any table in FROM/JOIN.");
    score -= 35;
  }

  const allowlisted = new Set(input.contract.guardrails.allowed_relations.map((relation) => relation.toLowerCase()));
  const offAllowlist = referencedRelations.filter((relation) => !allowlisted.has(relation));
  if (offAllowlist.length > 0) {
    issues.push(`References non-allowlisted relation(s): ${offAllowlist.join(", ")}`);
    score -= 30;
  }

  if (input.catalog_model.table_columns.size > 0) {
    const unknownCatalogRelations = referencedRelations.filter((relation) => {
      const relationColumns = resolveCatalogColumnsForRelation(input.catalog_model, relation);
      return relationColumns === null;
    });
    if (unknownCatalogRelations.length > 0) {
      issues.push(`References relation(s) missing from catalog: ${unknownCatalogRelations.join(", ")}`);
      score -= 15;
    }
  }

  if (/^\s*select\s+\*/i.test(input.sql) || /\bselect\s+[\w"']+\.\*/i.test(input.sql)) {
    issues.push("Uses SELECT *; prefer explicit projected columns.");
    score -= 12;
  }

  const needsTemporalComparison = /\b(compare|comparison|vs|prior|previous|last\s+\d+\s+months?|mom|yoy|qoq)\b/i.test(
    input.question
  );
  const hasTemporalLogic = /\b(date_trunc|interval|current_date|current_timestamp|extract|between|::date)\b/i.test(
    input.sql
  );
  if (needsTemporalComparison && !hasTemporalLogic) {
    issues.push("Question asks for time comparison but SQL lacks explicit temporal logic.");
    score -= 20;
  }

  if (/\bjoin\b/i.test(input.sql) && !/\bjoin\b[\s\S]{0,120}\bon\b/i.test(input.sql)) {
    issues.push("JOIN detected without explicit ON condition.");
    score -= 20;
  }

  const columnIssues = findQualifiedColumnIssues(input.sql, input.catalog_model);
  if (columnIssues.length > 0) {
    issues.push(...columnIssues);
    score -= Math.min(30, columnIssues.length * 10);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    referenced_relations: referencedRelations
  };
}

function findQualifiedColumnIssues(sql: string, catalogModel: CatalogModel): string[] {
  if (catalogModel.table_columns.size === 0) {
    return [];
  }

  const issues: string[] = [];
  const aliasToRelation = new Map<string, string>();
  const relationRegex =
    /\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_.]*)(?:\s+(?:as\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?/gi;
  const aliasStopWords = new Set(["on", "where", "group", "order", "left", "right", "inner", "full", "cross", "limit"]);

  let relationMatch = relationRegex.exec(sql);
  while (relationMatch) {
    const relation = relationMatch[1].toLowerCase();
    const shortName = relation.includes(".") ? relation.split(".").pop() ?? relation : relation;
    aliasToRelation.set(relation, relation);
    aliasToRelation.set(shortName, relation);

    const alias = relationMatch[2]?.toLowerCase();
    if (alias && !aliasStopWords.has(alias)) {
      aliasToRelation.set(alias, relation);
    }
    relationMatch = relationRegex.exec(sql);
  }

  const qualifiedColumnRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let qualifiedMatch = qualifiedColumnRegex.exec(sql);
  while (qualifiedMatch) {
    const qualifier = qualifiedMatch[1].toLowerCase();
    const column = qualifiedMatch[2].toLowerCase();
    const relation = aliasToRelation.get(qualifier);

    if (relation) {
      const columns = resolveCatalogColumnsForRelation(catalogModel, relation);
      if (columns && !columns.has(column)) {
        issues.push(`Column ${qualifier}.${column} is not present in catalog for ${relation}.`);
      }
    }

    qualifiedMatch = qualifiedColumnRegex.exec(sql);
  }

  return Array.from(new Set(issues));
}

async function profileTemporalColumnsForPreparation(input: {
  tenant_id: string;
  contract: ReportContract;
  data_plane: DataPlane;
  store: MetadataStore;
  planned_queries: PlannedStrategyQuery[];
}): Promise<TemporalSampleProfile> {
  const hintedDateColumns = new Set<string>();
  const notes: string[] = [];
  const warnings: string[] = [];
  const referencedRelations = new Set<string>();
  const allowlistedRelations = new Set(
    input.contract.guardrails.allowed_relations.map((relation) => relation.toLowerCase())
  );

  for (const planned of input.planned_queries) {
    try {
      const sanitizedSql = sanitizeLlmSql(planned.sql, PREPARATION_PREFLIGHT_ROW_CAP);
      for (const relation of extractReferencedRelations(sanitizedSql)) {
        if (allowlistedRelations.size === 0 || allowlistedRelations.has(relation)) {
          referencedRelations.add(relation);
        }
      }
    } catch {
      // Ignore malformed strategy SQL here; execution hardening handles repair.
    }
  }

  for (const relation of referencedRelations) {
    const sample = await executeQueryWithPolicy({
      tenant_id: input.tenant_id,
      contract: input.contract,
      store: input.store,
      data_plane: input.data_plane,
      question: `Temporal profile sample for ${relation}`,
      sql: `SELECT * FROM ${relation}`,
      row_cap: PREPARATION_SAMPLE_ROW_CAP
    });

    if (sample.error) {
      warnings.push(`Sample profiling failed for ${relation}: ${sample.error}`);
      continue;
    }

    const hints = inferTemporalColumnHints(sample.rows);
    if (hints.length === 0) {
      warnings.push(`No reliable date/time columns detected in sample rows for ${relation}.`);
      continue;
    }

    for (const hint of hints) {
      hintedDateColumns.add(hint.column.toLowerCase());
    }

    const preview = hints
      .slice(0, 3)
      .map((hint) => `${hint.column} (${Math.round(hint.parse_ratio * 100)}% parseable)`)
      .join(", ");
    notes.push(`Sampled ${relation} (${sample.rows.length} rows): temporal hints -> ${preview}.`);
  }

  return {
    hinted_date_columns: Array.from(hintedDateColumns),
    notes,
    warnings
  };
}

function inferTemporalColumnHints(
  rows: Record<string, unknown>[]
): Array<{ column: string; parse_ratio: number }> {
  const firstRow = rows[0];
  if (!firstRow) {
    return [];
  }

  const hints: Array<{ column: string; parse_ratio: number }> = [];
  for (const column of Object.keys(firstRow)) {
    const allowNumericEpoch = isDateLikeColumnName(column);
    let parseable = 0;
    let nonNull = 0;

    for (const row of rows) {
      const value = row[column];
      if (value === null || value === undefined || String(value).trim().length === 0) {
        continue;
      }
      nonNull += 1;
      if (toMonthKey(value, { strict: true, allow_numeric_epoch: allowNumericEpoch })) {
        parseable += 1;
      }
    }

    if (nonNull === 0) {
      continue;
    }

    const parseRatio = parseable / nonNull;
    const isLikelyTemporal = isDateLikeColumnName(column) || parseRatio >= 0.8;
    if (isLikelyTemporal && parseRatio >= 0.6) {
      hints.push({ column, parse_ratio: parseRatio });
    }
  }

  return hints.sort((left, right) => right.parse_ratio - left.parse_ratio);
}

function isDateLikeColumnName(column: string): boolean {
  return /(date|time|timestamp|month|period|created|updated|occurred|ordered)/i.test(column);
}

function buildAggregationSql(baseSql: string, rows: Record<string, unknown>[], rowCap: number): string | null {
  const firstRow = rows[0];
  if (!firstRow) {
    return null;
  }

  const columns = Object.keys(firstRow).filter((column) => !column.startsWith("_"));
  const numericCols = columns.filter((column) => columnLooksNumeric(rows, column));
  const dimensionCols = columns.filter((column) => columnLooksCategorical(rows, column));

  if (numericCols.length === 0 || dimensionCols.length === 0) {
    return null;
  }

  const dimension = dimensionCols[0];
  const measure = numericCols[0];
  const measureAlias = `sum_${sanitizeAlias(measure)}`;

  return [
    `WITH base AS (${stripTrailingLimit(baseSql)})`,
    `SELECT ${quoteIdentifier(dimension)} AS dimension_value,`,
    "COUNT(*) AS row_count,",
    `SUM(${quoteIdentifier(measure)}) AS ${quoteIdentifier(measureAlias)}`,
    "FROM base",
    `GROUP BY ${quoteIdentifier(dimension)}`,
    "ORDER BY row_count DESC",
    `LIMIT ${rowCap}`
  ].join(" ");
}

function stripTrailingLimit(sql: string): string {
  return sql.replace(/\s+limit\s+\d+\s*$/i, "").trim();
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function sanitizeAlias(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+/, "").slice(0, 48) || "metric";
}

function columnLooksNumeric(rows: Record<string, unknown>[], column: string): boolean {
  let numericCount = 0;
  let seen = 0;
  for (const row of rows.slice(0, 80)) {
    const value = row[column];
    if (value === null || value === undefined) {
      continue;
    }
    seen += 1;
    if (typeof value === "number") {
      numericCount += 1;
      continue;
    }
    if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
      numericCount += 1;
    }
  }
  return seen > 0 && numericCount / seen >= 0.7;
}

function columnLooksCategorical(rows: Record<string, unknown>[], column: string): boolean {
  const sample = rows.slice(0, 120);
  const values = new Set<string>();
  for (const row of sample) {
    const value = row[column];
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "object") {
      return false;
    }
    values.add(String(value));
    if (values.size > 60) {
      return false;
    }
  }
  return values.size > 0;
}

function reduceRowsDeterministic(
  rows: Record<string, unknown>[],
  cap: number
): { rows: Record<string, unknown>[]; notes: string[] } {
  if (rows.length <= cap) {
    return { rows, notes: [] };
  }

  const first = rows[0] ?? {};
  const numericColumns = Object.keys(first).filter((key) => columnLooksNumeric(rows, key));
  if (numericColumns.length > 0) {
    const metric = numericColumns[0];
    const sorted = [...rows].sort((left, right) => {
      const leftValue = Number(left[metric] ?? 0);
      const rightValue = Number(right[metric] ?? 0);
      if (Number.isNaN(leftValue) || Number.isNaN(rightValue)) {
        return 0;
      }
      return rightValue - leftValue;
    });

    return {
      rows: sorted.slice(0, cap),
      notes: [`Applied top-K reduction on column ${metric} to enforce ${cap}-row evidence cap.`]
    };
  }

  return {
    rows: rows.slice(0, cap),
    notes: [`Trimmed dataset to first ${cap} rows to enforce evidence cap.`]
  };
}

function extractExplicitMonthComparison(question: string): number | null {
  const normalized = question.toLowerCase();
  const exact = normalized.match(/\blast\s+(\d+)\s+months?\s+vs(?:\.|)\s+(?:the\s+)?(?:previous|prior)\s+(\d+)\s+months?\b/);
  if (exact) {
    const left = Number.parseInt(exact[1], 10);
    const right = Number.parseInt(exact[2], 10);
    if (!Number.isNaN(left) && left > 0 && left === right) {
      return left;
    }
  }

  const generic = normalized.match(/\b(\d+)\s+months?\b/);
  if (generic && /\b(previous|prior|vs)\b/.test(normalized)) {
    const months = Number.parseInt(generic[1], 10);
    if (!Number.isNaN(months) && months > 0) {
      return months;
    }
  }

  return null;
}

function detectMonthCoverage(rows: Record<string, unknown>[], hintedDateColumns: string[] = []): {
  unique_months: number;
  date_column: string | null;
  month_keys: string[];
} {
  if (rows.length === 0) {
    return { unique_months: 0, date_column: null, month_keys: [] };
  }

  const first = rows[0] ?? {};
  const keys = Object.keys(first);
  const hintedSet = new Set(hintedDateColumns.map((column) => column.toLowerCase()));
  const hinted = keys.filter((column) => hintedSet.has(column.toLowerCase()));
  const regexCandidates = keys.filter((column) => isDateLikeColumnName(column));
  const remaining = keys.filter((column) => !hinted.includes(column) && !regexCandidates.includes(column));
  const candidateDateColumns = [
    ...hinted,
    ...regexCandidates.filter((column) => !hinted.includes(column)),
    ...remaining
  ];

  let best: { unique_months: number; date_column: string | null; month_keys: string[]; score: number } = {
    unique_months: 0,
    date_column: null,
    month_keys: [],
    score: Number.NEGATIVE_INFINITY
  };

  for (const candidate of candidateDateColumns) {
    const monthKeys = new Set<string>();
    const allowNumericEpoch = hintedSet.has(candidate.toLowerCase()) || isDateLikeColumnName(candidate);
    for (const row of rows.slice(0, 500)) {
      const value = row[candidate];
      const monthKey = toMonthKey(value, { strict: true, allow_numeric_epoch: allowNumericEpoch });
      if (monthKey) {
        monthKeys.add(monthKey);
      }
    }

    const candidateScore =
      monthKeys.size +
      (hintedSet.has(candidate.toLowerCase()) ? 100 : 0) +
      (isDateLikeColumnName(candidate) ? 15 : 0);

    if (candidateScore > best.score) {
      best = {
        unique_months: monthKeys.size,
        date_column: candidate,
        month_keys: Array.from(monthKeys).sort(),
        score: candidateScore
      };
    }
  }

  if (best.unique_months === 0) {
    return {
      unique_months: 0,
      date_column: null,
      month_keys: []
    };
  }

  return {
    unique_months: best.unique_months,
    date_column: best.date_column,
    month_keys: best.month_keys
  };
}

function formatMonthKeyFromDate(value: Date, options: MonthKeyOptions = {}): string | null {
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const year = value.getUTCFullYear();
  if (options.strict && !isPlausibleBusinessYear(year)) {
    return null;
  }

  if (year < 1000 || year > 9999) {
    return null;
  }

  return `${year}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isMonthKey(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const month = Number.parseInt(match[2], 10);
  return month >= 1 && month <= 12;
}

function toMonthKey(value: unknown, options: MonthKeyOptions = {}): string | null {
  if (value instanceof Date) {
    return formatMonthKeyFromDate(value, options);
  }
  if (typeof value === "number") {
    if (!options.allow_numeric_epoch) {
      return null;
    }

    const abs = Math.abs(value);
    let epochMs: number | null = null;

    if (abs >= 100_000_000_000_000_000) {
      // nanoseconds
      epochMs = Math.trunc(value / 1_000_000);
    } else if (abs >= 100_000_000_000_000) {
      // microseconds
      epochMs = Math.trunc(value / 1_000);
    } else if (abs >= 100_000_000_000) {
      // milliseconds
      epochMs = value;
    } else if (abs >= 1_000_000_000) {
      // seconds
      epochMs = value * 1_000;
    }

    if (epochMs === null) {
      return null;
    }

    return formatMonthKeyFromDate(new Date(epochMs), options);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (isMonthKey(trimmed)) {
      return trimmed;
    }

    if (/^\d{4}$/.test(trimmed)) {
      return null;
    }

    if (/^-?\d+$/.test(trimmed)) {
      if (!options.allow_numeric_epoch) {
        return null;
      }
      const asNumber = Number(trimmed);
      if (Number.isFinite(asNumber)) {
        return toMonthKey(asNumber, options);
      }
      return null;
    }

    if (options.strict && !/[-/:T\s]/.test(trimmed)) {
      return null;
    }

    const parsed = new Date(trimmed);
    return formatMonthKeyFromDate(parsed, options);
  }
  return null;
}

function isPlausibleBusinessYear(year: number): boolean {
  const currentYear = new Date().getUTCFullYear();
  return year >= currentYear - 25 && year <= currentYear + 1;
}

function buildMonthCoverageSqlFromBase(
  baseSql: string,
  dateColumn: string | null,
  months: number
): string | null {
  if (!dateColumn) {
    return null;
  }

  return [
    `WITH base AS (${stripTrailingLimit(baseSql)})`,
    `SELECT date_trunc('month', ${quoteIdentifier(dateColumn)})::date AS period_month,`,
    "COUNT(*) AS row_count",
    "FROM base",
    `WHERE ${quoteIdentifier(dateColumn)} >= date_trunc('month', CURRENT_DATE)::date - interval '${months} months'`,
    `GROUP BY date_trunc('month', ${quoteIdentifier(dateColumn)})::date`,
    "ORDER BY period_month ASC"
  ].join(" ");
}

function buildPreparedDataValidation(
  rows: Record<string, unknown>[],
  question: string,
  comparisonMonths: number | null,
  hintedDateColumns: string[] = []
): NonNullable<PreparedQuestionPayload["validation"]> {
  const coverage = detectMonthCoverage(rows, hintedDateColumns);
  const observedMonths = coverage.month_keys.filter((monthKey) => isMonthKey(monthKey));
  const observedSet = new Set(observedMonths);
  const expectedMonths = comparisonMonths ? comparisonMonths * 2 : null;
  const expectedAnchor =
    observedMonths.length > 0 ? observedMonths[observedMonths.length - 1] : currentMonthKey();
  const expectedMonthKeys =
    expectedMonths !== null
      ? buildExpectedMonthKeys(expectedAnchor, expectedMonths).filter((monthKey) => isMonthKey(monthKey))
      : [];
  const missingMonths = expectedMonthKeys.filter((monthKey) => !observedSet.has(monthKey));
  const displayMonths = (expectedMonthKeys.length > 0 ? expectedMonthKeys : observedMonths).slice(-24);

  const rowCountByMonth = new Map<string, number>();
  if (coverage.date_column) {
    const allowNumericEpoch =
      hintedDateColumns.map((column) => column.toLowerCase()).includes(coverage.date_column.toLowerCase()) ||
      isDateLikeColumnName(coverage.date_column);
    for (const row of rows.slice(0, 5_000)) {
      const monthKey = toMonthKey(row[coverage.date_column], {
        strict: true,
        allow_numeric_epoch: allowNumericEpoch
      });
      if (!monthKey) {
        continue;
      }
      rowCountByMonth.set(monthKey, (rowCountByMonth.get(monthKey) ?? 0) + 1);
    }
  }

  const monthlyRowCounts = displayMonths.map((month) => ({
    month,
    row_count: rowCountByMonth.get(month) ?? 0
  }));

  const metricColumn = pickValidationMetricColumn(rows, question);
  const metricByMonth = new Map<string, number>();
  if (metricColumn && coverage.date_column) {
    const allowNumericEpoch =
      hintedDateColumns.map((column) => column.toLowerCase()).includes(coverage.date_column.toLowerCase()) ||
      isDateLikeColumnName(coverage.date_column);
    for (const row of rows.slice(0, 5_000)) {
      const monthKey = toMonthKey(row[coverage.date_column], {
        strict: true,
        allow_numeric_epoch: allowNumericEpoch
      });
      if (!monthKey) {
        continue;
      }
      const numeric = toFiniteNumber(row[metricColumn]);
      if (numeric === null) {
        continue;
      }
      metricByMonth.set(monthKey, (metricByMonth.get(monthKey) ?? 0) + numeric);
    }
  }

  const monthlyMetricTotals =
    metricColumn === null
      ? []
      : displayMonths.map((month) => ({
          month,
          total: Number((metricByMonth.get(month) ?? 0).toFixed(2))
        }));

  return {
    expected_months: expectedMonths,
    observed_months: observedMonths.length,
    missing_months: missingMonths,
    monthly_row_counts: monthlyRowCounts,
    metric_column: metricColumn,
    monthly_metric_totals: monthlyMetricTotals
  };
}

function pickValidationMetricColumn(rows: Record<string, unknown>[], question: string): string | null {
  const first = rows[0];
  if (!first) {
    return null;
  }

  const numericColumns = Object.keys(first).filter(
    (column) => !column.startsWith("_") && columnLooksNumeric(rows, column)
  );
  if (numericColumns.length === 0) {
    return null;
  }

  const lowerQuestion = question.toLowerCase();
  const scored = numericColumns.map((column) => {
    const lowerColumn = column.toLowerCase();
    let score = 0;

    if (/\brefund/.test(lowerQuestion) && /\brefund/.test(lowerColumn)) {
      score += 6;
    }
    if (/\brefund/.test(lowerQuestion) && /(amount|value|total|usd|dollar|revenue|loss)/.test(lowerColumn)) {
      score += 4;
    }
    if (/\brefund/.test(lowerQuestion) && /(count|tickets|orders|volume|qty|number)/.test(lowerColumn)) {
      score += 3;
    }
    if (/\bamount|value|total|revenue|sales|gmv/.test(lowerQuestion) && /(amount|value|total|revenue|sales|gmv)/.test(lowerColumn)) {
      score += 3;
    }
    if (/\bcount|volume|orders|tickets/.test(lowerQuestion) && /(count|volume|orders|tickets|qty)/.test(lowerColumn)) {
      score += 2;
    }

    return { column, score };
  });

  scored.sort((left, right) => right.score - left.score);
  if (scored[0] && scored[0].score > 0) {
    return scored[0].column;
  }
  return numericColumns[0] ?? null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildExpectedMonthKeys(anchorMonth: string, totalMonths: number): string[] {
  const parsed = parseMonthKey(anchorMonth);
  if (!parsed) {
    return [];
  }

  const months: string[] = [];
  let year = parsed.year;
  let month = parsed.month;
  for (let i = 0; i < totalMonths; i += 1) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month <= 0) {
      month = 12;
      year -= 1;
    }
  }
  return months.reverse();
}

function hardenBatchAnalysisOutput(
  payload: PreparedQuestionPayload,
  analysis: BatchAnalysis,
  questionLabel: string
): HardenedBatchAnalysisOutput {
  const cleanedHighlights = normalizeAnalysisLines(analysis.highlights, 6);
  const cleanedRisks = normalizeAnalysisLines(analysis.risks, 6);
  const cleanedRecommendations = normalizeAnalysisLines(analysis.recommendations, 6);

  const grounding = computeAnalysisGroundingScore(payload, [
    ...cleanedHighlights,
    ...cleanedRisks,
    ...cleanedRecommendations
  ]);
  const boundedConfidence = Math.max(0, Math.min(1, analysis.confidence_score));
  const hardenedConfidence = Number((boundedConfidence * grounding.score).toFixed(2));

  const dataSummary = buildPayloadDataSummary(payload);

  if (
    grounding.score < MIN_ANALYSIS_GROUNDING_SCORE ||
    cleanedHighlights.length === 0 ||
    (cleanedHighlights.length > 0 && grounding.grounded_claims === 0)
  ) {
    const fallbackHighlights = buildFallbackHighlights(payload, questionLabel);
    const fallbackRisks = buildFallbackRisks(payload);
    const fallbackRecommendations = buildFallbackRecommendations(payload);

    return {
      entry: {
        question: questionLabel,
        highlights: fallbackHighlights,
        risks: fallbackRisks,
        recommendations: fallbackRecommendations,
        data_summary: dataSummary
      },
      confidence_score: Number(Math.min(hardenedConfidence, MIN_ANALYSIS_GROUNDING_SCORE).toFixed(2))
    };
  }

  return {
    entry: {
      question: questionLabel,
      highlights: cleanedHighlights,
      risks: cleanedRisks.length > 0 ? cleanedRisks : buildFallbackRisks(payload),
      recommendations:
        cleanedRecommendations.length > 0 ? cleanedRecommendations : buildFallbackRecommendations(payload),
      data_summary: dataSummary
    },
    confidence_score: hardenedConfidence
  };
}

function normalizeAnalysisLines(lines: string[] | undefined, maxItems: number): string[] {
  if (!lines || lines.length === 0) {
    return [];
  }

  const deduped = new Set<string>();
  for (const raw of lines) {
    const normalized = raw.replace(/\s+/g, " ").trim();
    if (normalized.length === 0) {
      continue;
    }
    deduped.add(normalized);
    if (deduped.size >= maxItems) {
      break;
    }
  }

  return Array.from(deduped);
}

function computeAnalysisGroundingScore(
  payload: PreparedQuestionPayload,
  lines: string[]
): { score: number; grounded_claims: number; total_claims: number } {
  if (lines.length === 0) {
    return { score: 0, grounded_claims: 0, total_claims: 0 };
  }

  const evidenceTokens = buildEvidenceTokenSet(payload);
  const evidenceNumbers = buildEvidenceNumberSet(payload);
  let groundedClaims = 0;
  let totalScore = 0;

  for (const line of lines) {
    const lineScore = scoreLineGrounding(line, evidenceTokens, evidenceNumbers);
    totalScore += lineScore;
    if (lineScore >= 0.5) {
      groundedClaims += 1;
    }
  }

  const score = Number((totalScore / lines.length).toFixed(2));
  return {
    score,
    grounded_claims: groundedClaims,
    total_claims: lines.length
  };
}

function scoreLineGrounding(
  line: string,
  evidenceTokens: Set<string>,
  evidenceNumbers: Set<number>
): number {
  const tokens = tokenize(line);
  if (tokens.length === 0) {
    return 0;
  }

  let tokenMatches = 0;
  for (const token of tokens) {
    if (evidenceTokens.has(token)) {
      tokenMatches += 1;
    }
  }
  const tokenCoverage = tokenMatches / tokens.length;

  const numberMatches = extractComparableNumbers(line).map((value) => normalizeComparableNumber(value));
  let numericCoverage = 1;
  if (numberMatches.length > 0) {
    let hits = 0;
    for (const number of numberMatches) {
      if (evidenceNumbers.has(number)) {
        hits += 1;
      }
    }
    numericCoverage = hits / numberMatches.length;
  }

  return Number((tokenCoverage * 0.65 + numericCoverage * 0.35).toFixed(2));
}

function buildEvidenceTokenSet(payload: PreparedQuestionPayload): Set<string> {
  const tokens = new Set<string>();
  const pushFromText = (value: string): void => {
    for (const token of tokenize(value)) {
      tokens.add(token);
    }
  };

  pushFromText(payload.question);
  pushFromText(payload.purpose);
  for (const note of payload.preparation_notes) {
    pushFromText(note);
  }
  for (const warning of payload.warnings) {
    pushFromText(warning);
  }

  for (const row of payload.prepared_rows.slice(0, 200)) {
    for (const [key, value] of Object.entries(row)) {
      tokens.add(key.toLowerCase());
      if (typeof value === "string") {
        pushFromText(value);
      }
    }
  }

  if (payload.validation) {
    if (payload.validation.metric_column) {
      tokens.add(payload.validation.metric_column.toLowerCase());
    }
    for (const item of payload.validation.monthly_row_counts) {
      pushFromText(item.month);
    }
    for (const item of payload.validation.monthly_metric_totals) {
      pushFromText(item.month);
    }
  }

  return tokens;
}

function buildEvidenceNumberSet(payload: PreparedQuestionPayload): Set<number> {
  const values = new Set<number>();
  values.add(normalizeComparableNumber(payload.prepared_row_count));
  values.add(normalizeComparableNumber(payload.row_count_before_reduction));
  values.add(normalizeComparableNumber(payload.source_query_count));

  for (const row of payload.prepared_rows.slice(0, 200)) {
    for (const value of Object.values(row)) {
      const numeric = toFiniteNumber(value);
      if (numeric !== null) {
        values.add(normalizeComparableNumber(numeric));
      }
    }
  }

  if (payload.validation) {
    values.add(normalizeComparableNumber(payload.validation.observed_months));
    if (payload.validation.expected_months !== null) {
      values.add(normalizeComparableNumber(payload.validation.expected_months));
    }
    for (const item of payload.validation.monthly_row_counts) {
      values.add(normalizeComparableNumber(item.row_count));
    }
    for (const item of payload.validation.monthly_metric_totals) {
      values.add(normalizeComparableNumber(item.total));
    }
  }

  return values;
}

function extractComparableNumbers(value: string): number[] {
  const matches = value.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) {
    return [];
  }

  return matches
    .map((token) => Number(token))
    .filter((number) => Number.isFinite(number));
}

function normalizeComparableNumber(value: number): number {
  return Number(value.toFixed(2));
}

function buildFallbackHighlights(payload: PreparedQuestionPayload, questionLabel: string): string[] {
  const highlights: string[] = [];
  highlights.push(`${questionLabel}: analyzed ${payload.prepared_row_count} prepared rows.`);
  const validation = payload.validation;

  if (validation && validation.expected_months !== null) {
    highlights.push(
      `Timeline coverage ${validation.observed_months}/${validation.expected_months} month(s).`
    );
  } else if (validation && validation.observed_months > 0) {
    highlights.push(`Timeline coverage includes ${validation.observed_months} month(s).`);
  }

  const prepNote = payload.preparation_notes.find((note) => note.length > 0);
  if (prepNote) {
    highlights.push(prepNote);
  }

  return normalizeAnalysisLines(highlights, 4);
}

function buildFallbackRisks(payload: PreparedQuestionPayload): string[] {
  if (payload.warnings.length > 0) {
    return normalizeAnalysisLines(payload.warnings, 4);
  }

  if (payload.validation?.missing_months.length) {
    return [`Missing months in prepared data: ${payload.validation.missing_months.join(", ")}.`];
  }

  return ["No major data quality risks were flagged in the prepared payload."];
}

function buildFallbackRecommendations(payload: PreparedQuestionPayload): string[] {
  if (payload.validation?.missing_months.length) {
    return [
      "Refresh source data or adjust scope so requested timeline coverage is complete before final decisions."
    ];
  }

  if (payload.warnings.length > 0) {
    return ["Resolve preparation warnings and re-run the scoped question before publishing the final brief."];
  }

  return ["Proceed to final report review and validate key findings against the appendix evidence refs."];
}

function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function executeQueryWithPolicy(input: {
  tenant_id: string;
  contract: ReportContract;
  store: MetadataStore;
  data_plane: DataPlane;
  question: string;
  sql: string;
  row_cap: number;
}): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const storeContext = { tenant_id: input.tenant_id };
  try {
    const result = await input.data_plane.execute({
      request_id: `${input.contract.id}_${randomUUID().slice(0, 8)}`,
      sql: input.sql,
      policy: {
        allowed_relations: input.contract.guardrails.allowed_relations,
        allowed_schemas: input.contract.guardrails.allowed_schemas,
        timeout_ms: input.contract.guardrails.timeout_ms,
        row_cap: input.row_cap,
        pii_fields: []
      }
    });

    await input.store.appendAuditLog(
      "dataplane_execute",
      {
        question: input.question,
        sql: input.sql,
        row_count: result.rows.length
      },
      storeContext
    );

    return { rows: result.rows, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query execution failed";
    await input.store.appendAuditLog(
      "dataplane_error",
      {
        question: input.question,
        sql: input.sql,
        error: message
      },
      storeContext
    );
    return { rows: [], error: message };
  }
}

async function runPlannerPhase(
  input: {
    contract: ReportContract;
    tenant_id: string;
    store: MetadataStore;
    data_plane: DataPlane;
    planner_client: PlannerClient;
    query_strategist: QueryStrategistClient;
    catalog_summary: string;
    sql_dialect: SqlDialect;
  },
  insightMode: "business" | "data"
): Promise<{ plannerContext: string; plannerSummary: string }> {
  const storeContext = { tenant_id: input.tenant_id };
  const plannerInput = {
    catalog_summary: input.catalog_summary || "No catalog available.",
    user_goal: input.contract.name,
    audience: input.contract.audience,
    insight_mode: insightMode,
    allowed_relations: input.contract.guardrails.allowed_relations,
    allowed_schemas: input.contract.guardrails.allowed_schemas
  };

  const exploration = await input.planner_client.explore(plannerInput);

  await input.store.appendAuditLog(
    "planner_explore",
    {
      contract_id: input.contract.id,
      query_count: exploration.queries.length,
      purposes: exploration.queries.map((q) => q.purpose)
    },
    storeContext
  );

  const explorationResults: string[] = [];
  for (const eq of exploration.queries) {
    try {
      const compiled = await compileSqlForDialect({
        query_strategist: input.query_strategist,
        sql: eq.sql,
        dialect: input.sql_dialect,
        question: `${eq.purpose} (${eq.query_type})`,
        contract: input.contract,
        catalog_summary: input.catalog_summary
      });
      const safeSql = sanitizeLlmSql(compiled.sql, 50);
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

      const preview = result.rows.slice(0, 20).map((row) => JSON.stringify(row)).join("\n");
      explorationResults.push(
        `--- ${eq.purpose} (${eq.query_type}) ---\n${safeSql}\nRows returned: ${result.row_count}\n${preview}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "query failed";
      explorationResults.push(`--- ${eq.purpose} --- ERROR: ${message}`);
    }
  }

  const plan = await input.planner_client.plan({
    ...plannerInput,
    exploration_results: explorationResults.join("\n\n")
  });

  await input.store.appendAuditLog(
    "planner_plan",
    {
      contract_id: input.contract.id,
      discoveries: plan.data_discoveries.length,
      approaches: plan.recommended_approaches.length,
      warnings: plan.data_warnings
    },
    storeContext
  );

  return {
    plannerContext: serializePlannerContext(plan),
    plannerSummary: plan.plan_summary
  };
}

function serializePlannerContext(plan: PlannerOutput): string {
  const lines: string[] = [];
  lines.push("=== DATA DISCOVERIES ===");
  for (const discovery of plan.data_discoveries) {
    lines.push(`${discovery.table}.${discovery.column}: ${discovery.finding}`);
  }

  lines.push("");
  lines.push("=== RECOMMENDED APPROACHES ===");
  for (const approach of plan.recommended_approaches) {
    lines.push(`Q: ${approach.question}`);
    lines.push(`  Approach: ${approach.approach}`);
    if (approach.key_columns.length > 0) {
      lines.push(`  Key columns: ${approach.key_columns.join(", ")}`);
    }
    if (approach.relevant_tables.length > 0) {
      lines.push(`  Tables: ${approach.relevant_tables.join(", ")}`);
    }
  }

  if (plan.data_warnings.length > 0) {
    lines.push("");
    lines.push("=== DATA WARNINGS ===");
    for (const warning of plan.data_warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join("\n");
}

function sanitizeLlmSql(rawSql: string, fallbackLimit: number): string {
  let sql = rawSql.trim();

  const fencedMatch = sql.match(/```(?:sql)?\s*\n?([\s\S]*?)```/i);
  if (fencedMatch) {
    sql = fencedMatch[1].trim();
  }

  const statements = sql
    .split(";")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  sql = statements[0] ?? sql;
  sql = sql.replace(/;\s*$/, "").trim();

  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
    throw new Error(`LLM generated non-SELECT SQL: ${sql.slice(0, 80)}...`);
  }

  if (!/\bLIMIT\b/i.test(sql)) {
    sql = `${sql} LIMIT ${fallbackLimit}`;
  }

  return sql;
}

async function loadGlobalMetricDefinitions(
  store: MetadataStore,
  context: { tenant_id: string }
): Promise<MetricDefinition[]> {
  try {
    const raw = await store.getSystemState(GLOBAL_CONFIG_STATE_KEY, context);
    if (!raw) return [];
    const config = GlobalConfigSchema.parse(raw);
    return config.metric_definitions;
  } catch {
    return [];
  }
}

type ResolvedMetricDef = {
  metric_key: string;
  display_name: string;
  definition: string;
  filter_description: string;
  filter_column: string;
  filter_values: string[];
  status: string;
};

function buildRunMetricDefinitions(
  contract: ReportContract,
  globalMetricDefs: MetricDefinition[] = []
): ResolvedMetricDef[] {
  const fromContract = Array.isArray(contract.metric_definitions)
    ? contract.metric_definitions.map((m) => migrateMetricDefinition(m as Record<string, unknown>))
    : [];

  // Merge: contract-level definitions override global ones with the same key
  const merged = [...globalMetricDefs, ...fromContract];
  const deduped = new Map<string, Record<string, unknown>>();
  for (const metric of merged) {
    const raw = metric as Record<string, unknown>;
    const key = String(raw.metric_key ?? "").trim().toLowerCase();
    if (key.length > 0) {
      deduped.set(key, raw);
    }
  }

  const normalized = Array.from(deduped.values())
    .map((raw): ResolvedMetricDef => ({
      metric_key: String(raw.metric_key ?? "").trim(),
      display_name: String(raw.display_name ?? "").trim(),
      definition: String(raw.definition ?? "").trim(),
      filter_description: String(raw.filter_description ?? "").trim(),
      filter_column: String(raw.filter_column ?? "").trim(),
      filter_values: Array.isArray(raw.filter_values)
        ? (raw.filter_values as unknown[]).map((v) => String(v).trim()).filter((v) => v.length > 0)
        : [],
      status: String(raw.status ?? "pending")
    }))
    .filter(
      (metric) =>
        metric.metric_key.length > 0 &&
        metric.display_name.length > 0 &&
        metric.definition.length > 0
    );

  if (normalized.length > 0) {
    return normalized;
  }

  return contract.metric_ids.slice(0, 6).map((metricId) => {
    const display = metricId
      .replace(/^metric_/i, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      metric_key: metricId,
      display_name: display,
      definition: `Metric derived from ${metricId}. Definition was not explicitly confirmed in this run.`,
      filter_description: "",
      filter_column: "",
      filter_values: [],
      status: "pending"
    };
  });
}

function buildMetricSqlFilter(metric: ResolvedMetricDef): string {
  if (metric.filter_column.length > 0 && metric.filter_values.length > 0) {
    const escaped = metric.filter_values.map((v) => `'${v.replace(/'/g, "''")}'`);
    return `${metric.filter_column} IN (${escaped.join(", ")})`;
  }
  return "";
}

async function composeReportHtmlWithFallback(input: {
  report_composer: ReportComposerClient;
  compose_input: ReportComposerInput;
  fallback_exec_brief: ExecBrief;
  metric_definitions: ResolvedMetricDef[];
}): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const html = await input.report_composer.composeReport(input.compose_input);
      if (looksLikeHtmlDocument(html)) {
        return html;
      }
      throw new Error("Report composer returned non-HTML output.");
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await delay(250 * attempt);
      }
    }
  }

  const fallbackHtml = renderExecBriefHtml(input.fallback_exec_brief);
  return injectMetricDefinitionsIntoHtml(fallbackHtml, input.metric_definitions, lastError);
}

function looksLikeHtmlDocument(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html") || normalized.includes("<body");
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function injectMetricDefinitionsIntoHtml(
  html: string,
  definitions: ResolvedMetricDef[],
  lastError: unknown
): string {
  if (definitions.length === 0) {
    return html;
  }

  const hasSection = /metric definitions/i.test(html);
  const items = definitions
    .slice(0, 8)
    .map((definition) => {
      const sqlFilter = buildMetricSqlFilter(definition);
      const filterLine = definition.filter_description.length > 0
        ? ` (${definition.filter_description}${sqlFilter.length > 0 ? ` — ${sqlFilter}` : ""})`
        : sqlFilter.length > 0
          ? ` (filter: ${sqlFilter})`
          : "";
      return `<li><strong>${escapeHtml(definition.display_name)}</strong>: ${escapeHtml(definition.definition)}${escapeHtml(filterLine)}</li>`;
    })
    .join("");

  const fallbackNote = lastError instanceof Error
    ? `<p style="margin:0 0 8px 0;color:#6b7280;font-size:12px;">Report renderer fallback used for reliability.</p>`
    : "";
  const section = [
    '<section style="border:1px solid #dbeafe;border-radius:10px;padding:14px;margin:16px 0;background:#f8fbff;">',
    '<h2 style="margin:0 0 8px 0;font-size:16px;color:#1e3a8a;">Metric Definitions</h2>',
    fallbackNote,
    `<ul style="margin:0;padding-left:18px;line-height:1.45;">${items}</ul>`,
    "</section>"
  ].join("");

  if (hasSection) {
    return html;
  }

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${section}</body>`);
  }
  return `${html}\n${section}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildExecBrief(
  analyses: ReportComposerInput["analyses"],
  contractName: string,
  startedAt: string,
  previousRun: ReportRun | null
): ExecBrief {
  const allHighlights = analyses.flatMap((analysis) => analysis.highlights);
  const allRisks = analyses.flatMap((analysis) => analysis.risks);
  const allRecommendations = analyses.flatMap((analysis) => analysis.recommendations);
  const deltasVsLastRun = buildDeltasVsLastRun(analyses, previousRun);

  return ExecBriefSchema.parse({
    what_changed: allHighlights.length > 0 ? allHighlights.slice(0, 5) : [`${contractName} analysis completed`],
    why: analyses.map((analysis) => analysis.question).slice(0, 5),
    so_what: allRisks.length > 0 ? allRisks.slice(0, 5) : ["No significant risks identified"],
    what_to_do: allRecommendations.length > 0 ? allRecommendations.slice(0, 5) : ["Continue monitoring key metrics"],
    confidence: {
      score: analyses.length > 0 ? 0.8 : 0.3,
      rationale: `Based on ${analyses.length} analysis section(s) with prepared evidence payloads.`
    },
    appendix_refs: analyses.map((analysis) => analysis.question),
    deltas_vs_last_run: deltasVsLastRun,
    generated_at: startedAt
  });
}

function buildDeltasVsLastRun(
  analyses: ReportComposerInput["analyses"],
  previousRun: ReportRun | null
): string[] {
  if (!previousRun) {
    return ["No previous run available for delta comparison."];
  }

  const previousExecBriefParsed = ExecBriefSchema.safeParse(previousRun.exec_brief);
  const previousWhatChanged = previousExecBriefParsed.success ? previousExecBriefParsed.data.what_changed : [];

  const currentSignals = analyses
    .flatMap((analysis) => analysis.highlights.slice(0, 2))
    .map(normalizeSignal);
  const previousSignals = previousWhatChanged.map(normalizeSignal);

  const added = currentSignals.filter((signal) => signal.length > 0 && !previousSignals.includes(signal));
  const removed = previousSignals.filter((signal) => signal.length > 0 && !currentSignals.includes(signal));

  const deltas: string[] = [];
  if (added.length > 0) {
    deltas.push(`New findings vs last run: ${added.slice(0, 3).join(" | ")}`);
  }
  if (removed.length > 0) {
    deltas.push(`No longer observed: ${removed.slice(0, 3).join(" | ")}`);
  }

  const previousAnalysis = parseAnalysisPayloads(previousRun.query_plan);
  for (const analysis of analyses.slice(0, 5)) {
    const match = previousAnalysis.find(
      (item) => item.question.trim().toLowerCase() === analysis.question.trim().toLowerCase()
    );
    if (!match) {
      continue;
    }

    const currentRows = extractPreparedRowCount(analysis.data_summary);
    const previousRows = extractPreparedRowCount(match.data_summary);
    if (currentRows !== null && previousRows !== null && currentRows !== previousRows) {
      const direction = currentRows > previousRows ? "up" : "down";
      deltas.push(
        `Coverage for "${analysis.question}" is ${direction} (${previousRows} -> ${currentRows} prepared rows).`
      );
    }
  }

  if (deltas.length === 0) {
    return ["No material delta detected against previous run summary."];
  }

  return deltas.slice(0, 5);
}

function checkKpiWatchlist(
  watchlist: KpiWatchlistItem[],
  payloads: PreparedQuestionPayload[]
): KpiCheckResult[] {
  if (!watchlist || watchlist.length === 0) {
    return [];
  }

  return watchlist.map((kpi) => {
    const allTotals = payloads.flatMap((p) => p.validation?.monthly_metric_totals ?? []);
    const latestTotal = allTotals.length > 0 ? allTotals[allTotals.length - 1]?.total ?? null : null;

    let status: "pass" | "fail" = "pass";
    if (latestTotal !== null) {
      if (kpi.direction === "below" && latestTotal < kpi.threshold_value) {
        status = "fail";
      } else if (kpi.direction === "above" && latestTotal > kpi.threshold_value) {
        status = "fail";
      }
    }

    return {
      metric_key: kpi.metric_key,
      display_name: kpi.display_name,
      status,
      actual: latestTotal,
      threshold: kpi.threshold_value,
      direction: kpi.direction,
      alert_message: kpi.alert_message
    };
  });
}

function injectKpiResultsIntoHtml(html: string, kpiResults: KpiCheckResult[]): string {
  if (kpiResults.length === 0) return html;

  const badges = kpiResults
    .map((r) => {
      const isPassed = r.status === "pass";
      const color = isPassed ? "#16a34a" : "#dc2626";
      const bg = isPassed ? "#f0fdf4" : "#fef2f2";
      const border = isPassed ? "#86efac" : "#fca5a5";
      const label = isPassed ? "PASS" : "FAIL";
      const actualStr = r.actual !== null ? r.actual.toLocaleString() : "N/A";
      const thresholdStr = r.threshold.toLocaleString();
      const dirLabel = r.direction === "above" ? ">" : "<";
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${bg};border:1px solid ${border};border-radius:8px;margin-bottom:8px;">
  <span style="font-weight:700;color:${color};font-size:12px;letter-spacing:.05em;padding:2px 8px;background:${color}22;border-radius:4px;">${label}</span>
  <span style="font-weight:600;color:#111827;font-size:14px;">${r.display_name}</span>
  <span style="color:#6b7280;font-size:13px;">Actual: <strong>${actualStr}</strong> &nbsp;·&nbsp; Threshold: ${dirLabel} ${thresholdStr}</span>
  ${!isPassed ? `<span style="color:${color};font-size:13px;margin-left:auto;">${r.alert_message}</span>` : ""}
</div>`;
    })
    .join("\n");

  const section = `<div style="margin:24px 0;padding:16px 20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;">
  <h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111827;display:flex;align-items:center;gap:8px;">
    <span>KPI Watchlist</span>
    ${kpiResults.some((r) => r.status === "fail") ? '<span style="font-size:12px;color:#dc2626;background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;padding:1px 6px;">&#9888; Alerts</span>' : '<span style="font-size:12px;color:#16a34a;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:1px 6px;">&#10003; All Clear</span>'}
  </h3>
  ${badges}
</div>`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${section}\n</body>`);
  }
  return section + html;
}

function normalizeSignal(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractPreparedRowCount(dataSummary: string): number | null {
  const match = dataSummary.match(/(\d+)\s+prepared\s+rows?/i);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 10);
  return Number.isNaN(value) ? null : value;
}

function buildPayloadDataSummary(payload: PreparedQuestionPayload): string {
  const lines: string[] = [
    `${payload.prepared_row_count} prepared rows analyzed.`,
    payload.purpose
  ];

  if (payload.validation) {
    const validation = payload.validation;
    if (validation.expected_months !== null) {
      lines.push(
        `Timeline coverage: ${validation.observed_months}/${validation.expected_months} month(s).`
      );
      if (validation.missing_months.length > 0) {
        lines.push(`Missing months: ${validation.missing_months.join(", ")}.`);
      }
    } else if (validation.observed_months > 0) {
      lines.push(`Timeline coverage: ${validation.observed_months} month(s) detected.`);
    }

    if (validation.metric_column && validation.monthly_metric_totals.length > 0) {
      const preview = validation.monthly_metric_totals
        .slice(-6)
        .map((item) => `${item.month}=${item.total}`)
        .join(", ");
      lines.push(`Monthly ${validation.metric_column} totals: ${preview}.`);
    }
  }

  return lines.filter((line) => line.trim().length > 0).join(" ");
}

function describeCoverageGap(payload: PreparedQuestionPayload): {
  highlight: string;
  risks: string[];
} | null {
  const validation = payload.validation;
  if (!validation || validation.expected_months === null) {
    return null;
  }

  if (validation.observed_months >= validation.expected_months && validation.missing_months.length === 0) {
    return null;
  }

  return {
    highlight: `Coverage warning for Q${payload.question_number}: only ${validation.observed_months}/${validation.expected_months} month(s) available.`,
    risks: [
      validation.missing_months.length > 0
        ? `Missing months: ${validation.missing_months.join(", ")}.`
        : "Timeline coverage is below requested scope."
    ]
  };
}

function buildConciseSummary(
  contractName: string,
  analyses: ReportComposerInput["analyses"]
): string {
  const points: string[] = [];
  for (const analysis of analyses.slice(0, 4)) {
    const finding = analysis.highlights[0] ?? analysis.data_summary;
    points.push(`- ${pickEmoji(finding)} ${finding}`);
  }

  if (points.length === 0) {
    points.push("- 📌 No highlights were generated for this run.");
  }

  return [`${contractName} summary`, ...points].join("\n");
}

function pickEmoji(text: string): string {
  const lower = text.toLowerCase();
  if (/\bup|increase|growth|improve|higher\b/.test(lower)) return "📈";
  if (/\bdown|decline|drop|lower|decrease\b/.test(lower)) return "📉";
  if (/\brisk|issue|error|anomaly|warning\b/.test(lower)) return "⚠️";
  if (/\baction|recommend|next\b/.test(lower)) return "✅";
  return "📌";
}

function toPreparedPayloadPublic(payload: PreparedQuestionPayload): PreparedQuestionPayloadPublic {
  return PreparedQuestionPayloadPublicSchema.parse({
    question_id: payload.question_id,
    question_number: payload.question_number,
    question: payload.question,
    purpose: payload.purpose,
    group_id: payload.group_id,
    source_query_count: payload.source_query_count,
    preparation_sqls: payload.preparation_sqls,
    row_count_before_reduction: payload.row_count_before_reduction,
    prepared_row_count: payload.prepared_row_count,
    validation: payload.validation,
    preparation_notes: payload.preparation_notes,
    warnings: payload.warnings,
    sample_rows: (payload.prepared_rows ?? []).slice(0, 5)
  });
}

type TokenUsageAccumulator = {
  add(events: TokenUsageEvent[]): void;
  addReport(report: TokenUsageReport): void;
  snapshot(): TokenUsageReport;
};

function createTokenUsageAccumulator(): TokenUsageAccumulator {
  const byAgent = new Map<string, { input_tokens: number; output_tokens: number; total_tokens: number }>();

  return {
    add(events: TokenUsageEvent[]) {
      for (const event of events) {
        const key = event.agent;
        const current = byAgent.get(key) ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
        current.input_tokens += event.input_tokens;
        current.output_tokens += event.output_tokens;
        current.total_tokens += event.total_tokens;
        byAgent.set(key, current);
      }
    },
    addReport(report: TokenUsageReport) {
      for (const [agent, usage] of Object.entries(report.by_agent)) {
        const current = byAgent.get(agent) ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
        current.input_tokens += usage.input_tokens;
        current.output_tokens += usage.output_tokens;
        current.total_tokens += usage.total_tokens;
        byAgent.set(agent, current);
      }
    },
    snapshot() {
      const record: Record<string, { input_tokens: number; output_tokens: number; total_tokens: number }> = {};
      let inputTokens = 0;
      let outputTokens = 0;
      let totalTokens = 0;

      for (const [agent, usage] of byAgent.entries()) {
        record[agent] = {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          total_tokens: usage.total_tokens
        };
        inputTokens += usage.input_tokens;
        outputTokens += usage.output_tokens;
        totalTokens += usage.total_tokens;
      }

      return TokenUsageReportSchema.parse({
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        by_agent: record
      });
    }
  };
}

function collectClientUsage(
  client: { drainUsageEvents?: () => TokenUsageEvent[] },
  accumulator: TokenUsageAccumulator
): void {
  if (!client.drainUsageEvents) {
    return;
  }
  accumulator.add(client.drainUsageEvents());
}

async function runAnalystWithBatching(input: {
  analyst_client: AnalystClient;
  payload: PreparedQuestionPayload;
  question_label: string;
  insight_mode: "business" | "data";
  contract_id: string;
  data_context: string;
}): Promise<import("@project-overload/shared").BatchAnalysis> {
  const { analyst_client, payload, question_label, insight_mode, contract_id, data_context } = input;
  const rows = payload.prepared_rows;

  if (rows.length === 0) {
    return {
      request_id: `${contract_id}_${payload.question_id}`,
      batch_index: 0,
      total_batches: 1,
      highlights: [],
      risks: [],
      recommendations: [],
      confidence_score: 0,
      appendix_refs: []
    };
  }

  if (rows.length <= ANALYST_ROW_CAP) {
    return analyst_client.analyzeBatch({
      request_id: `${contract_id}_${payload.question_id}`,
      batch_index: 0,
      total_batches: 1,
      summary_word_budget: 220,
      question: question_label,
      insight_mode,
      data_context,
      evidence_packet: {
        request_id: payload.question_id,
        batch_index: 0,
        total_batches: 1,
        rows,
        row_count: rows.length
      }
    });
  }

  // Split into batches of ANALYST_ROW_CAP
  const batches: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += ANALYST_ROW_CAP) {
    batches.push(rows.slice(i, i + ANALYST_ROW_CAP));
  }

  const results: import("@project-overload/shared").BatchAnalysis[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batchRows = batches[i];
    const analysis = await analyst_client.analyzeBatch({
      request_id: `${contract_id}_${payload.question_id}_b${i}`,
      batch_index: i,
      total_batches: batches.length,
      summary_word_budget: 150,
      question: question_label,
      insight_mode,
      data_context: i === 0 ? data_context : undefined,
      evidence_packet: {
        request_id: `${payload.question_id}_b${i}`,
        batch_index: i,
        total_batches: batches.length,
        rows: batchRows,
        row_count: batchRows.length
      }
    });
    results.push(analysis);
  }

  return mergeBatchAnalyses(results, `${contract_id}_${payload.question_id}`);
}

function mergeBatchAnalyses(
  results: import("@project-overload/shared").BatchAnalysis[],
  requestId: string
): import("@project-overload/shared").BatchAnalysis {
  if (results.length === 0) {
    return {
      request_id: requestId,
      batch_index: 0,
      total_batches: 1,
      highlights: [],
      risks: [],
      recommendations: [],
      confidence_score: 0,
      appendix_refs: []
    };
  }

  if (results.length === 1) {
    return results[0];
  }

  const highlights = Array.from(new Set(results.flatMap((r) => r.highlights))).slice(0, 5);
  const risks = Array.from(new Set(results.flatMap((r) => r.risks))).slice(0, 3);
  const recommendations = Array.from(new Set(results.flatMap((r) => r.recommendations))).slice(0, 4);
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence_score, 0) / results.length;

  return {
    request_id: requestId,
    batch_index: 0,
    total_batches: 1,
    highlights,
    risks,
    recommendations,
    confidence_score: Number(avgConfidence.toFixed(2)),
    appendix_refs: Array.from(new Set(results.flatMap((r) => r.appendix_refs)))
  };
}

function buildAnalystDataContext(payload: PreparedQuestionPayload): string {
  const parts: string[] = [];

  // When multiple sub-queries feed one question, describe the structure upfront
  const subQueryCount = payload.source_query_count ?? 1;
  if (subQueryCount > 1) {
    parts.push(`DATA STRUCTURE: This question was answered by ${subQueryCount} separate SQL queries whose results are merged below.`);
    parts.push(`Each row has a _sub_query column indicating which query produced it.`);
    // Extract per-sub-query row counts from preparation notes
    const sourceNotes = payload.preparation_notes.filter((n) => /^Source query \d+\/\d+/.test(n) && /returned \d+ row/.test(n));
    if (sourceNotes.length > 0) {
      parts.push("Sub-query breakdown:");
      for (const note of sourceNotes) {
        parts.push(`  - ${note}`);
      }
    }
    parts.push("");
  }

  parts.push(`Rows fetched: ${payload.row_count_before_reduction}`);
  if (payload.row_count_before_reduction !== payload.prepared_row_count) {
    parts.push(`Rows after reduction: ${payload.prepared_row_count}`);
  }

  const validation = payload.validation;
  if (validation) {
    if (validation.monthly_metric_totals && validation.monthly_metric_totals.length > 0) {
      const metric = validation.metric_column ?? "metric";
      const rowCounts = validation.monthly_row_counts ?? [];
      parts.push(`\nMonthly ${metric} totals:`);
      for (const item of validation.monthly_metric_totals) {
        const rc = rowCounts.find((r) => r.month === item.month);
        const rcStr = rc !== undefined ? ` (${rc.row_count} rows)` : "";
        parts.push(`  ${item.month}: ${item.total}${rcStr}`);
      }
    } else if (validation.monthly_row_counts && validation.monthly_row_counts.length > 0) {
      parts.push(`\nMonthly row counts:`);
      for (const item of validation.monthly_row_counts) {
        parts.push(`  ${item.month}: ${item.row_count} rows`);
      }
    }

    if (validation.expected_months !== null && validation.missing_months.length > 0) {
      parts.push(`\nMissing months: ${validation.missing_months.join(", ")}`);
    }
  }

  const colStats = computeColumnStatsForAnalyst(payload.prepared_rows);
  if (colStats.length > 0) {
    parts.push(`\nColumn statistics (sample of ${Math.min(payload.prepared_rows.length, 300)} rows):`);
    for (const stat of colStats) {
      parts.push(`  ${stat}`);
    }
  }

  const keyNotes = payload.preparation_notes
    .filter((n) => /reduction|aggregation|coverage|repair/i.test(n))
    .slice(0, 3);
  if (keyNotes.length > 0) {
    parts.push(`\nPreparation notes:`);
    for (const note of keyNotes) {
      parts.push(`  - ${note}`);
    }
  }

  if (payload.warnings.length > 0) {
    parts.push(`\nData warnings:`);
    for (const w of payload.warnings.slice(0, 4)) {
      parts.push(`  - ${w}`);
    }
  }

  return parts.join("\n");
}

function computeColumnStatsForAnalyst(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) {
    return [];
  }

  const first = rows[0];
  const stats: string[] = [];
  const sampleRows = rows.slice(0, 300);

  for (const column of Object.keys(first).filter((k) => !k.startsWith("_"))) {
    const values = sampleRows.map((r) => r[column]).filter((v) => v !== null && v !== undefined);
    if (values.length === 0) {
      continue;
    }

    const numerics = values
      .map((v) => (typeof v === "number" ? v : Number(String(v))))
      .filter((n): n is number => Number.isFinite(n));

    if (numerics.length >= values.length * 0.7) {
      const min = Math.min(...numerics);
      const max = Math.max(...numerics);
      const avg = numerics.reduce((a, b) => a + b, 0) / numerics.length;
      stats.push(`${column}: numeric, min=${min.toFixed(2)}, max=${max.toFixed(2)}, avg=${avg.toFixed(2)}`);
      continue;
    }

    const distinct = new Set(values.map((v) => String(v)));
    if (distinct.size <= 15) {
      const listed = Array.from(distinct).slice(0, 10).join(", ");
      stats.push(`${column}: ${distinct.size} distinct values [${listed}]`);
    }
  }

  return stats.slice(0, 10);
}
