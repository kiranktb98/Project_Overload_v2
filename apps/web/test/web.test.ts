import { describe, expect, it } from "vitest";
import { buildWebApp } from "../src/app";
import {
  createPassthroughConversationClient,
  type ConversationClient
} from "../src/conversation";

describe("web chat interface", () => {
  it("serves health and chat html routes", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const health = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok", service: "web" });

    const page = await app.inject({
      method: "GET",
      url: "/"
    });

    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain("Report Contract Chat");

    await app.close();
  }, 15000);

  it("accepts set commands and persists chat state", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "set name: Weekly CEO Revenue"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.draft.name).toBe("Weekly CEO Revenue");
    expect(body.assistant_message).toContain("Updated name");
    expect(body.state.conversation_history).toHaveLength(2);
    expect(body.state.conversation_history[0].role).toBe("user");
    expect(body.state.conversation_history[1].role).toBe("assistant");

    await app.close();
  });

  it("responds naturally to small talk and open-ended report intent", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const wellbeing = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "how are you doing?"
      }
    });

    expect(wellbeing.statusCode).toBe(200);
    const wellbeingBody = wellbeing.json();
    expect(wellbeingBody.assistant_message.toLowerCase()).toContain("doing well");

    const openEnded = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "i need a report",
        state: wellbeingBody.state
      }
    });

    expect(openEnded.statusCode).toBe(200);
    expect(openEnded.json().assistant_message).toContain("Great, let's build your report.");

    await app.close();
  });

  it("saves and runs a contract through the api bridge", async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";
      requests.push({ url, method });

      if (url.endsWith("/report-contracts") && method === "POST") {
        const rawBody = typeof init?.body === "string" ? init.body : "{}";
        const payload = JSON.parse(rawBody) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ...payload,
            id: "contract_web_test"
          }),
          {
            status: 201,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/report-contracts/contract_web_test/run") && method === "POST") {
        return new Response(
          JSON.stringify({
            run_id: "run_web_test",
            pdf_path: "/report-runs/run_web_test/pdf",
            exec_brief: {
              what_changed: ["Revenue up 12%"],
              why: ["Higher order frequency"],
              so_what: ["Growth target is on track"],
              what_to_do: ["Increase top-performing channel budget"],
              confidence: {
                score: 0.84,
                rationale: "Coverage includes all top regions."
              },
              appendix_refs: ["evidence_contract_web_test_1"],
              deltas_vs_last_run: ["NA revenue +8%"],
              generated_at: "2026-01-01T00:00:00.000Z"
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/report-runs/run_web_test/pdf") && method === "GET") {
        return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": "attachment; filename=\"exec-brief-run_web_test.pdf\""
          }
        });
      }

      if (url.endsWith("/report-contracts") && method === "GET") {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(
        JSON.stringify({
          message: `Unhandled request: ${method} ${url}`
        }),
        {
          status: 404,
          headers: { "content-type": "application/json" }
        }
      );
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: createPassthroughConversationClient()
    });

    const setName = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "set name: Weekly CEO Revenue"
      }
    });
    expect(setName.statusCode).toBe(200);

    const save = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "save",
        state: setName.json().state
      }
    });
    expect(save.statusCode).toBe(200);
    expect(save.json().state.contract_id).toBe("contract_web_test");

    const run = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "run",
        state: save.json().state
      }
    });

    expect(run.statusCode).toBe(200);
    const runBody = run.json();
    expect(runBody.assistant_message).toContain("Run complete.");
    expect(runBody.pdf_download_url).toBe("/api/runs/run_web_test/pdf");
    expect(runBody.state.last_run_id).toBe("run_web_test");
    expect(runBody.state.last_exec_brief).toBeTruthy();

    const insights = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What did you find from the data?",
        state: runBody.state
      }
    });
    expect(insights.statusCode).toBe(200);
    expect(insights.json().assistant_message).toContain("Top finding");

    const pdf = await app.inject({
      method: "GET",
      url: "/api/runs/run_web_test/pdf"
    });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");

    expect(
      requests.some((request) => request.method === "POST" && request.url.endsWith("/report-contracts"))
    ).toBe(true);
    expect(
      requests.some(
        (request) => request.method === "POST" && request.url.endsWith("/report-contracts/contract_web_test/run")
      )
    ).toBe(true);
    expect(
      requests.some((request) => request.method === "GET" && request.url.endsWith("/report-runs/run_web_test/pdf"))
    ).toBe(true);

    await app.close();
  });

  it("supports natural-language multi-turn conversation", async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";
      requests.push({ url, method });

      if (url.endsWith("/report-contracts") && method === "POST") {
        const rawBody = typeof init?.body === "string" ? init.body : "{}";
        const payload = JSON.parse(rawBody) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ...payload,
            id: "contract_nl_test"
          }),
          {
            status: 201,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/report-contracts/contract_nl_test/run") && method === "POST") {
        return new Response(
          JSON.stringify({
            run_id: "run_nl_test",
            pdf_path: "/report-runs/run_nl_test/pdf",
            exec_brief: {
              what_changed: ["Revenue increased 11% week-over-week in NA and EU."],
              why: ["Higher online conversion and larger enterprise deals."],
              so_what: ["Quarter target risk reduced."],
              what_to_do: ["Shift 10% budget to online in EU."],
              confidence: {
                score: 0.82,
                rationale: "Trend is consistent across regions."
              },
              appendix_refs: ["evidence_nl_1"],
              deltas_vs_last_run: ["NA +8%, EU +14%"],
              generated_at: "2026-01-01T00:00:00.000Z"
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/report-runs/run_nl_test/pdf") && method === "GET") {
        return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
          status: 200,
          headers: {
            "content-type": "application/pdf"
          }
        });
      }

      if (url.endsWith("/report-contracts") && method === "GET") {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(
        JSON.stringify({
          message: `Unhandled request: ${method} ${url}`
        }),
        {
          status: 404,
          headers: { "content-type": "application/json" }
        }
      );
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: createPassthroughConversationClient()
    });

    const turn1 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Hi"
      }
    });
    expect(turn1.statusCode).toBe(200);
    expect(turn1.json().assistant_message).toContain("define a report contract");

    const turn2 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "I need a weekly CEO report by region. Call it Weekly CEO Revenue Report.",
        state: turn1.json().state
      }
    });
    expect(turn2.statusCode).toBe(200);
    expect(turn2.json().assistant_message).toContain("Updated:");

    const turn3 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What do you still need from me?",
        state: turn2.json().state
      }
    });
    expect(turn3.statusCode).toBe(200);
    expect(turn3.json().assistant_message).toContain("already gave enough");

    const turn4 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Run it now",
        state: turn3.json().state
      }
    });
    expect(turn4.statusCode).toBe(200);
    expect(turn4.json().assistant_message).toContain("Run complete.");
    expect(turn4.json().state.last_run_id).toBe("run_nl_test");

    const turn5 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Tell me what you found from the data.",
        state: turn4.json().state
      }
    });
    expect(turn5.statusCode).toBe(200);
    expect(turn5.json().assistant_message).toContain("Top finding:");

    const turn6 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Can I download the PDF?",
        state: turn5.json().state
      }
    });
    expect(turn6.statusCode).toBe(200);
    expect(turn6.json().pdf_download_url).toBe("/api/runs/run_nl_test/pdf");

    expect(
      requests.some((request) => request.method === "POST" && request.url.endsWith("/report-contracts"))
    ).toBe(true);
    expect(
      requests.some((request) => request.method === "POST" && request.url.endsWith("/report-contracts/contract_nl_test/run"))
    ).toBe(true);

    await app.close();
  });

  it("routes every chat turn through conversation client", async () => {
    const seen: string[] = [];
    const conversationClient: ConversationClient = {
      provider: "stub" as const,
      mode: "deterministic" as const,
      async respond(input) {
        seen.push(input.user_message);
        return `[AI] ${input.deterministic_response}`;
      }
    };

    const app = buildWebApp({
      conversation_client: conversationClient
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "hello"
      }
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().assistant_message.startsWith("[AI]")).toBe(true);

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "i need a report",
        state: first.json().state
      }
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().assistant_message.startsWith("[AI]")).toBe(true);
    expect(seen).toEqual(["hello", "i need a report"]);
    expect(second.json().state.conversation_history).toHaveLength(4);

    await app.close();
  });

  it("exposes chat runtime provider mode", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/chat/runtime"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      provider: "stub",
      mode: "deterministic"
    });

    await app.close();
  });
});
