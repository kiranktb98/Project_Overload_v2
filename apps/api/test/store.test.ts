import { describe, expect, it } from "vitest";
import { InMemoryMetadataStore } from "../src/store/create-store";

describe("metadata store tenant + version state", () => {
  it("separates contracts by tenant and tracks versions", async () => {
    const store = new InMemoryMetadataStore();

    const contractA = await store.createReportContract(
      {
        id: "c_1",
        tenant_id: "tenant_a",
        name: "A",
        audience: "Ops",
        timezone: "UTC",
        schedule_cron: null,
        sql_template: "SELECT 1",
        metric_ids: [],
        dimension_ids: [],
        insight_mode: "business",
        delivery: { emails: [] },
        lifecycle_status: "draft",
        contract_version: 1,
        approved_by: null,
        approved_at: null,
        locked_by: null,
        locked_at: null,
        kpi_watchlist: [],
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: [],
          allowed_schemas: [],
          timeout_ms: 10000,
          deny_write: true
        }
      },
      { tenant_id: "tenant_a" }
    );
    await store.createReportContractVersion("c_1", contractA, "created", { tenant_id: "tenant_a" });

    await store.createReportContract(
      {
        ...contractA,
        id: "c_2",
        tenant_id: "tenant_b",
        name: "B"
      },
      { tenant_id: "tenant_b" }
    );

    const listA = await store.listReportContracts({ tenant_id: "tenant_a" });
    const listB = await store.listReportContracts({ tenant_id: "tenant_b" });
    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(1);
    expect(listA[0].id).toBe("c_1");
    expect(listB[0].id).toBe("c_2");

    const versions = await store.listReportContractVersions("c_1", { tenant_id: "tenant_a" });
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(1);

    await store.close();
  });

  it("persists and clears system state entries per tenant", async () => {
    const store = new InMemoryMetadataStore();

    await store.setSystemState(
      "runtime_connection_v1",
      { encrypted_connection_string: "x", encrypted_iv: "y", encrypted_tag: "z" },
      { tenant_id: "tenant_a" }
    );
    const stateA = await store.getSystemState("runtime_connection_v1", { tenant_id: "tenant_a" });
    const stateB = await store.getSystemState("runtime_connection_v1", { tenant_id: "tenant_b" });

    expect(stateA).not.toBeNull();
    expect(stateB).toBeNull();

    await store.setSystemState("runtime_connection_v1", null, { tenant_id: "tenant_a" });
    const cleared = await store.getSystemState("runtime_connection_v1", { tenant_id: "tenant_a" });
    expect(cleared).toBeNull();

    await store.close();
  });
});
