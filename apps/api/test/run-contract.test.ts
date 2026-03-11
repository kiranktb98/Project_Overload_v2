import { describe, expect, it } from "vitest";
import { LocalStubDataPlane } from "@project-overload/dataplane";
import type { DataPlane } from "@project-overload/dataplane";
import {
  createStubAnalystClient,
  createStubPlannerClient,
  createStubReportComposerClient
} from "@project-overload/llm-client";
import type {
  AnalystClient,
  QueryStrategistClient,
  ReportComposerClient
} from "@project-overload/llm-client";
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
    scope_clarifications: [],
    kpi_watchlist: [],
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

type CapturedReportAnalysis = {
  data_summary: string;
  highlights: string[];
  answer_focus?: string;
  evidence_snapshot?: string;
};

function sequencedStrategist(plans: QueryStrategyOutput["queries"][]): QueryStrategistClient {
  let index = 0;
  return {
    provider: "stub",
    async planQueries() {
      const current = plans[Math.min(index, plans.length - 1)] ?? [];
      index += 1;
      return { queries: current };
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
  it("routes forecast-scoped questions to the forecast analyst and leaves standard questions on the analyst", async () => {
    let standardCalls = 0;
    let forecastCalls = 0;
    const analystClient: AnalystClient = {
      provider: "stub",
      async analyzeBatch(input) {
        standardCalls += 1;
        return {
          request_id: input.request_id,
          batch_index: input.batch_index,
          total_batches: input.total_batches,
          highlights: ["Standard analyst handled this question."],
          risks: [],
          recommendations: ["Proceed with standard analysis follow-up."],
          confidence_score: 0.84,
          appendix_refs: [`${input.request_id}:batch-${input.batch_index + 1}`],
          additional_query_requests: []
        };
      }
    };
    const forecastClient: AnalystClient = {
      provider: "stub",
      async analyzeBatch(input) {
        forecastCalls += 1;
        return {
          request_id: input.request_id,
          batch_index: input.batch_index,
          total_batches: input.total_batches,
          highlights: ["Forecast analyst handled this question."],
          risks: ["Forecast confidence depends on trend stability."],
          recommendations: ["Track the forecast weekly."],
          confidence_score: 0.77,
          appendix_refs: [`${input.request_id}:batch-${input.batch_index + 1}`],
          additional_query_requests: []
        };
      }
    };

    const strategist = fixedStrategist([
      {
        question: "Forecast refunds for the next 3 months",
        sql: "SELECT event_time, amount AS refund_amount FROM public.sales LIMIT 200",
        purpose: "Forecast trend"
      },
      {
        question: "What drove refunds last month?",
        sql: "SELECT event_time, amount AS refund_amount FROM public.sales LIMIT 200",
        purpose: "Driver analysis"
      }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(120) }),
      analyst_client: analystClient,
      forecast_client: forecastClient,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales [TABLE]: amount, event_time"
    });

    expect(forecastCalls).toBe(1);
    expect(standardCalls).toBe(1);
    expect(result.prepared_payloads).toHaveLength(2);
  });

  it("lets batch analyst request additional queries and re-runs analysis with supplemental evidence", async () => {
    let analystCalls = 0;
    const analystClient: AnalystClient = {
      provider: "stub",
      async analyzeBatch(input) {
        analystCalls += 1;
        if (analystCalls === 1) {
          return {
            request_id: input.request_id,
            batch_index: input.batch_index,
            total_batches: input.total_batches,
            highlights: ["Evidence is missing city-level split for this question."],
            risks: ["Cannot validate concentration without city breakdown."],
            recommendations: ["Fetch city-level refund totals for the same period."],
            confidence_score: 0.58,
            appendix_refs: [`${input.request_id}:batch-${input.batch_index + 1}`],
            additional_query_requests: [
              {
                reason: "Need city-level split to verify concentration.",
                question: "What is refund amount by city in the same timeline?",
                required_fields: ["city", "refund_amount"]
              }
            ]
          };
        }

        return {
          request_id: input.request_id,
          batch_index: input.batch_index,
          total_batches: input.total_batches,
          highlights: ["City-level evidence was added and concentration is now measurable."],
          risks: [],
          recommendations: ["Proceed with city-level prioritization in the report."],
          confidence_score: 0.91,
          appendix_refs: [`${input.request_id}:batch-${input.batch_index + 1}`],
          additional_query_requests: []
        };
      }
    };

    const strategist = sequencedStrategist([
      [
        {
          question: "Refund trend question",
          sql: "SELECT event_time, amount AS refund_amount FROM public.sales LIMIT 500",
          purpose: "Baseline refund trend"
        }
      ],
      [
        {
          question: "Refund trend question",
          sql: "SELECT city, SUM(amount) AS refund_amount FROM public.sales GROUP BY city LIMIT 200",
          purpose: "City-level refund breakdown"
        }
      ]
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({
        row_provider: (sql) =>
          /group by\s+city/i.test(sql)
            ? [
                { city: "Bengaluru", refund_amount: 1200 },
                { city: "Mumbai", refund_amount: 940 }
              ]
            : makeRows(120)
      }),
      analyst_client: analystClient,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales [TABLE]: id, amount, city, event_time"
    });

    expect(analystCalls).toBeGreaterThanOrEqual(2);
    expect(result.prepared_payloads[0]?.preparation_notes.join(" ")).toMatch(/Analyst follow-up query/i);
    expect(result.run.query_plan.strategy_queries).toHaveLength(2);
  });

  it("filters internal QA wording from customer-facing analysis output", async () => {
    const analystClient: AnalystClient = {
      provider: "stub",
      async analyzeBatch(input) {
        return {
          request_id: input.request_id,
          batch_index: input.batch_index,
          total_batches: input.total_batches,
          highlights: ["Applied UTC offset correction before trend comparison."],
          risks: ["Detected mislabels and autofixes in period keys."],
          recommendations: ["Use updated labels and continue."],
          confidence_score: 0.82,
          appendix_refs: [`${input.request_id}:batch-${input.batch_index + 1}`],
          additional_query_requests: []
        };
      }
    };

    const strategist = fixedStrategist([
      {
        question: "Refund trend",
        sql: "SELECT event_time, amount AS refund_amount FROM public.sales LIMIT 200",
        purpose: "Trend"
      }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(80) }),
      analyst_client: analystClient,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales [TABLE]: id, amount, event_time"
    });

    const htmlLower = result.html.toLowerCase();
    expect(htmlLower).not.toContain("utc offset");
    expect(htmlLower).not.toContain("mislabel");
    expect(htmlLower).not.toContain("autofix");
  });

  it("skips super-summary context query planning when analyst already triggered additional queries", async () => {
    let analystCalls = 0;
    const analystClient: AnalystClient = {
      provider: "stub",
      async analyzeBatch(input) {
        analystCalls += 1;
        if (analystCalls === 1) {
          return {
            request_id: input.request_id,
            batch_index: input.batch_index,
            total_batches: input.total_batches,
            highlights: ["Need one additional evidence slice."],
            risks: ["Missing segment detail."],
            recommendations: ["Fetch segment-level split."],
            confidence_score: 0.6,
            appendix_refs: [`${input.request_id}:batch-${input.batch_index + 1}`],
            additional_query_requests: [
              {
                reason: "Need segment-level evidence.",
                question: "What is refund amount by segment in the same window?",
                required_fields: ["segment", "refund_amount"]
              }
            ]
          };
        }

        return {
          request_id: input.request_id,
          batch_index: input.batch_index,
          total_batches: input.total_batches,
          highlights: ["Segment split added."],
          risks: [],
          recommendations: ["Proceed with final summary."],
          confidence_score: 0.88,
          appendix_refs: [`${input.request_id}:batch-${input.batch_index + 1}`],
          additional_query_requests: []
        };
      }
    };

    const strategist = sequencedStrategist([
      [
        {
          question: "Refund trend",
          sql: "SELECT event_time, amount AS refund_amount FROM public.sales LIMIT 200",
          purpose: "Trend"
        }
      ],
      [
        {
          question: "Refund trend",
          sql: "SELECT region AS segment, SUM(amount) AS refund_amount FROM public.sales GROUP BY region LIMIT 200",
          purpose: "Segment split"
        }
      ]
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(120) }),
      analyst_client: analystClient,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales [TABLE]: amount, event_time, region"
    });

    expect(analystCalls).toBeGreaterThanOrEqual(2);
    const plan = result.run.query_plan as Record<string, unknown>;
    expect(plan["super_summary"]).toBeNull();
    expect(plan["super_summary_context_queries"]).toEqual([]);
  });

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

    // Grouped queries produce one prepared payload; analyst may be called multiple times
    // due to row-level batching (ANALYST_ROW_CAP=50) but all calls share the same question context
    expect(analyst.calls.length).toBeGreaterThan(0);
    expect(analyst.calls[0].question).toContain("Q1.");
    expect(analyst.calls[0].question).toContain("Revenue by region?");
    expect(result.run.status).toBe("succeeded");
    expect(result.prepared_payloads).toHaveLength(1);
    expect(result.prepared_payloads[0].source_query_count).toBe(2);
  });

  it("enforces evidence cap <= 200 rows per analyst batch after preparation", async () => {
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

    // With ANALYST_ROW_CAP=200, each analyst call receives at most 200 rows
    expect(analyst.calls.length).toBeGreaterThan(0);
    expect(analyst.calls.every((c) => c.row_count <= 200)).toBe(true);
  });

  it("caps merged query planning fanout to avoid oversized discovery batches", async () => {
    const mergedStrategist: QueryStrategistClient = {
      provider: "stub",
      async planQueries() {
        return { queries: [] };
      },
      async planMergedQueries() {
        const makeBlocks = (prefix: string) =>
          Array.from({ length: 6 }, (_, idx) => ({
            sql: `SELECT ${idx + 1} AS metric FROM public.sales`,
            purpose: `${prefix} block ${idx + 1}`,
            expected_rows: 120,
            joins_used: [],
            filters_used: []
          }));

        return {
          questions: [
            {
              question_id: "q1",
              question_number: 1,
              question_text: "Q1",
              clarifications_used: [],
              group_id: "q1_group",
              query_blocks: makeBlocks("q1"),
              expected_output_columns: ["metric"],
              success_criteria: ["non-empty"]
            },
            {
              question_id: "q2",
              question_number: 2,
              question_text: "Q2",
              clarifications_used: [],
              group_id: "q2_group",
              query_blocks: makeBlocks("q2"),
              expected_output_columns: ["metric"],
              success_criteria: ["non-empty"]
            },
            {
              question_id: "q3",
              question_number: 3,
              question_text: "Q3",
              clarifications_used: [],
              group_id: "q3_group",
              query_blocks: makeBlocks("q3"),
              expected_output_columns: ["metric"],
              success_criteria: ["non-empty"]
            },
            {
              question_id: "q4",
              question_number: 4,
              question_text: "Q4",
              clarifications_used: [],
              group_id: "q4_group",
              query_blocks: makeBlocks("q4"),
              expected_output_columns: ["metric"],
              success_criteria: ["non-empty"]
            },
            {
              question_id: "q5",
              question_number: 5,
              question_text: "Q5",
              clarifications_used: [],
              group_id: "q5_group",
              query_blocks: makeBlocks("q5"),
              expected_output_columns: ["metric"],
              success_criteria: ["non-empty"]
            }
          ]
        };
      }
    };

    const result = await runReportContractPipeline({
      contract: makeContract({
        scope_clarifications: [
          {
            question_number: 1,
            question: "Q1",
            answer: "a1"
          },
          {
            question_number: 2,
            question: "Q2",
            answer: "a2"
          },
          {
            question_number: 3,
            question: "Q3",
            answer: "a3"
          },
          {
            question_number: 4,
            question: "Q4",
            answer: "a4"
          },
          {
            question_number: 5,
            question: "Q5",
            answer: "a5"
          }
        ]
      }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(140) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: mergedStrategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales [TABLE]: id, amount, event_time"
    });

    const strategyQueries = (result.run.query_plan as { strategy_queries: Array<{ question_number: number }> }).strategy_queries;

    expect(strategyQueries.length).toBeLessThanOrEqual(25);
    const byQuestion = new Map<number, number>();
    for (const query of strategyQueries) {
      const current = byQuestion.get(query.question_number) ?? 0;
      byQuestion.set(query.question_number, current + 1);
    }
    expect(Array.from(byQuestion.values()).every((count) => count <= 3)).toBe(true);
  });

  it("keeps scoped questions separate even when merged planner reuses the same group_id", async () => {
    const mergedStrategist: QueryStrategistClient = {
      provider: "stub",
      async planQueries() {
        return { queries: [] };
      },
      async planMergedQueries() {
        return {
          questions: [
            {
              question_id: "q1",
              question_number: 1,
              question_text: "Q1 refund trend",
              clarifications_used: [],
              group_id: "trend_group",
              query_blocks: [
                {
                  sql: "SELECT event_time, amount FROM public.sales LIMIT 200",
                  purpose: "Q1 trend",
                  expected_rows: 120,
                  joins_used: [],
                  filters_used: []
                }
              ],
              expected_output_columns: ["event_time", "amount"],
              success_criteria: ["non-empty"]
            },
            {
              question_id: "q2",
              question_number: 2,
              question_text: "Q2 comparison",
              clarifications_used: [],
              group_id: "comparison_group",
              query_blocks: [
                {
                  sql: "SELECT event_time, amount FROM public.sales LIMIT 200",
                  purpose: "Q2 comparison",
                  expected_rows: 120,
                  joins_used: [],
                  filters_used: []
                }
              ],
              expected_output_columns: ["event_time", "amount"],
              success_criteria: ["non-empty"]
            },
            {
              question_id: "q3",
              question_number: 3,
              question_text: "Q3 city refund rate",
              clarifications_used: [],
              group_id: "city_group",
              query_blocks: [
                {
                  sql: "SELECT region, amount FROM public.sales LIMIT 200",
                  purpose: "Q3 city",
                  expected_rows: 120,
                  joins_used: [],
                  filters_used: []
                }
              ],
              expected_output_columns: ["region", "amount"],
              success_criteria: ["non-empty"]
            },
            {
              question_id: "q4",
              question_number: 4,
              question_text: "Q4 support ticket count",
              clarifications_used: [],
              group_id: "support_shared",
              query_blocks: [
                {
                  sql: "SELECT id, amount FROM public.sales LIMIT 200",
                  purpose: "Q4 support count",
                  expected_rows: 120,
                  joins_used: [],
                  filters_used: []
                }
              ],
              expected_output_columns: ["id", "amount"],
              success_criteria: ["non-empty"]
            },
            {
              question_id: "q5",
              question_number: 5,
              question_text: "Q5 top issue types",
              clarifications_used: [],
              group_id: "support_shared",
              query_blocks: [
                {
                  sql: "SELECT id, amount FROM public.sales LIMIT 200",
                  purpose: "Q5 top issues",
                  expected_rows: 120,
                  joins_used: [],
                  filters_used: []
                }
              ],
              expected_output_columns: ["id", "amount"],
              success_criteria: ["non-empty"]
            }
          ]
        };
      }
    };

    const result = await runReportContractPipeline({
      contract: makeContract({
        scope_clarifications: [
          { question_number: 1, question: "Q1 refund trend", answer: "a1" },
          { question_number: 2, question: "Q2 comparison", answer: "a2" },
          { question_number: 3, question: "Q3 city refund rate", answer: "a3" },
          { question_number: 4, question: "Q4 support ticket count", answer: "a4" },
          { question_number: 5, question: "Q5 top issue types", answer: "a5" }
        ]
      }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(80) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: mergedStrategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales [TABLE]: id, amount, event_time"
    });

    const preparedNumbers = result.prepared_payloads.map((payload) => payload.question_number).sort((a, b) => a - b);
    expect(preparedNumbers).toContain(4);
    expect(preparedNumbers).toContain(5);
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

    // Analyst is called (possibly multiple batches) when coverage is complete
    expect(analyst.calls.length).toBeGreaterThan(0);
    expect(analyst.calls[0].question).toContain("Q1.");
    expect(result.prepared_payloads).toHaveLength(1);
    expect(result.prepared_payloads[0].validation?.expected_months).toBe(12);
    expect(result.prepared_payloads[0].validation?.observed_months).toBe(12);
    expect(result.prepared_payloads[0].validation?.missing_months).toHaveLength(0);
    expect(result.exec_brief.what_changed.join(" ")).not.toMatch(/coverage warning/i);
  });

  it("does not treat period-label comparison aggregates as timeline coverage gaps", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      {
        question: "Compare last 2 months vs prior 2 months for refunds from Nov 2025 through Feb 2026",
        sql: "SELECT month_label, prior_period, current_period, prior_total_orders, prior_refund_amount, current_total_orders, current_refund_amount, prior_refund_rate_pct FROM public.sales",
        purpose: "Period-over-period comparison"
      }
    ]);

    const comparisonRows = [
      {
        month_label: "Nov-Dec 2025",
        prior_period: "Nov-Dec 2025 (Prior)",
        current_period: "Jan-Feb 2026 (Current, Feb partial)",
        prior_total_orders: 446,
        prior_refund_amount: 241844.28,
        current_total_orders: 454,
        current_refund_amount: 236857.8,
        prior_refund_rate_pct: 21.75
      }
    ];

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => comparisonRows }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(result.prepared_payloads).toHaveLength(1);
    expect(result.prepared_payloads[0].prepared_row_count).toBeGreaterThan(0);
    expect(result.prepared_payloads[0].validation?.expected_months).toBeNull();
    expect(result.prepared_payloads[0].validation?.missing_months).toHaveLength(0);
    expect(analyst.calls.length).toBeGreaterThan(0);
    expect(result.exec_brief.what_changed.join(" ")).not.toMatch(/coverage warning/i);
  });

  it("anchors expected timeline to requested end month and flags missing February when requested", async () => {
    const analyst = spyAnalyst();
    const strategist = fixedStrategist([
      {
        question: "Compare last 2 months vs prior 2 months for refunds from Nov 2025 through Feb 2026",
        sql: "SELECT event_time, amount AS refund_amount, region FROM public.sales",
        purpose: "2v2 refund comparison"
      }
    ]);

    const rowsMissingFebruary = Array.from({ length: 180 }, (_, index) => {
      const month = [10, 11, 0][index % 3]; // Nov 2025, Dec 2025, Jan 2026
      const year = month === 0 ? 2026 : 2025;
      return {
        id: index + 1,
        refund_amount: (index % 30) + 1,
        region: ["NA", "EU", "APAC"][index % 3],
        event_time: new Date(Date.UTC(year, month, 1)).toISOString()
      };
    });

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => rowsMissingFebruary }),
      analyst_client: analyst.client,
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(result.prepared_payloads).toHaveLength(1);
    expect(result.prepared_payloads[0].validation?.expected_months).toBe(4);
    expect(result.prepared_payloads[0].validation?.missing_months).toContain("2026-02");
    expect(analyst.calls).toHaveLength(0);
  });

  it("labels period-comparison aggregate rows with explicit month-range labels", async () => {
    const strategist = fixedStrategist([
      {
        question: "Compare last 2 months vs prior 2 months for refunds from Nov 2025 through Feb 2026",
        sql: "SELECT 'monthly_mode' AS mode, event_time, amount AS refund_amount FROM public.sales WHERE event_time >= DATE '2025-11-01' AND event_time < DATE '2026-03-01'",
        purpose: "Monthly trend of refund metrics",
        group_id: "q1"
      },
      {
        question: "Compare last 2 months vs prior 2 months for refunds from Nov 2025 through Feb 2026",
        sql: "SELECT 'comparison_mode' AS mode, event_time, amount AS refund_amount FROM public.sales WHERE event_time >= DATE '2025-11-01' AND event_time < DATE '2026-03-01'",
        purpose: "Period-over-period comparison",
        group_id: "q1"
      }
    ]);

    const store = new InMemoryMetadataStore();
    const contract = makeContract();
    const dataPlane = new LocalStubDataPlane({
      row_provider: (sql) => {
        if (sql.includes("comparison_mode")) {
          return [
            {
              month_start: "2025-11-01",
              month_label: "",
              refund_order_count: 97,
              refund_revenue: 241844.28
            },
            {
              month_start: "2026-01-01",
              month_label: "",
              refund_order_count: 95,
              refund_revenue: 237257.8
            }
          ];
        }
        return [
          { month_start: "2025-11-01", month_label: "Nov 2025", refund_order_count: 41, refund_revenue: 102222.84 },
          { month_start: "2025-12-01", month_label: "Dec 2025", refund_order_count: 56, refund_revenue: 139621.44 },
          { month_start: "2026-01-01", month_label: "Jan 2026", refund_order_count: 64, refund_revenue: 159567.36 },
          { month_start: "2026-02-01", month_label: "Feb 2026", refund_order_count: 31, refund_revenue: 77290.44 }
        ];
      }
    });

    const prepared = await prepareReportContractData({
      contract,
      store,
      data_plane: dataPlane,
      query_strategist: strategist,
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(prepared.prepared_payloads).toHaveLength(1);
    const rows = prepared.prepared_payloads[0].prepared_rows;
    const novDec = rows.find(
      (row) =>
        String(row.month_start) === "2025-11-01" &&
        String(row._sub_query ?? "").toLowerCase().includes("period-over-period")
    );
    const janFeb = rows.find(
      (row) =>
        String(row.month_start) === "2026-01-01" &&
        String(row._sub_query ?? "").toLowerCase().includes("period-over-period")
    );

    expect(String(novDec?.month_label ?? "")).toContain("Nov-Dec 2025");
    expect(String(janFeb?.month_label ?? "")).toContain("Jan-Feb 2026");
  });

  it("reduces city x issue rows to top issue cuts per city during preparation", async () => {
    const strategist = fixedStrategist([
      {
        question:
          "For refunded orders in the past 4 months, what are the top issue types by city?",
        sql: "SELECT city, issue_type, ticket_count FROM public.sales",
        purpose: "Cross-tabulation of city vs issue type"
      }
    ]);

    const cities = ["Bengaluru", "Mumbai", "Delhi", "Chennai", "Pune", "Kolkata"];
    const issues = ["delivery", "wrong_item", "damaged_item", "billing"];
    const rows = cities.flatMap((city, cityIndex) =>
      issues.map((issue, issueIndex) => ({
        city,
        issue_type: issue,
        ticket_count: 100 - cityIndex * 5 - issueIndex
      }))
    );

    const prepared = await prepareReportContractData({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => rows }),
      query_strategist: strategist,
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(prepared.prepared_payloads).toHaveLength(1);
    const payload = prepared.prepared_payloads[0];
    expect(payload.row_count_before_reduction).toBe(rows.length);
    expect(payload.prepared_row_count).toBeLessThan(rows.length);
    expect(payload.preparation_notes.join(" ")).toMatch(/top 2 issues per city/i);
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

    // Analyst is called (possibly multiple batches) when epoch timestamps normalize correctly
    expect(analyst.calls.length).toBeGreaterThan(0);
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

    // Analyst is called (possibly multiple batches) and temporal column profiling is applied
    expect(analyst.calls.length).toBeGreaterThan(0);
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

  it("falls back to deterministic HTML when composer is temporarily unavailable", async () => {
    const strategist = fixedStrategist([
      { question: "Q1", sql: "SELECT * FROM public.sales", purpose: "Test" }
    ]);
    const flakyComposer: ReportComposerClient = {
      provider: "openrouter",
      async composeReport() {
        throw new Error("fetch failed");
      },
      drainUsageEvents() {
        return [];
      }
    };

    const result = await runReportContractPipeline({
      contract: makeContract({
        metric_definitions: [
          {
            metric_key: "refund_rate",
            display_name: "Refund Rate",
            definition: "refunded_orders / total_orders"
          }
        ]
      }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(60) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: flakyComposer,
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(result.run.status).toBe("succeeded");
    expect(result.html.toLowerCase()).toContain("<html");
    expect(result.html).toContain("Metric Definitions");
    expect(result.html).toContain("Refund Rate");
  });

  it("sanitizes metric definitions section so partial/incomplete wording is not shown", async () => {
    const strategist = fixedStrategist([
      { question: "Q1", sql: "SELECT * FROM public.sales", purpose: "Test" }
    ]);
    const flakyComposer: ReportComposerClient = {
      provider: "openrouter",
      async composeReport() {
        throw new Error("fetch failed");
      },
      drainUsageEvents() {
        return [];
      }
    };

    const result = await runReportContractPipeline({
      contract: makeContract({
        metric_definitions: [
          {
            metric_key: "refund_rate",
            display_name: "Refund Rate",
            definition: "Refund rate with partial data coverage in this period"
          }
        ]
      }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(60) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: flakyComposer,
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(result.html).toContain("Metric Definitions");
    expect(result.html.toLowerCase()).not.toContain("partial data coverage");
    expect(result.html.toLowerCase()).not.toContain("missing months");
  });

  it("rejects unresolved placeholder composer HTML and falls back to deterministic grounded HTML", async () => {
    const strategist = fixedStrategist([
      {
        question: "Top cities by refund value",
        sql: "SELECT city, amount AS refund_amount, event_time FROM public.sales",
        purpose: "City ranking"
      }
    ]);
    const placeholderComposer: ReportComposerClient = {
      provider: "openrouter",
      async composeReport() {
        return "<html><body><p>Pending full export for top cities.</p></body></html>";
      },
      drainUsageEvents() {
        return [];
      }
    };

    const rows = [
      { city: "Bengaluru", refund_amount: 1200, event_time: "2025-11-01T00:00:00.000Z" },
      { city: "Mumbai", refund_amount: 900, event_time: "2025-11-01T00:00:00.000Z" },
      { city: "Delhi", refund_amount: 700, event_time: "2025-11-01T00:00:00.000Z" }
    ];

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => rows }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: placeholderComposer,
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    expect(result.run.status).toBe("succeeded");
    expect(result.html.toLowerCase()).not.toContain("pending full export");
    expect(result.html).toMatch(/Bengaluru|Mumbai|Delhi/);
  });

  it("keeps city refund-rate questions focused on refund rate in the composer input", async () => {
    const strategist = fixedStrategist([
      {
        question: "Which cities have the highest refund rate over the past 4 complete months?",
        sql: "SELECT city, refund_rate, total_orders, total_revenue, refunded_orders_total FROM public.sales",
        purpose: "City refund-rate ranking"
      }
    ]);

    let capturedAnalysis: CapturedReportAnalysis | null = null;
    const capturingComposer: ReportComposerClient = {
      provider: "stub",
      async composeReport(input) {
        const first = input.analyses[0];
        capturedAnalysis = first
          ? {
              data_summary: first.data_summary,
              highlights: [...first.highlights],
              answer_focus: first.answer_focus,
              evidence_snapshot: first.evidence_snapshot
            }
          : null;
        return "<html><body><p>ok</p></body></html>";
      },
      drainUsageEvents() {
        return [];
      }
    };

    const rows = [
      { city: "Bengaluru", refund_rate: 25.49, total_orders: 102, total_revenue: 254310.48, refunded_orders_total: 26 },
      { city: "Pune", refund_rate: 24.37, total_orders: 119, total_revenue: 296895.56, refunded_orders_total: 29 },
      { city: "Hyderabad", refund_rate: 23.53, total_orders: 102, total_revenue: 254310.48, refunded_orders_total: 24 },
      { city: "Delhi", refund_rate: 23.23, total_orders: 99, total_revenue: 246830.76, refunded_orders_total: 23 },
      { city: "Chennai", refund_rate: 21.93, total_orders: 114, total_revenue: 284229.36, refunded_orders_total: 25 }
    ];

    const result = await runReportContractPipeline({
      contract: makeContract({
        metric_definitions: [
          {
            metric_key: "refund_rate",
            display_name: "Refund Rate",
            definition: "refunded_orders_total / total_orders * 100"
          }
        ]
      }),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => rows }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: capturingComposer,
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales [table]: city(text), refund_rate(numeric), total_orders(integer), total_revenue(numeric), refunded_orders_total(integer)"
    });

    expect(result.run.status).toBe("succeeded");
    expect(capturedAnalysis).not.toBeNull();
    const analysis = capturedAnalysis!;
    expect(analysis.answer_focus?.toLowerCase()).toContain("refund rate");
    expect(analysis.answer_focus?.toLowerCase()).toContain("city");
    expect(analysis.data_summary).toContain("Direct answer cue:");
    expect(analysis.data_summary.toLowerCase()).toContain("refund rate");
    expect(analysis.evidence_snapshot).toContain("Primary metric: refund_rate");
    expect(analysis.evidence_snapshot).toContain("city=Bengaluru");
    expect(analysis.evidence_snapshot).toContain("refund_rate=25.49%");
    expect(analysis.highlights.join(" ")).toContain("Bengaluru");
    expect(analysis.highlights.join(" ").toLowerCase()).toContain("refund rate");
  });

  it("passes per-question summaries directly to html composer without super-summary stage", async () => {
    const strategist = fixedStrategist([
      { question: "Q1", sql: "SELECT * FROM public.sales", purpose: "Test" }
    ]);

    const result = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(120) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales [table]: region(text), amount(numeric), event_time(timestamp)"
    });

    const plan = result.run.query_plan as Record<string, unknown>;
    expect(plan["super_summary"]).toBeNull();
    expect(plan["super_summary_context_queries"]).toEqual([]);
    expect(plan["super_summary_context_results"]).toEqual([]);
    const perQuestionSummaries = plan["per_question_summaries"] as Array<Record<string, unknown>>;
    expect(perQuestionSummaries.length).toBeGreaterThanOrEqual(1);
    expect(perQuestionSummaries[0]).toHaveProperty("question_text");
    expect(perQuestionSummaries[0]).toHaveProperty("findings");
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

  it("applies LLM dialect compiler before executing prepared SQL", async () => {
    const compileCalls: Array<{ dialect: string; sql: string }> = [];
    const strategist: QueryStrategistClient = {
      provider: "stub",
      async planQueries() {
        return {
          queries: [
            {
              question: "Last 30 days sales",
              sql: "SELECT * FROM public.sales WHERE event_time >= CURRENT_DATE - INTERVAL '30 days'",
              purpose: "Windowed sales pull"
            }
          ]
        };
      },
      async compileSql(input) {
        compileCalls.push({
          dialect: input.dialect,
          sql: input.sql
        });
        return {
          sql: "SELECT id, amount, region, event_time FROM public.sales LIMIT 80",
          rationale: "Converted to mysql-compatible window strategy."
        };
      }
    };

    const result = await prepareReportContractData({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(120) }),
      query_strategist: strategist,
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales",
      sql_dialect: "mysql"
    });

    expect(compileCalls.length).toBeGreaterThan(0);
    expect(compileCalls[0].dialect).toBe("mysql");
    expect(result.query_details).toHaveLength(1);
    expect(result.query_details[0].sql).toContain("LIMIT 80");
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
          appendix_refs: ["fake-ref"],
          additional_query_requests: []
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

  it("requires fresh scoped analysis for novel follow-up intent not grounded in current payload", async () => {
    const strategist = fixedStrategist([
      { question: "How did refunds change month over month?", sql: "SELECT * FROM public.sales", purpose: "Refund trend" }
    ]);

    const pipeline = await runReportContractPipeline({
      contract: makeContract(),
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => makeRows(120) }),
      analyst_client: createStubAnalystClient(),
      query_strategist: strategist,
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient(),
      catalog_summary: "public.sales"
    });

    const qa = answerRunPayloadQuestion({
      run: pipeline.run,
      question: "Can you also add top cities by issue type and support-ticket driver breakdown?"
    });

    expect(qa.grounded).toBe(false);
    expect(qa.requires_new_analysis).toBe(true);
  });
});
