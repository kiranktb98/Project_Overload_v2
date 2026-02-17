import { describe, expect, it } from "vitest";
import type { AnalystInput, BatchAnalysis, PlannerInput, QueryStrategyInput } from "@project-overload/shared";
import {
  createAnalystClient,
  createAnalystClientFromEnv,
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
      appendix_refs: ["req_1:batch-1"]
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

  it("returns grouped queries when both metric_ids and dimension_ids are set (Case 1)", async () => {
    const client = createStubQueryStrategistClient();
    const result = await client.planQueries({
      ...baseInput,
      metric_ids: ["revenue"],
      dimension_ids: ["region"]
    });

    expect(result.queries.length).toBe(2);
    expect(result.queries[0].group_id).toBe("overview");
    expect(result.queries[1].group_id).toBe("overview");
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
