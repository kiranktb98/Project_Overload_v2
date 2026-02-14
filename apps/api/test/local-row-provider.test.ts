import { describe, expect, it } from "vitest";
import {
  createLocalRowProviderFromEnv,
  parseLocalRowSource
} from "../src/dataplane/local-row-provider";

describe("local row provider", () => {
  it("defaults to synthetic source and returns deterministic rows", async () => {
    const runtime = createLocalRowProviderFromEnv({});

    expect(runtime.source).toBe("synthetic");
    const rows = await runtime.row_provider("SELECT * FROM analytics.sales LIMIT 5");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].order_id).toBe("order_1");
    await runtime.close();
  });

  it("falls back to synthetic when postgres source has no connection string", async () => {
    const runtime = createLocalRowProviderFromEnv({
      DATAPLANE_LOCAL_SOURCE: "postgres"
    });

    expect(runtime.source).toBe("synthetic");
    await runtime.close();
  });

  it("parses local row source values safely", () => {
    expect(parseLocalRowSource(undefined)).toBe("synthetic");
    expect(parseLocalRowSource("synthetic")).toBe("synthetic");
    expect(parseLocalRowSource("postgres")).toBe("postgres");
    expect(parseLocalRowSource("unknown-source")).toBe("synthetic");
  });
});
