import { describe, expect, it } from "vitest";
import { createStubAnalystClient } from "@project-overload/llm-client";
import { buildApiApp } from "../src/app";
import { InMemoryMetadataStore } from "../src/store/create-store";

describe("api connection routes", () => {
  it("returns connection context and runs safe SELECT queries", async () => {
    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      analyst_client: createStubAnalystClient()
    });

    const context = await app.inject({
      method: "GET",
      url: "/connections/active"
    });

    expect(context.statusCode).toBe(200);
    expect(typeof context.json().connected).toBe("boolean");

    const query = await app.inject({
      method: "POST",
      url: "/connections/query",
      payload: {
        sql: "SELECT * FROM analytics.sales",
        limit: 25
      }
    });

    expect(query.statusCode).toBe(200);
    const body = query.json();
    expect(body.row_count).toBeLessThanOrEqual(25);
    expect(body.governed_sql.toLowerCase()).toContain("limit 25");
    expect(Array.isArray(body.rows)).toBe(true);

    const logs = await app.inject({
      method: "GET",
      url: "/connections/query-logs"
    });
    expect(logs.statusCode).toBe(200);
    expect(Array.isArray(logs.json().logs)).toBe(true);
    expect(logs.json().logs.length).toBeGreaterThan(0);

    const fix = await app.inject({
      method: "POST",
      url: "/connections/fix-script",
      payload: {
        allowlisted_relations: ["analytics.sales"]
      }
    });
    expect(fix.statusCode).toBe(200);
    expect(typeof fix.json().script).toBe("string");
    expect(fix.json().script.toLowerCase()).toContain("grant select");

    await app.close();
  });

  it("blocks unsafe queries on connection module", async () => {
    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      analyst_client: createStubAnalystClient()
    });

    const query = await app.inject({
      method: "POST",
      url: "/connections/query",
      payload: {
        sql: "DELETE FROM analytics.sales"
      }
    });

    expect(query.statusCode).toBe(400);
    expect(query.json().message.toLowerCase()).toContain("select");

    await app.close();
  });

  it("accepts cloud connector providers and returns provider-specific validation errors", async () => {
    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      analyst_client: createStubAnalystClient()
    });

    const snowflakeResult = await app.inject({
      method: "POST",
      url: "/connections/test",
      payload: {
        provider: "snowflake",
        connection_string: "snowflake://"
      }
    });

    expect(snowflakeResult.statusCode).toBe(400);
    expect(snowflakeResult.json().message.toLowerCase()).toContain("account");

    const bigQueryResult = await app.inject({
      method: "POST",
      url: "/connections/test",
      payload: {
        provider: "bigquery",
        connection_string: "bigquery://"
      }
    });

    expect(bigQueryResult.statusCode).toBe(400);
    expect(bigQueryResult.json().message.toLowerCase()).toContain("project id");

    await app.close();
  });

  it("supports Power BI semantic connections and keeps SQL query mode disabled", async () => {
    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      analyst_client: createStubAnalystClient()
    });

    const connectionString = [
      "powerbi+semantic://finance-workspace/executive-model",
      "?workspace_name=Finance",
      "&model_name=Executive%20P%26L",
      "&entities=Sales",
      "&measures=Revenue,Margin",
      "&dimensions=Region,Month",
      "&preview_rows_json=%5B%7B%22Region%22%3A%22NA%22%2C%22Revenue%22%3A1250%7D%5D"
    ].join("");

    const testResult = await app.inject({
      method: "POST",
      url: "/connections/test",
      payload: {
        provider: "powerbi_semantic",
        connection_string: connectionString
      }
    });

    expect(testResult.statusCode).toBe(200);
    expect(testResult.json().provider).toBe("powerbi_semantic");

    const connectResult = await app.inject({
      method: "POST",
      url: "/connections/connect",
      payload: {
        provider: "powerbi_semantic",
        name: "Finance semantic model",
        connection_string: connectionString
      }
    });

    expect(connectResult.statusCode).toBe(200);
    expect(connectResult.json().provider).toBe("powerbi_semantic");
    expect(connectResult.json().query_family).toBe("powerbi_semantic");

    const queryResult = await app.inject({
      method: "POST",
      url: "/connections/query",
      payload: {
        sql: "SELECT * FROM semantic.sales",
        limit: 25
      }
    });

    expect(queryResult.statusCode).toBe(400);
    expect(queryResult.json().message).toMatch(/semantic planner\/executor path/i);

    await app.close();
  });
});
