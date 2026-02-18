import { describe, expect, it } from "vitest";
import { LocalStubDataPlane } from "@project-overload/dataplane";
import type { DataPlane } from "@project-overload/dataplane";
import {
  createStubAnalystClient,
  createStubPlannerClient,
  createStubReportComposerClient
} from "@project-overload/llm-client";
import type { AnalystClient, QueryStrategistClient } from "@project-overload/llm-client";
import type { QueryStrategyOutput, ReportContract } from "@project-overload/shared";
import { InMemoryMetadataStore } from "../src/store/create-store";
import {
  answerRunPayloadQuestion,
  prepareReportContractData,
  runReportContractPipeline
} from "../src/services/run-contract";

function makeContract(overrides: Partial<ReportContract> = {}): ReportContract {
  return {
    id: "test_contract",
    tenant_id: "default",
    name: "Test Report",
    audience: "Executive",
    timezone: "UTC",
    schedule_cron: null,
    sql_template: "SELECT 1",
    metric_ids: [],
    dimension_ids: [],
    insight_mode: "business",
    delivery: {
      emails: []
    },
    lifecycle_status: "draft",
    contract_version: 1,
    approved_at: null,
    approved_by: null,
    locked_at: null,
    locked_by: null,
    guardrails: {
      evidence_row_cap: 200,
      max_batches: 5,
      allowed_relations: ["public.sales"],
      allowed_schemas: ["public"],
      timeout_ms: 10_000,
      deny_write: true
    },
    ...overrides
  };
}

function makeRows(count: number, extra: Record<string, unknown> = {}): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: idx + 1,
    amount: (idx % 40) + 1,
    region: ["NA", "EU", "APAC"][idx % 3],
    event_time: new Date(Date.UTC(2025, idx % 12, 1)).toISOString(),
    ...extra
  }));
}

function fixedStrategist(queries: QueryStrategyOutput["queries"]): QueryStrategistClient {
  return {
    provider: "stub",
    async planQueries() {
      return { queries };
    }
  };
}

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

