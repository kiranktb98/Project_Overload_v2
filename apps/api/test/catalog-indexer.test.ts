import { describe, expect, it } from "vitest";
import {
  catalogAgentIndexTable,
  generateBusinessId,
  generateTableId
} from "../src/agents/catalog-indexer";

describe("catalog index agent", () => {
  it("generates stable table id for business + table", () => {
    const businessId = "biz_test_123";
    const tableIdA = generateTableId(businessId, "public.orders");
    const tableIdB = generateTableId(businessId, "public.orders");
    const tableIdC = generateTableId(businessId, "public.customers");

    expect(tableIdA).toBe(tableIdB);
    expect(tableIdA).toMatch(/^tbl_[a-f0-9]{16}$/);
    expect(tableIdA).not.toBe(tableIdC);
  });

  it("builds summary and table index from sample rows", () => {
    const output = catalogAgentIndexTable({
      business_id: "biz_demo",
      qualified_name: "public.orders",
      columns: [
        { column_name: "order_id", data_type: "integer" },
        { column_name: "customer_id", data_type: "integer" },
        { column_name: "status", data_type: "text" },
        { column_name: "region", data_type: "text" },
        { column_name: "created_at", data_type: "timestamp" }
      ],
      sample_rows: [
        {
          order_id: 101,
          customer_id: 9001,
          status: "completed",
          region: "NA"
        }
      ],
      low_cardinality_columns: [
        { column_name: "status", distinct_values: ["completed", "pending"] },
        { column_name: "region", distinct_values: ["NA", "EU"] }
      ]
    });

    expect(output.table_id).toMatch(/^tbl_[a-f0-9]{16}$/);
    expect(output.summary).toContain("public.orders");
    expect(output.summary).toContain("sampled row");
    expect(output.summary).toContain("Low-cardinality");
  });

  it("creates random business ids", () => {
    const a = generateBusinessId();
    const b = generateBusinessId();
    expect(a).toMatch(/^biz_[a-f0-9]{16}$/);
    expect(b).toMatch(/^biz_[a-f0-9]{16}$/);
    expect(a).not.toBe(b);
  });
});
