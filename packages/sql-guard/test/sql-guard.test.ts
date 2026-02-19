import { describe, expect, it } from "vitest";
import {
  assertAllowlistedRelations,
  assertAllowlistedSchemas,
  assertSelectOnly,
  extractReferencedRelations,
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

  it("ignores CTE aliases and validates only base relations", () => {
    const sql = [
      "WITH expected AS (",
      "  SELECT generate_series(date_trunc('month', CURRENT_DATE) - interval '3 months', date_trunc('month', CURRENT_DATE), interval '1 month')::date AS month_start",
      "),",
      "observed AS (",
      "  SELECT date_trunc('month', order_date::timestamp)::date AS month_start",
      "  FROM public.demo_orders",
      "  WHERE order_date IS NOT NULL",
      ")",
      "SELECT COUNT(*)",
      "FROM expected",
      "LEFT JOIN observed USING (month_start)"
    ].join("\n");

    expect(() =>
      assertAllowlistedRelations(sql, ["public.demo_orders"])
    ).not.toThrow();
    expect(extractReferencedRelations(sql)).toEqual(["public.demo_orders"]);
  });

  it("extracts quoted schema.table identifiers", () => {
    const sql = 'SELECT SUM("total_amount") FROM "public"."demo_orders"';
    expect(extractReferencedRelations(sql)).toEqual(["public.demo_orders"]);
    expect(() =>
      assertAllowlistedRelations(sql, ["public.demo_orders"])
    ).not.toThrow();
  });

  it("ignores set-returning functions in FROM", () => {
    const sql = "SELECT day::date FROM generate_series(CURRENT_DATE - interval '6 days', CURRENT_DATE, interval '1 day') AS day";
    expect(extractReferencedRelations(sql)).toEqual([]);
  });
});
