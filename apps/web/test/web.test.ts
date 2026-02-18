import { describe, expect, it } from "vitest";
import { buildWebApp } from "../src/app";
import { createPassthroughConversationClient } from "../src/conversation";

describe("web chat interface", () => {
  it("serves health and html routes", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok", service: "web" });

    const page = await app.inject({ method: "GET", url: "/" });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Project Overload");

    const connectPage = await app.inject({ method: "GET", url: "/connect" });
    expect(connectPage.statusCode).toBe(200);
    expect(connectPage.body).toContain("1-Click Database Connection Wizard");

    await app.close();
  });

  it("persists state updates from set commands", async () => {
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
    expect(body.state.conversation_history).toHaveLength(2);

    await app.close();
  });

  it("sets prep decision state when assistant confirms scope is ready for data preparation", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message: "Perfect — scope is locked in. Click Run Data Preparation when you're ready."
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "scope looks good to me"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.prep_pending).toBe(true);
    expect(body.assistant_message).toContain("Run Data Preparation");

    await app.close();
  });

  it("runs prepare -> analysis -> pdf confirmation workflow", async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";
      requests.push({ url, method });

      if (url.endsWith("/report-contracts") && method === "POST") {
        const rawBody = typeof init?.body === "string" ? init.body : "{}";
        const payload = JSON.parse(rawBody) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...payload, id: "contract_web_test" }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts/contract_web_test/prepare") && method === "POST") {
        return new Response(JSON.stringify({
          contract_id: "contract_web_test",
          planner_summary: "Prepared scoped payloads.",
          prepared_payloads: [
            {
              question_id: "q_1",
              question: "Revenue trend",
              purpose: "Trend analysis",
              row_count_before_reduction: 500,
              prepared_row_count: 200,
              preparation_notes: ["Applied aggregation"],
              warnings: []
            }
          ],
          token_usage: {
            input_tokens: 100,
            output_tokens: 20,
            total_tokens: 120,
            by_agent: {}
          }
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts/contract_web_test/run") && method === "POST") {
        return new Response(JSON.stringify({
          run_id: "run_web_test",
          exec_brief: {
            what_changed: ["Revenue up 12%"],
            why: ["Higher order frequency"],
            so_what: ["Growth target is on track"],
            what_to_do: ["Increase top-performing channel budget"],
            confidence: { score: 0.84, rationale: "Coverage includes all top regions." },
            appendix_refs: ["evidence_contract_web_test_1"],
            deltas_vs_last_run: ["NA revenue +8%"],
            generated_at: "2026-01-01T00:00:00.000Z"
          },
          concise_summary: "Test Report summary\n- 📈 Revenue up 12%",
          prepared_payloads: [
            {
              question_id: "q_1",
              question: "Revenue trend",
              purpose: "Trend analysis",
              row_count_before_reduction: 500,
              prepared_row_count: 200,
              preparation_notes: ["Applied aggregation"],
              warnings: []
            }
          ],
          token_usage: {
            input_tokens: 260,
            output_tokens: 80,
            total_tokens: 340,
            by_agent: {}
          },
          pdf_path: "/report-runs/run_web_test/pdf"
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-runs/run_web_test/qa") && method === "POST") {
        return new Response(JSON.stringify({
          answer: "- Revenue trend: Revenue up 12%",
          citations: ["q_1"],
          grounded: true
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-runs/run_web_test/save") && method === "POST") {
        return new Response(JSON.stringify({
          run_id: "run_web_test",
          contract_id: "contract_web_test",
          saved: true,
          logged_at: "2026-01-01T00:00:00.000Z"
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts/contract_web_test/schedule") && method === "POST") {
        return new Response(JSON.stringify({
          contract_id: "contract_web_test",
          frequency: "weekly",
          timezone: "UTC",
          schedule_cron: "0 9 * * 1"
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts/contract_web_test/approve") && method === "POST") {
        return new Response(JSON.stringify({
          id: "contract_web_test",
          tenant_id: "default",
          name: "Weekly CEO Revenue",
          audience: "Executive",
          timezone: "UTC",
          schedule_cron: null,
          sql_template: "SELECT * FROM analytics.sales",
          metric_ids: ["metric_revenue"],
          dimension_ids: ["region"],
          insight_mode: "business",
          delivery: { emails: [] },
          lifecycle_status: "approved",
          contract_version: 2,
          approved_by: "system",
          approved_at: "2026-01-01T00:00:00.000Z",
          locked_by: null,
          locked_at: null,
          guardrails: {
            evidence_row_cap: 200,
            max_batches: 5,
            allowed_relations: ["analytics.sales"],
            allowed_schemas: ["analytics"],
            timeout_ms: 10000,
            deny_write: true
          }
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts/contract_web_test/lock") && method === "POST") {
        return new Response(JSON.stringify({
          id: "contract_web_test",
          tenant_id: "default",
          name: "Weekly CEO Revenue",
          audience: "Executive",
          timezone: "UTC",
          schedule_cron: null,
          sql_template: "SELECT * FROM analytics.sales",
          metric_ids: ["metric_revenue"],
          dimension_ids: ["region"],
          insight_mode: "business",
          delivery: { emails: [] },
          lifecycle_status: "locked",
          contract_version: 3,
          approved_by: "system",
          approved_at: "2026-01-01T00:00:00.000Z",
          locked_by: "system",
          locked_at: "2026-01-01T00:01:00.000Z",
          guardrails: {
            evidence_row_cap: 200,
            max_batches: 5,
            allowed_relations: ["analytics.sales"],
            allowed_schemas: ["analytics"],
            timeout_ms: 10000,
            deny_write: true
          }
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-runs/run_web_test/pdf") && method === "GET") {
        return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
          status: 200,
          headers: { "content-type": "application/pdf" }
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

      if (url.endsWith("/report-contracts") && method === "GET") {
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: createPassthroughConversationClient()
    });

    const setName = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Weekly CEO Revenue" }
    });
    expect(setName.statusCode).toBe(200);

    const save = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "save", state: setName.json().state }
    });
    expect(save.statusCode).toBe(200);

    const run = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "run", state: save.json().state }
    });
    expect(run.statusCode).toBe(200);
    expect(run.json().state.prep_pending).toBe(true);

    const prepared = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_run_data_preparation__", state: run.json().state }
    });
    expect(prepared.statusCode).toBe(200);
    expect(prepared.json().state.scope_pending).toBe(true);

    const analyzed = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_finish_scoping_run_analysis__", state: prepared.json().state }
    });
    expect(analyzed.statusCode).toBe(200);
    expect(analyzed.json().state.awaiting_pdf_confirmation).toBe(true);
    expect(analyzed.json().assistant_message).toContain("Report executed");

    const qa = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "what changed?", state: analyzed.json().state }
    });
    expect(qa.statusCode).toBe(200);
    expect(qa.json().assistant_message).toContain("Revenue trend");

    const confirmPdf = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_generate_pdf_yes__", state: analyzed.json().state }
    });
    expect(confirmPdf.statusCode).toBe(200);
    expect(confirmPdf.json().pdf_download_url).toBe("/api/runs/run_web_test/pdf");
    expect(confirmPdf.json().state.awaiting_save_confirmation).toBe(true);

    const saveRun = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_save_report_yes__", state: confirmPdf.json().state }
    });
    expect(saveRun.statusCode).toBe(200);
    expect(saveRun.json().state.awaiting_schedule_confirmation).toBe(true);

    const scheduleStart = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_schedule_setup_yes__", state: saveRun.json().state }
    });
    expect(scheduleStart.statusCode).toBe(200);
    expect(scheduleStart.json().state.awaiting_schedule_mode_selection).toBe(true);

    const scheduleMode = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_schedule_mode_weekly__", state: scheduleStart.json().state }
    });
    expect(scheduleMode.statusCode).toBe(200);

    const scheduleDay = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_schedule_weekday_mon__", state: scheduleMode.json().state }
    });
    expect(scheduleDay.statusCode).toBe(200);
    expect(scheduleDay.json().state.draft.schedule_cron).toBe("0 9 * * 1");

    expect(requests.some((request) => request.url.endsWith("/report-contracts/contract_web_test/prepare"))).toBe(true);
    expect(requests.some((request) => request.url.endsWith("/report-contracts/contract_web_test/run"))).toBe(true);
    expect(requests.some((request) => request.url.endsWith("/report-runs/run_web_test/qa"))).toBe(true);
    expect(requests.some((request) => request.url.endsWith("/report-runs/run_web_test/save"))).toBe(true);
    expect(requests.some((request) => request.url.endsWith("/report-contracts/contract_web_test/schedule"))).toBe(true);

    await app.close();
  });
});
