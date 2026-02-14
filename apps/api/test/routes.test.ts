import { describe, expect, it } from "vitest";
import { LocalStubDataPlane } from "@project-overload/dataplane";
import { buildApiApp } from "../src/app";
import { InMemoryMetadataStore } from "../src/store/create-store";

describe("api semantic and run flow", () => {
  it("stores semantic objects, stores contracts, and runs manual contract", async () => {
    const store = new InMemoryMetadataStore();
    const dataPlane = new LocalStubDataPlane({
      row_provider: () =>
        Array.from({ length: 480 }, (_, index) => ({
          customer_id: `c_${(index % 12) + 1}`,
          customer_email: `c_${(index % 12) + 1}@example.com`,
          amount: (index % 20) + 1,
          region: ["NA", "EU", "APAC"][index % 3],
          order_id: `o_${index + 1}`
        }))
    });

    const app = await buildApiApp({ store, data_plane: dataPlane });

    const entityCreate = await app.inject({
      method: "POST",
      url: "/semantic/entities",
      payload: {
        id: "entity_customer",
        name: "Customer",
        description: "Customer table"
      }
    });

    expect(entityCreate.statusCode).toBe(201);

    const entityGet = await app.inject({
      method: "GET",
      url: "/semantic/entities/entity_customer"
    });

    expect(entityGet.statusCode).toBe(200);

    const contractCreate = await app.inject({
      method: "POST",
      url: "/report-contracts",
      payload: {
        id: "contract_weekly_ceo",
        name: "Weekly CEO report",
        audience: "CEO",
        timezone: "Asia/Kolkata",
        schedule_cron: "0 18 * * 5",
        sql_template: "SELECT * FROM analytics.sales",
        metric_ids: ["metric_revenue"],
        dimension_ids: ["region"],
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 10000,
          deny_write: true
        }
      }
    });

    expect(contractCreate.statusCode).toBe(201);

    const runContract = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_weekly_ceo/run"
    });

    expect(runContract.statusCode).toBe(200);

    const body = runContract.json();
    expect(body.exec_brief.what_changed.length).toBeGreaterThan(0);
    expect(body.exec_brief.why.length).toBeGreaterThan(0);
    expect(body.exec_brief.so_what.length).toBeGreaterThan(0);
    expect(body.exec_brief.what_to_do.length).toBeGreaterThan(0);
    expect(Array.isArray(body.exec_brief.appendix_refs)).toBe(true);

    await app.close();
  });

  it("accepts manual run request with empty JSON body", async () => {
    const store = new InMemoryMetadataStore();
    const dataPlane = new LocalStubDataPlane({
      row_provider: () =>
        Array.from({ length: 220 }, (_, index) => ({
          customer_id: `c_${(index % 8) + 1}`,
          customer_email: `c_${(index % 8) + 1}@example.com`,
          amount: (index % 15) + 1,
          region: ["NA", "EU", "APAC"][index % 3],
          order_id: `o_${index + 1}`
        }))
    });

    const app = await buildApiApp({ store, data_plane: dataPlane });

    const contractCreate = await app.inject({
      method: "POST",
      url: "/report-contracts",
      payload: {
        id: "contract_empty_json_body",
        name: "Empty JSON body run test",
        audience: "Ops",
        timezone: "UTC",
        schedule_cron: null,
        sql_template: "SELECT * FROM analytics.sales",
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 10000,
          deny_write: true
        }
      }
    });

    expect(contractCreate.statusCode).toBe(201);

    const runContract = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_empty_json_body/run",
      headers: {
        "content-type": "application/json"
      }
    });

    expect(runContract.statusCode).toBe(200);
    const body = runContract.json();
    expect(body.run_id).toBeDefined();
    expect(body.exec_brief.what_changed.length).toBeGreaterThan(0);

    await app.close();
  });
});
