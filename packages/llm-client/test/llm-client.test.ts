import { describe, expect, it } from "vitest";
import type {
  AnalystInput,
  BatchAnalysis,
  BusinessCaseInput,
  PlannerInput,
  QueryStrategyInput
} from "@project-overload/shared";
import {
  createAnalystClient,
  createAnalystClientFromEnv,
  createBusinessCaseClient,
  createStubReportClarificationClient,
  createReportComposerClient,
  createStubAnalystClient,
  createStubPlannerClient,
  createStubQueryStrategistClient,
  createStubReportComposerClient
} from "../src";

const sampleInput: AnalystInput = {
  request_id: "req_1",
  batch_index: 0,
  total_batches: 1,
  summary_word_budget: 180,
  insight_mode: "business",
  evidence_packet: {
    request_id: "req_1",
    batch_index: 0,
    total_batches: 1,
    rows: [{ region: "NA", amount: 120 }],
    row_count: 1
  }
};

const sampleBusinessCaseInput: BusinessCaseInput = {
  report_title: "Refund Reduction Plan",
  question: "Build the business case for the recommendation.",
  user_message: "Build the business case for the recommendation.",
  candidate: {
    candidate_id: "q1_r1",
    question_id: "q1",
    question_number: 1,
    question_text: "How can we reduce refund-linked support burden?",
    recommendation_index: 1,
    recommendation: "Prioritize the highest-volume refund-linked issue types.",
    highlights: ["Refund-linked support contacts are concentrated in two issue types."],
    risks: ["Operational savings depend on implementation quality."]
  },
  assumption_notes: ["Implementation begins next quarter."],
  business_context: "Customer support cost and refund recovery are operational priorities.",
  metric_definitions: [],
  analysis_payload: {
    question_id: "q1",
    question: "How can we reduce refund-linked support burden?",
    data_summary: "Top issue types drive most refund-linked contacts.",
    highlights: ["Two issue types account for most refund-linked contacts."],
    risks: ["Ticket tagging quality may vary."],
    recommendations: ["Focus intervention on the top two issue types first."]
  },
  prepared_payload: null,
  supporting_data: []
};

