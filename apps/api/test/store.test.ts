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
        scope_clarifications: [],
        prepared_query_overrides: [],
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

  it("scopes rag memory search to user and session", async () => {
    const store = new InMemoryMetadataStore();

    await store.upsertChatRagChunks(
      [
        {
          user_id: "user_a",
          session_id: "chat_1",
          source: "assistant_turn",
          label: "A1",
          text_content: "Revenue by month includes refunds.",
          content_hash: "h1",
          embedding: [0.9, 0.1]
        },
        {
          user_id: "user_a",
          session_id: "chat_2",
          source: "assistant_turn",
          label: "A2",
          text_content: "Inventory backlog summary.",
          content_hash: "h2",
          embedding: [0.1, 0.9]
        },
        {
          user_id: "user_b",
          session_id: "chat_1",
          source: "assistant_turn",
          label: "B1",
          text_content: "Other user memory.",
          content_hash: "h3",
          embedding: [1, 0]
        }
      ],
      { tenant_id: "tenant_a" }
    );

    const scoped = await store.searchChatRagChunks(
      {
        user_id: "user_a",
        session_id: "chat_1",
        embedding: [1, 0],
        limit: 5
      },
      { tenant_id: "tenant_a" }
    );

    expect(scoped).toHaveLength(1);
    expect(scoped[0].label).toBe("A1");

    await store.close();
  });
});
