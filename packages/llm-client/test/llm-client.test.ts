import { describe, expect, it } from "vitest";
import type { AnalystInput, BatchAnalysis } from "@project-overload/shared";
import {
  createAnalystClient,
  createAnalystClientFromEnv,
  createStubAnalystClient
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
