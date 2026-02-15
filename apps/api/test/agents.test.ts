import { describe, expect, it } from "vitest";
import {
  agentA_buildContractDraft,
  agentB_mapMetadataToSemantic,
  agentC_buildQueryPlan,
  agentD_reduceEvidence,
  agentE_analyzeBatch,
  agentF_aggregate,
  agentG_renderExecBrief,
  agentH_evaluateExecBrief
} from "../src/agents";

describe("agent pipeline map", () => {
  it("builds report contract draft with hard guardrails", () => {
    const draft = agentA_buildContractDraft({
      contract_name: "Weekly CEO Revenue",
      audience: "CEO",
      decision_use: "Weekly exec decision support",
      timezone: "Asia/Kolkata",
      schedule_nl: "Weekly Friday 6pm",
      schedule_cron: "0 18 * * 5",
      guardrails: {
        evidence_row_cap: 200,
        max_batches: 5,
        deny_write: true,
        timeout_ms: 15000,
        allowed_sources: ["analytics.sales_enriched"]
      }
    });

    expect(draft.guardrails.evidence_row_cap).toBe(200);
    expect(draft.guardrails.max_batches).toBe(5);
    expect(draft.guardrails.deny_write).toBe(true);
  });

  it("maps DB metadata into semantic entities, fields, and relationships", () => {
    const mapped = agentB_mapMetadataToSemantic(
      [
        {
          schema_name: "analytics",
          table_name: "customers",
          columns: [
            { name: "customer_id", type: "text" },
            { name: "customer_email", type: "text", pii: true }
          ]
        },
        {
          schema_name: "analytics",
          table_name: "sales",
          columns: [
            { name: "order_id", type: "text" },
            { name: "customer_id", type: "text" },
            { name: "amount", type: "numeric" }
          ]
        }
      ],
      [
        {
          from_schema: "analytics",
          from_table: "sales",
          from_column: "customer_id",
          to_schema: "analytics",
          to_table: "customers",
          to_column: "customer_id",
          cardinality: "many_to_one"
        }
      ]
    );

    expect(mapped.entities.length).toBe(2);
    expect(mapped.fields.some((field) => field.pii)).toBe(true);
    expect(mapped.relationships.length).toBe(1);
  });

  it("builds planner query plan and runs reducer -> analyst -> aggregator -> qa", async () => {
    const draft = agentA_buildContractDraft({
      contract_name: "Weekly Revenue",
      audience: "CEO",
      decision_use: "Weekly performance decisions",
      timezone: "UTC",
      schedule_nl: "Weekly",
      schedule_cron: "0 18 * * 5",
      guardrails: {
        evidence_row_cap: 200,
        max_batches: 5,
        deny_write: true,
        timeout_ms: 15000,
        allowed_sources: ["analytics.sales"]
      }
    });

    const queryPlan = agentC_buildQueryPlan({
      contract_id: "contract_1",
      contract_draft: draft,
      sql: "SELECT * FROM analytics.sales",
      expected_row_count_estimate: 420
    });

    expect(queryPlan.evidence_requests).toHaveLength(1);
    expect(queryPlan.evidence_requests[0].batch_plan?.max_batches_cap).toBeLessThanOrEqual(5);

    const rows = Array.from({ length: 750 }, (_, index) => ({
      order_id: `o_${index + 1}`,
      region: ["NA", "EU", "APAC"][index % 3],
      amount: (index % 40) + 10
    }));

    const reduction = agentD_reduceEvidence({
      request_id: queryPlan.evidence_requests[0].request_id,
      rows,
      query_sql: queryPlan.evidence_requests[0].sql[0],
      row_cap: 200,
      max_batches: 5
    });

    expect(reduction.packets.length).toBeGreaterThan(0);
    for (const packet of reduction.packets) {
      expect(packet.rows.length).toBeLessThanOrEqual(200);
      expect(packet.total_batches).toBeLessThanOrEqual(5);
    }

    const analyses = reduction.packets.map((packet) => agentE_analyzeBatch(packet));
    const brief = agentF_aggregate({
      title: "Weekly CEO Revenue Brief",
      period: "2026-W01",
      analyses,
      query_hashes: reduction.packets.map((packet) => packet.query_hash)
    });

    const qa = agentH_evaluateExecBrief(brief);
    expect(qa.score_0_100).toBeGreaterThanOrEqual(75);

    const rendered = await agentG_renderExecBrief(brief);
    expect(rendered.html).toContain("Executive Brief");
    expect(rendered.pdf_bytes.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("fails QA when appendix references are missing", () => {
    const qa = agentH_evaluateExecBrief({
      title: "Bad Brief",
      period: "2026-W01",
      headline: "Unknown",
      what_changed: ["X"],
      why_changed: ["Y"],
      so_what: ["Z"],
      actions: ["Do something"],
      confidence_notes: [],
      appendix: {
        evidence_packet_refs: [],
        query_hashes: []
      }
    });

    expect(qa.pass).toBe(false);
    expect(qa.issues.length).toBeGreaterThan(0);
  });
});
