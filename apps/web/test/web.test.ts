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

    const connectPage = await app.inject({
      method: "GET",
      url: "/connect"
    });

    expect(connectPage.statusCode).toBe(200);
    expect(connectPage.body).toContain("1-Click Database Connection Wizard");
    expect(connectPage.body).toContain("Catalogue & index");

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
    expect(body.assistant_message).toContain("name");
    expect(body.state.conversation_history).toHaveLength(2);
    expect(body.state.conversation_history[0].role).toBe("user");
    expect(body.state.conversation_history[1].role).toBe("assistant");

    await app.close();
  });

  it("sends all messages through the LLM conversation client", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    // Greetings, small talk, and open-ended messages all go through the LLM.
    // With passthrough, the response is the action_context (state context).
    const greeting = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "how are you doing?" }
    });
    expect(greeting.statusCode).toBe(200);
    // No deterministic greeting — passthrough returns state context
    expect(greeting.json().assistant_message).toContain("Current draft");

    const openEnded = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "i need a report" }
    });
    expect(openEnded.statusCode).toBe(200);
    // "i need" triggers inferSimpleIntent / expressesReportIntent → now falls through to LLM
    // The passthrough returns state context
    expect(openEnded.json().assistant_message).toBeDefined();

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

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(JSON.stringify({
          relations: [{
            schema_name: "analytics", relation_name: "sales",
            qualified_name: "analytics.sales",
            has_select_privilege: true,
            rls_active_for_me: false,
            policies_count_for_me: 0,
            status: "OK",
            status_label: "OK"
          }]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(JSON.stringify({
          rows: [{ row_count: 1500 }],
          row_count: 1,
          governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
          warnings: []
        }), {
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
    expect(save.json().assistant_message).toContain("Contract saved");

    // Step 1: "run" now triggers scope confirmation
    const scopeConfirm = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "run",
        state: save.json().state
      }
    });

    expect(scopeConfirm.statusCode).toBe(200);
    expect(scopeConfirm.json().assistant_message).toContain("Ready to run");
    expect(scopeConfirm.json().state.scope_pending).toBe(true);

    // Step 2: Confirm to actually execute the run
    const run = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "confirm",
        state: scopeConfirm.json().state
      }
    });

    expect(run.statusCode).toBe(200);
    const runBody = run.json();
    expect(runBody.assistant_message).toContain("Report executed");
    expect(runBody.assistant_message).toContain("Revenue up 12%");
    expect(runBody.pdf_download_url).toBe("/api/runs/run_web_test/pdf");
    expect(runBody.state.last_run_id).toBe("run_web_test");
    expect(runBody.state.last_exec_brief).toBeTruthy();
    expect(runBody.state.scope_pending).toBe(false);

    // Ask for PDF download
    const pdfRequest = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Can I download the PDF?",
        state: runBody.state
      }
    });
    expect(pdfRequest.statusCode).toBe(200);
    expect(pdfRequest.json().pdf_download_url).toBe("/api/runs/run_web_test/pdf");

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

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(JSON.stringify({
          relations: [{
            schema_name: "analytics", relation_name: "sales",
            qualified_name: "analytics.sales",
            has_select_privilege: true, rls_active_for_me: false, policies_count_for_me: 0,
            status: "OK", status_label: "OK"
          }]
        }), { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(JSON.stringify({
          rows: [{ row_count: 1500 }], row_count: 1,
          governed_sql: "SELECT COUNT(*)", warnings: []
        }), { status: 200, headers: { "content-type": "application/json" } });
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

    // Turn 1: Greeting — LLM handles, passthrough returns state context
    const turn1 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "Hi" }
    });
    expect(turn1.statusCode).toBe(200);

    // Turn 2: Natural language report request — should update draft fields
    const turn2 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "I need a weekly CEO report by region. Call it Weekly CEO Revenue Report.",
        state: turn1.json().state
      }
    });
    expect(turn2.statusCode).toBe(200);
    expect(turn2.json().assistant_message).toContain("Draft updated");

    // Turn 3: Run request → scope confirmation
    const turn3 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Run it now",
        state: turn2.json().state
      }
    });
    expect(turn3.statusCode).toBe(200);
    expect(turn3.json().assistant_message).toContain("Ready to run");
    expect(turn3.json().state.scope_pending).toBe(true);

    // Turn 4: Confirm to execute
    const turn4 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "yes",
        state: turn3.json().state
      }
    });
    expect(turn4.statusCode).toBe(200);
    expect(turn4.json().assistant_message).toContain("Report executed");
    expect(turn4.json().state.last_run_id).toBe("run_nl_test");

    // Turn 5: Ask for PDF
    const turn5 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Can I download the PDF?",
        state: turn4.json().state
      }
    });
    expect(turn5.statusCode).toBe(200);
    expect(turn5.json().pdf_download_url).toBe("/api/runs/run_nl_test/pdf");

    expect(
      requests.some((request) => request.method === "POST" && request.url.endsWith("/report-contracts"))
    ).toBe(true);
    expect(
      requests.some((request) => request.method === "POST" && request.url.endsWith("/report-contracts/contract_nl_test/run"))
    ).toBe(true);

    await app.close();
  });

  it("supports continue-scoping choice without executing analysis", async () => {
    let runCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(JSON.stringify({
          relations: [{
            schema_name: "analytics",
            relation_name: "sales",
            qualified_name: "analytics.sales",
            has_select_privilege: true,
            rls_active_for_me: false,
            policies_count_for_me: 0,
            status: "OK",
            status_label: "OK"
          }]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(JSON.stringify({
          rows: [{ row_count: 1500 }],
          row_count: 1,
          governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
          warnings: []
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.includes("/report-contracts/") && url.endsWith("/run") && method === "POST") {
        runCalls += 1;
        return new Response(JSON.stringify({
          run_id: "run_scope_choice_test",
          exec_brief: {
            what_changed: ["n/a"],
            why: ["n/a"],
            so_what: ["n/a"],
            what_to_do: ["n/a"],
            confidence: { score: 0.5, rationale: "n/a" },
            appendix_refs: [],
            deltas_vs_last_run: [],
            generated_at: "2026-01-01T00:00:00.000Z"
          }
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts") && method === "POST") {
        const rawBody = typeof init?.body === "string" ? init.body : "{}";
        const payload = JSON.parse(rawBody) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...payload, id: "contract_scope_choice_test" }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts") && method === "GET") {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(
        JSON.stringify({ message: `Unhandled request: ${method} ${url}` }),
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

    const scopePrompt = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "run" }
    });

    expect(scopePrompt.statusCode).toBe(200);
    expect(scopePrompt.json().state.scope_pending).toBe(true);

    const continueScoping = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_continue_scoping__",
        state: scopePrompt.json().state
      }
    });

    expect(continueScoping.statusCode).toBe(200);
    expect(continueScoping.json().assistant_message).toContain("Continue scoping");
    expect(continueScoping.json().state.scope_pending).toBe(false);
    expect(runCalls).toBe(0);

    await app.close();
  });

  it("routes every chat turn through conversation client", async () => {
    const seen: string[] = [];
    const conversationClient: ConversationClient = {
      provider: "stub" as const,
      mode: "deterministic" as const,
      async respond(input) {
        seen.push(input.user_message);
        return { message: `[AI] ${input.action_context}` };
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
        message: "set name: Test Report",
        state: first.json().state
      }
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().assistant_message.startsWith("[AI]")).toBe(true);
    expect(seen).toEqual(["hello", "set name: Test Report"]);
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

  it("proxies database connector endpoints", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/active") && method === "GET") {
        return new Response(
          JSON.stringify({
            connected: true,
            name: "test-db",
            database: "test-db",
            connected_at: "2026-01-01T00:00:00.000Z",
            allowed_relations: ["public.sales"],
            allowed_schemas: ["public"],
            available_relations: ["public.sales", "public.customers"],
            source: "runtime"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/connections/fix-script") && method === "POST") {
        return new Response(
          JSON.stringify({
            ok: true,
            script: "BEGIN; -- fix script\nCOMMIT;"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/connections/query-logs") && method === "GET") {
        return new Response(
          JSON.stringify({
            logs: []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ id: 1, amount: 100 }],
            row_count: 1,
            governed_sql: "SELECT * FROM public.sales LIMIT 10",
            warnings: []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/connections/catalogue") && method === "POST") {
        return new Response(
          JSON.stringify({
            business_id: "biz_demo_001",
            tables: [],
            business_context: "",
            cataloged_at: "2026-01-01T00:00:00.000Z"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          message: `Unhandled request: ${method} ${url}`
        }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: createPassthroughConversationClient()
    });

    const context = await app.inject({
      method: "GET",
      url: "/api/db/context"
    });

    expect(context.statusCode).toBe(200);
    expect(context.json().connected).toBe(true);

    const query = await app.inject({
      method: "POST",
      url: "/api/db/query",
      payload: {
        sql: "SELECT * FROM public.sales",
        limit: 10
      }
    });

    expect(query.statusCode).toBe(200);
    expect(query.json().row_count).toBe(1);

    const fix = await app.inject({
      method: "POST",
      url: "/api/db/fix-script",
      payload: {
        allowlisted_relations: ["public.sales"]
      }
    });
    expect(fix.statusCode).toBe(200);
    expect(typeof fix.json().script).toBe("string");

    const logs = await app.inject({
      method: "GET",
      url: "/api/db/query-logs"
    });
    expect(logs.statusCode).toBe(200);
    expect(Array.isArray(logs.json().logs)).toBe(true);

    const catalogue = await app.inject({
      method: "POST",
      url: "/api/db/catalogue"
    });

    expect(catalogue.statusCode).toBe(200);
    expect(catalogue.json().business_id).toBe("biz_demo_001");

    await app.close();
  });

  it("lets chat run safe query and sync connected tables", async () => {
    let queryCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/active") && method === "GET") {
        return new Response(
          JSON.stringify({
            connected: true,
            database: "analytics-db",
            allowed_relations: ["public.sales", "public.customers"],
            allowed_schemas: ["public"],
            available_relations: ["public.sales", "public.customers"],
            source: "runtime"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        queryCalls += 1;
        return new Response(
          JSON.stringify({
            rows: [{ id: 1, amount: 42 }],
            row_count: 1,
            governed_sql: "SELECT id, amount FROM public.sales LIMIT 20",
            warnings: []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/report-contracts") && method === "GET") {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(
        JSON.stringify({
          message: `Unhandled request: ${method} ${url}`
        }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: createPassthroughConversationClient()
    });

    const sync = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "use connected tables"
      }
    });

    expect(sync.statusCode).toBe(200);
    expect(sync.json().assistant_message).toContain("Synced");
    expect(sync.json().state.draft.allowed_relations).toContain("public.sales");

    const query = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "query: SELECT id, amount FROM public.sales LIMIT 20",
        state: sync.json().state
      }
    });

    expect(query.statusCode).toBe(200);
    expect(query.json().assistant_message).toContain("waiting for your confirmation");
    expect(query.json().state.pending_query_sql).toContain("SELECT id, amount FROM public.sales LIMIT 20");
    expect(queryCalls).toBe(0);

    const runQuery = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_run_query__",
        state: query.json().state
      }
    });

    expect(runQuery.statusCode).toBe(200);
    expect(runQuery.json().assistant_message).toContain("Query completed. Query ID:");
    expect(runQuery.json().assistant_message).toContain("Rows returned: 1");
    expect(runQuery.json().state.pending_query_sql).toBeNull();
    expect(runQuery.json().state.last_query_id).toMatch(/^qry_/);
    expect(queryCalls).toBe(1);

    const bareSql = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "SELECT id, amount FROM public.sales LIMIT 20",
        state: runQuery.json().state
      }
    });

    expect(bareSql.statusCode).toBe(200);
    expect(bareSql.json().state.pending_query_sql).toContain("SELECT id, amount FROM public.sales LIMIT 20");
    expect(queryCalls).toBe(1);

    const otherInstruction = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_query_other_instruction__",
        state: bareSql.json().state
      }
    });

    expect(otherInstruction.statusCode).toBe(200);
    expect(otherInstruction.json().assistant_message).toContain("continue with other instructions");
    expect(otherInstruction.json().state.pending_query_sql).toBeNull();
    expect(queryCalls).toBe(1);

    await app.close();
  });

  it("prevents false query-running claims when no query was executed", async () => {
    const conversationClient: ConversationClient = {
      provider: "openai",
      mode: "provider",
      async respond() {
        return {
          message: [
            "I'm running the query now.",
            "```sql",
            "SELECT * FROM public.demo_support_tickets LIMIT 5;",
            "```",
            "I'll share results once they come back."
          ].join("\n")
        };
      }
    };

    const app = buildWebApp({
      conversation_client: conversationClient
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "can you confirm if the query is running?"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).toContain("I haven't executed a SQL query yet.");

    await app.close();
  });

  function buildCatalogFetchImpl() {
    const mockCatalog = {
      tables: [
        {
          qualified_name: "public.orders",
          relation_type: "TABLE",
          columns: [
            { column_name: "id", data_type: "integer", is_nullable: false },
            { column_name: "customer_id", data_type: "integer", is_nullable: false },
            { column_name: "total_amount", data_type: "numeric", is_nullable: false },
            { column_name: "created_at", data_type: "timestamp", is_nullable: false },
            { column_name: "region", data_type: "text", is_nullable: true },
            { column_name: "status", data_type: "varchar", is_nullable: false }
          ],
          sample_rows: [
            { id: 1, customer_id: 101, total_amount: 250.00, created_at: "2026-01-15", region: "NA", status: "completed" },
            { id: 2, customer_id: 102, total_amount: 180.50, created_at: "2026-01-16", region: "EU", status: "pending" }
          ],
          row_count_estimate: 15420
        },
        {
          qualified_name: "public.customers",
          relation_type: "TABLE",
          columns: [
            { column_name: "id", data_type: "integer", is_nullable: false },
            { column_name: "name", data_type: "text", is_nullable: false },
            { column_name: "email", data_type: "text", is_nullable: false },
            { column_name: "segment", data_type: "varchar", is_nullable: true },
            { column_name: "signed_up_at", data_type: "timestamp", is_nullable: false }
          ],
          sample_rows: [
            { id: 101, name: "Acme Corp", email: "sales@acme.com", segment: "Enterprise", signed_up_at: "2025-06-01" }
          ],
          row_count_estimate: 3200
        },
        {
          qualified_name: "public.products",
          relation_type: "TABLE",
          columns: [
            { column_name: "id", data_type: "integer", is_nullable: false },
            { column_name: "name", data_type: "text", is_nullable: false },
            { column_name: "category", data_type: "varchar", is_nullable: true },
            { column_name: "price", data_type: "numeric", is_nullable: false }
          ],
          sample_rows: [
            { id: 1, name: "Widget Pro", category: "Tools", price: 49.99 }
          ],
          row_count_estimate: 580
        }
      ],
      business_context: "B2B SaaS company selling project management tools. Revenue from monthly subscriptions. Tracks sales by region and customer segment.",
      cataloged_at: "2026-02-16T00:00:00.000Z"
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify(mockCatalog), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/active") && method === "GET") {
        return new Response(
          JSON.stringify({
            connected: true,
            database: "analytics-db",
            allowed_relations: ["public.orders", "public.customers", "public.products"],
            allowed_schemas: ["public"],
            available_relations: ["public.orders", "public.customers", "public.products"],
            source: "runtime"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(JSON.stringify({
          relations: [
            { schema_name: "public", relation_name: "orders", qualified_name: "public.orders", has_select_privilege: true, rls_active_for_me: false, policies_count_for_me: 0, status: "OK", status_label: "OK" },
            { schema_name: "public", relation_name: "customers", qualified_name: "public.customers", has_select_privilege: true, rls_active_for_me: false, policies_count_for_me: 0, status: "OK", status_label: "OK" },
            { schema_name: "public", relation_name: "products", qualified_name: "public.products", has_select_privilege: true, rls_active_for_me: false, policies_count_for_me: 0, status: "OK", status_label: "OK" },
            { schema_name: "analytics", relation_name: "sales", qualified_name: "analytics.sales", has_select_privilege: true, rls_active_for_me: false, policies_count_for_me: 0, status: "OK", status_label: "OK" }
          ]
        }), { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ id: 1, total_amount: 250.00, region: "NA", row_count: 1500 }],
            row_count: 1,
            governed_sql: "SELECT id, total_amount, region FROM public.orders LIMIT 10",
            warnings: []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/report-contracts") && method === "GET") {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts") && method === "POST") {
        const rawBody = typeof init?.body === "string" ? init.body : "{}";
        const payload = JSON.parse(rawBody) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ ...payload, id: "contract_catalog_test" }),
          { status: 201, headers: { "content-type": "application/json" } }
        );
      }

      if (url.includes("/report-contracts/") && url.endsWith("/run") && method === "POST") {
        return new Response(
          JSON.stringify({
            run_id: "run_catalog_test",
            exec_brief: {
              what_changed: ["Revenue up 12% MoM"],
              why: ["Enterprise segment growth"],
              so_what: ["On track for quarterly target"],
              what_to_do: ["Continue current strategy"],
              confidence: { score: 0.85, rationale: "Good data coverage" },
              appendix_refs: [],
              deltas_vs_last_run: [],
              generated_at: "2026-01-01T00:00:00.000Z"
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message: `Unhandled: ${method} ${url}` }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    };

    return { fetchImpl, mockCatalog };
  }

  it("passes catalog and business context to conversation client", async () => {
    const { fetchImpl } = buildCatalogFetchImpl();
    let capturedInput: { catalog_summary?: string; business_context?: string; action_context?: string } | null = null;
    const conversationClient: ConversationClient = {
      provider: "stub" as const,
      mode: "deterministic" as const,
      async respond(input) {
        capturedInput = {
          catalog_summary: input.catalog_summary,
          business_context: input.business_context,
          action_context: input.action_context
        };
        return { message: input.action_context };
      }
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: conversationClient
    });

    await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "hello" }
    });

    expect(capturedInput).not.toBeNull();
    // Business context should be passed through
    expect(capturedInput!.business_context).toContain("B2B SaaS");
    // Catalog summary should contain table info
    expect(capturedInput!.catalog_summary).toContain("public.orders");
    expect(capturedInput!.catalog_summary).toContain("total_amount");
    expect(capturedInput!.catalog_summary).toContain("public.customers");

    await app.close();
  });

  it("sends catalog context to LLM for all messages including data questions", async () => {
    const { fetchImpl } = buildCatalogFetchImpl();
    const capturedContexts: string[] = [];
    const conversationClient: ConversationClient = {
      provider: "stub" as const,
      mode: "deterministic" as const,
      async respond(input) {
        capturedContexts.push(input.catalog_summary ?? "");
        return { message: input.action_context };
      }
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: conversationClient
    });

    // All these messages — data questions, report ideas, natural phrasing — go to the LLM
    // with the full catalog in the system prompt
    const messages = [
      "What data do you have?",
      "what reports can I build?",
      "suggest some reports",
      "describe my data",
      "what's in my database?",
      "what can you gather from my tables?",
      "can you access my tables?",
      "tell me about my tables",
      "what insights can you pull?",
      "explore my data"
    ];

    for (const message of messages) {
      await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message }
      });
    }

    // Every message should have received the catalog context
    expect(capturedContexts).toHaveLength(messages.length);
    for (const ctx of capturedContexts) {
      expect(ctx).toContain("public.orders");
      expect(ctx).toContain("total_amount");
      expect(ctx).toContain("public.customers");
    }

    await app.close();
  });

  it("handles gracefully when no DB is connected", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({ message: "No active connection" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ message: `Unhandled: ${method} ${url}` }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    };

    let capturedCatalog = "";
    const conversationClient: ConversationClient = {
      provider: "stub" as const,
      mode: "deterministic" as const,
      async respond(input) {
        capturedCatalog = input.catalog_summary ?? "";
        return { message: input.action_context };
      }
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: conversationClient
    });

    const result = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "what reports can I build?" }
    });
    expect(result.statusCode).toBe(200);
    // With no catalog, the LLM still gets the message but catalog_summary is empty
    expect(capturedCatalog).toBe("");

    await app.close();
  });

  it("delegates all unrecognized messages to LLM with state context", async () => {
    const { fetchImpl } = buildCatalogFetchImpl();
    let capturedAction = "";
    const conversationClient: ConversationClient = {
      provider: "stub" as const,
      mode: "deterministic" as const,
      async respond(input) {
        capturedAction = input.action_context;
        return { message: input.action_context };
      }
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: conversationClient
    });

    // A message that doesn't match any specific handler
    const gibberish = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "blorp zingle freem" }
    });
    expect(gibberish.statusCode).toBe(200);
    // Action context should contain state info (not catalog — that's in system prompt)
    expect(capturedAction).toContain("Current draft");
    expect(capturedAction).toContain("No specific action was executed");

    await app.close();
  });

  it("action context contains exec brief when a report has been run", async () => {
    const { fetchImpl } = buildCatalogFetchImpl();
    let capturedAction = "";
    const conversationClient: ConversationClient = {
      provider: "stub" as const,
      mode: "deterministic" as const,
      async respond(input) {
        capturedAction = input.action_context;
        return { message: input.action_context };
      }
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: conversationClient
    });

    // Run the report — first triggers scope confirmation
    const scope = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "run" }
    });
    expect(scope.statusCode).toBe(200);
    expect(capturedAction).toContain("Ready to run");

    // Confirm to actually execute
    const run = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "confirm",
        state: scope.json().state
      }
    });
    expect(run.statusCode).toBe(200);
    expect(capturedAction).toContain("Report executed");

    // Ask a follow-up question — the exec brief should be in the state context
    await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "what did you find?",
        state: run.json().state
      }
    });
    // The state context (returned for unrecognized messages) includes last analysis info
    expect(capturedAction).toContain("Last analysis");

    await app.close();
  });

  it("supports multi-turn data-aware conversation", async () => {
    const { fetchImpl } = buildCatalogFetchImpl();
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: createPassthroughConversationClient()
    });

    // Turn 1: Open-ended question — goes to LLM via passthrough (returns state context)
    const turn1 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "what data do you have?" }
    });
    expect(turn1.statusCode).toBe(200);

    // Turn 2: Another question — state carries over
    const turn2 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "what reports can I build with this?",
        state: turn1.json().state
      }
    });
    expect(turn2.statusCode).toBe(200);

    // Turn 3: Start building a report — should update draft fields
    const turn3 = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "I want a weekly sales report for the sales team by region",
        state: turn2.json().state
      }
    });
    expect(turn3.statusCode).toBe(200);
    const state3 = turn3.json().state;
    // Should have picked up audience and schedule from natural language
    expect(state3.draft.audience.toLowerCase()).toContain("sales");
    expect(state3.draft.schedule_cron).not.toBeNull();
    expect(state3.draft.dimension_ids).toContain("region");

    await app.close();
  });
});
