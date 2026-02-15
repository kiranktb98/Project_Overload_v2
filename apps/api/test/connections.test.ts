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
});
