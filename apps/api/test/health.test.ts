import { describe, expect, it } from "vitest";
import { createStubAnalystClient } from "@project-overload/llm-client";
import { buildApiApp } from "../src/app";
import { InMemoryMetadataStore } from "../src/store/create-store";

describe("api health", () => {
  it("returns ok", async () => {
    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      analyst_client: createStubAnalystClient()
    });

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "api" });

    await app.close();
  });
});
