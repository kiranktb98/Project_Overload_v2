import { createHash } from "node:crypto";
import {
  aggregateBatchAnalyses,
  analyzeBatch as analyzeLegacyBatch,
  materializeBatches,
  reduceEvidence
} from "@project-overload/evidence";
import { renderExecBriefHtml, renderPdfFromHtml } from "@project-overload/report-render";
import {
  ContractBatchAnalysisSchema,
  ContractEvidencePacketSchema,
  ContractExecBriefSchema,
  ContractQueryPlanSchema,
  QualityEvalSchema,
  ReportContractDraftSchema,
  type ContractBatchAnalysis,
  type ContractEvidencePacket,
  type ContractExecBrief,
  type ContractQueryPlan,
  type ReportContractDraft,
  type SemanticEntity,
  type SemanticField,
  type SemanticRelationship
} from "@project-overload/shared";

export type DbTableMetadata = {
  schema_name: string;
  table_name: string;
  columns: Array<{
    name: string;
    type: string;
    description?: string;
    pii?: boolean;
  }>;
};

export type DbRelationshipMetadata = {
  from_schema: string;
  from_table: string;
  from_column: string;
  to_schema: string;
  to_table: string;
  to_column: string;
  cardinality: SemanticRelationship["cardinality"];
};

export type SemanticMappingResult = {
  entities: SemanticEntity[];
  fields: SemanticField[];
  relationships: SemanticRelationship[];
};

export type AgentDReduceResult = {
  packets: ContractEvidencePacket[];
  notes: string[];
};

export type AgentGRenderResult = {
  html: string;
  pdf_bytes: Buffer;
};

// Agent A - Contract Builder (Chat -> ReportContractDraft)
export function agentA_buildContractDraft(input: Partial<ReportContractDraft>): ReportContractDraft {
  return ReportContractDraftSchema.parse({
    contract_name: input.contract_name ?? "Untitled report contract",
    audience: input.audience ?? "Executive",
    decision_use: input.decision_use ?? "Weekly business decision support",
    timezone: input.timezone ?? "UTC",
    schedule_nl: input.schedule_nl ?? "Manual run",
    schedule_cron: input.schedule_cron ?? null,
    delivery: input.delivery ?? { emails: [] },
    metrics: input.metrics ?? [],
    dimensions: input.dimensions ?? [],
    filters: input.filters ?? [],
    thresholds: input.thresholds ?? [],
    guardrails: input.guardrails ?? {
      evidence_row_cap: 200,
      max_batches: 5,
      deny_write: true,
      timeout_ms: 15000,
      allowed_sources: []
    }
  });
}

// Agent B - Semantic Mapper (DB metadata -> semantic layer objects)
export function agentB_mapMetadataToSemantic(
  tables: DbTableMetadata[],
  relationships: DbRelationshipMetadata[] = []
): SemanticMappingResult {
  const entities: SemanticEntity[] = [];
  const fields: SemanticField[] = [];
  const relationRecords: SemanticRelationship[] = [];

  for (const table of tables) {
    const entityId = `${table.schema_name}.${table.table_name}`;
    entities.push({
      id: entityId,
      name: table.table_name,
      description: `Mapped from ${table.schema_name}.${table.table_name}`
    });

    for (const column of table.columns) {
      fields.push({
        id: `${entityId}.${column.name}`,
        entity_id: entityId,
        name: column.name,
        type: normalizeSemanticType(column.type),
        description: column.description ?? "",
        pii: column.pii ?? false
      });
    }
  }

  for (const relationship of relationships) {
    const fromEntityId = `${relationship.from_schema}.${relationship.from_table}`;
    const toEntityId = `${relationship.to_schema}.${relationship.to_table}`;

    relationRecords.push({
      id: `${fromEntityId}->${toEntityId}:${relationship.from_column}=${relationship.to_column}`,
      from_entity_id: fromEntityId,
      to_entity_id: toEntityId,
      join_keys: [
        {
          from_field: `${fromEntityId}.${relationship.from_column}`,
          to_field: `${toEntityId}.${relationship.to_column}`
        }
      ],
      cardinality: relationship.cardinality,
      confidence: 0.9
    });
  }

  return {
    entities,
    fields,
    relationships: relationRecords
  };
}

