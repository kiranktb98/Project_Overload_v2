import { describe, expect, it } from "vitest";
import {
  AnalystInputSchema,
  BatchPlanSchema,
  ContractBatchAnalysisSchema,
  ContractEvidencePacketSchema,
  ContractExecBriefSchema,
  ContractQueryPlanSchema,
  EvidencePacketSchema,
  MetricSchema,
  QualityEvalSchema,
  ReportContractDraftSchema,
  QueryPlanSchema,
  SemanticEntitySchema
} from "../src";

describe("shared schemas", () => {
  it("validates semantic entity and metric", () => {
    const entity = SemanticEntitySchema.parse({
      id: "entity_customer",
      name: "Customer",
      description: "Customer master"
    });

    const metric = MetricSchema.parse({
      id: "metric_revenue",
      name: "Revenue",
      definition: "sum(order_amount)",
      grain: "day"
    });

    expect(entity.name).toBe("Customer");
    expect(metric.name).toBe("Revenue");
  });

  it("rejects evidence packet above row cap", () => {
    const rows = Array.from({ length: 201 }, (_, index) => ({ index }));

    expect(() =>
      EvidencePacketSchema.parse({
        request_id: "req_1",
        batch_index: 0,
        total_batches: 1,
        rows,
        row_count: rows.length
      })
    ).toThrow();
  });

  it("rejects batch plan above max batches", () => {
    expect(() =>
      BatchPlanSchema.parse({
        method: "time_window",
        partition_field: "order_date",
        partitions: ["1", "2", "3", "4", "5", "6"],
        total_batches: 6
      })
    ).toThrow();
  });

  it("requires analyst total_batches and batch_index", () => {
    expect(() =>
      AnalystInputSchema.parse({
        request_id: "req_1",
        summary_word_budget: 150,
        evidence_packet: {
          request_id: "req_1",
          batch_index: 0,
          total_batches: 1,
          rows: [{ a: 1 }],
          row_count: 1
        }
      })
    ).toThrow();
  });

  it("supports query plan with hard budgets", () => {
    const plan = QueryPlanSchema.parse({
      id: "plan_1",
      contract_id: "contract_1",
      evidence_requests: [
        {
          id: "req_1",
          name: "Revenue trend",
          sql: "SELECT * FROM analytics.revenue"
        }
      ],
      budgets: {
        evidence_row_cap: 200,
        max_batches: 5
      }
    });

    expect(plan.budgets.evidence_row_cap).toBe(200);
    expect(plan.budgets.max_batches).toBe(5);
  });

  it("validates report contract draft schema", () => {
    const draft = ReportContractDraftSchema.parse({
      contract_name: "Weekly CEO Revenue",
      audience: "CEO",
      decision_use: "Board-ready weekly decisions",
      timezone: "Asia/Kolkata",
      schedule_nl: "Every Friday at 6 PM IST",
      schedule_cron: "0 18 * * 5",
      delivery: {
        emails: ["ceo@example.com"]
      },
      metrics: [{ metric_id: "metric_revenue" }],
      dimensions: ["region"],
      filters: [{ field: "status", operator: "=", value: "completed" }],
      thresholds: [{ metric_id: "metric_revenue", comparator: ">", value: 0 }],
      guardrails: {
        evidence_row_cap: 200,
        max_batches: 5,
        deny_write: true,
        timeout_ms: 15000,
        allowed_sources: ["analytics.sales_enriched"]
      }
    });

    expect(draft.contract_name).toBe("Weekly CEO Revenue");
    expect(draft.guardrails.evidence_row_cap).toBe(200);
  });

  it("enforces evidence packet and batch caps in core contracts", () => {
    expect(() =>
      ContractEvidencePacketSchema.parse({
        request_id: "req_1",
        batch_index: 0,
        total_batches: 6,
        columns: ["region"],
        rows: [{ region: "NA" }],
        notes: [],
        query_hash: "hash_1",
        data_freshness: "2026-01-01T00:00:00.000Z",
        warnings: []
      })
    ).toThrow();
  });

  it("validates core query plan and output contracts", () => {
    const queryPlan = ContractQueryPlanSchema.parse({
      plan_id: "plan_1",
      contract_id: "contract_1",
      approval_required: true,
      evidence_requests: [
        {
          request_id: "req_1",
          purpose: "Revenue by region",
          strategy: "db_join",
          sql: ["SELECT region, SUM(amount) AS amount FROM analytics.sales GROUP BY region"],
          reduction_plan: {
            aggregate_first: true,
            top_k: 10,
            grain: "week"
          },
          batch_plan: {
            method: "time_window",
            total_batches_estimate: 2,
            max_batches_cap: 5
          },
          expected_row_count_estimate: 120
        }
      ]
    });

    const batchAnalysis = ContractBatchAnalysisSchema.parse({
      request_id: "req_1",
      batch_index: 0,
      total_batches: 1,
      findings: ["Revenue increased in NA."],
      drivers: ["Enterprise deal volume rose."],
      anomalies: [],
      confidence: 0.82,
      evidence_refs: ["req_1:batch-1"]
    });

    const brief = ContractExecBriefSchema.parse({
      title: "Weekly CEO Revenue Brief",
      period: "2026-W01",
      headline: "Revenue rose 12% WoW",
      what_changed: ["NA and EU grew double digits."],
      why_changed: ["Higher conversion and larger deals."],
      so_what: ["Quarter target risk reduced."],
      actions: ["Shift budget toward high-performing channels."],
      confidence_notes: ["Consistent trend across key regions."],
      appendix: {
        evidence_packet_refs: batchAnalysis.evidence_refs,
        query_hashes: ["hash_1"]
      }
    });

    const quality = QualityEvalSchema.parse({
      pass: true,
      score_0_100: 91,
      issues: [],
      fix_instructions: []
    });

    expect(queryPlan.evidence_requests[0].strategy).toBe("db_join");
    expect(brief.headline).toContain("12%");
    expect(quality.score_0_100).toBe(91);
  });
});
