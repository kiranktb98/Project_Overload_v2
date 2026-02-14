import { describe, expect, it } from "vitest";
import {
  assertAllowlistedRelations,
  assertAllowlistedSchemas,
  assertSelectOnly,
  ensureLimit,
  SqlGuardError
} from "../src";

describe("assertSelectOnly", () => {
  it("allows SELECT", () => {
    expect(() => assertSelectOnly("SELECT * FROM analytics.sales")).not.toThrow();
  });

  it("allows CTE SELECT", () => {
    expect(() =>
      assertSelectOnly("WITH q AS (SELECT 1 as x) SELECT * FROM q")
    ).not.toThrow();
  });

  it("rejects write statements", () => {
    expect(() => assertSelectOnly("DELETE FROM analytics.sales")).toThrow(SqlGuardError);
  });
});

describe("ensureLimit", () => {
  it("adds limit when absent", () => {
    expect(ensureLimit("SELECT * FROM analytics.sales", 200)).toBe(
      "SELECT * FROM analytics.sales LIMIT 200"
    );
  });

  it("tightens oversized limit", () => {
    expect(ensureLimit("SELECT * FROM analytics.sales LIMIT 1000", 200)).toBe(
      "SELECT * FROM analytics.sales LIMIT 200"
    );
  });

  it("keeps stricter existing limit", () => {
    expect(ensureLimit("SELECT * FROM analytics.sales LIMIT 50", 200)).toBe(
      "SELECT * FROM analytics.sales LIMIT 50"
    );
  });
});

describe("allowlist checks", () => {
  it("allows listed relations", () => {
    expect(() =>
      assertAllowlistedRelations("SELECT * FROM analytics.sales", ["analytics.sales"])
    ).not.toThrow();
  });

  it("rejects unlisted relations", () => {
    expect(() =>
      assertAllowlistedRelations("SELECT * FROM analytics.customers", ["analytics.sales"])
    ).toThrow(SqlGuardError);
  });

  it("enforces schema allowlist", () => {
    expect(() =>
      assertAllowlistedSchemas("SELECT * FROM analytics.sales", ["analytics"])
    ).not.toThrow();

    expect(() =>
      assertAllowlistedSchemas("SELECT * FROM private.sales", ["analytics"])
    ).toThrow(SqlGuardError);
  });
});