// Agent C - Planner / Data Architect (Contract + semantic -> QueryPlan)
export function agentC_buildQueryPlan(input: {
  contract_id: string;
  contract_draft: ReportContractDraft;
  sql: string | string[];
  approval_required?: boolean;
  expected_row_count_estimate?: number;
}): ContractQueryPlan {
  const sqlList = Array.isArray(input.sql) ? input.sql : [input.sql];

  return ContractQueryPlanSchema.parse({
    plan_id: `plan_${input.contract_id}`,
    contract_id: input.contract_id,
    approval_required: input.approval_required ?? true,
    evidence_requests: [
      {
        request_id: `req_${input.contract_id}_1`,
        purpose: input.contract_draft.decision_use,
        strategy: sqlList.length > 1 ? "two_query_merge" : "db_join",
        sql: sqlList,
        reduction_plan: {
          aggregate_first: true,
          top_k: input.contract_draft.guardrails.evidence_row_cap,
          grain: "week"
        },
        batch_plan: {
          method: "time_window",
          total_batches_estimate: 1,
          max_batches_cap: input.contract_draft.guardrails.max_batches
        },
        expected_row_count_estimate: input.expected_row_count_estimate ?? 0,
        join_plan:
          sqlList.length > 1
            ? {
                left_request_id: `req_${input.contract_id}_1`,
                right_request_id: `req_${input.contract_id}_1_aux`,
                join_keys: [{ left_key: "customer_id", right_key: "customer_id" }],
                join_type: "left",
                dedup_policy: "keep_first",
                missing_key_policy: "keep_null"
              }
            : undefined
      }
    ]
  });
}

// Agent D - Evidence Reducer & Batch Controller
export function agentD_reduceEvidence(input: {
  request_id: string;
  rows: Record<string, unknown>[];
  query_sql: string;
  row_cap?: number;
  max_batches?: number;
  partition_field?: string;
}): AgentDReduceResult {
  const rowCap = input.row_cap ?? 200;
  const maxBatches = input.max_batches ?? 5;

  const reduction = reduceEvidence(input.rows, {
    request_id: input.request_id,
    row_cap: rowCap,
    max_batches: maxBatches,
    partition_field: input.partition_field ?? "region",
    top_k_field: "amount",
    stratify_by: input.partition_field ?? "region"
  });

  const queryHash = hashSql(input.query_sql);
  const freshness = new Date().toISOString();

  if (reduction.kind === "packet") {
    return {
      packets: [toContractEvidencePacket(reduction.packet, queryHash, freshness, reduction.reduction_steps)],
      notes: reduction.reduction_steps
    };
  }

  const legacyPackets = materializeBatches(
    input.rows,
    input.request_id,
    reduction.batch_plan,
    rowCap
  );

  return {
    packets: legacyPackets.map((packet) =>
      toContractEvidencePacket(packet, queryHash, freshness, reduction.reduction_steps)
    ),
    notes: reduction.reduction_steps
  };
}

// Agent E - Batch Analyst
export function agentE_analyzeBatch(packet: ContractEvidencePacket): ContractBatchAnalysis {
  const legacyAnalysis = analyzeLegacyBatch({
    request_id: packet.request_id,
    batch_index: packet.batch_index,
    total_batches: packet.total_batches,
    summary_word_budget: packet.total_batches > 1 ? 120 : 250,
    insight_mode: "business",
    evidence_packet: {
      request_id: packet.request_id,
      batch_index: packet.batch_index,
      total_batches: packet.total_batches,
      rows: packet.rows,
      row_count: packet.rows.length
    }
  });

  return ContractBatchAnalysisSchema.parse({
    request_id: packet.request_id,
    batch_index: packet.batch_index,
    total_batches: packet.total_batches,
    findings: legacyAnalysis.highlights,
    drivers: legacyAnalysis.recommendations,
    anomalies: legacyAnalysis.risks,
    confidence: legacyAnalysis.confidence_score,
    evidence_refs: packet.warnings.length > 0 ? [...legacyAnalysis.appendix_refs, ...packet.warnings] : legacyAnalysis.appendix_refs
  });
}

