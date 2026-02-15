import { randomUUID } from "node:crypto";
import {
  type ContractBatchAnalysis,
  ContractExecBriefSchema,
  DEFAULT_PII_FIELDS,
  ExecBriefSchema,
  type ExecBrief,
  ReportRunSchema,
  type ReportContract,
  type ReportRun
} from "@project-overload/shared";
import type { DataPlane } from "@project-overload/dataplane";
import { mergeWithJoinPlan } from "@project-overload/evidence";
import type { AnalystClient } from "@project-overload/llm-client";
import type { MetadataStore } from "../store";
import {
  agentA_buildContractDraft,
  agentC_buildQueryPlan,
  agentD_reduceEvidence,
  agentF_aggregate,
  agentG_renderExecBrief,
  agentH_evaluateExecBrief
} from "../agents";

export type RunReportContractResult = {
  run: ReportRun;
  exec_brief: ExecBrief;
  html: string;
  pdf_bytes: Buffer;
};

export async function runReportContractPipeline(input: {
  contract: ReportContract;
  store: MetadataStore;
  data_plane: DataPlane;
  analyst_client: AnalystClient;
}): Promise<RunReportContractResult> {
  const startedAt = new Date().toISOString();
  const contractDraft = agentA_buildContractDraft({
    contract_name: input.contract.name,
    audience: input.contract.audience,
    decision_use: `${input.contract.name} recurring executive analysis`,
    timezone: input.contract.timezone,
    schedule_nl: input.contract.schedule_cron ? `cron:${input.contract.schedule_cron}` : "manual",
    schedule_cron: input.contract.schedule_cron,
    delivery: { emails: [] },
    metrics: input.contract.metric_ids.map((metricId) => ({ metric_id: metricId })),
    dimensions: input.contract.dimension_ids,
    filters: [],
    thresholds: [],
    guardrails: {
      evidence_row_cap: input.contract.guardrails.evidence_row_cap,
      max_batches: input.contract.guardrails.max_batches,
      deny_write: input.contract.guardrails.deny_write,
      timeout_ms: input.contract.guardrails.timeout_ms,
      allowed_sources: input.contract.guardrails.allowed_relations
    }
  });

  const queryPlan = agentC_buildQueryPlan({
    contract_id: input.contract.id,
    contract_draft: contractDraft,
    sql: input.contract.sql_template,
    expected_row_count_estimate: 0,
    approval_required: true
  });

  const previousRun = await input.store.getLatestReportRun(input.contract.id);
  const analyses: ContractBatchAnalysis[] = [];
  const queryHashes: string[] = [];

  for (const evidenceRequest of queryPlan.evidence_requests) {
    const queryResults = [];

    for (const [index, sql] of evidenceRequest.sql.entries()) {
      const queryResult = await input.data_plane.execute({
        request_id: `${evidenceRequest.request_id}_${index + 1}`,
        sql,
        policy: {
          allowed_relations: input.contract.guardrails.allowed_relations,
          allowed_schemas: input.contract.guardrails.allowed_schemas,
          timeout_ms: input.contract.guardrails.timeout_ms,
          row_cap: input.contract.guardrails.evidence_row_cap,
          pii_fields: DEFAULT_PII_FIELDS
        }
      });

      await input.store.appendAuditLog(
        "dataplane_execute",
        queryResult.audit_event as unknown as Record<string, unknown>
      );

      queryResults.push(queryResult);
    }

    let evidenceRows = queryResults[0]?.rows ?? [];

    if (evidenceRequest.strategy === "two_query_merge" && queryResults.length >= 2) {
      const joinPlan = evidenceRequest.join_plan;

      if (joinPlan) {
        evidenceRows = mergeWithJoinPlan(evidenceRows, queryResults[1].rows, {
          mode: "two_query_merge",
          left_request_id: joinPlan.left_request_id,
          right_request_id: joinPlan.right_request_id,
          join_keys: joinPlan.join_keys,
          join_type: joinPlan.join_type,
          dedup_policy: joinPlan.dedup_policy,
          missing_key_policy: joinPlan.missing_key_policy
        });
      } else {
        evidenceRows = [...evidenceRows, ...queryResults[1].rows];
      }
    }

    const reduction = agentD_reduceEvidence({
      request_id: evidenceRequest.request_id,
      rows: evidenceRows,
      query_sql: evidenceRequest.sql.join("\n--split--\n"),
      row_cap: input.contract.guardrails.evidence_row_cap,
      max_batches: input.contract.guardrails.max_batches,
      partition_field: input.contract.dimension_ids[0] ?? "region"
    });

    for (const packet of reduction.packets) {
      queryHashes.push(packet.query_hash);

      const analysis = await input.analyst_client.analyzeBatch({
        request_id: evidenceRequest.request_id,
        batch_index: packet.batch_index,
        total_batches: packet.total_batches,
        summary_word_budget: packet.total_batches > 1 ? 120 : 250,
        evidence_packet: {
          request_id: packet.request_id,
          batch_index: packet.batch_index,
          total_batches: packet.total_batches,
          rows: packet.rows,
          row_count: packet.rows.length
        }
      });

      analyses.push({
        request_id: analysis.request_id,
        batch_index: analysis.batch_index,
        total_batches: analysis.total_batches,
        findings: analysis.highlights,
        drivers: analysis.recommendations,
        anomalies: analysis.risks,
        confidence: analysis.confidence_score,
        evidence_refs: analysis.appendix_refs.length > 0 ? analysis.appendix_refs : [packet.request_id]
      });
    }
  }

  let contractExecBrief = agentF_aggregate({
    title: `${input.contract.name} Executive Brief`,
    period: startedAt.slice(0, 10),
    analyses,
    query_hashes: queryHashes
  });

  let qualityEval = agentH_evaluateExecBrief(contractExecBrief);
  if (!qualityEval.pass) {
    contractExecBrief = ContractExecBriefSchema.parse({
      ...contractExecBrief,
      confidence_notes: [
        ...contractExecBrief.confidence_notes,
        ...qualityEval.fix_instructions
      ],
      appendix: {
        evidence_packet_refs:
          contractExecBrief.appendix.evidence_packet_refs.length > 0
            ? contractExecBrief.appendix.evidence_packet_refs
            : ["fallback:evidence_ref"],
        query_hashes:
          contractExecBrief.appendix.query_hashes.length > 0
            ? contractExecBrief.appendix.query_hashes
            : ["fallback_query_hash"]
      }
    });

    qualityEval = agentH_evaluateExecBrief(contractExecBrief);
  }

  await input.store.appendAuditLog("quality_eval", qualityEval as unknown as Record<string, unknown>);

  const previousBrief = parsePreviousExecBrief(previousRun);
  const execBrief = mapContractExecBriefToLegacy(contractExecBrief, previousBrief, qualityEval.score_0_100);
  const rendered = await agentG_renderExecBrief(contractExecBrief);

  const run = ReportRunSchema.parse({
    id: randomUUID(),
    contract_id: input.contract.id,
    status: "succeeded",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    query_plan: {
      ...queryPlan,
      quality_eval: qualityEval
    },
    exec_brief: execBrief
  });

  await input.store.createReportRun(run);

  return {
    run,
    exec_brief: execBrief,
    html: rendered.html,
    pdf_bytes: rendered.pdf_bytes
  };
}

function parsePreviousExecBrief(previousRun: ReportRun | null): ExecBrief | null {
  if (!previousRun) {
    return null;
  }

  const parsed = ExecBriefSchema.safeParse(previousRun.exec_brief);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function mapContractExecBriefToLegacy(
  contractBrief: {
    what_changed: string[];
    why_changed: string[];
    so_what: string[];
    actions: string[];
    confidence_notes: string[];
    appendix: { evidence_packet_refs: string[] };
  },
  previousBrief: ExecBrief | null,
  qualityScore: number
): ExecBrief {
  const previousWhatChanged = previousBrief?.what_changed ?? [];
  const deltas = contractBrief.what_changed.filter((entry) => !previousWhatChanged.includes(entry));

  return ExecBriefSchema.parse({
    what_changed: contractBrief.what_changed,
    why: contractBrief.why_changed,
    so_what: contractBrief.so_what,
    what_to_do: contractBrief.actions,
    confidence: {
      score: Number((qualityScore / 100).toFixed(2)),
      rationale: contractBrief.confidence_notes.join(" | ") || "Quality-based confidence."
    },
    appendix_refs: contractBrief.appendix.evidence_packet_refs,
    deltas_vs_last_run: deltas,
    generated_at: new Date().toISOString()
  });
}