describe("run pipeline", () => {
  it("merges grouped queries into one question payload and one analyst call", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      { question: "Revenue by region?", sql: "SELECT * FROM public.sales", purpose: "Regional view", group_id: "overview" },
      { question: "Revenue by product?", sql: "SELECT * FROM public.sales", purpose: "Product view", group_id: "overview" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(120) }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(analyst.calls).toHaveLength(1);
    expect(analyst.calls[0].question).toContain("Q1.");
    expect(analyst.calls[0].question).toContain("Revenue by region?");
    expect(result.run.status).toBe("succeeded");
    expect(result.prepared_payloads).toHaveLength(1);
    expect(result.prepared_payloads[0].source_query_count).toBe(2);
  });

  it("enforces evidence cap <= 200 rows for analyst input after preparation", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      { question: "Large dataset question", sql: "SELECT * FROM public.sales", purpose: "Stress test" }
    ]);

    await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(950) }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(analyst.calls).toHaveLength(1);
    expect(analyst.calls[0].row_count).toBeLessThanOrEqual(200);
  });

  it("flags timeline gaps for requested month comparisons before analysis", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      {
        question: "Compare last 6 months vs prior 6 months for refund amount trends",
        sql: "SELECT event_time, amount AS refund_amount, region FROM public.sales",
        purpose: "6v6 refund comparison"
      }
    ]);

    const limitedMonthRows = Array.from({ length: 220 }, (_, index) => ({
      id: index + 1,
      refund_amount: (index % 20) + 1,
      region: ["NA", "EU"][index % 2],
      event_time: new Date(Date.UTC(2025, index % 4, 1)).toISOString()
    }));

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => limitedMonthRows }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(analyst.calls).toHaveLength(0);
    expect(result.prepared_payloads).toHaveLength(1);
    expect(result.prepared_payloads[0].validation?.expected_months).toBe(12);
    expect((result.prepared_payloads[0].validation?.missing_months.length ?? 0)).toBeGreaterThan(0);
    expect(result.exec_brief.what_changed.join(" ")).toMatch(/coverage warning/i);
  });

  it("runs full analysis when 6-vs-prior-6 months coverage is complete", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      {
        question: "Compare last 6 months vs prior 6 months for refund amount trends",
        sql: "SELECT event_time, amount AS refund_amount, region FROM public.sales",
        purpose: "6v6 refund comparison"
      }
    ]);

    const completeRows = Array.from({ length: 360 }, (_, index) => ({
      id: index + 1,
      refund_amount: (index % 40) + 10,
      region: ["NA", "EU", "APAC"][index % 3],
      event_time: new Date(Date.UTC(2025, index % 12, 1)).toISOString()
    }));

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => completeRows }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(analyst.calls).toHaveLength(1);
    expect(analyst.calls[0].question).toContain("Q1.");
    expect(result.prepared_payloads).toHaveLength(1);
    expect(result.prepared_payloads[0].validation?.expected_months).toBe(12);
    expect(result.prepared_payloads[0].validation?.observed_months).toBe(12);
    expect(result.prepared_payloads[0].validation?.missing_months).toHaveLength(0);
    expect(result.exec_brief.what_changed.join(" ")).not.toMatch(/coverage warning/i);
  });

  it("normalizes epoch microsecond timestamps into valid month keys during preparation", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      {
        question: "Compare last 6 months vs prior 6 months for refund amount trends",
        sql: "SELECT event_time_us, amount AS refund_amount, region FROM public.sales",
        purpose: "6v6 refund comparison"
      }
    ]);

    const rows = Array.from({ length: 360 }, (_, index) => {
      const monthOffset = index % 12;
      const monthMicros = Date.UTC(2025, monthOffset, 1) * 1_000;
      return {
        id: index + 1,
        refund_amount: (index % 40) + 10,
        region: ["NA", "EU", "APAC"][index % 3],
        event_time_us: monthMicros
      };
    });

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => rows }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(analyst.calls).toHaveLength(1);
    const validation = result.prepared_payloads[0].validation;
    expect(validation).toBeDefined();
    expect((validation?.monthly_row_counts ?? []).every((entry) => /^\d{4}-\d{2}$/.test(entry.month))).toBe(true);
    expect((validation?.monthly_metric_totals ?? []).every((entry) => /^\d{4}-\d{2}$/.test(entry.month))).toBe(true);
  });

  it("profiles sample rows and prefers true date columns over numeric ids for timeline checks", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      {
        question: "Compare last 3 months vs prior 3 months for refunds",
        sql: "SELECT order_date, ticket_id, amount AS refund_amount, region FROM public.sales",
        purpose: "3v3 refund comparison"
      }
    ]);

    const rows = Array.from({ length: 240 }, (_, index) => {
      const monthOffset = index % 6;
      return {
        id: index + 1,
        order_date: new Date(Date.UTC(2025, monthOffset, 1)).toISOString(),
        ticket_id: 1_700_000_000 + index * 2_592_000,
        refund_amount: (index % 35) + 1,
        region: ["NA", "EU", "APAC"][index % 3]
      };
    });

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => rows }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(analyst.calls).toHaveLength(1);
    const payload = result.prepared_payloads[0];
    expect(payload.validation?.expected_months).toBe(6);
    expect(payload.validation?.observed_months).toBe(6);
    expect(payload.validation?.missing_months).toHaveLength(0);
    expect(payload.preparation_notes.join(" ").toLowerCase()).toContain("temporal hints");
  });

  it("returns concise summary and token usage report", async () => {
    const strategist = fixedStrategist([
      { question: "Q1", sql: "SELECT * FROM public.sales", purpose: "Test" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(80) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(result.concise_summary).toContain("summary");
    expect(result.token_usage.input_tokens).toBeGreaterThanOrEqual(0);
    expect(result.token_usage.output_tokens).toBeGreaterThanOrEqual(0);
    expect(result.token_usage.total_tokens).toBeGreaterThanOrEqual(0);
  });

  it("computes deltas against previous run", async () => {
    const strategist = fixedStrategist([
      { question: "Q1", sql: "SELECT * FROM public.sales", purpose: "Test" }
    ]);
    const store = new InMemoryMetadataStore();
    let activeRows = makeRows(120);
    const dataPlane = new LocalStubDataPlane({ row_provider: () => activeRows });

    const firstRun = await runReportContractPipeline({
      contract: makeContract(),
      store,
      data_plane: dataPlane,
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });
    expect(firstRun.exec_brief.deltas_vs_last_run.length).toBeGreaterThan(0);

    activeRows = makeRows(45);
    const secondRun = await runReportContractPipeline({
      contract: makeContract(),
      store,
      data_plane: dataPlane,
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(secondRun.exec_brief.deltas_vs_last_run.some((line) => /prepared rows/i.test(line))).toBe(true);
  });
});

describe("data preparation", () => {
  it("prepares payloads and returns planner summary", async () => {
    const strategist = fixedStrategist([
      { question: "Q1", sql: "SELECT * FROM public.sales", purpose: "Purpose 1" },
      { question: "Q2", sql: "SELECT * FROM public.sales", purpose: "Purpose 2" }
    ]);

    const result = await prepareReportContractData({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(150) }),
      query_strategist: strategist,
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(result.prepared_payloads).toHaveLength(2);
    expect(result.query_details).toHaveLength(2);
    expect(result.prepared_payloads[0].question_number).toBe(1);
    expect(result.prepared_payloads[1].question_number).toBe(2);
    expect(result.prepared_payloads[0].validation).toBeDefined();
    expect(result.planner_summary.length).toBeGreaterThan(0);
  });

  it("auto-repairs off-allowlist strategist SQL to a safe allowlisted fallback", async () => {
    const strategist = fixedStrategist([
      {
        question: "Show sales trend",
        sql: "SELECT * FROM private.shadow_sales",
        purpose: "Should be repaired"
      }
    ]);

    const result = await prepareReportContractData({
      contract: makeContract({
        sql_template: "SELECT id, amount, region, event_time FROM public.sales LIMIT 120"
      }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(80) }),
      query_strategist: strategist,
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(result.query_details).toHaveLength(1);
    expect(result.query_details[0].sql.toLowerCase()).toContain("public.sales");
    expect(result.prepared_payloads[0].warnings.join(" ")).toMatch(/quality gate|auto-repaired/i);
  });

  it("captures errors gracefully when dataplane fails", async () => {
    const strategist = fixedStrategist([
      { question: "Will fail", sql: "SELECT * FROM public.sales", purpose: "Failure path" }
    ]);

    const failingDataPlane: DataPlane = {
      async execute() {
        throw new Error("Connection refused");
      },
      getAuditEvents() {
        return [];
      }
    };

    const result = await prepareReportContractData({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: failingDataPlane,
      query_strategist: strategist,
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(result.prepared_payloads).toHaveLength(1);
    expect(result.prepared_payloads[0].warnings.join(" ")).toContain("Connection refused");
  });
});

describe("payload QA agent", () => {
  it("answers follow-up questions from stored payloads only", async () => {
    const strategist = fixedStrategist([
      { question: "What changed in revenue?", sql: "SELECT * FROM public.sales", purpose: "Revenue changes" }
    ]);

    const pipeline = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(100) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    const qa = answerRunPayloadQuestion({
      run: pipeline.run,
      question: "What changed in revenue?"
    });

    expect(qa.grounded).toBe(true);
    expect(qa.answer.length).toBeGreaterThan(0);
    expect(qa.citations.length).toBeGreaterThan(0);
  });

  it("falls back to payload-grounded analysis when analyst output is not grounded", async () => {
    const strategist = fixedStrategist([
      { question: "How did refunds change?", sql: "SELECT * FROM public.sales", purpose: "Refund trends" }
    ]);

    const ungroundedAnalyst: AnalystClient = {
      provider: "stub",
      async analyzeBatch(input) {
        return {
          request_id: input.request_id,
          batch_index: input.batch_index,
          total_batches: input.total_batches,
          highlights: ["Atlantis refunds spiked to 9999999 despite zero evidence."],
          risks: ["Dragon metric instability at 123456."],
          recommendations: ["Launch moon campaign immediately."],
          confidence_score: 0.99,
          appendix_refs: ["fake-ref"]
        };
      }
    };

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(150) }),
      analyst_client: ungroundedAnalyst,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    const analysisPayloads = (result.run.query_plan.analysis_payloads ?? []) as Array<{
      highlights: string[];
      risks: string[];
      recommendations: string[];
    }>;
    expect(analysisPayloads.length).toBeGreaterThan(0);
    expect(analysisPayloads[0].highlights.join(" ").toLowerCase()).toContain("analyzed");
    expect(analysisPayloads[0].highlights.join(" ").toLowerCase()).not.toContain("atlantis");
    expect(analysisPayloads[0].recommendations.length).toBeGreaterThan(0);
  });
});
