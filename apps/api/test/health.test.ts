import { describe, expect, it } from "vitest";
import { buildApiApp } from "../src/app";

describe("api health", () => {
  it("returns ok", async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "api" });

    await app.close();
  });
});