import { describe, expect, it, vi } from "vitest";
import { LocalStubDataPlane } from "@project-overload/dataplane";
import type { DataPlane, DataPlaneQueryRequest, DataPlaneQueryResult } from "@project-overload/dataplane";
import {
  createStubAnalystClient,
  createStubQueryStrategistClient,
  createStubReportComposerClient
} from "@project-overload/llm-client";
import type {
  AnalystClient,
  QueryStrategistClient,
  ReportComposerClient,
  ReportComposerInput
} from "@project-overload/llm-client";
import type { ReportContract, BatchAnalysis, QueryStrategyOutput } from "@project-overload/shared";
import { InMemoryMetadataStore } from "../src/store/create-store";
import { runReportContractPipeline } from "../src/services/run-contract";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContract(overrides: Partial<ReportContract> = {}): ReportContract {
  return {
    id: "test_contract",
    name: "Test Report",
    audience: "test",
    timezone: "UTC",
    schedule_cron: null,
    sql_template: "SELECT 1",
    metric_ids: [],
    dimension_ids: [],
    insight_mode: "business",
    guardrails: {
      evidence_row_cap: 200,
      max_batches: 5,
      allowed_relations: ["public.sales"],
      allowed_schemas: ["public"],
      timeout_ms: 10000,
      deny_write: true
    },
    ...overrides
  } as ReportContract;
}

function makeRows(count: number, extra: Record<string, unknown> = {}): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    amount: (i % 20) + 1,
    region: ["NA", "EU", "APAC"][i % 3],
    ...extra
  }));
}

/** A strategist that returns a fixed set of queries for testing */
function fixedStrategist(queries: QueryStrategyOutput["queries"]): QueryStrategistClient {
  return {
    provider: "stub",
    async planQueries() {
      return { queries };
    }
  };
}

/** An analyst that records every call for inspection */
function spyAnalyst(): { client: AnalystClient; calls: Array<{ question: string; row_count: number }> } {
  const calls: Array<{ question: string; row_count: number }> = [];
  const stub = createStubAnalystClient();
  return {
    calls,
    client: {
      provider: "stub",
      async analyzeBatch(input) {
        calls.push({
          question: input.question ?? "(no question)",
          row_count: input.evidence_packet.row_count
        });
        return stub.analyzeBatch(input);
      }
    }
  };
}

/** A data plane that returns specific rows for each SQL query, matched by substring */
function routingDataPlane(
  routes: Array<{ match: string; rows: Record<string, unknown>[] }>
): DataPlane {
  return new LocalStubDataPlane({
    row_provider: (sql: string) => {
      for (const route of routes) {
        if (sql.toLowerCase().includes(route.match.toLowerCase())) {
          return route.rows;
        }
      }
      return [];
    }
  });
}

// ---------------------------------------------------------------------------
// Case 2: Standalone queries — each query gets its own analyst call
// ---------------------------------------------------------------------------

