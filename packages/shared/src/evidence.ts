import { z } from "zod";
import { EVIDENCE_ROW_CAP, MAX_BATCHES } from "./constants";

export const EvidenceRowSchema = z.record(z.string(), z.unknown());

export const EvidencePacketSchema = z.object({
  request_id: z.string().min(1),
  batch_index: z.number().int().min(0),
  total_batches: z.number().int().min(1).max(MAX_BATCHES),
  rows: z.array(EvidenceRowSchema).max(EVIDENCE_ROW_CAP),
  row_count: z.number().int().min(0).max(EVIDENCE_ROW_CAP)
});

export const AnalystInputSchema = z.object({
  request_id: z.string().min(1),
  batch_index: z.number().int().min(0),
  total_batches: z.number().int().min(1).max(MAX_BATCHES),
  summary_word_budget: z.number().int().min(50).max(800),
  evidence_packet: EvidencePacketSchema,
  question: z.string().min(1).optional(),
  insight_mode: z.enum(["business", "data"]).default("business"),
  data_context: z.string().optional()
});

export const QueryStrategyInputSchema = z.object({
  catalog_summary: z.string().min(1),
  report_goal: z.string().min(1),
  audience: z.string().min(1),
  insight_mode: z.enum(["business", "data"]),
  sql_dialect: z.enum(["postgres", "mysql", "snowflake", "bigquery"]).optional(),
  metric_ids: z.array(z.string().min(1)).default([]),
  dimension_ids: z.array(z.string().min(1)).default([]),
  allowed_relations: z.array(z.string().min(1)).default([]),
  planner_context: z.string().optional()
});

export const PlannedQuerySchema = z.object({
  question: z.string().min(1),
  sql: z.string().min(1),
  purpose: z.string().min(1),
  /** Optional group ID. Queries sharing the same group_id are executed
   *  separately but their rows are merged into ONE evidence packet and
   *  sent to a single analyst call (Case 1).
   *  Queries with no group_id are each analyzed independently (Case 2). */
  group_id: z.string().min(1).optional()
});

export const QueryStrategyOutputSchema = z.object({
  queries: z.array(PlannedQuerySchema).min(1).max(5)
});

export const BatchAnalysisSchema = z.object({
  request_id: z.string().min(1),
  batch_index: z.number().int().min(0),
  total_batches: z.number().int().min(1).max(MAX_BATCHES),
  highlights: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  recommendations: z.array(z.string().min(1)).default([]),
  confidence_score: z.number().min(0).max(1),
  appendix_refs: z.array(z.string().min(1)).default([])
});

export const ExecBriefSchema = z.object({
  what_changed: z.array(z.string().min(1)).min(1),
  why: z.array(z.string().min(1)).min(1),
  so_what: z.array(z.string().min(1)).min(1),
  what_to_do: z.array(z.string().min(1)).min(1),
  confidence: z.object({
    score: z.number().min(0).max(1),
    rationale: z.string().min(1)
  }),
  appendix_refs: z.array(z.string().min(1)).default([]),
  deltas_vs_last_run: z.array(z.string().min(1)).default([]),
  generated_at: z.string().datetime()
});

export type EvidenceRow = z.infer<typeof EvidenceRowSchema>;
export type EvidencePacket = z.infer<typeof EvidencePacketSchema>;
export type AnalystInput = z.infer<typeof AnalystInputSchema>;
export type BatchAnalysis = z.infer<typeof BatchAnalysisSchema>;
export type ExecBrief = z.infer<typeof ExecBriefSchema>;
export type QueryStrategyInput = z.infer<typeof QueryStrategyInputSchema>;
export type SqlDialect = NonNullable<QueryStrategyInput["sql_dialect"]>;
export type PlannedQuery = z.infer<typeof PlannedQuerySchema>;
export type QueryStrategyOutput = z.infer<typeof QueryStrategyOutputSchema>;

// ---------------------------------------------------------------------------
// Planner Agent schemas
// ---------------------------------------------------------------------------

export const PlannerInputSchema = z.object({
  catalog_summary: z.string().min(1),
  user_goal: z.string().min(1),
  audience: z.string().min(1),
  insight_mode: z.enum(["business", "data"]),
  allowed_relations: z.array(z.string().min(1)).default([]),
  allowed_schemas: z.array(z.string().min(1)).default([])
});

export const ExploratoryQuerySchema = z.object({
  purpose: z.string().min(1),
  sql: z.string().min(1),
  query_type: z.enum(["distinct", "count", "sample", "range", "schema"])
});

export const PlannerExplorationSchema = z.object({
  queries: z.array(ExploratoryQuerySchema).min(1).max(6)
});

export const DataDiscoverySchema = z.object({
  table: z.string().min(1),
  column: z.string().min(1),
  finding: z.string().min(1)
});

export const RecommendedApproachSchema = z.object({
  question: z.string().min(1),
  approach: z.string().min(1),
  key_columns: z.array(z.string().min(1)).default([]),
  relevant_tables: z.array(z.string().min(1)).default([])
});

export const PlannerOutputSchema = z.object({
  data_discoveries: z.array(DataDiscoverySchema).min(1).max(20),
  recommended_approaches: z.array(RecommendedApproachSchema).min(1).max(5),
  data_warnings: z.array(z.string().min(1)).default([]),
  plan_summary: z.string().min(1)
});

export type PlannerInput = z.infer<typeof PlannerInputSchema>;
export type ExploratoryQuery = z.infer<typeof ExploratoryQuerySchema>;
export type PlannerExploration = z.infer<typeof PlannerExplorationSchema>;
export type DataDiscovery = z.infer<typeof DataDiscoverySchema>;
export type RecommendedApproach = z.infer<typeof RecommendedApproachSchema>;
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;
