import { randomUUID } from "node:crypto";
import {
  ExecBriefSchema,
  type ExecBrief,
  ReportRunSchema,
  type ReportContract,
  type ReportRun
} from "@project-overload/shared";
import type { DataPlane } from "@project-overload/dataplane";
import {
  aggregateBatchAnalyses,
  materializeBatches,
  reduceEvidence
} from "@project-overload/evidence";
import type { AnalystClient } from "@project-overload/llm-client";
import { renderExecBriefHtml, renderPdfPlaceholder } from "@project-overload/report-render";
import type { MetadataStore } from "../store";
import { buildDeterministicQueryPlan } from "./planner";

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
  const queryPlan = buildDeterministicQueryPlan(input.contract);
  const previousRun = await input.store.getLatestReportRun(input.contract.id);

  const previousBrief = parsePreviousExecBrief(previousRun);
  const analyses = [];

  for (const evidenceRequest of queryPlan.evidence_requests) {
    const queryResult = await input.data_plane.execute({
      request_id: evidenceRequest.id,
      sql: evidenceRequest.sql,
      policy: {
        allowed_relations: input.contract.guardrails.allowed_relations,
        allowed_schemas: input.contract.guardrails.allowed_schemas,
        timeout_ms: input.contract.guardrails.timeout_ms,
        row_cap: input.contract.guardrails.evidence_row_cap,
        pii_fields: ["customer_email", "email", "phone", "ssn"]
      }
    });

    await input.store.appendAuditLog("dataplane_execute", queryResult.audit_event as unknown as Record<string, unknown>);

    const reduction = reduceEvidence(queryResult.rows, {
      request_id: evidenceRequest.id,
      row_cap: input.contract.guardrails.evidence_row_cap,
      max_batches: input.contract.guardrails.max_batches,
      partition_field: input.contract.dimension_ids[0] ?? "region",
      top_k_field: "amount",
      stratify_by: input.contract.dimension_ids[0] ?? "region"
    });

    if (reduction.kind === "packet") {
      analyses.push(
        await input.analyst_client.analyzeBatch({
          request_id: evidenceRequest.id,
          batch_index: 0,
          total_batches: 1,
          summary_word_budget: 250,
          evidence_packet: reduction.packet
        })
      );
      continue;
    }

    const packets = materializeBatches(
      queryResult.rows,
      evidenceRequest.id,
      reduction.batch_plan,
      input.contract.guardrails.evidence_row_cap
    );

    for (const packet of packets) {
      analyses.push(
        await input.analyst_client.analyzeBatch({
          request_id: evidenceRequest.id,
          batch_index: packet.batch_index,
          total_batches: packet.total_batches,
          summary_word_budget: packet.total_batches > 1 ? 120 : 250,
          evidence_packet: packet
        })
      );
    }
  }

  const execBrief = aggregateBatchAnalyses(analyses, previousBrief);
  const html = renderExecBriefHtml(execBrief);
  const pdf = renderPdfPlaceholder(html);

  const run = ReportRunSchema.parse({
    id: randomUUID(),
    contract_id: input.contract.id,
    status: "succeeded",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    query_plan: queryPlan,
    exec_brief: execBrief
  });

  await input.store.createReportRun(run);

  return {
    run,
    exec_brief: execBrief,
    html,
    pdf_bytes: pdf.bytes
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
