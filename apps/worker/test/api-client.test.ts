import { describe, expect, it } from "vitest";
import { createWorkerApiClient } from "../src/api-client";

describe("worker api client", () => {
  it("lists report contracts through API", async () => {
    const calls: Array<{ url: string; method: string }> = [];

    const client = createWorkerApiClient({
      base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        calls.push({
          url,
          method: (init?.method ?? "GET").toUpperCase()
        });

        return new Response(
          JSON.stringify([
            {
              id: "contract_1",
              name: "Weekly report",
              audience: "CEO",
              timezone: "UTC",
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
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
    });

    const contracts = await client.listContracts();

    expect(contracts).toHaveLength(1);
    expect(contracts[0].id).toBe("contract_1");
    expect(calls).toEqual([{ url: "http://api.local/report-contracts", method: "GET" }]);
  });

  it("triggers contract run through API", async () => {
    let requestBody = "";
    const client = createWorkerApiClient({
      base_url: "http://api.local",
      fetch_impl: async (_input, init) => {
        requestBody = typeof init?.body === "string" ? init.body : "";
        return new Response(
          JSON.stringify({
            run_id: "run_123"
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
    });

    const run = await client.runContract("contract_1", {
      trigger: "retry",
      attempt: 2,
      retry_of_run_id: "run_old"
    });
    expect(run.run_id).toBe("run_123");
    expect(requestBody).toContain('"trigger":"retry"');
    expect(requestBody).toContain('"attempt":2');
    expect(requestBody).toContain('"retry_of_run_id":"run_old"');
  });

  it("throws with API message when run fails", async () => {
    const client = createWorkerApiClient({
      base_url: "http://api.local",
      fetch_impl: async () =>
        new Response(
          JSON.stringify({
            message: "Report contract not found"
          }),
          {
            status: 404,
            headers: { "content-type": "application/json" }
          }
        )
    });

    await expect(client.runContract("missing")).rejects.toThrow("Report contract not found");
  });
});