// Agent F - Aggregator
export function agentF_aggregate(input: {
  title: string;
  period: string;
  analyses: ContractBatchAnalysis[];
  query_hashes: string[];
}): ContractExecBrief {
  const legacyAnalyses = input.analyses.map((analysis) => ({
    request_id: analysis.request_id,
    batch_index: analysis.batch_index,
    total_batches: analysis.total_batches,
    highlights: analysis.findings,
    risks: analysis.anomalies,
    recommendations: analysis.drivers,
    confidence_score: analysis.confidence,
    appendix_refs: analysis.evidence_refs
  }));

  const legacyBrief = aggregateBatchAnalyses(legacyAnalyses);
  const headline = legacyBrief.what_changed[0] ?? "No material change captured.";

  return ContractExecBriefSchema.parse({
    title: input.title,
    period: input.period,
    headline,
    what_changed: legacyBrief.what_changed,
    why_changed: legacyBrief.why,
    so_what: legacyBrief.so_what,
    actions: legacyBrief.what_to_do,
    confidence_notes: [
      `Confidence score ${legacyBrief.confidence.score.toFixed(2)}`,
      legacyBrief.confidence.rationale
    ],
    appendix: {
      evidence_packet_refs: legacyBrief.appendix_refs,
      query_hashes: dedupeStrings(input.query_hashes)
    }
  });
}

// Agent G - Renderer
export async function agentG_renderExecBrief(brief: ContractExecBrief): Promise<AgentGRenderResult> {
  const legacyBrief = {
    what_changed: brief.what_changed,
    why: brief.why_changed,
    so_what: brief.so_what,
    what_to_do: brief.actions,
    confidence: {
      score: parseConfidenceScore(brief.confidence_notes),
      rationale: brief.confidence_notes.join(" | ") || "No rationale provided."
    },
    appendix_refs: brief.appendix.evidence_packet_refs,
    deltas_vs_last_run: [],
    generated_at: new Date().toISOString()
  };

  const html = renderExecBriefHtml(legacyBrief);
  const pdf = await renderPdfFromHtml(html);

  return {
    html,
    pdf_bytes: pdf.bytes
  };
}

// Agent H - QA / Judge
export function agentH_evaluateExecBrief(brief: ContractExecBrief): ReturnType<typeof QualityEvalSchema.parse> {
  const issues: string[] = [];
  let score = 100;

  if (brief.what_changed.length === 0) {
    issues.push("Missing what_changed details.");
    score -= 20;
  }

  if (brief.why_changed.length === 0) {
    issues.push("Missing why_changed details.");
    score -= 20;
  }

  if (brief.so_what.length === 0) {
    issues.push("Missing so_what impact section.");
    score -= 20;
  }

  if (brief.actions.length === 0) {
    issues.push("Missing actions section.");
    score -= 20;
  }

  if (brief.appendix.query_hashes.length === 0) {
    issues.push("Appendix has no query hashes.");
    score -= 10;
  }

  if (brief.appendix.evidence_packet_refs.length === 0) {
    issues.push("Appendix has no evidence references.");
    score -= 10;
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const passed = boundedScore >= 75 && issues.length === 0;

  return QualityEvalSchema.parse({
    pass: passed,
    score_0_100: boundedScore,
    issues,
    fix_instructions: issues.map((issue) => `Fix required: ${issue}`)
  });
}

function toContractEvidencePacket(
  packet: {
    request_id: string;
    batch_index: number;
    total_batches: number;
    rows: Record<string, unknown>[];
  },
  queryHash: string,
  freshness: string,
  reductionNotes: string[]
): ContractEvidencePacket {
  const columns = packet.rows.length > 0 ? Object.keys(packet.rows[0]) : [];

  return ContractEvidencePacketSchema.parse({
    request_id: packet.request_id,
    batch_index: packet.batch_index,
    total_batches: packet.total_batches,
    columns,
    rows: packet.rows,
    notes: reductionNotes.map((entry) => `reduction:${entry}`),
    query_hash: queryHash,
    data_freshness: freshness,
    warnings: []
  });
}

function hashSql(sql: string): string {
  return createHash("sha256").update(sql).digest("hex").slice(0, 16);
}

function parseConfidenceScore(notes: string[]): number {
  for (const note of notes) {
    const match = note.match(/confidence score\s+(\d(?:\.\d+)?)/i);
    if (match) {
      const parsed = Number.parseFloat(match[1]);
      if (!Number.isNaN(parsed)) {
        return Math.max(0, Math.min(1, parsed));
      }
    }
  }

  return 0.8;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeSemanticType(rawType: string): SemanticField["type"] {
  const normalized = rawType.trim().toLowerCase();

  if (normalized.includes("bool")) {
    return "boolean";
  }

  if (normalized.includes("date") && normalized.includes("time")) {
    return "datetime";
  }

  if (normalized.includes("date")) {
    return "date";
  }

  if (
    normalized.includes("int") ||
    normalized.includes("numeric") ||
    normalized.includes("decimal") ||
    normalized.includes("float") ||
    normalized.includes("double")
  ) {
    return "number";
  }

  return "string";
}
