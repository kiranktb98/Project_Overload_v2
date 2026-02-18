import { describe, expect, it } from "vitest";
import { LocalStubDataPlane } from "@project-overload/dataplane";
import {
  createStubAnalystClient,
  createStubPlannerClient,
  createStubQueryStrategistClient,
  createStubReportComposerClient
} from "@project-overload/llm-client";
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

    const app = await buildApiApp({
      store,
      data_plane: dataPlane,
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

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
    expect(typeof body.pdf_path).toBe("string");
    expect(typeof body.concise_summary).toBe("string");
    expect(Array.isArray(body.prepared_payloads)).toBe(true);
    expect(body.token_usage).toBeDefined();
    expect(body.exec_brief.what_changed.length).toBeGreaterThan(0);
    expect(body.exec_brief.why.length).toBeGreaterThan(0);
    expect(body.exec_brief.so_what.length).toBeGreaterThan(0);
    expect(body.exec_brief.what_to_do.length).toBeGreaterThan(0);
    expect(Array.isArray(body.exec_brief.appendix_refs)).toBe(true);
    expect(body.delivery).toBeDefined();
    expect(typeof body.delivery.status).toBe("string");

    const runPdf = await app.inject({
      method: "GET",
      url: `/report-runs/${body.run_id}/pdf`
    });

    expect(runPdf.statusCode).toBe(200);
    expect(runPdf.headers["content-type"]).toContain("application/pdf");

    const contractRuns = await app.inject({
      method: "GET",
      url: "/report-contracts/contract_weekly_ceo/runs"
    });
    expect(contractRuns.statusCode).toBe(200);
    expect(contractRuns.json()).toHaveLength(1);

    const prepare = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_weekly_ceo/prepare"
    });
    expect(prepare.statusCode).toBe(200);
    expect(Array.isArray(prepare.json().prepared_payloads)).toBe(true);

    const qa = await app.inject({
      method: "POST",
      url: `/report-runs/${body.run_id}/qa`,
      payload: {
        question: "What changed?"
      }
    });
    expect(qa.statusCode).toBe(200);
    expect(typeof qa.json().answer).toBe("string");

    const saveRun = await app.inject({
      method: "POST",
      url: `/report-runs/${body.run_id}/save`
    });
    expect(saveRun.statusCode).toBe(200);
    expect(saveRun.json().saved).toBe(true);

    const lockContract = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_weekly_ceo/lock"
    });
    expect(lockContract.statusCode).toBe(200);

    const scheduleRun = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_weekly_ceo/schedule",
      payload: {
        frequency: "weekly",
        day_of_week: 1,
        hour_utc: 9,
        minute_utc: 0
      }
    });
    expect(scheduleRun.statusCode).toBe(200);
    expect(scheduleRun.json().schedule_cron).toBe("0 9 * * 1");

    await app.close();
  }, 20000);

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

    const app = await buildApiApp({
      store,
      data_plane: dataPlane,
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

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

  it("requires lock before scheduling and stores lifecycle versions", async () => {
    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => [] }),
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    const create = await app.inject({
      method: "POST",
      url: "/report-contracts",
      payload: {
        id: "contract_lifecycle",
        name: "Lifecycle Contract",
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
    expect(create.statusCode).toBe(201);

    const scheduleBeforeLock = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_lifecycle/schedule",
      payload: {
        frequency: "weekly",
        day_of_week: 1
      }
    });
    expect(scheduleBeforeLock.statusCode).toBe(409);

    const scheduledRunBeforeLock = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_lifecycle/run",
      payload: {
        trigger: "scheduled"
      }
    });
    expect(scheduledRunBeforeLock.statusCode).toBe(409);

    const approve = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_lifecycle/approve"
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().lifecycle_status).toBe("approved");

    const lock = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_lifecycle/lock"
    });
    expect(lock.statusCode).toBe(200);
    expect(lock.json().lifecycle_status).toBe("locked");

    const scheduleAfterLock = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_lifecycle/schedule",
      payload: {
        frequency: "monthly",
        day_of_month: 15
      }
    });
    expect(scheduleAfterLock.statusCode).toBe(200);

    const versions = await app.inject({
      method: "GET",
      url: "/report-contracts/contract_lifecycle/versions"
    });
    expect(versions.statusCode).toBe(200);
    expect(Array.isArray(versions.json())).toBe(true);
    expect(versions.json().length).toBeGreaterThanOrEqual(3);

    await app.close();
  });

  it("isolates report contracts by tenant header", async () => {
    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => [] }),
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    await app.inject({
      method: "POST",
      url: "/report-contracts",
      headers: { "x-tenant-id": "tenant_a" },
      payload: {
        id: "contract_tenant_a",
        name: "Tenant A Contract",
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

    await app.inject({
      method: "POST",
      url: "/report-contracts",
      headers: { "x-tenant-id": "tenant_b" },
      payload: {
        id: "contract_tenant_b",
        name: "Tenant B Contract",
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

    const listA = await app.inject({
      method: "GET",
      url: "/report-contracts",
      headers: { "x-tenant-id": "tenant_a" }
    });
    expect(listA.statusCode).toBe(200);
    expect(listA.json()).toHaveLength(1);
    expect(listA.json()[0].id).toBe("contract_tenant_a");

    const listB = await app.inject({
      method: "GET",
      url: "/report-contracts",
      headers: { "x-tenant-id": "tenant_b" }
    });
    expect(listB.statusCode).toBe(200);
    expect(listB.json()).toHaveLength(1);
    expect(listB.json()[0].id).toBe("contract_tenant_b");

    await app.close();
  });
});