describe("llm client", () => {
  it("falls back to stub when provider key is missing", async () => {
    withEnv(
      {
        LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "",
        OPENROUTER_API_KEY: ""
      },
      async () => {
        const client = createAnalystClientFromEnv();
        expect(client.provider).toBe("stub");

        const result = await client.analyzeBatch(sampleInput);
        expect(result.request_id).toBe("req_1");
      }
    );
  });

  it("uses openai provider when configured and parses JSON", async () => {
    const expected: BatchAnalysis = {
      request_id: "req_1",
      batch_index: 0,
      total_batches: 1,
      highlights: ["Revenue stable"],
      risks: ["No major risk"],
      recommendations: ["Keep monitoring"],
      confidence_score: 0.81,
      appendix_refs: ["req_1:batch-1"],
      additional_query_requests: []
    };

    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify(expected)
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const client = createAnalystClient({
      provider: "openai",
      openaiApiKey: "test_key",
      openaiModel: "gpt-4.1-mini",
      timeoutMs: 200,
      fallbackToStub: false,
      fetcher: mockFetch
    });

    const result = await client.analyzeBatch(sampleInput);

    expect(result).toEqual(expected);
    expect(String(calls[0].input)).toBe("https://api.openai.com/v1/responses");
    expect(calls[0].init?.headers).toMatchObject({
      Authorization: "Bearer test_key"
    });
  });

  it("falls back to stub when provider request fails", async () => {
    const mockFetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ message: "upstream error" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });

    const client = createAnalystClient({
      provider: "openrouter",
      openrouterApiKey: "test_key",
      openrouterBaseUrl: "https://openrouter.ai/api/v1",
      timeoutMs: 200,
      fallbackToStub: true,
      fetcher: mockFetch
    });

    const fallback = createStubAnalystClient();
    const [result, expected] = await Promise.all([
      client.analyzeBatch(sampleInput),
      fallback.analyzeBatch(sampleInput)
    ]);

    expect(result).toEqual(expected);
  });

  it("falls back to stub on timeout", async () => {
    const neverResolvingFetch = async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> =>
      await new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(new Error("aborted"));
          return;
        }

        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(new Error("aborted"));
          },
          { once: true }
        );
      });

    const client = createAnalystClient({
      provider: "openrouter",
      openrouterApiKey: "test_key",
      timeoutMs: 5,
      fallbackToStub: true,
      fetcher: neverResolvingFetch
    });

    const fallback = createStubAnalystClient();
    const [result, expected] = await Promise.all([
      client.analyzeBatch(sampleInput),
      fallback.analyzeBatch(sampleInput)
    ]);

    expect(result).toEqual(expected);
  });

  it("coerces string additional-query requests from analyst output into object form", async () => {
    const client = createAnalystClient({
      provider: "openrouter",
      openrouterApiKey: "test_key",
      timeoutMs: 200,
      fallbackToStub: false,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    request_id: "req_1",
                    batch_index: 0,
                    total_batches: 1,
                    highlights: ["Coverage is incomplete for the root-cause slice."],
                    risks: ["Issue-type detail is missing."],
                    recommendations: ["Fetch a more granular issue-type split."],
                    confidence_score: 0.61,
                    appendix_refs: ["req_1:batch-1"],
                    additional_query_requests: ["Need issue-type level evidence for refunded orders in the same window."]
                  })
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    });

    const result = await client.analyzeBatch(sampleInput);

    expect(result.additional_query_requests).toEqual([
      {
        reason: "Need issue-type level evidence for refunded orders in the same window.",
        question: "Need issue-type level evidence for refunded orders in the same window.",
        required_fields: []
      }
    ]);
  });

  it("coerces string additional-query requests from business-case output into object form", async () => {
    const client = createBusinessCaseClient({
      provider: "openrouter",
      openrouterApiKey: "test_key",
      timeoutMs: 200,
      fallbackToStub: false,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: "complete",
                    title: "Refund Root-Cause Intervention Case",
                    executive_summary: "Targeting the top refund-linked issue types should reduce avoidable support load.",
                    recommendation: "Prioritize the highest-volume refund-linked issue types.",
                    baseline: ["Two issue types drive most refund-linked support contacts."],
                    assumptions: ["Implementation begins next quarter."],
                    implementation_plan: ["Confirm issue taxonomy.", "Roll out fixes for the top issue types."],
                    timeline_impact: [
                      { period_label: "Time period 1 after implementation", impact: "Operational noise should begin to fall." },
                      { period_label: "Time period 2 after implementation", impact: "Support savings should become more visible." }
                    ],
                    financial_view: ["Support handling effort should decline if ticket volumes fall."],
                    operational_view: ["Support teams can focus on fewer repeat refund-linked issues."],
                    risks: ["Benefits depend on tagging quality and rollout discipline."],
                    kpis_to_track: ["Refund-linked ticket volume", "Resolution time"],
                    citations: ["q1"],
                    additional_query_requests: ["Need city-level savings split for the same intervention window."]
                  })
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    });

    const result = await client.buildCase(sampleBusinessCaseInput);

    expect(result.additional_query_requests).toEqual([
      {
        reason: "Need city-level savings split for the same intervention window.",
        question: "Need city-level savings split for the same intervention window.",
        required_fields: []
      }
    ]);
  });

  it("grounds report clarification answers from prepared payload evidence when summaries are thin", async () => {
    const client = createStubReportClarificationClient();

    const result = await client.answerQuestion({
      report_title: "Refund Report",
      question: "Which city had the highest refund rate?",
      report_html: "",
      exec_brief: {},
      per_question_summaries: [],
      analysis_payloads: [],
      prepared_payloads: [
        {
          question_id: "q3",
          question_number: 3,
          question: "Which cities had the highest refund rate?",
          purpose: "Top cities by refund rate over the last 4 complete months.",
          prepared_row_count: 5,
          warnings: [],
          validation: {
            observed_months: 4,
            missing_months: [],
            monthly_row_counts: [],
            monthly_metric_totals: [],
            metric_column: "refund_rate"
          },
          sample_rows: [
            { city: "Pune", refund_rate: 24.37 },
            { city: "Bengaluru", refund_rate: 25.49 }
          ]
        }
      ],
      metric_definitions: [
        {
          metric_key: "refund_rate",
          display_name: "Refund Rate",
          definition: "Refunded Revenue / Total Revenue"
        }
      ],
      business_context: "Refund reduction is a core operational priority."
    });

    expect(result.grounded).toBe(true);
    expect(result.requires_new_analysis).toBe(false);
    expect(result.citations).toContain("q3");
  });
});