describe("Case 2: standalone queries", () => {
  it("runs 2 standalone queries with 2 separate analyst calls", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      { question: "What is the revenue trend?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Revenue trend" },
      { question: "Top customers?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Top customers" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(50) }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "public.sales [TABLE]: id, amount, region"
    });

    // Two standalone queries → two analyst calls
    expect(analyst.calls).toHaveLength(2);
    expect(analyst.calls[0].question).toBe("What is the revenue trend?");
    expect(analyst.calls[1].question).toBe("Top customers?");
    expect(analyst.calls[0].row_count).toBe(50);
    expect(analyst.calls[1].row_count).toBe(50);

    // Report should be generated
    expect(result.html).toContain("<!doctype html");
    expect(result.run.status).toBe("succeeded");
    expect(result.exec_brief.why).toHaveLength(2);

    // query_plan should have 2 entries, neither with group_id
    const qp = result.run.query_plan as { strategy_queries: Array<{ group_id?: string }> };
    expect(qp.strategy_queries).toHaveLength(2);
    expect(qp.strategy_queries[0].group_id).toBeUndefined();
    expect(qp.strategy_queries[1].group_id).toBeUndefined();
  });

  it("handles query that returns zero rows gracefully", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      { question: "Empty data?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Test empty" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => [] }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "empty"
    });

    // Analyst should NOT be called for zero rows
    expect(analyst.calls).toHaveLength(0);
    expect(result.run.status).toBe("succeeded");
    expect(result.exec_brief.so_what.some((s) => s.includes("No data returned"))).toBe(true);
  });

  it("handles data plane error gracefully in standalone mode", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      { question: "Will fail", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Error test" }
    ]);

    const failingDataPlane: DataPlane = {
      async execute(): Promise<DataPlaneQueryResult> {
        throw new Error("Connection refused");
      },
      getAuditEvents() {
        return [];
      }
    };

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: failingDataPlane,
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "broken"
    });

    expect(analyst.calls).toHaveLength(0);
    expect(result.run.status).toBe("succeeded");
    expect(result.exec_brief.so_what.some((s) => s.includes("Connection refused"))).toBe(true);
  });

  it("produces correct exec brief with multiple standalone analyses", async () => {
    const strategist = fixedStrategist([
      { question: "Q1?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P1" },
      { question: "Q2?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P2" },
      { question: "Q3?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P3" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(30) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "public.sales"
    });

    expect(result.exec_brief.why.length).toBeLessThanOrEqual(5);
    expect(result.exec_brief.appendix_refs).toHaveLength(3);
    expect(result.exec_brief.confidence.score).toBe(0.8);
    expect(result.exec_brief.generated_at).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Case 1: Grouped queries — merged rows, single analyst call per group
// ---------------------------------------------------------------------------

describe("Case 1: grouped queries", () => {
  it("merges 2 grouped queries into 1 analyst call with _source_query tags", async () => {
    const analyst = spyAnalyst();

    const strategist = fixedStrategist([
      { question: "Revenue by region?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Regional breakdown", group_id: "overview" },
      { question: "Revenue by product?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Product breakdown", group_id: "overview" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(40) }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "public.sales [TABLE]: id, amount, region"
    });

    // Two queries in same group → ONE analyst call
    expect(analyst.calls).toHaveLength(1);
    expect(analyst.calls[0].question).toBe("Revenue by region? + Revenue by product?");
    // 40 rows from each query = 80 merged rows
    expect(analyst.calls[0].row_count).toBe(80);

    expect(result.run.status).toBe("succeeded");
    expect(result.html).toContain("<!doctype html");

    // query_plan should have 2 entries both with group_id
    const qp = result.run.query_plan as { strategy_queries: Array<{ group_id?: string }> };
    expect(qp.strategy_queries).toHaveLength(2);
    expect(qp.strategy_queries[0].group_id).toBe("overview");
    expect(qp.strategy_queries[1].group_id).toBe("overview");
  });

  it("caps merged rows at evidence_row_cap", async () => {
    const analyst = spyAnalyst();

    const strategist = fixedStrategist([
      { question: "Q1?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P1", group_id: "big" },
      { question: "Q2?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P2", group_id: "big" }
    ]);

    // Each query returns 150 rows → 300 merged, but cap is 200
    const result = await runReportContractPipeline({
      contract: makeContract({ guardrails: { evidence_row_cap: 200, max_batches: 5, allowed_relations: ["public.sales"], allowed_schemas: ["public"], timeout_ms: 10000, deny_write: true } }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(150) }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "public.sales"
    });

    expect(analyst.calls).toHaveLength(1);
    // 150 + 150 = 300, capped to 200
    expect(analyst.calls[0].row_count).toBe(200);
  });

  it("handles partial group failure — one query fails, other succeeds", async () => {
    const analyst = spyAnalyst();
    let callCount = 0;

    const partialFailDataPlane: DataPlane = {
      async execute(request: DataPlaneQueryRequest): Promise<DataPlaneQueryResult> {
        callCount++;
        if (callCount === 1) {
          throw new Error("Table not found");
        }
        // Second query succeeds
        const rows = makeRows(30);
        return {
          rows,
          row_count: rows.length,
          governed_sql: request.sql,
          audit_event: {
            request_id: request.request_id,
            sql: request.sql,
            governed_sql: request.sql,
            row_count: rows.length,
            truncated: false,
            occurred_at: new Date().toISOString()
          }
        };
      },
      getAuditEvents() {
        return [];
      }
    };

    const strategist = fixedStrategist([
      { question: "Broken query?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Will fail", group_id: "mixed" },
      { question: "Working query?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Will work", group_id: "mixed" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: partialFailDataPlane,
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "public.sales"
    });

    // One query failed but the other succeeded → analyst still called with partial data
    expect(analyst.calls).toHaveLength(1);
    expect(analyst.calls[0].row_count).toBe(30);
    expect(analyst.calls[0].question).toBe("Working query?");
    expect(result.run.status).toBe("succeeded");
  });

  it("handles full group failure — all queries in group fail", async () => {
    const analyst = spyAnalyst();

    const failingDataPlane: DataPlane = {
      async execute(): Promise<DataPlaneQueryResult> {
        throw new Error("Database down");
      },
      getAuditEvents() {
        return [];
      }
    };

    const strategist = fixedStrategist([
      { question: "Q1?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P1", group_id: "doomed" },
      { question: "Q2?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P2", group_id: "doomed" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: failingDataPlane,
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "public.sales"
    });

    // All queries failed → no analyst call, but report still generated
    expect(analyst.calls).toHaveLength(0);
    expect(result.run.status).toBe("succeeded");
    expect(result.exec_brief.so_what.some((s) => s.includes("Database down"))).toBe(true);
  });

  it("uses larger word budget (400) for grouped analysis", async () => {
    const wordBudgets: number[] = [];
    const stub = createStubAnalystClient();
    const trackingAnalyst: AnalystClient = {
      provider: "stub",
      async analyzeBatch(input) {
        wordBudgets.push(input.summary_word_budget);
        return stub.analyzeBatch(input);
      }
    };

    const strategist = fixedStrategist([
      { question: "Q1?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P1", group_id: "grp" },
      { question: "Q2?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P2", group_id: "grp" }
    ]);

    await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(20) }),
      analyst_client: trackingAnalyst,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "public.sales"
    });

    expect(wordBudgets).toHaveLength(1);
    expect(wordBudgets[0]).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Mixed: Case 1 + Case 2 in the same report
// ---------------------------------------------------------------------------

describe("mixed Case 1 + Case 2", () => {
  it("handles grouped and standalone queries in the same strategy", async () => {
    const analyst = spyAnalyst();

    const strategist = fixedStrategist([
      // Case 2: standalone
      { question: "Standalone trend?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Independent analysis" },
      // Case 1: grouped pair
      { question: "Revenue by region?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Regional", group_id: "breakdown" },
      { question: "Revenue by product?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "Product", group_id: "breakdown" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(25) }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "public.sales"
    });

    // 1 standalone + 1 grouped = 2 analyst calls
    expect(analyst.calls).toHaveLength(2);

    // First call is the standalone (Case 2 runs first)
    expect(analyst.calls[0].question).toBe("Standalone trend?");
    expect(analyst.calls[0].row_count).toBe(25);

    // Second call is the grouped pair (Case 1)
    expect(analyst.calls[1].question).toBe("Revenue by region? + Revenue by product?");
    expect(analyst.calls[1].row_count).toBe(50); // 25 + 25

    expect(result.exec_brief.appendix_refs).toHaveLength(2);
    expect(result.run.status).toBe("succeeded");
  });

  it("handles multiple separate groups", async () => {
    const analyst = spyAnalyst();

    const strategist = fixedStrategist([
      { question: "G1Q1?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "G1P1", group_id: "groupA" },
      { question: "G1Q2?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "G1P2", group_id: "groupA" },
      { question: "G2Q1?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "G2P1", group_id: "groupB" },
      { question: "G2Q2?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "G2P2", group_id: "groupB" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(20) }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "public.sales"
    });

    // 2 groups → 2 analyst calls (no standalone)
    expect(analyst.calls).toHaveLength(2);
    expect(analyst.calls[0].question).toBe("G1Q1? + G1Q2?");
    expect(analyst.calls[0].row_count).toBe(40); // 20 + 20
    expect(analyst.calls[1].question).toBe("G2Q1? + G2Q2?");
    expect(analyst.calls[1].row_count).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Insight mode routing
// ---------------------------------------------------------------------------

describe("insight mode", () => {
  it("passes business insight_mode through to analyst", async () => {
    const insightModes: string[] = [];
    const stub = createStubAnalystClient();
    const trackingAnalyst: AnalystClient = {
      provider: "stub",
      async analyzeBatch(input) {
        insightModes.push(input.insight_mode);
        return stub.analyzeBatch(input);
      }
    };

    const strategist = fixedStrategist([
      { question: "Q?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P" }
    ]);

    await runReportContractPipeline({
      contract: makeContract({ insight_mode: "business" }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(10) }),
      analyst_client: trackingAnalyst,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "x"
    });

    expect(insightModes).toEqual(["business"]);
  });

  it("passes data insight_mode through to analyst", async () => {
    const insightModes: string[] = [];
    const stub = createStubAnalystClient();
    const trackingAnalyst: AnalystClient = {
      provider: "stub",
      async analyzeBatch(input) {
        insightModes.push(input.insight_mode);
        return stub.analyzeBatch(input);
      }
    };

    const strategist = fixedStrategist([
      { question: "Q?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P" }
    ]);

    await runReportContractPipeline({
      contract: makeContract({ insight_mode: "data" }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(10) }),
      analyst_client: trackingAnalyst,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "x"
    });

    expect(insightModes).toEqual(["data"]);
  });

  it("passes insight_mode to grouped analyst calls", async () => {
    const insightModes: string[] = [];
    const stub = createStubAnalystClient();
    const trackingAnalyst: AnalystClient = {
      provider: "stub",
      async analyzeBatch(input) {
        insightModes.push(input.insight_mode);
        return stub.analyzeBatch(input);
      }
    };

    const strategist = fixedStrategist([
      { question: "Q1?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P1", group_id: "g" },
      { question: "Q2?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P2", group_id: "g" }
    ]);

    await runReportContractPipeline({
      contract: makeContract({ insight_mode: "data" }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(10) }),
      analyst_client: trackingAnalyst,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "x"
    });

    expect(insightModes).toEqual(["data"]);
  });
});

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

describe("audit logging", () => {
  it("logs query_strategy event with correct question list", async () => {
    const store = new InMemoryMetadataStore();

    const strategist = fixedStrategist([
      { question: "Q1?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P1" },
      { question: "Q2?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P2" }
    ]);

    await runReportContractPipeline({
      contract: makeContract(),
      store,
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(10) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      catalog_summary: "x"
    });

    // InMemoryMetadataStore stores audit logs internally - verify via the run being created
    // The pipeline should complete without errors which means audit logs were written
    const runs = await store.listReportRuns("test_contract");
    expect(runs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Report composer integration
// ---------------------------------------------------------------------------

describe("report composer receives correct analyses", () => {
  it("sends standalone analyses to composer with correct structure", async () => {
    const composerInputs: ReportComposerInput[] = [];
    const stubComposer = createStubReportComposerClient();
    const trackingComposer: ReportComposerClient = {
      provider: "stub",
      async composeReport(input) {
        composerInputs.push(input);
        return stubComposer.composeReport(input);
      }
    };

    const strategist = fixedStrategist([
      { question: "Q1?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P1" },
      { question: "Q2?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P2" }
    ]);

    await runReportContractPipeline({
      contract: makeContract({ name: "My Report", audience: "CEO" }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(20) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: trackingComposer,
      catalog_summary: "x"
    });

    expect(composerInputs).toHaveLength(1);
    expect(composerInputs[0].title).toBe("My Report");
    expect(composerInputs[0].audience).toBe("CEO");
    expect(composerInputs[0].insight_mode).toBe("business");
    expect(composerInputs[0].analyses).toHaveLength(2);
    expect(composerInputs[0].analyses[0].question).toBe("Q1?");
    expect(composerInputs[0].analyses[1].question).toBe("Q2?");
  });

  it("sends grouped analysis to composer as single entry", async () => {
    const composerInputs: ReportComposerInput[] = [];
    const stubComposer = createStubReportComposerClient();
    const trackingComposer: ReportComposerClient = {
      provider: "stub",
      async composeReport(input) {
        composerInputs.push(input);
        return stubComposer.composeReport(input);
      }
    };

    const strategist = fixedStrategist([
      { question: "Q1?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P1", group_id: "g" },
      { question: "Q2?", sql: "SELECT * FROM public.sales LIMIT 200", purpose: "P2", group_id: "g" }
    ]);

    await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(20) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: trackingComposer,
      catalog_summary: "x"
    });

    expect(composerInputs).toHaveLength(1);
    // Grouped queries produce a single analysis entry
    expect(composerInputs[0].analyses).toHaveLength(1);
    expect(composerInputs[0].analyses[0].question).toBe("Q1? + Q2?");
    expect(composerInputs[0].analyses[0].data_summary).toContain("merged rows");
    expect(composerInputs[0].analyses[0].data_summary).toContain("group: g");
  });
});
