import { describe, expect, it } from "vitest";
import {
  AnalystInputSchema,
  BatchPlanSchema,
  EvidencePacketSchema,
  MetricSchema,
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
});