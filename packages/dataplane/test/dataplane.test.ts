import { afterEach, describe, expect, it } from "vitest";
import {
  createDataPlaneFromEnv,
  LocalStubDataPlane,
  RemoteAgentDataPlane,
  type DataPlaneQueryResult
} from "../src";

describe("LocalStubDataPlane", () => {
  it("enforces SELECT-only", async () => {
    const dataPlane = new LocalStubDataPlane();

    await expect(
      dataPlane.execute({
        request_id: "req_1",
        sql: "UPDATE analytics.sales SET amount = 0",
        policy: {
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 1000,
          row_cap: 200,
          pii_fields: []
        }
      })
    ).rejects.toThrow();
  });

  it("enforces allowlist and masks pii", async () => {
    const dataPlane = new LocalStubDataPlane({
      row_provider: () => [
        { id: 1, customer_email: "user@example.com", amount: 100, region: "NA" },
        { id: 2, customer_email: "user2@example.com", amount: 50, region: "EU" }
      ]
    });

    const result = await dataPlane.execute({
      request_id: "req_2",
      sql: "SELECT * FROM analytics.sales",
      policy: {
        allowed_relations: ["analytics.sales"],
        allowed_schemas: ["analytics"],
        timeout_ms: 1000,
        row_cap: 200,
        pii_fields: ["customer_email"]
      }
    });

    expect(result.rows[0].customer_email).toBe("[REDACTED]");
    expect(result.audit_event.row_count).toBe(2);

    await expect(
      dataPlane.execute({
        request_id: "req_3",
        sql: "SELECT * FROM private.sales",
        policy: {
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 1000,
          row_cap: 200,
          pii_fields: []
        }
      })
    ).rejects.toThrow();
  });

  it("records audit events", async () => {
    const dataPlane = new LocalStubDataPlane({
      row_provider: () => [{ id: 1 }]
    });

    await dataPlane.execute({
      request_id: "req_4",
      sql: "SELECT * FROM analytics.sales",
      policy: {
        allowed_relations: ["analytics.sales"],
        allowed_schemas: ["analytics"],
        timeout_ms: 1000,
        row_cap: 200,
        pii_fields: []
      }
    });

    const events = dataPlane.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0].request_id).toBe("req_4");
  });
});

describe("RemoteAgentDataPlane", () => {
  it("sends governed request to remote agent", async () => {
    const expectedResult: DataPlaneQueryResult = {
      rows: [{ id: 1, amount: 10 }],
      row_count: 1,
      governed_sql: "SELECT * FROM analytics.sales LIMIT 200",
      audit_event: {
        request_id: "req_remote",
        sql: "SELECT * FROM analytics.sales",
        governed_sql: "SELECT * FROM analytics.sales LIMIT 200",
        row_count: 1,
        truncated: false,
        occurred_at: new Date().toISOString()
      }
    };

    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      return new Response(JSON.stringify(expectedResult), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    const dataPlane = new RemoteAgentDataPlane({
      base_url: "http://localhost:4100",
      api_key: "test_key",
      query_endpoint: "/v1/query",
      timeout_ms: 500,
      fetcher: mockFetch
    });

    const result = await dataPlane.execute({
      request_id: "req_remote",
      sql: "SELECT * FROM analytics.sales",
      policy: {
        allowed_relations: ["analytics.sales"],
        allowed_schemas: ["analytics"],
        timeout_ms: 1000,
        row_cap: 200,
        pii_fields: []
      }
    });

    expect(result.row_count).toBe(1);
    expect(String(calls[0].input)).toBe("http://localhost:4100/v1/query");
    expect(calls[0].init?.headers).toMatchObject({ Authorization: "Bearer test_key" });
    expect(dataPlane.getAuditEvents()).toHaveLength(1);
  });

  it("throws for non-2xx remote responses", async () => {
    const mockFetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ message: "upstream error" }), {
        status: 502,
        headers: { "content-type": "application/json" }
      });

    const dataPlane = new RemoteAgentDataPlane({
      base_url: "http://localhost:4100",
      fetcher: mockFetch,
      timeout_ms: 500
    });

    await expect(
      dataPlane.execute({
        request_id: "req_fail",
        sql: "SELECT * FROM analytics.sales",
        policy: {
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 1000,
          row_cap: 200,
          pii_fields: []
        }
      })
    ).rejects.toThrow("Remote Data Plane request failed");
  });
});

describe("createDataPlaneFromEnv", () => {
  afterEach(() => {
    delete process.env.DATAPLANE_MODE;
    delete process.env.DATAPLANE_AGENT_URL;
    delete process.env.DATAPLANE_AGENT_API_KEY;
    delete process.env.DATAPLANE_AGENT_QUERY_ENDPOINT;
    delete process.env.DATAPLANE_AGENT_TIMEOUT_MS;
  });

  it("returns local stub when mode is local", () => {
    process.env.DATAPLANE_MODE = "local";

    const dataPlane = createDataPlaneFromEnv();
    expect(dataPlane).toBeInstanceOf(LocalStubDataPlane);
  });

  it("returns remote agent client in hybrid mode with URL", () => {
    process.env.DATAPLANE_MODE = "hybrid";
    process.env.DATAPLANE_AGENT_URL = "http://localhost:4100";

    const dataPlane = createDataPlaneFromEnv();
    expect(dataPlane).toBeInstanceOf(RemoteAgentDataPlane);
  });

  it("falls back to local when hybrid mode has no URL", () => {
    process.env.DATAPLANE_MODE = "hybrid";
    delete process.env.DATAPLANE_AGENT_URL;

    const dataPlane = createDataPlaneFromEnv();
    expect(dataPlane).toBeInstanceOf(LocalStubDataPlane);
  });
});