describe("stub query strategist", () => {
  const baseInput: QueryStrategyInput = {
    catalog_summary: "public.sales [TABLE]: id, amount, region",
    report_goal: "Test report",
    audience: "test",
    insight_mode: "business",
    metric_ids: [],
    dimension_ids: [],
    allowed_relations: ["public.sales"]
  };

  it("returns standalone queries when only metric_ids are set (Case 2)", async () => {
    const client = createStubQueryStrategistClient();
    const result = await client.planQueries({
      ...baseInput,
      metric_ids: ["revenue"]
    });

    expect(result.queries.length).toBeGreaterThanOrEqual(1);
    for (const q of result.queries) {
      expect(q.group_id).toBeUndefined();
    }
  });

  it("returns standalone queries when only dimension_ids are set (Case 2)", async () => {
    const client = createStubQueryStrategistClient();
    const result = await client.planQueries({
      ...baseInput,
      dimension_ids: ["region"]
    });

    expect(result.queries.length).toBeGreaterThanOrEqual(1);
    for (const q of result.queries) {
      expect(q.group_id).toBeUndefined();
    }
  });

  it("returns aggregation queries when both metric_ids and dimension_ids are set", async () => {
    const client = createStubQueryStrategistClient();
    const result = await client.planQueries({
      ...baseInput,
      metric_ids: ["revenue"],
      dimension_ids: ["region"]
    });

    expect(result.queries.length).toBeGreaterThanOrEqual(1);
    // Stub now generates aggregation queries (COUNT/GROUP BY) instead of SELECT *
    for (const q of result.queries) {
      expect(q.sql).toContain("COUNT(*)");
      expect(q.sql).not.toContain("SELECT *");
    }
  });

  it("returns data quality query for data insight mode", async () => {
    const client = createStubQueryStrategistClient();
    const result = await client.planQueries({
      ...baseInput,
      insight_mode: "data"
    });

    expect(result.queries.length).toBe(1);
    expect(result.queries[0].question).toContain("data quality");
    expect(result.queries[0].group_id).toBeUndefined();
  });

  it("returns fallback query when no metric_ids or dimension_ids", async () => {
    const client = createStubQueryStrategistClient();
    const result = await client.planQueries(baseInput);

    expect(result.queries.length).toBe(1);
    expect(result.queries[0].question).toContain("key business insights");
    expect(result.queries[0].group_id).toBeUndefined();
  });

  it("provides dialect compiler fallback for safe single-statement SQL", async () => {
    const client = createStubQueryStrategistClient();
    const compiled = await client.compileSql?.({
      sql: "SELECT * FROM public.sales; SELECT * FROM public.orders;",
      dialect: "mysql",
      allowed_relations: ["public.sales"],
      allowed_schemas: ["public"]
    });

    expect(compiled).toBeDefined();
    expect(compiled?.sql).toBe("SELECT * FROM public.sales");
    expect(compiled?.rationale).toContain("mysql");
  });
});

