import { describe, expect, it } from "vitest";
import {
  aggregateBatchAnalyses,
  analyzeBatch,
  mergeWithJoinPlan,
  planBatches,
  reduceEvidence
} from "../src";
import type { JoinPlan } from "@project-overload/shared";

describe("evidence reduction", () => {
  it("returns packet <= 200 rows when reducible", () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({
      region: ["NA", "EU", "APAC", "LATAM", "MEA"][index % 5],
      revenue: 10
    }));

    const result = reduceEvidence(rows, {
      request_id: "req_1",
      partition_field: "region"
    });

    expect(result.kind).toBe("packet");

    if (result.kind === "packet") {
      expect(result.packet.rows.length).toBeLessThanOrEqual(200);
    }
  });

  it("returns batch plan with max 5 batches when not reducible", () => {
    const rows = Array.from({ length: 1500 }, (_, index) => ({
      order_id: `o_${index + 1}`,
      amount: 1
    }));

    const result = reduceEvidence(rows, {
      request_id: "req_2",
      partition_field: "order_id"
    });

    expect(result.kind).toBe("batch_plan");

    if (result.kind === "batch_plan") {
      expect(result.batch_plan.total_batches).toBeLessThanOrEqual(5);
    }
  });

  it("batch planner never exceeds hard cap", () => {
    const batchPlan = planBatches({
      total_rows: 25000,
      row_cap: 200,
      max_batches: 5,
      method: "time_window",
      partition_field: "order_date"
    });

    expect(batchPlan.total_batches).toBeLessThanOrEqual(5);
    expect(batchPlan.partitions).toHaveLength(batchPlan.total_batches);
  });
});

describe("join plan merge", () => {
  it("merges with two_query_merge and keep_first dedup", () => {
    const joinPlan: JoinPlan = {
      mode: "two_query_merge",
      left_request_id: "left",
      right_request_id: "right",
      join_keys: [{ left_key: "customer_id", right_key: "customer_id" }],
      join_type: "left",
      dedup_policy: "keep_first",
      missing_key_policy: "keep_null"
    };

    const leftRows = [
      { customer_id: "c1", orders: 5 },
      { customer_id: "c2", orders: 2 }
    ];

    const rightRows = [
      { customer_id: "c1", segment: "enterprise" },
      { customer_id: "c1", segment: "duplicate" }
    ];

    const merged = mergeWithJoinPlan(leftRows, rightRows, joinPlan);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ customer_id: "c1", segment: "enterprise" });
    expect(merged[1]).toMatchObject({ customer_id: "c2", orders: 2 });
  });
});

describe("analysis aggregation", () => {
  it("produces exec brief with fixed sections", () => {
    const analysis = analyzeBatch({
      request_id: "req_3",
      batch_index: 0,
      total_batches: 1,
      summary_word_budget: 150,
      insight_mode: "business",
      evidence_packet: {
        request_id: "req_3",
        batch_index: 0,
        total_batches: 1,
        rows: [{ metric: "revenue", value: 120 }],
        row_count: 1
      }
    });

    const brief = aggregateBatchAnalyses([analysis]);

    expect(brief.what_changed.length).toBeGreaterThan(0);
    expect(brief.why.length).toBeGreaterThan(0);
    expect(brief.so_what.length).toBeGreaterThan(0);
    expect(brief.what_to_do.length).toBeGreaterThan(0);
    expect(Array.isArray(brief.appendix_refs)).toBe(true);
  });
});