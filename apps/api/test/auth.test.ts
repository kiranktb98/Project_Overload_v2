import { afterEach, describe, expect, it } from "vitest";
import { createStubAnalystClient } from "@project-overload/llm-client";
import { buildApiApp } from "../src/app";
import { InMemoryMetadataStore } from "../src/store/create-store";

const ORIGINAL_AUTH_REQUIRED = process.env.API_AUTH_REQUIRED;
const ORIGINAL_AUTH_TOKEN = process.env.API_AUTH_TOKEN;

afterEach(() => {
  process.env.API_AUTH_REQUIRED = ORIGINAL_AUTH_REQUIRED;
  process.env.API_AUTH_TOKEN = ORIGINAL_AUTH_TOKEN;
});

describe("api auth guard", () => {
  it("blocks non-health routes when API auth is required", async () => {
    process.env.API_AUTH_REQUIRED = "true";
    process.env.API_AUTH_TOKEN = "test_key";

    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      analyst_client: createStubAnalystClient()
    });

    const unauthorized = await app.inject({
      method: "GET",
      url: "/report-contracts"
    });
    expect(unauthorized.statusCode).toBe(401);

    const authorized = await app.inject({
      method: "GET",
      url: "/report-contracts",
      headers: {
        "x-api-key": "test_key"
      }
    });
    expect(authorized.statusCode).toBe(200);

    await app.close();
  }, 30_000);
});