describe("stub report composer", () => {
  it("generates HTML with correct title and mode label", async () => {
    const client = createStubReportComposerClient();

    const html = await client.composeReport({
      title: "Revenue Report",
      audience: "CEO",
      insight_mode: "business",
      analyses: [
        {
          question: "What is the trend?",
          highlights: ["Revenue up 10%"],
          risks: ["Churn rising"],
          recommendations: ["Expand sales team"],
          data_summary: "100 rows analyzed"
        }
      ],
      catalog_summary: "public.sales"
    });

    expect(html).toContain("Revenue Report");
    expect(html).toContain("Business Insights Report");
    expect(html).toContain("Revenue up 10%");
    expect(html).toContain("Churn rising");
    expect(html).toContain("Expand sales team");
  });

  it("renders data quality label for data mode", async () => {
    const client = createStubReportComposerClient();

    const html = await client.composeReport({
      title: "DQ Report",
      audience: "Ops",
      insight_mode: "data",
      analyses: [],
      catalog_summary: "x"
    });

    expect(html).toContain("Data Quality Assessment");
  });

  it("passes question-first evidence guidance to the remote report composer prompt", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createReportComposerClient({
      provider: "openrouter",
      openrouterApiKey: "test_key",
      openrouterBaseUrl: "https://openrouter.ai/api/v1",
      timeoutMs: 200,
      fallbackToStub: false,
      fetcher: async (input, init) => {
        calls.push({ input, init });
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "<html><body><p>ok</p></body></html>"
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    await client.composeReport({
      title: "Refund Rate Report",
      audience: "Ops",
      insight_mode: "business",
      analyses: [
        {
          question: "Q3. Which cities have the highest refund rate over the past 4 complete months?",
          highlights: ["City with the highest refund rate: Bengaluru (25.49%), Pune (24.37%), Hyderabad (23.53%)."],
          risks: ["Refund rate is concentrated in a few cities."],
          recommendations: ["Investigate the highest-rate cities first."],
          data_summary: "5 prepared rows analyzed. Direct answer cue: City with the highest refund rate: Bengaluru (25.49%), Pune (24.37%), Hyderabad (23.53%).",
          answer_focus: "Lead with refund rate by city because that is the exact metric and breakdown requested by the scoped question.",
          evidence_snapshot: [
            "Primary metric: refund_rate",
            "Primary breakdown: city",
            "Prepared evidence preview:",
            "- city=Bengaluru | refund_rate=25.49% | total_orders=102 | total_revenue=254,310.48",
            "- city=Pune | refund_rate=24.37% | total_orders=119 | total_revenue=296,895.56"
          ].join("\n")
        }
      ],
      metric_definitions: [
        {
          metric_key: "refund_rate",
          display_name: "Refund Rate",
          definition: "refunded_orders_total / total_orders * 100"
        }
      ],
      catalog_summary: "public.sales"
    });

    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0].init?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemPrompt = body.messages[0]?.content ?? "";
    const userPrompt = body.messages[1]?.content ?? "";

    expect(systemPrompt).toContain("QUESTION-FIRST");
    expect(systemPrompt).toContain("DO NOT SUBSTITUTE METRICS");
    expect(systemPrompt).toContain("evidence_snapshot");
    expect(userPrompt).toContain("Answer focus: Lead with refund rate by city");
    expect(userPrompt).toContain("Evidence snapshot: Primary metric: refund_rate");
    expect(userPrompt).toContain("city=Bengaluru");
  });
});

describe("stub planner", () => {
  const basePlannerInput: PlannerInput = {
    catalog_summary: "TABLE: public.sales\n  - id : integer\n  - amount : numeric\n  - region : text",
    user_goal: "Analyze sales trends",
    audience: "Executive",
    insight_mode: "business",
    allowed_relations: ["public.sales"],
    allowed_schemas: ["public"]
  };

  it("explore returns exploratory queries", async () => {
    const client = createStubPlannerClient();
    const result = await client.explore(basePlannerInput);

    expect(result.queries.length).toBeGreaterThanOrEqual(1);
    expect(result.queries.length).toBeLessThanOrEqual(6);
    for (const q of result.queries) {
      expect(q.purpose).toBeDefined();
      expect(q.sql).toBeDefined();
      expect(["distinct", "count", "sample", "range", "schema"]).toContain(q.query_type);
    }
  });

  it("plan returns structured plan with discoveries and approaches", async () => {
    const client = createStubPlannerClient();
    const result = await client.plan({
      ...basePlannerInput,
      exploration_results: "--- Sample rows ---\nSELECT * FROM public.sales LIMIT 5\nRows returned: 5\n{\"id\":1,\"amount\":100,\"region\":\"NA\"}"
    });

    expect(result.data_discoveries.length).toBeGreaterThanOrEqual(1);
    expect(result.recommended_approaches.length).toBeGreaterThanOrEqual(1);
    expect(result.plan_summary).toBeDefined();
    expect(result.plan_summary.length).toBeGreaterThan(0);
  });

  it("plan summary includes user goal", async () => {
    const client = createStubPlannerClient();
    const result = await client.plan({
      ...basePlannerInput,
      exploration_results: "test results"
    });

    expect(result.plan_summary).toContain("Analyze sales trends");
  });
});

function withEnv(
  updates: Partial<Record<string, string>>,
  fn: () => Promise<void> | void
): Promise<void> | void {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(updates)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  const restore = () => {
    for (const [key, value] of previous.entries()) {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  const result = fn();

  if (result instanceof Promise) {
    return result.finally(restore);
  }

  restore();
  return result;
}
