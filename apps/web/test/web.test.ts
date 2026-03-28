import { describe, expect, it } from "vitest";
import { buildWebApp } from "../src/app";
import { createPassthroughConversationClient } from "../src/conversation";
import type { QueryRouterClient } from "../src/query-router";
import { applyLlmDraftUpdates, createInitialChatState, handleChatTurn, parseChatState } from "../src/chat";

describe("web chat interface", () => {
  const createScopeVerificationFetchImpl = (rowCount: number): typeof fetch => {
    return async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/table-health") && method === "GET") {
        return new Response(JSON.stringify({
          relations: [
            {
              qualified_name: "analytics.sales",
              status: "OK",
              status_label: "OK",
              relation_type: "TABLE",
              rls_active: false,
              policies_count: 0,
              can_select: true,
              can_insert: false,
              can_update: false,
              can_delete: false,
              owner: null,
              grants: []
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(JSON.stringify({
          rows: [{ row_count: rowCount }],
          row_count: 1,
          governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
          warnings: []
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({
          business_context: "",
          cataloged_at: "2026-03-01T00:00:00.000Z",
          tables: [
            {
              table_id: "tbl_sales",
              qualified_name: "analytics.sales",
              relation_type: "TABLE",
              summary: "Sales facts",
              columns: [
                { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false }
              ],
              low_cardinality_columns: [],
              sample_rows: [],
              row_count_estimate: rowCount
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };
  };

  it("serves health and html routes", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient(),
      marketing_asset_mode: "stub"
    });

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok", service: "web" });

    const marketingPage = await app.inject({ method: "GET", url: "/" });
    expect(marketingPage.statusCode).toBe(200);
    expect(marketingPage.body).toContain("Claritect");
    expect(marketingPage.body).toContain("Turn data into decisions");
    expect(marketingPage.body).toContain("/marketing-assets/home.js");
    expect(marketingPage.body).toContain("Book a Live Pilot");

    const pricingPage = await app.inject({ method: "GET", url: "/pricing" });
    expect(pricingPage.statusCode).toBe(200);
    expect(pricingPage.body).toContain("Claritect | Pricing");
    expect(pricingPage.body).toContain("How Claritect compares");
    expect(pricingPage.body).toContain("Self-serve AI tools");
    expect(pricingPage.body).toContain("/marketing-assets/pricing.js");

    const marketingHomeScript = await app.inject({ method: "GET", url: "/marketing-assets/home.js" });
    expect(marketingHomeScript.statusCode).toBe(200);
    expect(marketingHomeScript.headers["content-type"]).toContain("text/javascript");
    expect(marketingHomeScript.body).toContain("HomeHeroScene");

    const marketingPricingStyles = await app.inject({ method: "GET", url: "/marketing-assets/pricing.css" });
    expect(marketingPricingStyles.statusCode).toBe(200);
    expect(marketingPricingStyles.headers["content-type"]).toContain("text/css");
    expect(marketingPricingStyles.body).toContain(".mk-pricing-hero");

    const loginPage = await app.inject({ method: "GET", url: "/login" });
    expect(loginPage.statusCode).toBe(200);
    expect(loginPage.body).toContain("Claritect | Customer login");

    const adminLoginPage = await app.inject({ method: "GET", url: "/admin/login" });
    expect(adminLoginPage.statusCode).toBe(200);
    expect(adminLoginPage.body).toContain("Claritect | Admin login");

    const loggedOutPage = await app.inject({ method: "GET", url: "/logout" });
    expect(loggedOutPage.statusCode).toBe(200);
    expect(loggedOutPage.body).toContain("Claritect | Signed out");
    expect(loggedOutPage.body).toContain("You’re safely signed out.");

    const adminLoggedOutPage = await app.inject({ method: "GET", url: "/admin/logout" });
    expect(adminLoggedOutPage.statusCode).toBe(200);
    expect(adminLoggedOutPage.body).toContain("Claritect | Admin signed out");
    expect(adminLoggedOutPage.body).toContain("Admin session closed.");

    const page = await app.inject({ method: "GET", url: "/app" });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Claritect");
    expect(page.body).toContain('id="schedule-modal"');
    expect(page.body).toContain("Save schedule");
    expect(page.body).toContain("How should the time windows change on each run?");

    const connectPage = await app.inject({ method: "GET", url: "/connect" });
    expect(connectPage.statusCode).toBe(200);
    expect(connectPage.body).toContain("Data Sources");
    expect(connectPage.body).toContain("Step A1 - Choose a database type");
    expect(connectPage.body).toContain("Snowflake");
    expect(connectPage.body).toContain("BigQuery");
    expect(connectPage.body).toContain("Guided setup");
    expect(connectPage.body).toContain("Paste connection string");
    expect(connectPage.body).toContain("Disable TLS (local/dev)");
    expect(connectPage.body).toContain("URL-encodes credentials safely");
    expect(connectPage.body).toContain("Step A2 - Set up your Postgres connection");
      expect(connectPage.body).toContain("Postgres connection details");
      expect(connectPage.body).toContain("There is no warehouse for Postgres");
      expect(connectPage.body).toContain("Test Postgres connection");
      expect(connectPage.body).toContain("Connect Postgres source");
      expect(connectPage.body).toContain("For corporate VPN / SSL inspection");
      expect(connectPage.body).not.toContain("Role (optional)");
      expect(connectPage.body).not.toContain("Location (optional)");
      expect(connectPage.body).not.toContain("Credentials JSON (optional)");
      expect(connectPage.body).toContain("A safe query will be suggested once the governed allowlist is ready.");
    expect(connectPage.body).toContain('href="/connect/guide"');
    expect(connectPage.body).toContain("Open the database connection guide");
    expect(connectPage.body).not.toContain("Open Chat Interface");
    expect(connectPage.body).not.toContain("SELECT * FROM public.sales LIMIT 50");
    expect(connectPage.body).not.toContain("Available now");
    expect(connectPage.body).not.toContain("In rollout");

    const guidePage = await app.inject({ method: "GET", url: "/connect/guide" });
    expect(guidePage.statusCode).toBe(200);
    expect(guidePage.body).toContain("Database Connection Guide");
    expect(guidePage.body).toContain("snowflake://user:password@account/database/schema?warehouse=COMPUTE_WH");
    expect(guidePage.body).toContain("bigquery://project-id/dataset");

    const scheduledPage = await app.inject({ method: "GET", url: "/scheduled" });
    expect(scheduledPage.statusCode).toBe(200);
    expect(scheduledPage.body).toContain("Scheduled report types");
    expect(scheduledPage.body).toContain("Question handling on future runs");
    expect(scheduledPage.body).toContain("grid-template-columns:repeat(3,minmax(250px,1fr))");
    expect(scheduledPage.body).toContain("Open in chat");

    const usagePage = await app.inject({ method: "GET", url: "/usage" });
    expect(usagePage.statusCode).toBe(200);
    expect(usagePage.body).toContain("Claritect | Usage and AI balance");
    expect(usagePage.body).toContain("OpenRouter Credits");
    expect(usagePage.body).toContain("AI usage by model");

    const adminPage = await app.inject({ method: "GET", url: "/admin" });
    expect(adminPage.statusCode).toBe(200);
    expect(adminPage.body).toContain("Claritect | Admin dashboard");
    expect(adminPage.body).toContain("Admin console");

    await app.close();
  }, 20000);

  it("redirects logout posts to dedicated signed-out pages", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const customerLogout = await app.inject({
      method: "POST",
      url: "/auth/logout"
    });
    expect(customerLogout.statusCode).toBe(302);
    expect(customerLogout.headers.location).toBe("/logout");

    const adminLogout = await app.inject({
      method: "POST",
      url: "/admin/auth/logout"
    });
    expect(adminLogout.statusCode).toBe(302);
    expect(adminLogout.headers.location).toBe("/admin/logout");

    await app.close();
  });

  it("names a chat from the first two user messages", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async nameConversation() {
          return { title: "Monthly Refund Deep Dive" };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat/name",
      payload: {
        messages: ["show me refunds by city", "compare this month vs prior month"]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ title: "Monthly Refund Deep Dive" });

    await app.close();
  });

  it("proxies scheduled report status updates to the API", async () => {
    const requests: Array<{
      url: string;
      method: string;
      body: Record<string, unknown> | null;
      headers: Record<string, string>;
    }> = [];

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";
        const body =
          typeof init?.body === "string" && init.body.length > 0
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : null;
        const headers = Object.fromEntries(new Headers(init?.headers ?? {}).entries());

        requests.push({ url, method, body, headers });

        if (url.endsWith("/scheduled-reports/contract_sched_123/status") && method === "POST") {
          return new Response(
            JSON.stringify({
              profile: {
                id: "sched_profile_123",
                contract_id: "contract_sched_123",
                status: "paused"
              },
              contract: {
                id: "contract_sched_123",
                schedule_cron: null
              }
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" }
            }
          );
        }

        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/scheduled-reports/contract_sched_123/status",
      headers: {
        cookie: "po_user=test123"
      },
      payload: {
        status: "paused"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      profile: {
        contract_id: "contract_sched_123",
        status: "paused"
      }
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "http://api.local/scheduled-reports/contract_sched_123/status",
      body: { status: "paused" }
    });
    expect(requests[0]?.headers["x-ui-user"]).toBe("test123");

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

  it("uses the chat title for the saved report name when no explicit draft name is set", async () => {
    const state = createInitialChatState();
    state.session_title = "Refund Trend Analysis";

    const response = await handleChatTurn({
      message: "save",
      state,
      api_client: {
        async createContract(payload: { id: string; name: string }) {
          return payload;
        }
      } as any
    });

    expect(response.assistant_message).toContain('Name: "Refund Trend Analysis"');
    expect(response.state.contract_id).toMatch(/^contract_/);
  });

  it("uses LLM query router for single-query execution when router returns single_query", async () => {
    let executedSql = "";
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "single_query",
          sql: "SELECT SUM(total_amount) AS total_sales FROM public.demo_orders WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'",
          reason: "Single metric request can be answered with one aggregate query.",
          confidence: 0.91
        };
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders and sales",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 5000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        const body = typeof init?.body === "string" ? (JSON.parse(init.body) as { sql?: string }) : {};
        executedSql = body.sql ?? "";
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_sales: "9123.45"
              }
            ],
            row_count: 1,
            governed_sql: executedSql.length > 0 ? executedSql : "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Can you give me past month sales?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Query completed. Query ID:");
    expect(body.assistant_message).toContain("Total Sales:");
    expect(body.assistant_message).toContain("Method:");
    expect(body.assistant_message).toContain("Tables used:");
    expect(body.assistant_message).toContain("Filters used:");
    expect(executedSql).toContain("SELECT SUM(total_amount) AS total_sales");
    expect(body.state.pending_query_sql).toBe(null);

    await app.close();
  });

  const singleQueryDialectCases = [
    {
      provider: "mysql",
      expectedSqlFragment: "DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)",
      compiledSql:
        "SELECT SUM(total_amount) AS total_sales FROM `public`.`demo_orders` WHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)"
    },
    {
      provider: "snowflake",
      expectedSqlFragment: 'DATEADD(day, -30, CURRENT_DATE())',
      compiledSql:
        'SELECT SUM(total_amount) AS total_sales FROM "PUBLIC"."DEMO_ORDERS" WHERE order_date >= DATEADD(day, -30, CURRENT_DATE())'
    },
    {
      provider: "bigquery",
      expectedSqlFragment: "DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)",
      compiledSql:
        "SELECT SUM(total_amount) AS total_sales FROM `demo-project.public.demo_orders` WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)"
    }
  ] as const;

  for (const testCase of singleQueryDialectCases) {
    it(`compiles routed SQL to the ${testCase.provider} dialect before single-query execution`, async () => {
      let executedSql = "";
      const router: QueryRouterClient = {
        provider: "openrouter",
        mode: "provider",
        async decide() {
          return {
            route: "single_query",
            sql: "SELECT SUM(total_amount) AS total_sales FROM public.demo_orders WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'",
            reason: "Single metric request can be answered with one aggregate query.",
            confidence: 0.9
          };
        },
        async compile_sql(input) {
          expect(input.dialect).toBe(testCase.provider);
          return {
            sql: testCase.compiledSql,
            rationale: `Converted interval syntax for ${testCase.provider}.`
          };
        }
      };

      const fetchImpl: typeof fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";

        if (url.endsWith("/connections/active") && method === "GET") {
          return new Response(
            JSON.stringify({
              connected: true,
              provider: testCase.provider,
              name: testCase.provider,
              database: "demo",
              connected_at: "2026-02-01T00:00:00.000Z",
              allowed_relations: ["public.demo_orders"],
              allowed_schemas: ["public"],
              available_relations: ["public.demo_orders"],
              source: "runtime"
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (url.endsWith("/connections/catalog") && method === "GET") {
          return new Response(
            JSON.stringify({
              business_id: "biz_test",
              business_context: "",
              cataloged_at: "2026-02-01T00:00:00.000Z",
              tables: [
                {
                  table_id: "tbl_orders",
                  qualified_name: "public.demo_orders",
                  relation_type: "TABLE",
                  summary: "Orders and sales",
                  columns: [
                    { column_name: "order_date", data_type: "timestamp", is_nullable: false },
                    { column_name: "total_amount", data_type: "decimal", is_nullable: false }
                  ],
                  low_cardinality_columns: [],
                  sample_rows: [],
                  row_count_estimate: 1000
                }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        if (url.endsWith("/connections/query") && method === "POST") {
          const body = typeof init?.body === "string" ? (JSON.parse(init.body) as { sql?: string }) : {};
          executedSql = body.sql ?? "";
          return new Response(
            JSON.stringify({
              rows: [{ total_sales: "1200.50" }],
              row_count: 1,
              governed_sql: executedSql,
              warnings: []
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }

        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      };

      const app = buildWebApp({
        api_base_url: "http://api.local",
        fetch_impl: fetchImpl,
        query_router: router,
        conversation_client: createPassthroughConversationClient()
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: {
          message: "total sales in last 30 days"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(executedSql).toContain(testCase.expectedSqlFragment);

      await app.close();
    });
  }

  it("uses LLM narrator for natural single-query explanation when available", async () => {
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "single_query",
          sql: "SELECT SUM(total_amount) AS total_sales FROM public.demo_orders WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'",
          reason: "Single metric request can be answered with one aggregate query.",
          confidence: 0.93
        };
      },
      async narrate_single_query() {
        return [
          "I calculated total sales from `public.demo_orders` for the last 30 days.",
          "I used one aggregate query with no joins and applied the requested date scope.",
          "Result: total sales are 9,123.45."
        ].join("\n");
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders and sales",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 5000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ total_sales: "9123.45" }],
            row_count: 1,
            governed_sql:
              "SELECT SUM(total_amount) AS total_sales FROM public.demo_orders WHERE order_date >= CURRENT_DATE - INTERVAL '30 days' LIMIT 500",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Can you give me past month sales?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Query completed. Query ID:");
    expect(body.assistant_message).toContain("I calculated total sales");
    expect(body.assistant_message).not.toContain("Tables used:");
    expect(body.assistant_message).not.toContain("Filters used:");

    await app.close();
  });

  it("does not block single-query execution behind metric confirmation prompts", async () => {
    let queryRuns = 0;
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "single_query",
          sql: "SELECT SUM(total_amount) AS total_refunds FROM public.demo_orders WHERE status = 'refunded'",
          reason: "Single metric request can be answered with one aggregate query.",
          confidence: 0.94
        };
      },
      async propose_metrics() {
        return {
          metrics: [
            {
              metric_key: "refund_rate",
              display_name: "Refund Rate",
              definition: "Refunded orders divided by total orders in the selected window.",
              source_type: "derived",
              source_columns: ["public.demo_orders.status", "public.demo_orders.order_id"],
              requires_confirmation: true,
              confirmation_question: "Should refund rate use all orders as denominator?"
            },
            {
              metric_key: "monthly_refund_count",
              display_name: "Monthly Refund Count",
              definition: "Count of refunded orders by month for the selected timeline.",
              source_type: "derived",
              source_columns: ["public.demo_orders.status", "public.demo_orders.order_date"],
              requires_confirmation: true,
              confirmation_question: "Confirm monthly window split."
            },
            {
              metric_key: "refund_change",
              display_name: "Refund Change",
              definition: "Change in refund count between comparison periods.",
              source_type: "derived",
              source_columns: ["public.demo_orders.status", "public.demo_orders.order_date"],
              requires_confirmation: true,
              confirmation_question: "Confirm comparison periods."
            }
          ]
        };
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders and statuses",
                columns: [
                  { column_name: "order_id", data_type: "uuid", is_nullable: false },
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 5000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        queryRuns += 1;
        return new Response(
          JSON.stringify({
            rows: [{ total_refunds: "2200.10" }],
            row_count: 1,
            governed_sql:
              "SELECT SUM(total_amount) AS total_refunds FROM public.demo_orders WHERE status = 'refunded' LIMIT 500",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: createPassthroughConversationClient()
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "I need refund rate for the past 4 months."
      }
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.assistant_message).toContain("Query completed. Query ID:");
    expect(firstBody.state.pending_metric_confirmations).toHaveLength(0);
    expect(queryRuns).toBe(1);

    await app.close();
  });

  it("routes complex asks to deep-analysis flow when router returns deep_analysis", async () => {
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "deep_analysis",
          reason: "Request includes multi-part trend comparison and diagnostics.",
          confidence: 0.95
        };
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_sales",
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                summary: "Sales fact table",
                columns: [
                  { column_name: "event_time", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 9000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: [
              {
                schema_name: "analytics",
                relation_name: "sales",
                qualified_name: "analytics.sales",
                has_select_privilege: true,
                rls_active_for_me: false,
                policies_count_for_me: 0,
                status: "OK",
                status_label: "OK"
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ row_count: 1200 }],
            row_count: 1,
            governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I want 6 months vs prior 6 months, top cities, top product problems, and support ticket reasons."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).not.toContain("Routing decision:");
    expect(body.assistant_message).toContain("Before data preparation");
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.scope_questions.length).toBeGreaterThan(0);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_pending).toBe(false);

    await app.close();
  });

  it("does not duplicate metric clarification when scope already covers the same ask", async () => {
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "deep_analysis",
          reason: "Multi-part analytical request.",
          confidence: 0.95
        };
      },
      async scope_clarifications() {
        return {
          questions: [
            {
              question_number: 1,
              question: "For refund rate by city, should it be count-based or value-based?",
              clarification: "Please confirm whether refund rate is refunded orders/total orders or refunded amount/total revenue."
            }
          ]
        };
      },
      async propose_metrics() {
        return {
          metrics: [
            {
              metric_key: "refund_rate_city",
              display_name: "Refund Rate by City",
              definition: "Rate of refunds per city.",
              source_type: "derived",
              source_columns: ["public.demo_orders.status", "public.demo_orders.total_amount", "public.demo_customers.city"],
              requires_confirmation: true,
              confirmation_question:
                "For refund rate by city, should this be count-based (refunded orders / total orders) or value-based (refunded amount / total revenue)?"
            }
          ]
        };
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders and refunds",
                columns: [
                  { column_name: "order_id", data_type: "uuid", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false },
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Compare refund trend and refund rate by city for the last 4 months."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message.toLowerCase()).not.toContain("metric definition");
    expect(body.state.scope_questions.length).toBeGreaterThanOrEqual(1);
    expect(body.state.scope_questions[0].question.toLowerCase()).toContain("refund rate");

    await app.close();
  });

  it("sets prep decision state when assistant confirms scope is ready for data preparation", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: [
              {
                qualified_name: "analytics.sales",
                status: "OK"
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            query_id: "qry_test",
            governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales LIMIT 1",
            row_count: 1,
            rows: [{ row_count: 1200 }],
            columns: ["row_count"],
            warnings: [],
            elapsed_ms: 9
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_sales",
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                summary: "Sales table",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1200
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
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
        message: "scope looks good to me",
        state: {
          draft: {
            name: "Scope Ready Report",
            audience: "Executive",
            timezone: "UTC",
            schedule_cron: null,
            sql_template: "SELECT * FROM analytics.sales",
            metric_ids: ["metric_refunds"],
            dimension_ids: ["city"],
            allowed_relations: ["analytics.sales"],
            allowed_schemas: ["analytics"],
            insight_mode: "business"
          },
          contract_id: null,
          last_run_id: null,
          last_exec_brief: null,
          scope_finalized: true,
          scope_questions: [
            { question_number: 1, question: "Time range?", clarification: "Specify the period", answer: "Last 6 months" }
          ]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.prep_pending).toBe(true);
    expect(body.assistant_message).toContain("Run Data Preparation");

    await app.close();
  });

  it("shows query decision state from assistant SQL prompt and executes on yes", async () => {
    let executedSql = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: null,
            business_context: "",
            cataloged_at: null,
            tables: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        const payload =
          typeof init?.body === "string" ? (JSON.parse(init.body) as { sql?: string }) : {};
        executedSql = payload.sql ?? "";
        return new Response(
          JSON.stringify({
            rows: [{ total_sales: "9100.00" }],
            row_count: 1,
            governed_sql: "SELECT SUM(total_amount) AS total_sales FROM public.demo_orders WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          if (/run the query/i.test(input.user_message)) {
            return {
              message: [
                "Here's the query to get that number:",
                "",
                "```sql",
                "SELECT SUM(total_amount) AS total_sales",
                "FROM public.demo_orders",
                "WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'",
                "AND status IN ('delivered','paid');",
                "```",
                "",
                "Want me to run this? Use the Run Query button or say yes."
              ].join("\n")
            };
          }
          return { message: input.action_context };
        }
      }
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "run the query then, just give me sales in the past month"
      }
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.state.pending_query_sql).toContain("SELECT SUM(total_amount) AS total_sales");

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "yes",
        state: firstBody.state
      }
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.assistant_message).toContain("Query completed. Query ID:");
    expect(secondBody.state.pending_query_sql).toBe(null);
    expect(executedSql.trim().endsWith(";")).toBe(false);

    await app.close();
  });

  it("creates pending query from inline `query:` reply and executes on natural run request", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: null,
            business_context: "",
            cataloged_at: null,
            tables: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ daily_sales: "5100.00", order_count: 38 }],
            row_count: 1,
            governed_sql:
              "SELECT DATE(order_date) AS day, SUM(total_amount) AS daily_sales, COUNT(order_id) AS order_count FROM public.demo_orders WHERE order_date >= CURRENT_DATE - INTERVAL '25 days' GROUP BY DATE(order_date) ORDER BY day ASC",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          if (/past 25 days/i.test(input.user_message)) {
            return {
              message: [
                "Here's a quick look at your sales over the past 25 days!",
                "",
                "query: SELECT DATE(order_date) AS day, SUM(total_amount) AS daily_sales, COUNT(order_id) AS order_count FROM public.demo_orders WHERE order_date >= CURRENT_DATE - INTERVAL '25 days' AND status NOT IN ('cancelled','refunded') GROUP BY DATE(order_date) ORDER BY day ASC",
                "",
                "This will give you day-by-day revenue and order counts."
              ].join("\n")
            };
          }
          return { message: input.action_context };
        }
      }
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "can you tell me my sales in past 25 days?"
      }
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.state.pending_query_sql).toContain("SELECT DATE(order_date) AS day");
    expect(firstBody.state.pending_query_sql).toContain("CURRENT_DATE - INTERVAL '25 days'");

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Can you run this query and give it to me?",
        state: firstBody.state
      }
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.assistant_message).toContain("Query completed. Query ID:");
    expect(secondBody.state.pending_query_sql).toBe(null);

    await app.close();
  });

  it("auto-runs simple month-coverage query and calls out missing months", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_sales",
                qualified_name: "public.demo_sales",
                relation_type: "TABLE",
                summary: "Sales transactions by order date",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 12000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [
              {
                observed_months: 4,
                expected_months: 6,
                missing_months: ["2025-09", "2025-10"],
                from_month: "2025-09-01",
                to_month: "2026-02-01"
              }
            ],
            row_count: 1,
            governed_sql: "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "can you tell me how many months of sales data do we have in the last 6 months?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Query completed. Query ID:");
    expect(body.assistant_message).toContain("Coverage: 4 out of 6 month(s) have data.");
    expect(body.assistant_message).toContain("Missing months: 2025-09, 2025-10.");
    expect(body.state.pending_query_sql).toBe(null);
    expect(body.state.last_query_id).toMatch(/^qry_/);

    await app.close();
  });

  it("answers simple sales-in-days question directly without showing SQL text", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Order data",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 9000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "9988.50",
                row_count: 144,
                from_date: "2026-01-26",
                to_date: "2026-02-19"
              }
            ],
            row_count: 1,
            governed_sql: "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Can you give me sales in the past 25 days?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Query completed. Query ID:");
    expect(body.assistant_message).toContain("Total sales for the last 25 day(s): 9,988.5.");
    expect(body.assistant_message).not.toContain("SELECT");
    expect(body.state.pending_query_sql).toBe(null);
    expect(body.state.last_query_id).toMatch(/^qry_/);

    await app.close();
  });

  it("auto-runs plain-language sales query and returns a number", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_sales",
                qualified_name: "public.demo_sales",
                relation_type: "TABLE",
                summary: "Sales transactions by order date",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "amount", data_type: "numeric", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 12000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "12345.67",
                observed_months: 1,
                expected_months: 1,
                missing_months: [],
                from_month: "2026-02-01",
                to_month: "2026-02-01"
              }
            ],
            row_count: 1,
            governed_sql: "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What are my sales in the past month?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Query completed. Query ID:");
    expect(body.assistant_message).toContain("Total sales for the last 1 month(s): 12,345.67.");
    expect(body.assistant_message).toContain("Coverage: all 1 month(s) have data.");
    expect(body.state.last_query_id).toMatch(/^qry_/);

    await app.close();
  });

  it("auto-runs plain-language total sales by city without showing SQL", async () => {
    let lastQuerySql = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false },
                  { column_name: "city", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [
                  { column_name: "city", distinct_values: ["Bengaluru", "Mumbai"] }
                ],
                sample_rows: [],
                row_count_estimate: 4200
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as { sql?: string } : {};
        lastQuerySql = body.sql ?? "";
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "4321",
                row_count: 88,
                from_date: "2025-01-01",
                to_date: "2026-02-19"
              }
            ],
            row_count: 1,
            governed_sql: lastQuerySql.length > 0 ? lastQuerySql : "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What are total sales in Bengaluru all-time?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Query completed. Query ID:");
    expect(body.assistant_message).toContain("Total sales in Bengaluru across all available data: 4,321.");
    expect(body.assistant_message).not.toContain("SELECT");
    expect(body.state.pending_query_sql).toBe(null);
    expect(body.state.last_query_id).toMatch(/^qry_/);
    expect(lastQuerySql).toContain("lower(base.\"city\"::text) = lower('Bengaluru')");

    await app.close();
  });

  it("asks a clarifying question for ambiguous single-query scope, then runs after user clarifies", async () => {
    let lastQuerySql = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false },
                  { column_name: "city", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [
                  { column_name: "city", distinct_values: ["Bengaluru", "Mumbai"] }
                ],
                sample_rows: [],
                row_count_estimate: 4200
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as { sql?: string } : {};
        lastQuerySql = body.sql ?? "";
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "7521.75",
                row_count: 63,
                from_date: "2026-01-21",
                to_date: "2026-02-19"
              }
            ],
            row_count: 1,
            governed_sql: lastQuerySql.length > 0 ? lastQuerySql : "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What are total sales in Bengaluru?"
      }
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.assistant_message).toContain("Before I run that query, I need one clarification");
    expect(firstBody.state.pending_single_query_request).toContain("What are total sales in Bengaluru?");

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Use last 30 days",
        state: firstBody.state
      }
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.assistant_message).toContain("Query completed. Query ID:");
    expect(secondBody.assistant_message).toContain("Method:");
    expect(secondBody.assistant_message).toContain("Tables used:");
    expect(secondBody.assistant_message).toContain("Filters used:");
    expect(secondBody.state.pending_single_query_request).toBe(null);
    expect(lastQuerySql).toContain("CURRENT_DATE - interval '29 days'");

    await app.close();
  });

  it("reuses previous single-query context for repeated asks without executing another query", async () => {
    let queryCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 4200
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        queryCalls += 1;
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "10123.88",
                observed_months: 2,
                expected_months: 2,
                missing_months: [],
                from_month: "2025-12-01",
                to_month: "2026-01-31"
              }
            ],
            row_count: 1,
            governed_sql: "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Can you give me past 2 months sales?"
      }
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.assistant_message).toContain("Query completed. Query ID:");
    expect(queryCalls).toBe(1);

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "same question again",
        state: firstBody.state
      }
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.assistant_message).toContain("Using the same context as your previous single-query request.");
    expect(secondBody.assistant_message).toContain("Query completed. Query ID:");
    expect(queryCalls).toBe(1);

    await app.close();
  });

  it("keeps month window on sales follow-up and does not regress to 1-day query", async () => {
    const executedSql: string[] = [];

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Order data",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 9000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        const payload =
          typeof init?.body === "string" ? (JSON.parse(init.body) as { sql?: string }) : {};
        executedSql.push(payload.sql ?? "");
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "12345.67",
                observed_months: 1,
                expected_months: 1,
                missing_months: [],
                from_month: "2026-02-01",
                to_month: "2026-02-01"
              }
            ],
            row_count: 1,
            governed_sql: payload.sql ?? "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What are my sales in the past month?"
      }
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.assistant_message).toContain("Total sales for the last 1 month(s): 12,345.67.");

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Delivered and paid only, just the number.",
        state: firstBody.state
      }
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.assistant_message).toContain("Total sales for the last 1 month(s): 12,345.67.");
    expect(secondBody.assistant_message).not.toContain("last 1 day(s)");
    expect(executedSql.length).toBeGreaterThanOrEqual(2);
    expect(executedSql[1]).toContain("date_trunc('month', CURRENT_DATE)");
    expect(executedSql[1]).toContain(`lower(base."status"::text) = ANY (ARRAY['delivered', 'paid'])`);

    await app.close();
  });

  it("auto-runs single-query product sales with deterministic join and calendar month filter", async () => {
    let lastQuerySql = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_id", data_type: "uuid", is_nullable: false },
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false },
                  { column_name: "product_id", data_type: "uuid", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 18000
              },
              {
                table_id: "tbl_products",
                qualified_name: "public.products",
                relation_type: "TABLE",
                summary: "Product dimension",
                columns: [
                  { column_name: "id", data_type: "uuid", is_nullable: false },
                  { column_name: "product_name", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [
                  { column_name: "product_name", distinct_values: ["Alpha", "Beta"] }
                ],
                sample_rows: [],
                row_count_estimate: 50
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as { sql?: string } : {};
        lastQuerySql = body.sql ?? "";
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "15750.25",
                observed_months: 1,
                expected_months: 1,
                missing_months: [],
                from_month: "2026-01-01",
                to_month: "2026-01-31"
              }
            ],
            row_count: 1,
            governed_sql: lastQuerySql.length > 0 ? lastQuerySql : "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What are my sales for product Alpha in January 2026?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Query completed. Query ID:");
    expect(body.assistant_message).toContain("for January 2026");
    expect(lastQuerySql).toContain("JOIN \"public\".\"products\" AS dim");
    expect(lastQuerySql).toContain("base.\"product_id\" = dim.\"id\"");
    expect(lastQuerySql).toContain("lower(dim.\"product_name\"::text) = lower('Alpha')");
    expect(lastQuerySql).toContain(">= DATE '2026-01-01'");
    expect(lastQuerySql).toContain("< DATE '2026-02-01'");

    await app.close();
  });

  it("handles non-standard schema names by matching summary and low-cardinality values", async () => {
    let lastQuerySql = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_txn",
                qualified_name: "finance.txn_ledger",
                relation_type: "TABLE",
                summary: "Commercial bookings and settlement values by market",
                columns: [
                  { column_name: "txn_ts", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "gross_value_usd", data_type: "numeric", is_nullable: false },
                  { column_name: "market_name", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [
                  { column_name: "market_name", distinct_values: ["Mumbai", "Tokyo"] }
                ],
                sample_rows: [],
                row_count_estimate: 7000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as { sql?: string } : {};
        lastQuerySql = body.sql ?? "";
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "12000.25",
                observed_months: 1,
                expected_months: 1,
                missing_months: [],
                from_month: "2026-02-01",
                to_month: "2026-02-01"
              }
            ],
            row_count: 1,
            governed_sql: lastQuerySql.length > 0 ? lastQuerySql : "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What is total turnover in Mumbai this month?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Query completed. Query ID:");
    expect(body.assistant_message).toContain("12,000.25");
    expect(body.state.pending_query_sql).toBe(null);
    expect(lastQuerySql).toContain("\"gross_value_usd\"");
    expect(lastQuerySql).toContain("lower(base.\"market_name\"::text) = lower('Mumbai')");

    await app.close();
  });

  it("falls back to all-time totals when no date column exists", async () => {
    let lastQuerySql = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_bookings",
                qualified_name: "ops.booking_facts",
                relation_type: "TABLE",
                summary: "Booking values by market",
                columns: [
                  { column_name: "booking_value", data_type: "numeric", is_nullable: false },
                  { column_name: "region_name", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [
                  { column_name: "region_name", distinct_values: ["London", "Paris"] }
                ],
                sample_rows: [],
                row_count_estimate: 4500
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as { sql?: string } : {};
        lastQuerySql = body.sql ?? "";
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "7800",
                row_count: 77,
                from_date: null,
                to_date: null
              }
            ],
            row_count: 1,
            governed_sql: lastQuerySql.length > 0 ? lastQuerySql : "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Show me total sales in London all-time"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Query completed. Query ID:");
    expect(body.assistant_message).toContain("across all available data");
    expect(body.assistant_message).not.toContain("Data range:");
    expect(lastQuerySql).toContain("NULL::date AS from_date");
    expect(lastQuerySql).toContain("lower(base.\"region_name\"::text) = lower('London')");

    await app.close();
  });

  it("uses follow-up status filters for a simple number request", async () => {
    let lastQuerySql = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_sales",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Order sales",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 5000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        const body = typeof init?.body === "string" ? JSON.parse(init.body) as { sql?: string } : {};
        lastQuerySql = body.sql ?? "";
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "9100",
                observed_months: 1,
                expected_months: 1,
                missing_months: [],
                from_month: "2026-02-01",
                to_month: "2026-02-01"
              }
            ],
            row_count: 1,
            governed_sql: lastQuerySql.length > 0 ? lastQuerySql : "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What are my sales in the past month?"
      }
    });

    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Delivered and paid only, I don't want a breakdown. just the number",
        state: first.json().state
      }
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().assistant_message).toContain("Query completed. Query ID:");
    expect(lastQuerySql).toContain("lower(base.\"status\"::text) = ANY");
    expect(lastQuerySql).toContain("'delivered'");
    expect(lastQuerySql).toContain("'paid'");

    await app.close();
  });

  it("does not treat complex multi-part analysis prompts as simple sales follow-ups", async () => {
    let queryCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders and refunds",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 8000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        queryCalls += 1;
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "5000",
                observed_months: 1,
                expected_months: 1,
                missing_months: [],
                from_month: "2026-02-01",
                to_month: "2026-02-01"
              }
            ],
            row_count: 1,
            governed_sql: "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Can you give me sales for the past month?"
      }
    });
    expect(first.statusCode).toBe(200);
    expect(queryCalls).toBe(1);

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Give me just paid and delivered",
        state: first.json().state
      }
    });
    expect(second.statusCode).toBe(200);
    expect(queryCalls).toBe(2);

    const third = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I want a 4 month refund trend along with comparision of past 2 months vs prior 2 months for refunds. Also tell me cities with highest refund rate. Also tell me for the orders refunded how many support tickets were opened in the past 4 months and what were the top issues or reasons.",
        state: second.json().state
      }
    });
    expect(third.statusCode).toBe(200);
    expect(queryCalls).toBe(2);
    expect(third.json().assistant_message).not.toContain("Query completed. Query ID:");

    await app.close();
  });

  it("returns explicit stage error when conversation provider throws", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
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
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          throw new Error("fetch failed");
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "hello" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).toContain("Stage error: conversation_response failed.");

    await app.close();
  });

  it("keeps authoritative run-in-flight context when finishing scope", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/report-contracts/test_contract/run") && method === "POST") {
        return new Response(
          JSON.stringify({
            run_id: "run_test_1",
            status: "queued"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return { message: "I am running the report now." };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_finish_scoping_run_analysis__",
        state: {
          contract_id: "test_contract",
          prep_complete: true,
          scope_pending: true
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("I am running the report now.");

    await app.close();
  });

  it("accepts typed refinement while analysis decision is pending and still blocks ad-hoc query execution", async () => {
    let queryCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Order data",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 9000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        queryCalls += 1;
        return new Response(
          JSON.stringify({
            rows: [
              {
                total_value: "7777.00",
                observed_months: 1,
                expected_months: 1,
                missing_months: [],
                from_month: "2026-02-01",
                to_month: "2026-02-01"
              }
            ],
            row_count: 1,
            governed_sql: "SELECT ...",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Weekly Revenue" }
    });
    expect(initial.statusCode).toBe(200);
    const scopedState = {
      ...initial.json().state,
      prep_complete: true,
      scope_pending: true
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What are my sales in the past month?",
        state: scopedState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).not.toContain("Analysis decision pending");
    expect(response.json().assistant_message).not.toContain("Query completed");
    expect(queryCalls).toBe(0);

    await app.close();
  });

  it("returns report run result even if conversation provider fails after run", async () => {
    let conversationCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/report-contracts/contract_run_test/run") && method === "POST") {
        return new Response(JSON.stringify({
          run_id: "run_web_test",
          status: "pending"
        }), {
          status: 202,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
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
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          conversationCalls += 1;
          throw new Error("fetch failed");
        }
      }
    });

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Weekly Revenue" }
    });
    expect(initial.statusCode).toBe(200);
    conversationCalls = 0;
    const readyToRunState = {
      ...initial.json().state,
      contract_id: "contract_run_test",
      prep_complete: true,
      scope_pending: true
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_finish_scoping_run_analysis__",
        state: readyToRunState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).toContain("Stage error: conversation_response failed.");
    expect(response.json().state.pending_run_id).toBe("run_web_test");
    expect(conversationCalls).toBe(1);

    await app.close();
  });

  it("keeps authoritative run result when provider returns contradictory network-error wording", async () => {
    let conversationCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/report-contracts/contract_run_test/run") && method === "POST") {
        return new Response(JSON.stringify({
          run_id: "run_web_test",
          status: "pending"
        }), {
          status: 202,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
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
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          conversationCalls += 1;
          return {
            message:
              "Looks like the run hit a network error on its end — the execution didn't go through. Nothing was lost on our end though; the report contract and all the prepped data are still intact.\n\nJust try running it again and it should go through cleanly!"
          };
        }
      }
    });

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Weekly Revenue" }
    });
    expect(initial.statusCode).toBe(200);
    conversationCalls = 0;
    const readyToRunState = {
      ...initial.json().state,
      contract_id: "contract_run_test",
      prep_complete: true,
      scope_pending: true
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_finish_scoping_run_analysis__",
        state: readyToRunState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).toContain("execution didn't go through");
    expect(response.json().state.pending_run_id).toBe("run_web_test");
    expect(conversationCalls).toBe(1);

    await app.close();
  });

  it("answers all scope questions in one message when LLM resolver is unavailable", async () => {
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "deep_analysis",
          reason: "Multi-part diagnostic request",
          confidence: 0.94
        };
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_sales",
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                summary: "Sales rows",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "refund_amount", data_type: "numeric", is_nullable: true }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: [
              {
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                status: "OK",
                has_rls: false,
                force_rls: false,
                rls_active_for_me: false,
                policies_count_for_me: 0
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ row_count: 1000 }],
            row_count: 1,
            governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: createPassthroughConversationClient()
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I need a refund trend by month. Also compare last 6 months vs prior 6 months."
      }
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().state.scope_clarification_pending).toBe(true);
    expect(first.json().state.scope_questions.length).toBeGreaterThanOrEqual(2);

    // Without an LLM resolver, explicit Qn assignments are still accepted.
    const firstState = first.json().state;
    const generatedAnswers = (firstState.scope_questions as Array<{ question_number: number }>)
      .map((entry) => {
        if (entry.question_number === 1) {
          return "Q1: Use order_date and last 6 full calendar months.";
        }
        if (entry.question_number === 2) {
          return "Q2: Compare against the previous 6 full months and include refunded status only.";
        }
        return `Q${entry.question_number}: Use standard defaults and keep the same 6-month timeline.`;
      })
      .join(" ");

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: generatedAnswers,
        state: firstState
      }
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().state.scope_clarification_pending).toBe(false);
    expect(second.json().state.prep_pending).toBe(true);
    expect(second.json().assistant_message).toContain("Scope is locked for");
    expect(second.json().assistant_message).toContain("Run Data Preparation when you're ready.");

    await app.close();
  });

  it("does not crash scope clarification when business context is empty", async () => {
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "deep_analysis",
          reason: "Multi-part analysis request",
          confidence: 0.9
        };
      },
      async scope_clarifications() {
        return {
          questions: [
            {
              question_number: 1,
              question: "Show a 4-month refund trend",
              clarification: "Confirm if we should include the current partial month."
            },
            {
              question_number: 2,
              question: "Compare past 2 months vs prior 2 months",
              clarification: "Confirm exact comparison windows and primary date column."
            }
          ]
        };
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_id", data_type: "uuid", is_nullable: false },
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 5000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I want a 4 month refund trend and compare past 2 months vs prior 2 months, plus top refund cities."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(typeof body.assistant_message).toBe("string");
    expect(body.assistant_message).toContain("Before data preparation");
    expect(body.assistant_message).toContain("Clarifications to confirm:");
    expect(body.assistant_message).not.toContain("Default:");

    await app.close();
  });

  it("adds a new scoped question when a clarification message includes Q answers plus an extra ask", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: {
        provider: "openrouter",
        mode: "provider",
        async decide() {
          return {
            route: "deep_analysis",
            reason: "Multi-part request",
            confidence: 0.9
          };
        }
      },
      conversation_client: createPassthroughConversationClient()
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "I need a refund trend for the last 4 months. Also show top cities by refund rate."
      }
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().state.scope_clarification_pending).toBe(true);

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "Q1: Use Nov-Feb on order_date. Q2: Use value-based city refund rate. Also add top products by refund value in the same window.",
        state: first.json().state
      }
    });

    expect(second.statusCode).toBe(200);
    const body = second.json();
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_questions.length).toBeGreaterThanOrEqual(3);
    expect(body.state.scope_questions[0].answer).toContain("Nov-Feb");
    expect(body.state.scope_questions[1].answer).toContain("value-based");
    const unresolved = body.state.scope_questions.filter((entry: { answer: string | null }) => !entry.answer);
    expect(unresolved.length).toBeGreaterThan(0);
    expect(body.assistant_message.toLowerCase()).toContain("need clarification");
    expect(JSON.stringify(body.state.scope_questions).toLowerCase()).toContain("top products");

    await app.close();
  });

  it("accepts inline Q1/Q2/Q3 clarifications in a single message and proceeds", async () => {
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "deep_analysis",
          reason: "Multi-part diagnostic request",
          confidence: 0.94
        };
      },
      async resolve_scope_answers() {
        return {
          assignments: [],
          unresolved_question_numbers: [1, 2, 3],
          remove_question_numbers: []
        };
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_sales",
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                summary: "Sales rows",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "refund_amount", data_type: "numeric", is_nullable: true }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: [
              {
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                status: "OK",
                has_rls: false,
                force_rls: false,
                rls_active_for_me: false,
                policies_count_for_me: 0
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ row_count: 1000 }],
            row_count: 1,
            governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: createPassthroughConversationClient()
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I need a refund trend by month. Also compare last 6 months vs prior 6 months. Include support-ticket linkage."
      }
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().state.scope_clarification_pending).toBe(true);

    const firstState = first.json().state;
    const generatedAnswers = (firstState.scope_questions as Array<{ question_number: number }>)
      .map((entry) => {
        if (entry.question_number === 1) {
          return "Q1: use refund amount / total revenue and rank top 6 cities.";
        }
        if (entry.question_number === 2) {
          return "Q2: use Nov 2025 to Feb 2026 and compare Nov-Dec vs Jan-Feb.";
        }
        if (entry.question_number === 3) {
          return "Q3: only include non-null order_id and customer_id-linked tickets.";
        }
        return `Q${entry.question_number}: use standard defaults and keep the same scoped timeframe.`;
      })
      .join(" ");

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: generatedAnswers,
        state: firstState
      }
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().state.scope_clarification_pending).toBe(false);
    expect(second.json().state.prep_pending).toBe(true);
    expect(second.json().assistant_message).toContain("Scope is locked for");
    expect(second.json().assistant_message).toContain("Run Data Preparation when you're ready.");

    await app.close();
  });

  it("does not auto-lock scope from the same initial problem statement and backfills missing LLM scope questions", async () => {
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "deep_analysis",
          reason: "Multi-part request",
          confidence: 0.92
        };
      },
      async scope_clarifications() {
        return {
          questions: [
            {
              question_number: 1,
              question: "Use latest available date as today.",
              clarification: "Confirm date anchor."
            }
          ]
        };
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: [
              {
                schema_name: "public",
                relation_name: "demo_orders",
                qualified_name: "public.demo_orders",
                has_select_privilege: true,
                has_rls: false,
                force_rls: false,
                rls_active_for_me: false,
                policies_count_for_me: 0,
                relation_type: "TABLE",
                status: "OK",
                status_label: "OK"
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I want a 4 month refund trend with 2 month vs prior 2 month comparison, top cities by refund rate, and support ticket top issues."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message.toLowerCase()).toContain("before data preparation");
    expect(body.assistant_message.toLowerCase()).not.toContain("scope clarifications captured for all questions");
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_questions.length).toBeGreaterThanOrEqual(2);

    const forcePrep = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_run_data_preparation__",
        state: body.state
      }
    });
    expect(forcePrep.statusCode).toBe(200);
    expect(forcePrep.json().assistant_message.toLowerCase()).toContain("need clarification");
    expect(forcePrep.json().state.prep_pending).toBe(false);

    await app.close();
  });

  it("splits compound scope questions into atomic questions", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [{ type: "new_question", text: "Support ticket analysis." }],
            resolved_scope_answers: [],
            new_scope_questions: [
              {
                question_text:
                  "How many support tickets were opened for refunded orders in the past 4 months, and what are the top issue types among those tickets?",
                clarification: "Confirm ticket linkage and ranking method."
              }
            ],
            follow_up_requests: [],
            pending_inputs: [
              {
                input_key: "q1_scope",
                prompt: "Confirm support ticket scope."
              }
            ],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: false,
              append_new_questions: true,
              clear_pending_inputs: false,
              summary: "Added scoped question.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Analyze support tickets for refunded orders over the last 4 months."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_questions.length).toBeGreaterThanOrEqual(2);
    const questions = body.state.scope_questions.map((entry: { question: string }) => entry.question.toLowerCase());
    expect(questions.some((q: string) => q.includes("how many support tickets"))).toBe(true);
    expect(questions.some((q: string) => q.includes("top issue types"))).toBe(true);

    await app.close();
  });

  it("does not collapse merged Q4+Q5 support scope into one question", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [{ type: "new_question", text: "Support ticket diagnostics." }],
            resolved_scope_answers: [],
            new_scope_questions: [
              {
                question_text:
                  "Q4 + Q5 - Support tickets linked to refunded orders + top issue types",
                clarification: "Confirm ticket linkage and ranking method."
              }
            ],
            follow_up_requests: [],
            pending_inputs: [
              {
                input_key: "q4_scope",
                prompt: "Confirm support diagnostics scope."
              }
            ],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: false,
              append_new_questions: true,
              clear_pending_inputs: false,
              summary: "Added support diagnostics.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Analyze support tickets for refunded orders."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const questions = body.state.scope_questions.map((entry: { question: string }) => entry.question.toLowerCase());

    expect(questions.some((q: string) => /support tickets linked to refunded orders/.test(q))).toBe(true);
    expect(questions.some((q: string) => /top issue types/.test(q))).toBe(true);
    expect(
      questions.some(
        (q: string) =>
          /support tickets linked to refunded orders/.test(q) && /top issue types/.test(q)
      )
    ).toBe(false);

    await app.close();
  });

  it("treats clarification-style prompts as clarifications, not new planning questions", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [{ type: "new_question", text: "Refund city analysis." }],
            resolved_scope_answers: [],
            new_scope_questions: [
              {
                question_text:
                  "Which cities have the highest Refund Rate over the past 4 complete months?",
                clarification: "Confirm refund-rate formula and ranking logic."
              },
              {
                question_text: "How many cities should be shown?",
                clarification: "Confirm city cutoff."
              }
            ],
            follow_up_requests: [],
            pending_inputs: [
              {
                input_key: "q1_scope",
                prompt: "Confirm city refund-rate scope."
              }
            ],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: false,
              append_new_questions: true,
              clear_pending_inputs: false,
              summary: "Added refund city scope.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "Show refund rates by city." }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const questions = body.state.scope_questions.map((entry: { question: string }) => entry.question);
    expect(questions.some((q: string) => /how many cities should be shown/i.test(q))).toBe(false);

    const cityQuestion = body.state.scope_questions.find((entry: { question: string }) =>
      /cities have the highest refund rate/i.test(entry.question)
    );
    expect(cityQuestion).toBeTruthy();
    expect(cityQuestion.clarification).toMatch(/how many cities should be shown/i);

    await app.close();
  });

  it("reconciles merged scope labels in LLM output to canonical per-question lines", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message: [
              "All confirmed.",
              "- Q1 + Q2: Support tickets linked to refunded orders + top issue types",
              "Scope is locked — ready to move into data preparation."
            ].join("\n")
          };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [{ type: "new_question", text: "Support ticket diagnostics." }],
            resolved_scope_answers: [],
            new_scope_questions: [
              {
                question_text:
                  "Q4 + Q5 - Support tickets linked to refunded orders + top issue types",
                clarification: "Confirm ticket linkage and ranking method."
              }
            ],
            follow_up_requests: [],
            pending_inputs: [
              {
                input_key: "q4_scope",
                prompt: "Confirm support diagnostics scope."
              }
            ],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: false,
              append_new_questions: true,
              clear_pending_inputs: false,
              summary: "Added support diagnostics.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Analyze support tickets for refunded orders."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Questions in scope:");
    expect(body.assistant_message).toContain("Q1:");
    expect(body.assistant_message).toContain("Q2:");
    expect(body.assistant_message).not.toMatch(/\bQ1\s*(?:\+|\/|&)\s*Q2\b/i);

    await app.close();
  });

  it("does not split metric-pair phrasing into broken scope questions", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [{ type: "new_question", text: "Refund trend and city ranking." }],
            resolved_scope_answers: [],
            new_scope_questions: [
              {
                question_text:
                  "What is the monthly refund trend over the past 4 complete months (refund count and refunded revenue per month)?",
                clarification: "Confirm 4-month window and whether partial current month is included."
              }
            ],
            follow_up_requests: [],
            pending_inputs: [
              {
                input_key: "q1_scope",
                prompt: "Confirm trend scope."
              }
            ],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: false,
              append_new_questions: true,
              clear_pending_inputs: false,
              summary: "Added scoped question.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Track monthly refunds by count and revenue for the last 4 complete months."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const questions = body.state.scope_questions as Array<{ question: string }>;
    expect(questions.length).toBeGreaterThanOrEqual(1);

    const matching = questions.filter((entry) =>
      /refund trend over the past 4 complete months/i.test(entry.question)
    );
    expect(matching.length).toBe(1);
    expect(matching[0].question.toLowerCase()).toContain("refund count and refunded revenue per month");

    await app.close();
  });

  it("applies saved metric definitions and splits compound scope questions on deep-analysis scope generation", async () => {
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "deep_analysis",
          reason: "Multi-part request",
          confidence: 0.95
        };
      },
      async scope_clarifications() {
        return {
          questions: [
            {
              question_number: 1,
              question:
                "Which cities have the highest refund rate where refund rate = refunded orders / total orders over the past 4 months?",
              clarification: "Confirm formula and city cutoff."
            },
            {
              question_number: 2,
              question:
                "How many support tickets were opened for refunded orders in the past 4 months, and what are the top issue types among those tickets?",
              clarification: "Confirm ticket linkage and issue ranking."
            }
          ]
        };
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/config/user-settings") && method === "GET") {
        return new Response(
          JSON.stringify({
            metric_definitions: [
              {
                metric_key: "refund_rate",
                display_name: "Refund Rate",
                definition: "refunded revenue / total revenue"
              }
            ],
            business_context: "E-commerce refunds"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "E-commerce refunds",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              },
              {
                table_id: "tbl_tickets",
                qualified_name: "public.demo_support_tickets",
                relation_type: "TABLE",
                summary: "Support tickets",
                columns: [
                  { column_name: "order_id", data_type: "text", is_nullable: true },
                  { column_name: "issue_type", data_type: "text", is_nullable: true }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 400
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I want a 4 month refund trend and cities with highest refund rate. Also tell me support ticket volume and top issue types."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const scopeQuestions = body.state.scope_questions as Array<{
      question: string;
      clarification: string;
      metric_definition_draft: string | null;
    }>;

    expect(scopeQuestions.length).toBeGreaterThanOrEqual(3);
    const supportQuestions = scopeQuestions.filter((entry) => /support ticket/i.test(entry.question));
    const issueQuestions = scopeQuestions.filter((entry) => /issue type|top issues|top reasons/i.test(entry.question));
    expect(supportQuestions.length).toBeGreaterThanOrEqual(1);
    expect(issueQuestions.length).toBeGreaterThanOrEqual(1);
    expect(
      supportQuestions.every(
        (entry) =>
          entry.metric_definition_draft === null &&
          !/using saved metric/i.test(`${entry.question} ${entry.clarification}`)
      )
    ).toBe(true);
    expect(
      issueQuestions.every(
        (entry) =>
          entry.metric_definition_draft === null &&
          !/using saved metric/i.test(`${entry.question} ${entry.clarification}`)
      )
    ).toBe(true);

    const refundQuestion = scopeQuestions.find((entry) => /refund rate/i.test(entry.question));
    expect(refundQuestion).toBeDefined();
    expect(refundQuestion?.metric_definition_draft).toBe("refunded revenue / total revenue");
    expect(`${refundQuestion?.question} ${refundQuestion?.clarification}`.toLowerCase()).toContain(
      "refunded revenue / total revenue"
    );

    await app.close();
  });

  it("does not auto-apply orchestrator scope answers for brand-new questions on the first turn", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [{ type: "new_question", text: "Refund trend and city ranking." }],
            resolved_scope_answers: [
              { question_number: 1, answer: "Use Nov-Feb on order_date." },
              { question_number: 2, answer: "Use value-based city refund rate." }
            ],
            new_scope_questions: [
              {
                question_text: "4-month refund trend and 2-month vs prior 2-month comparison",
                clarification: "Confirm exact month anchors."
              },
              {
                question_text: "Top cities by refund rate",
                clarification: "Confirm count-based or value-based refund rate."
              }
            ],
            follow_up_requests: [],
            pending_inputs: [],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: true,
              append_new_questions: true,
              clear_pending_inputs: true,
              summary: "Scope drafted from initial request.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I want a 4 month refund trend with 2 month vs prior 2 month comparison and top cities by refund rate."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_questions.length).toBeGreaterThanOrEqual(2);
    expect(body.state.scope_questions.some((entry: { answer: string | null }) => !entry.answer)).toBe(true);
    expect(body.assistant_message.toLowerCase()).toContain("before data preparation");

    await app.close();
  });

  it("keeps impromptu new scoped question during clarification instead of auto-finalizing scope", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [
              { type: "clarification_answer", text: "Q1 and Q2 answered." },
              { type: "follow_up_request", text: "Add top products breakdown." }
            ],
            resolved_scope_answers: [
              { question_number: 1, answer: "Use Nov-Feb and order_date." },
              { question_number: 2, answer: "Use refunded amount / total revenue by city, top 5." }
            ],
            new_scope_questions: [],
            follow_up_requests: [
              {
                question_text: "Top problematic products by refund value in the same window",
                requires_new_data: true,
                grounded_in_existing_payload: false,
                referenced_question_ids: ["q1", "q2"]
              }
            ],
            pending_inputs: [
              {
                input_key: "q3_product_scope",
                prompt: "Should Q3 use top 5 products or all products?",
                question_number: 3
              }
            ],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: false,
              append_new_questions: true,
              clear_pending_inputs: false,
              summary: "Added Q3 follow-up.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Q1: Use Nov-Feb. Q2: Value-based city rate. Also add top products analysis.",
        state: {
          draft: {
            name: "Refund Deep Dive",
            audience: "Ops",
            timezone: "UTC",
            schedule_cron: null,
            sql_template: "SELECT * FROM public.demo_orders",
            metric_ids: [],
            dimension_ids: [],
            allowed_relations: ["public.demo_orders", "public.demo_support_tickets"],
            allowed_schemas: ["public"],
            insight_mode: "business"
          },
          contract_id: null,
          last_run_id: null,
          last_query_id: null,
          last_exec_brief: null,
          conversation_history: [],
          prep_pending: false,
          prep_complete: false,
          scope_pending: false,
          metric_definitions: [],
          pending_metric_confirmations: [],
          pending_metric_resume_message: null,
          pending_metric_resume_mode: null,
          scope_clarification_pending: true,
          scope_source_prompt: "initial prompt",
          scope_questions: [
            {
              question_number: 1,
              question: "4-month refund trend",
              clarification: "Confirm timeline/date column.",
              answer: null,
              metric_key: null,
              metric_display_name: null,
              metric_definition_draft: null,
              metric_source_columns: []
            },
            {
              question_number: 2,
              question: "Top cities by refund rate",
              clarification: "Confirm value-based vs count-based.",
              answer: null,
              metric_key: null,
              metric_display_name: null,
              metric_definition_draft: null,
              metric_source_columns: []
            }
          ],
          pending_query_sql: null,
          pending_query_limit: null,
          pending_single_query_request: null,
          last_single_query_snapshot: null,
          single_query_log: [],
          planner_summary: null,
          preparation_summary: null,
          prepared_payloads: [],
          awaiting_pdf_confirmation: false,
          awaiting_post_run_refinement: false,
          refinement_active: false,
          refinement_questions_remaining: 0,
          awaiting_save_confirmation: false,
          awaiting_schedule_confirmation: false,
          awaiting_schedule_mode_selection: false,
          schedule_mode_pending: null,
          schedule_day_kind: null,
          awaiting_custom_day_input: false,
          schedule_pending: false,
          pending_schedule: null,
          last_concise_summary: null,
          pending_run_id: null,
          last_token_usage: null,
          orchestrator_context_version: 1,
          orchestrator_summary: null,
          last_orchestrator_decision: null,
          pending_inputs: [],
          question_registry: []
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_questions.length).toBe(3);
    expect(body.state.scope_questions[0].answer).toContain("Nov-Feb");
    expect(body.state.scope_questions[1].answer).toContain("Value-based");
    expect(body.state.scope_questions[2].answer).toBe(null);
    expect(body.assistant_message.toLowerCase()).toContain("need clarification");

    await app.close();
  });

  it("does not auto-mark clarifications answered when user adds an extra question", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [{ type: "follow_up_request", text: "Add city by issue-type cut." }],
            resolved_scope_answers: [
              { question_number: 1, answer: "Use Nov-Feb and order_date." }
            ],
            new_scope_questions: [
              {
                question_text: "Top cities for each support issue type on refunded orders",
                clarification: "Confirm top N and whether ranking should be by refund value or refunded order count."
              }
            ],
            follow_up_requests: [],
            pending_inputs: [
              {
                input_key: "q1_window",
                prompt: "Confirm exact Q1 month window.",
                question_number: 1
              },
              {
                input_key: "q2_rank_mode",
                prompt: "Confirm Q2 rank mode and top N.",
                question_number: 2
              }
            ],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: true,
              append_new_questions: true,
              clear_pending_inputs: false,
              summary: "Added follow-up question while clarifications are still pending.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Clarification Guardrail Test" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "4-month refund trend",
        clarification: "Confirm exact timeline and anchor date column.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Can you also give me top cities for each issue type for refunded orders?",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_questions.length).toBe(2);
    expect(body.state.scope_questions[0].answer).toBe(null);
    expect(body.state.scope_questions[1].answer).toBe(null);
    expect(body.assistant_message).toContain("Still need clarification on 2 items");
    expect(body.assistant_message).toContain("Q1: 4-month refund trend");
    expect(body.assistant_message).toContain("Clarifications to confirm:");
    expect(body.assistant_message).not.toContain("Default:");
    expect(body.assistant_message).toContain("Q2:");
    expect(body.assistant_message.toLowerCase()).toContain("top cities for each issue type");

    await app.close();
  });

  it("keeps newly added scope questions pending even if orchestrator returns resolved answers for them", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [
              { type: "clarification_answer", text: "Use Nov-Feb on order_date for trend." },
              { type: "follow_up_request", text: "Add top issue type per city for refunded orders." }
            ],
            resolved_scope_answers: [
              { question_number: 1, answer: "Use Nov-Feb and order_date." },
              { question_number: 2, answer: "Join support_tickets and rank issue type per city." }
            ],
            new_scope_questions: [
              {
                question_text: "For each city, what is the top issue type for refunded orders?",
                clarification: "Confirm top 1 issue type per city and whether only refunded-linked tickets should be included."
              }
            ],
            follow_up_requests: [],
            pending_inputs: [],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: true,
              append_new_questions: true,
              clear_pending_inputs: false,
              summary: "Added a follow-up city-issue question.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: New Question Clarification Guard" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "4-month refund trend",
        clarification: "Confirm exact timeline and anchor date column.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Q1 use Nov-Feb on order_date. Also add top issue type per city for refunded orders.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_finalized).toBe(false);
    expect(body.state.scope_questions.length).toBe(2);
    expect(body.state.scope_questions[0].answer).toContain("Nov-Feb");
    expect(body.state.scope_questions[1].answer).toBe(null);
    expect(body.assistant_message).toContain("Still need clarification on 1 item");
    expect(body.assistant_message).toContain("Q2");
    expect(body.assistant_message).toContain("Clarifications to confirm:");
    expect(body.assistant_message).not.toContain("Default:");

    await app.close();
  });

  it("does not let 'confirm all' auto-close a freshly added scope question in the same turn", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [
              { type: "clarification_answer", text: "confirm all existing scope items" },
              { type: "follow_up_request", text: "add top issue per city" }
            ],
            resolved_scope_answers: [{ question_number: 1, answer: "Confirmed existing Q1 scope." }],
            new_scope_questions: [
              {
                question_text: "What is the top issue type per city for refunded-order tickets?",
                clarification: "Confirm top-1 per city and refunded-order join path."
              }
            ],
            follow_up_requests: [],
            pending_inputs: [],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: true,
              append_new_questions: true,
              clear_pending_inputs: false,
              summary: "Added one new follow-up scope question.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Confirm All Guardrail" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Monthly refund trend",
        clarification: "Confirm 4-month timeline.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Confirm all, and also add top issue per city.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_questions.length).toBe(2);
    expect(body.state.scope_questions[0].answer).toBeTruthy();
    expect(body.state.scope_questions[1].answer).toBeNull();
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_finalized).toBe(false);
    expect(body.assistant_message).toContain("Clarifications to confirm:");
    expect(body.assistant_message).toContain("Q2:");

    await app.close();
  });

  it("applies an explicit answer and confirms the rest in the same clarification turn", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Confirm Rest" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Monthly refund trend",
        clarification: "Confirm timeframe boundary, primary date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "Two-month refund comparison",
        clarification: "Confirm exact comparison windows and delta format.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Top cities by refund rate",
        clarification: "Confirm refund-rate formula and top-N cutoff.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Q1: Use the last 4 complete months on order_date, confirm the rest.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.prep_pending).toBe(true);
    expect(body.state.scope_questions).toHaveLength(3);
    expect(body.state.scope_questions[0].answer).toContain("last 4 complete months on order_date");
    expect(body.state.scope_questions[0].answer).not.toContain("confirm the rest");
    expect(body.state.scope_questions[1].answer).toContain("Confirmed:");
    expect(body.state.scope_questions[2].answer).toContain("Confirmed:");
    expect(body.assistant_message).toContain("Scope is locked for");
    expect(body.assistant_message).not.toContain("Clarifications to confirm:");

    await app.close();
  });

  it("treats plain confirm-all as answering the remaining scope questions", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Plain Confirm All" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Monthly refund trend",
        clarification: "Confirm timeframe boundary, primary date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "Two-month refund comparison",
        clarification: "Confirm exact comparison windows and delta format.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Confirm all.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.prep_pending).toBe(true);
    expect(body.state.scope_questions[0].answer).toContain("Confirmed:");
    expect(body.state.scope_questions[1].answer).toContain("Confirmed:");
    expect(body.assistant_message).toContain("Scope is locked for");

    await app.close();
  });

  it("shows concise assumption-style clarification prompts in the pending scope message", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Assumption Copy" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "What is the monthly refund trend over the past 4 complete months?",
        clarification: "Confirm timeframe boundary, primary date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "How do refunds in the most recent 2 months compare to the prior 2 months?",
        clarification: "Confirm exact comparison windows and delta format.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Need a minute.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("Clarifications to confirm:");
    expect(body.assistant_message).toContain(
      "Q1: I assumed this should use Nov 2025 to Feb 2026 with monthly buckets. Is that fine, or do you want a change?"
    );
    expect(body.assistant_message).toContain(
      "Q2: I assumed this should compare Jan 2026 to Feb 2026 vs Nov 2025 to Dec 2025 and show both absolute and percentage change. Is that fine, or do you want a change?"
    );
    expect(body.assistant_message).not.toContain("Default:");

    await app.close();
  });

  it("treats 'I like your assumptions' as confirming the remaining scope questions", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Assumption Approval" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Monthly refund trend",
        clarification: "Confirm timeframe boundary, primary date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "Two-month refund comparison",
        clarification: "Confirm exact comparison windows and delta format.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "I like your assumptions.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.prep_pending).toBe(true);
    expect(body.state.scope_questions[0].answer).toContain("Confirmed:");
    expect(body.state.scope_questions[1].answer).toContain("Confirmed:");

    await app.close();
  });

  it("confirms the rest while keeping an exception question editable in the same turn", async () => {
    const queryRouter: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "none",
          reason: "Not used in this test.",
          confidence: 0.1
        };
      },
      async resolve_scope_answers() {
        return {
          assignments: [
            {
              question_number: 2,
              answer: "Compare Jan 2026 to Feb 2026 vs Nov 2025 to Dec 2025 and show both absolute and percentage change."
            }
          ],
          unresolved_question_numbers: [],
          remove_question_numbers: []
        };
      }
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      query_router: queryRouter,
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Blanket Approval With Exception" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Monthly refund trend",
        clarification: "Confirm timeframe boundary, primary date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "Two-month refund comparison",
        clarification: "Confirm exact comparison windows and delta format.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Top cities by refund rate",
        clarification: "Confirm refund-rate formula and top-N cutoff.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I like all but Q2. Q2: Compare Jan 2026 to Feb 2026 against Nov 2025 to Dec 2025 and show both absolute and percentage change.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.prep_pending).toBe(true);
    expect(body.state.scope_questions[0].answer).toContain("Confirmed:");
    expect(String(body.state.scope_questions[1].answer)).toContain("Jan 2026 to Feb 2026");
    expect(String(body.state.scope_questions[1].answer)).not.toContain("Confirmed:");
    expect(body.state.scope_questions[2].answer).toContain("Confirmed:");

    await app.close();
  });

  it("handles confirm-all plus explicit scope edits and suggested-question decline in one message", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Mixed Confirmation With Suggested Removal" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "What is the monthly refund trend over the past 4 complete months?",
        clarification: "Confirm timeframe boundary, primary date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "How do refunds in the most recent 2 months compare to the prior 2 months?",
        clarification: "Confirm exact comparison windows and delta format.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Which cities have the highest refund rate over the past 4 complete months?",
        clarification: "Confirm refund-rate formula and top-N cutoff.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 4,
        question: "How many support tickets were opened for refunded orders over the past 4 months?",
        clarification: "Confirm join key and whether only refunded-order-linked tickets are in scope.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 5,
        question: "What are the top issue types by ticket count?",
        clarification: "Confirm top-N cutoff and whether only refunded-order-linked tickets are in scope.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 6,
        question:
          "[Suggested] What is the average support ticket resolution time for support tickets linked to refunded orders, broken down by issue type?",
        clarification: "Confirm whether this suggested analysis should stay in scope.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "confirm all, give me top 5 cities and top 5 issues, don't add suggested question",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_questions).toHaveLength(5);
    expect(JSON.stringify(body.state.scope_questions)).not.toContain("[Suggested]");
    expect(body.state.scope_questions[0].answer).toContain("Confirmed:");
    expect(body.state.scope_questions[1].answer).toContain("Confirmed:");
    expect(String(body.state.scope_questions[2].answer).toLowerCase()).toContain("top 5 cities");
    expect(String(body.state.scope_questions[4].answer).toLowerCase()).toContain("top 5 issue");
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.prep_pending).toBe(true);
    expect(body.assistant_message).toContain("Scope is locked for");
    expect(body.assistant_message).not.toContain("Q6");
    expect(body.assistant_message).not.toContain("average support ticket resolution time");

    await app.close();
  });

  it("treats a plain yes as confirming grouped pending defaults when the last assistant turn asked for scope approval", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Grouped Pending Yes" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "What is the monthly refund trend over the past 4 complete months?",
        clarification: "Confirm timeframe boundary, primary date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "How do refunds in the most recent 2 months compare to the prior 2 months?",
        clarification: "Confirm exact comparison windows and delta format.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];
    seededState.conversation_history = [
      {
        role: "assistant",
        content: [
          "The 4-month window (Nov 2025 – Feb 2026) applies uniformly across all questions.",
          "Q1 uses refunded orders with monthly granularity.",
          "Q2 compares Jan–Feb 2026 vs Nov–Dec 2025.",
          "Does that work, or would you like a different range?"
        ].join("\n")
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "yes",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.prep_pending).toBe(true);
    expect(body.state.scope_questions[0].answer).toContain("Confirmed:");
    expect(body.state.scope_questions[1].answer).toContain("Confirmed:");
    expect(body.assistant_message).toContain("Scope is locked for");

    await app.close();
  });

  it("does not let a stale suggested scope question block prep after grouped time-window confirmation", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Suggested Scope Should Not Block Prep" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const baseState = bootstrap.json().state as Record<string, unknown>;
    baseState.scope_clarification_pending = true;
    baseState.scope_finalized = false;
    baseState.prep_pending = false;
    baseState.scope_pending = false;
    baseState.scope_questions = [
      {
        question_number: 1,
        question: "What is the monthly refund trend over the past 4 complete months?",
        clarification: "Confirm timeframe boundary, primary date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "How do refunds in the most recent 2 months compare to the prior 2 months?",
        clarification: "Confirm exact comparison windows and delta format.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Which cities have the highest refund rate over the past 4 complete months?",
        clarification: "Confirm refund-rate formula and top-N cutoff.",
        answer: "Confirmed: Top 5 cities by refund rate [Refunded Rev / Total Rev], Nov 2025 - Feb 2026.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 4,
        question: "How many support tickets were opened for refunded orders over the past 4 months?",
        clarification: "Confirm join key and whether only refunded-order-linked tickets are in scope.",
        answer:
          "Confirmed: Count of support tickets linked to refunded orders in the past 4 months (Nov 2025 - Feb 2026).",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 5,
        question: "What are the top issue types by ticket count?",
        clarification: "Confirm top-N cutoff and whether only refunded-order-linked tickets are in scope.",
        answer: "Confirmed: Top 5 issue types by ticket count for refunded-order tickets.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 6,
        question:
          "[Suggested] What is the average support ticket resolution time for tickets linked to refunded orders, broken down by issue type?",
        clarification: "Confirm whether this suggested analysis should stay in scope.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];
    baseState.conversation_history = [
      {
        role: "assistant",
        content: [
          "Need clarification for 2 items before data preparation.",
          "Today is 2026-03-09 in UTC; relative windows are anchored to this date by default.",
          "Proposed defaults remain unconfirmed until you explicitly confirm or edit them.",
          "",
          "Recorded so far:",
          "- Q3: Which cities have the highest refund rate over the past 4 complete months?",
          "  Recorded answer: Confirmed: Top 5 cities by refund rate [Refunded Rev / Total Rev], Nov 2025 - Feb 2026.",
          "- Q4: How many support tickets were opened for refunded orders over the past 4 months?",
          "  Recorded answer: Confirmed: Count of support tickets linked to refunded orders in the past 4 months (Nov 2025 - Feb 2026).",
          "- Q5: What are the top issue types by ticket count?",
          "  Recorded answer: Confirmed: Top 5 issue types by ticket count for refunded-order tickets.",
          "",
          "Still pending:",
          "- Q1: What is the monthly refund trend over the past 4 complete months?",
          "  Clarification needed: Proposed default: last 4 complete calendar months (Nov 2025 - Feb 2026).",
          "  Proposed default (not applied): last 4 complete calendar months on order_date",
          "",
          "- Q2: How do refunds in the most recent 2 months compare to the prior 2 months?",
          "  Clarification needed: Derived from the same 4-month window. Proposed split: recent Jan-Feb 2026, prior Nov-Dec 2025.",
          "  Proposed default (not applied): Compare latest 2-month window vs the prior 2-month window anchored to 2026-03-09 (UTC). Return both absolute and percentage delta by default.",
          "",
          "Please confirm or edit the pending items. Run Data Preparation will appear only after this list is empty."
        ].join("\n")
      }
    ];

    for (const message of ["confirm these time periods", "yes"]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: {
          message,
          state: structuredClone(baseState)
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.state.scope_questions).toHaveLength(5);
      expect(body.state.scope_questions.every((entry: { question: string }) => !entry.question.includes("[Suggested]"))).toBe(true);
      expect(body.state.scope_suggestions).toHaveLength(1);
      expect(body.state.scope_suggestions[0].question).toContain("average support ticket resolution time");
      expect(body.state.scope_clarification_pending).toBe(false);
      expect(body.state.prep_pending).toBe(true);
      expect(body.assistant_message).toContain("Scope is locked for");
      expect(body.assistant_message).not.toContain("Q6:");
      expect(body.assistant_message).not.toContain("[Suggested]");
    }

    await app.close();
  });

  it("keeps only a newly added question pending when the user answers one item and confirms the rest", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Confirm Rest With New Question" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Monthly refund trend",
        clarification: "Confirm timeframe boundary, primary date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "Two-month refund comparison",
        clarification: "Confirm exact comparison windows and delta format.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "Q1: Use the last 4 complete months on order_date, confirm the rest, and also add question: Which product categories have the highest refund rate by month?",
        state: seededState
      }
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.state.scope_questions).toHaveLength(3);
    expect(firstBody.state.scope_questions[0].answer).toContain("last 4 complete months on order_date");
    expect(firstBody.state.scope_questions[0].answer).not.toContain("confirm the rest");
    expect(firstBody.state.scope_questions[1].answer).toContain("Confirmed:");
    expect(String(firstBody.state.scope_questions[2].question).toLowerCase()).toContain(
      "product categories have the highest refund rate by month"
    );
    expect(String(firstBody.state.scope_questions[2].question)).not.toContain("Add question:");
    expect(firstBody.state.scope_questions[2].answer).toBeNull();
    expect(firstBody.state.scope_clarification_pending).toBe(true);
    expect(firstBody.state.prep_pending).toBe(false);
    expect(firstBody.assistant_message).toContain("Clarifications to confirm:");
    expect(firstBody.assistant_message).toContain("Q3:");
    expect(firstBody.assistant_message).not.toContain("Q2: Two-month refund comparison\n  Clarification needed:");

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Use refunded orders / total orders, top 5 categories, and monthly buckets on order_date.",
        state: firstBody.state
      }
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.state.scope_clarification_pending).toBe(false);
    expect(secondBody.state.prep_pending).toBe(true);
    expect(secondBody.state.scope_questions[2].answer).toContain("top 5 categories");
    expect(secondBody.assistant_message).toContain("Scope is locked for");

    await app.close();
  });

  it("ignores orchestrator resolved_scope_answers on initial scoping turn", async () => {
    const app = buildWebApp({
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          return {
            intent_parts: [{ type: "new_question", text: "refund analysis" }],
            resolved_scope_answers: [
              { question_number: 1, answer: "Use Nov-Feb" },
              { question_number: 2, answer: "Use top 5 cities" }
            ],
            new_scope_questions: [
              {
                question_text: "What is the monthly refund trend over the past 4 months?",
                clarification: "Confirm exact month window."
              },
              {
                question_text: "Which cities have the highest refund rate?",
                clarification: "Confirm city cutoff and formula."
              }
            ],
            follow_up_requests: [],
            pending_inputs: [
              {
                input_key: "q1_scope",
                prompt: "Confirm month window."
              },
              {
                input_key: "q2_scope",
                prompt: "Confirm city cutoff."
              }
            ],
            next_owner: "wait_for_user",
            tool_calls: [],
            state_updates: {
              mark_scope_complete: false,
              append_new_questions: true,
              clear_pending_inputs: false,
              summary: "Need clarifications first.",
              question_registry_updates: []
            }
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I want a 4 month refund trend and cities with highest refund rate."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_questions.length).toBeGreaterThanOrEqual(2);
    expect(body.state.scope_questions[0].answer).toBeNull();
    expect(body.state.scope_questions[1].answer).toBeNull();
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.assistant_message.toLowerCase()).not.toContain("data preparation decision pending");

    await app.close();
  });

  it("fails fast when orchestrator decision fails", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_orch_fallback",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: {
        provider: "openrouter",
        mode: "provider",
        async decide() {
          return {
            route: "deep_analysis",
            reason: "Multi-part request",
            confidence: 0.9
          };
        }
      },
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return { message: input.action_context };
        },
        async orchestrateTurn() {
          throw new Error("orchestrator down");
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I want a 4 month refund trend along with comparison of past 2 months vs prior 2 months for refunds."
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).toContain("Stage error: orchestrator_decision failed.");
    expect(response.json().state.scope_clarification_pending).toBe(false);
    expect(response.json().state.prep_pending).toBe(false);

    await app.close();
  });

  it("records comma-separated Q1/Q2 clarifications without colons and appends extra scoped question", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Scope Parser Guardrail" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "4-month refund trend with 2-month vs prior 2-month comparison",
        clarification: "Confirm month window and anchor date column.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "Cities with highest refund rate",
        clarification: "Confirm value-based or count-based refund rate.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "Q1 include Feb and use order_date, Q2 use refunded revenue / total revenue by city, also can you show top city for each issue type for refunded orders?",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_questions.length).toBe(3);
    expect(body.state.scope_questions[0].answer).toContain("include Feb");
    expect(body.state.scope_questions[1].answer).toContain("refunded revenue / total revenue");
    expect(body.state.scope_questions[2].answer).toBe(null);
    expect(body.assistant_message).toContain("Questions in scope:");
    expect(body.assistant_message).toContain("Clarifications to confirm:");
    expect(JSON.stringify(body.state.scope_questions).toLowerCase()).toContain("top city for each issue type");

    await app.close();
  });

  it("maps unnumbered clarification text to pending scope questions and keeps new ask as unresolved", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Unnumbered Scope Mapping" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "4-month refund trend and 2-month vs prior 2-month comparison",
        clarification: "Confirm month window and date anchor column.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "Cities with highest refund rate",
        clarification: "Confirm value-based or count-based refund rate.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Support ticket reasons for refunded orders",
        clarification: "Confirm join path and top issue breakdown.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "Use Nov-Feb on order_date and include February partial month. For refund rate use refunded revenue divided by total revenue by city. Also can you show top city for each issue type among refunded orders?",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_questions.length).toBe(4);
    expect(body.state.scope_questions[0].answer).toContain("Nov-Feb");
    expect(body.state.scope_questions[1].answer).toContain("refunded revenue");
    expect(body.state.scope_questions[2].answer).toBe(null);
    expect(body.state.scope_questions[3].answer).toBe(null);
    expect(body.assistant_message).toContain("Questions in scope:");
    expect(body.assistant_message).toContain("Clarifications to confirm:");
    expect(JSON.stringify(body.state.scope_questions).toLowerCase()).toContain("top city for each issue type");

    await app.close();
  });

  it("does not auto-answer suggested scope questions from generic clarification text", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Suggested Scope Guardrail" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "4-month refund trend and 2-month vs prior 2-month comparison",
        clarification: "Confirm month window and date anchor column.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "[Suggested] Which product categories account for the most refunds in this window?",
        clarification: "Confirm whether to include the suggested product-category cut.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Use Nov-Feb on order_date and include February partial month. That works.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.prep_pending).toBe(true);
    expect(body.state.scope_questions).toHaveLength(1);
    expect(body.state.scope_suggestions).toHaveLength(1);
    expect(body.state.scope_questions[0].answer).toContain("Nov-Feb");
    expect(body.state.scope_suggestions[0].question).toContain("product categories");
    expect(body.assistant_message).toContain("Scope is locked for");
    expect(body.assistant_message).not.toContain("Q2");

    await app.close();
  });

  it("accepts explicit confirmation for a single remaining suggested scope question", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Single Suggested Confirmation" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "4-month refund trend and 2-month vs prior 2-month comparison",
        clarification: "Confirm month window and date anchor column.",
        answer: "Use Nov-Feb with Feb partial and order_date anchor.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "[Suggested] Which product categories account for the most refunds in this window?",
        clarification: "Confirm whether to include the suggested product-category cut.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "I like your clarification, go ahead with it.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.scope_finalized).toBe(true);
    expect(body.state.prep_pending).toBe(true);
    expect(body.state.scope_questions[1].answer).toBeTruthy();
    expect(body.assistant_message).toContain("Scope is locked for");
    expect(body.assistant_message.toLowerCase()).not.toContain("need clarification");

    await app.close();
  });

  it("keeps prep blocked when scope answers are complete but data verification fails", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/table-health") && method === "GET") {
        return new Response(JSON.stringify({
          relations: [
            {
              qualified_name: "analytics.sales",
              status: "OK",
              status_label: "OK",
              relation_type: "TABLE",
              rls_active: false,
              policies_count: 0,
              can_select: true,
              can_insert: false,
              can_update: false,
              can_delete: false,
              owner: null,
              grants: []
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(JSON.stringify({
          rows: [{ row_count: 0 }],
          row_count: 1,
          governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
          warnings: []
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({
          business_context: "",
          cataloged_at: "2026-03-01T00:00:00.000Z",
          tables: [
            {
              table_id: "tbl_sales",
              qualified_name: "analytics.sales",
              relation_type: "TABLE",
              summary: "Sales facts",
              columns: [
                { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false }
              ],
              low_cardinality_columns: [],
              sample_rows: [],
              row_count_estimate: 0
            }
          ]
        }), {
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

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Verification Block" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Refund trend for last 4 months",
        clarification: "Confirm timeframe boundary, primary date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Use the last 4 complete months on order_date with monthly granularity.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("appears to be empty");
    expect(body.assistant_message).toContain("There's no data to analyze");
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_finalized).toBe(false);

    await app.close();
  });

  it("offers optional suggestions without auto-scoping them and still unlocks prep when core scope is complete", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/table-health") && method === "GET") {
        return new Response(JSON.stringify({
          relations: [
            {
              qualified_name: "analytics.sales",
              status: "OK",
              status_label: "OK",
              relation_type: "TABLE",
              rls_active: false,
              policies_count: 0,
              can_select: true,
              can_insert: false,
              can_update: false,
              can_delete: false,
              owner: null,
              grants: []
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(JSON.stringify({
          rows: [{ row_count: 120 }],
          row_count: 1,
          governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
          warnings: []
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({
          business_context: "",
          cataloged_at: "2026-03-01T00:00:00.000Z",
          tables: [
            {
              table_id: "tbl_sales",
              qualified_name: "analytics.sales",
              relation_type: "TABLE",
              summary: "Sales facts",
              columns: [
                { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false }
              ],
              low_cardinality_columns: [],
              sample_rows: [],
              row_count_estimate: 120
            }
          ]
        }), {
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

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Compare refunds month over month, and top cities by refund rate."
      }
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.state.scope_questions.length).toBe(2);
    expect(firstBody.state.scope_suggestions.length).toBe(1);
    expect(JSON.stringify(firstBody.state.scope_questions).toLowerCase()).not.toContain("support ticket reasons");
    expect(firstBody.assistant_message).not.toContain("Optional suggested questions");
    expect(firstBody.assistant_message).toContain("Q3 (suggested)");

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Use the last 4 complete months on order_date. For city refund rate use refunded revenue over total revenue and top 5 cities.",
        state: firstBody.state
      }
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.state.scope_clarification_pending).toBe(false);
    expect(secondBody.state.prep_pending).toBe(true);
    expect(secondBody.state.scope_questions.length).toBe(2);
    expect(secondBody.state.scope_suggestions.length).toBe(1);

    await app.close();
  });

  it("suggests a support resolution-time follow-up for refund analyses that already include support volume", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "What is the monthly refund trend over the past 4 complete months, how do the most recent 2 months compare to the prior 2 months in terms of refund count and refund value, which cities have the highest refund rate over the past 4 complete months, how many support tickets were opened for refunded orders over the past 4 complete months, and what were the top issue types?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_suggestions.length).toBeGreaterThan(0);
    expect(body.assistant_message).not.toContain("Optional suggested questions");
    expect(body.state.scope_suggestions[0].question.toLowerCase()).toContain("resolution time");
    expect(body.state.scope_suggestions[0].question.toLowerCase()).toContain("refunded orders");

    await app.close();
  });

  it("keeps optional suggestions visible even when the renderer rewrites the scope message", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message: "Great set of questions - this is a solid refund health analysis. Here's where things stand:"
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "What is the monthly refund trend over the past 4 complete months, how do the most recent 2 months compare to the prior 2 months in terms of refund count and refund value, which cities have the highest refund rate over the past 4 complete months, how many support tickets were opened for refunded orders over the past 4 complete months, and what were the top issue types?"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_suggestions.length).toBeGreaterThan(0);
    expect(body.assistant_message).not.toContain("Optional suggested questions");
    expect(body.assistant_message).toContain("Q6 (suggested)");
    expect(body.assistant_message.toLowerCase()).toContain("resolution time");

    await app.close();
  });

  it("includes an optional suggestion only when explicitly asked and reopens clarification for it", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/table-health") && method === "GET") {
        return new Response(JSON.stringify({
          relations: [
            {
              qualified_name: "analytics.sales",
              status: "OK",
              status_label: "OK",
              relation_type: "TABLE",
              rls_active: false,
              policies_count: 0,
              can_select: true,
              can_insert: false,
              can_update: false,
              can_delete: false,
              owner: null,
              grants: []
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(JSON.stringify({
          rows: [{ row_count: 120 }],
          row_count: 1,
          governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
          warnings: []
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({
          business_context: "",
          cataloged_at: "2026-03-01T00:00:00.000Z",
          tables: [
            {
              table_id: "tbl_sales",
              qualified_name: "analytics.sales",
              relation_type: "TABLE",
              summary: "Sales facts",
              columns: [
                { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false }
              ],
              low_cardinality_columns: [],
              sample_rows: [],
              row_count_estimate: 120
            }
          ]
        }), {
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

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Compare refunds month over month, and top cities by refund rate."
      }
    });
    expect(first.statusCode).toBe(200);

    const answered = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Use the last 4 complete months on order_date. For city refund rate use refunded revenue over total revenue and top 5 cities.",
        state: first.json().state
      }
    });
    expect(answered.statusCode).toBe(200);
    expect(answered.json().state.prep_pending).toBe(true);

    const include = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Include Q3.",
        state: answered.json().state
      }
    });

    expect(include.statusCode).toBe(200);
    const includeBody = include.json();
    expect(includeBody.state.prep_pending).toBe(false);
    expect(includeBody.state.scope_clarification_pending).toBe(true);
    expect(includeBody.state.scope_questions.length).toBe(3);
    expect(String(includeBody.state.scope_questions[2].question).toLowerCase()).toContain("support ticket reasons");
    expect(includeBody.state.scope_questions[2].answer).toBeNull();
    expect(includeBody.state.scope_suggestions).toEqual([]);
    expect(includeBody.assistant_message).toContain("Clarifications to confirm:");
    expect(includeBody.assistant_message).toContain("Q3");

    await app.close();
  });

  it("promotes an included add-on suggestion into canonical scope and prepares all six questions", async () => {
    let createdScopeCount = 0;
    let resolverUserMessage = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/table-health") && method === "GET") {
        return new Response(JSON.stringify({
          relations: [
            {
              qualified_name: "analytics.sales",
              status: "OK",
              status_label: "OK",
              relation_type: "TABLE",
              rls_active: false,
              policies_count: 0,
              can_select: true,
              can_insert: false,
              can_update: false,
              can_delete: false,
              owner: null,
              grants: []
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(JSON.stringify({
          rows: [{ row_count: 120 }],
          row_count: 1,
          governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
          warnings: []
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({
          business_context: "",
          cataloged_at: "2026-03-01T00:00:00.000Z",
          tables: [
            {
              table_id: "tbl_sales",
              qualified_name: "analytics.sales",
              relation_type: "TABLE",
              summary: "Sales facts",
              columns: [
                { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false }
              ],
              low_cardinality_columns: [],
              sample_rows: [],
              row_count_estimate: 120
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts") && method === "POST") {
        const payload =
          typeof init?.body === "string" ? (JSON.parse(init.body) as { scope_clarifications?: unknown[] }) : {};
        createdScopeCount = Array.isArray(payload.scope_clarifications) ? payload.scope_clarifications.length : 0;
        return new Response(JSON.stringify({
          id: "contract_addon_scope",
          name: "Add-on Scope",
          audience: "Executive",
          timezone: "UTC",
          schedule_cron: null,
          sql_template: "SELECT * FROM analytics.sales",
          metric_ids: ["metric_refunds"],
          metric_definitions: [],
          dimension_ids: ["city"],
          insight_mode: "business",
          scope_clarifications: payload.scope_clarifications ?? [],
          guardrails: {
            evidence_row_cap: 200,
            max_batches: 5,
            sql_read_only: true
          },
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          created_at: "2026-03-10T00:00:00.000Z",
          approved_at: null,
          locked_at: null
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts/contract_addon_scope/prepare") && method === "POST") {
        return new Response(JSON.stringify({
          contract_id: "contract_addon_scope",
          planner_summary: "Prepared payloads",
          prepared_payloads: Array.from({ length: createdScopeCount }, (_, index) => ({
            question_id: `q${index + 1}`,
            question_number: index + 1,
            question: `Question ${index + 1}`,
            purpose: "Test payload",
            row_count_before_reduction: 120,
            prepared_row_count: 50,
            preparation_notes: [],
            warnings: []
          }))
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const queryRouter: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "none",
          reason: "n/a",
          confidence: 1
        };
      },
      async resolve_scope_answers(input) {
        resolverUserMessage = input.user_message;
        return {
          assignments: [
            {
              question_number: 1,
              answer:
                "Confirmed: Use the proposed 4-complete-month monthly window anchored on order_date."
            },
            {
              question_number: 2,
              answer:
                "Confirmed: Use the proposed most recent 2 months vs prior 2 months comparison with count and value deltas."
            },
            {
              question_number: 3,
              answer: "Top 5 cities by refund rate."
            },
            {
              question_number: 4,
              answer: "Use only support tickets linked to refunded orders."
            },
            {
              question_number: 5,
              answer: "Use the same refunded-order-linked ticket filter as Q4 and rank the top 5 issue types."
            }
          ],
          unresolved_question_numbers: [],
          remove_question_numbers: []
        };
      }
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: queryRouter,
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Add On Canonical Scope" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "What is the monthly refund trend over the past 4 complete months?",
        clarification: "Confirm date anchor, date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "How do the most recent 2 months compare to the prior 2 months in terms of refund count and refund value?",
        clarification: "Confirm exact period A vs period B windows and whether to show absolute delta, percentage delta, or both.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Which cities have the highest Refund Rate over the past 4 complete months?",
        clarification: "Confirm refund-rate formula and top-N cutoff.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 4,
        question: "How many support tickets were opened for refunded orders over the past 4 complete months?",
        clarification: "Confirm whether only refunded-order-linked tickets are in scope.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 5,
        question: "What are the top issue types by ticket count?",
        clarification: "Confirm top-N cutoff and whether only refunded-order-linked tickets are in scope.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];
    seededState.scope_suggestions = [
      {
        suggestion_number: 1,
        question:
          "What is the average support ticket resolution time for tickets linked to refunded orders, broken down by issue type?",
        reason: "This helps explain whether refund-linked issues also take longer to resolve."
      }
    ];

    const clarified = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I like the time windows for Q1 and 2. Just give me top 5 cities, for support tickets give me just the ones with refunded order and for Q5 should be same as Q4. Include the add on question",
        state: seededState
      }
    });

    expect(clarified.statusCode).toBe(200);
    const clarifiedBody = clarified.json();
    expect(resolverUserMessage.toLowerCase()).not.toContain("add on question");
    expect(resolverUserMessage.toLowerCase()).not.toContain("include s1");
    expect(clarifiedBody.state.scope_questions).toHaveLength(6);
    expect(String(clarifiedBody.state.scope_questions[5].question).toLowerCase()).toContain("resolution time");
    expect(String(clarifiedBody.state.scope_questions[5].answer)).toContain("Confirmed:");
    expect(clarifiedBody.state.scope_suggestions).toEqual([]);
    expect(clarifiedBody.state.scope_clarification_pending).toBe(false);
    expect(clarifiedBody.state.prep_pending).toBe(true);
    expect(clarifiedBody.assistant_message).toContain("Scope is locked for");

    const prepared = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_run_data_preparation__",
        state: clarifiedBody.state
      }
    });

    expect(prepared.statusCode).toBe(200);
    expect(prepared.json().state.prepared_payloads).toHaveLength(6);
    expect(prepared.json().assistant_message).toContain("Data preparation is complete");

    await app.close();
  });

  it("keeps existing scoped questions when the user says also include the suggested question", async () => {
    let resolverUserMessage = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({
          business_context:
            "Refund operations for an ecommerce business. Support tickets are linked to orders when order_id is available.",
          cataloged_at: "2026-03-01T00:00:00.000Z",
          tables: [
            {
              table_id: "tbl_orders",
              qualified_name: "public.demo_orders",
              relation_type: "TABLE",
              summary: "Orders and refunds",
              columns: [
                { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                { column_name: "status", data_type: "text", is_nullable: false },
                { column_name: "order_id", data_type: "text", is_nullable: false },
                { column_name: "city", data_type: "text", is_nullable: true }
              ],
              low_cardinality_columns: [],
              sample_rows: [],
              row_count_estimate: 400
            },
            {
              table_id: "tbl_support",
              qualified_name: "public.demo_support_tickets",
              relation_type: "TABLE",
              summary: "Support tickets",
              columns: [
                { column_name: "created_at", data_type: "timestamp with time zone", is_nullable: false },
                { column_name: "order_id", data_type: "text", is_nullable: true },
                { column_name: "issue_type", data_type: "text", is_nullable: true },
                { column_name: "resolution_time_hours", data_type: "numeric", is_nullable: true }
              ],
              low_cardinality_columns: [],
              sample_rows: [],
              row_count_estimate: 200
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(JSON.stringify({
          rows: [{ row_count: 400 }],
          row_count: 1,
          governed_sql: "SELECT COUNT(*) AS row_count FROM public.demo_orders",
          warnings: []
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts") && method === "POST") {
        return new Response(JSON.stringify({
          id: "contract_include_suggested"
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts/contract_include_suggested") && method === "GET") {
        return new Response(JSON.stringify({
          id: "contract_include_suggested",
          approved_at: null,
          locked_at: null
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-contracts/contract_include_suggested/prepare") && method === "POST") {
        return new Response(JSON.stringify({
          contract_id: "contract_include_suggested",
          planner_summary: "Prepared payloads",
          prepared_payloads: Array.from({ length: 6 }, (_, index) => ({
            question_id: `q${index + 1}`,
            question_number: index + 1,
            question: `Question ${index + 1}`,
            purpose: "Test payload",
            row_count_before_reduction: 120,
            prepared_row_count: 50,
            preparation_notes: [],
            warnings: []
          }))
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const queryRouter: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "none",
          reason: "n/a",
          confidence: 1
        };
      },
      async resolve_scope_answers(input) {
        resolverUserMessage = input.user_message;
        return {
          assignments: [
            {
              question_number: 1,
              answer:
                "Confirmed: Use the proposed 4-complete-month monthly window anchored on order_date."
            },
            {
              question_number: 2,
              answer:
                "Confirmed: Use the proposed most recent 2 months vs prior 2 months comparison with count and value deltas."
            },
            {
              question_number: 4,
              answer: "Use only support tickets linked to refunded orders."
            },
            {
              question_number: 5,
              answer: "Use the same refunded-order-linked ticket filter as Q4 and rank the top 5 issue types."
            }
          ],
          unresolved_question_numbers: [],
          remove_question_numbers: [3]
        };
      }
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: queryRouter,
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Include Suggested Exact Wording" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "What is the monthly refund trend over the past 4 complete months?",
        clarification: "Confirm date anchor, date column, and reporting granularity.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "How do the most recent 2 months compare to the prior 2 months in terms of refund count and refund value?",
        clarification:
          "Confirm exact period A vs period B windows and whether to show absolute delta, percentage delta, or both.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Which cities have the highest Refund Rate over the past 4 complete months?",
        clarification: "Confirm refund-rate formula and top-N cutoff.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 4,
        question: "How many support tickets were opened for refunded orders over the past 4 complete months?",
        clarification: "Confirm whether only refunded-order-linked tickets are in scope.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 5,
        question: "What are the top issue types by ticket count?",
        clarification: "Confirm top-N cutoff and whether only refunded-order-linked tickets are in scope.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];
    seededState.scope_suggestions = [
      {
        suggestion_number: 1,
        question:
          "What is the average support ticket resolution time for tickets linked to refunded orders, broken down by issue type?",
        reason: "This helps explain whether refund-linked issues also take longer to resolve."
      }
    ];

    const clarified = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "Time window is ok, top 5 cities is also ok, include only tickets that are linked to refunded orders, all of them. Also include the suggested question",
        state: seededState
      }
    });

    expect(clarified.statusCode).toBe(200);
    const clarifiedBody = clarified.json();
    expect(resolverUserMessage.toLowerCase()).not.toContain("suggested question");
    expect(clarifiedBody.state.scope_questions).toHaveLength(6);
    expect(
      clarifiedBody.state.scope_questions.some((entry: { question: string }) =>
        /cities have the highest refund rate/i.test(entry.question)
      )
    ).toBe(true);
    expect(
      String(clarifiedBody.state.scope_questions[2].answer).toLowerCase()
    ).toContain("top 5 cities");
    expect(
      clarifiedBody.state.scope_questions.some((entry: { question: string }) =>
        /average support ticket resolution time/i.test(entry.question)
      )
    ).toBe(true);
    expect(clarifiedBody.state.scope_suggestions).toEqual([]);
    expect(clarifiedBody.state.prep_pending).toBe(true);
    expect(clarifiedBody.state.scope_clarification_pending).toBe(false);

    await app.close();
  });

  it("treats Q-specific tweaks as edits while still appending a real new follow-up question", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Mixed Clarification Edit" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "What is the monthly refund trend over the past 4 complete months?",
        clarification: "Confirm date range and time grain.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question:
          "How do the most recent 2 months compare to the prior 2 months in terms of refund count and refund value?",
        clarification: "Confirm comparison windows and whether to show absolute delta, percentage delta, or both.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Which cities have the highest Refund Rate over the past 4 complete months?",
        clarification: "Confirm refund-rate formula and how many cities to rank.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 4,
        question: "How many support tickets were opened for refunded orders over the past 4 complete months?",
        clarification: "Confirm whether only refunded-order-linked tickets are in scope.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 5,
        question: "What are the top issue types by ticket count?",
        clarification: "Confirm ranking method for top issues.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];
    seededState.scope_suggestions = [
      {
        suggestion_number: 1,
        question:
          "What is the average support ticket resolution time (in hours) for support tickets linked to refunded orders, broken down by issue type?",
        reason: "This helps explain whether refund-linked issues also take longer to resolve."
      }
    ];

    const clarified = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I like the assumptions and also show me just top 4 cities for Q3, include Q6 and also tell me what is the top issue for each city.",
        state: seededState
      }
    });

    expect(clarified.statusCode).toBe(200);
    const body = clarified.json();
    expect(body.state.scope_questions).toHaveLength(7);
    expect(String(body.state.scope_questions[2].answer).toLowerCase()).toContain("top 4 cities");
    expect(
      body.state.scope_questions.some((entry: { question: string }) =>
        /top 4 cities for q3/i.test(entry.question)
      )
    ).toBe(false);
    expect(
      body.state.scope_questions.some((entry: { question: string }) =>
        /average support ticket resolution time/i.test(entry.question)
      )
    ).toBe(true);
    expect(
      body.state.scope_questions.some((entry: { question: string }) =>
        /top issue.*each city|each city.*top issue/i.test(entry.question)
      )
    ).toBe(true);
    expect(body.state.scope_suggestions).toEqual([]);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_clarification_pending).toBe(true);

    await app.close();
  });

  it("strips shared list verbs from the first scoped question so clarifications stay specific", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Compare refund trend for last 4 months, top cities by refund rate, and top ticket reasons behind refunded orders."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(String(body.state.scope_questions[0].question).toLowerCase()).not.toContain("compare refund trend");
    expect(body.state.scope_questions[0].clarification).not.toContain("Period A vs Period B");
    expect(body.state.scope_questions[0].clarification).toContain("date range and time grain");

    await app.close();
  });

  it("splits simple two-clause scope prompts joined only by and", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Compare refund trend for last 4 months and top cities by refund rate."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_questions).toHaveLength(2);
    expect(String(body.state.scope_questions[0].question).toLowerCase()).toContain("refund trend");
    expect(String(body.state.scope_questions[0].question).toLowerCase()).not.toContain("compare refund trend");
    expect(String(body.state.scope_questions[0].clarification).toLowerCase()).toContain("date anchor");
    expect(String(body.state.scope_questions[0].clarification).toLowerCase()).not.toContain("city");
    expect(String(body.state.scope_questions[0].clarification).toLowerCase()).not.toContain("refund-rate formula");
    expect(String(body.state.scope_questions[1].question).toLowerCase()).toContain("cities");

    await app.close();
  });

  it("uses product-category-specific clarification and defaults for late-added refund-rate questions", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Compare refund trend for last 4 months, top cities by refund rate."
      }
    });
    expect(first.statusCode).toBe(200);

    const answered = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Use the last 4 complete months on order_date. For city refund rate use refunded revenue over total revenue and top 5 cities.",
        state: first.json().state
      }
    });
    expect(answered.statusCode).toBe(200);

    const added = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What about product categories with the highest refund rate by month?",
        state: answered.json().state
      }
    });

    expect(added.statusCode).toBe(200);
    const addedBody = added.json();
    expect(addedBody.assistant_message).toContain("top 5 product categories");
    expect(addedBody.assistant_message).not.toContain("cities/regions");

    await app.close();
  });

  it("removes excluded scope questions, renumbers the remaining list, and unlocks prep only after the remaining scope is complete", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Exclude Scope Question" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "4-month refund trend",
        clarification: "Confirm month window and date anchor column.",
        answer: "Use Nov-Feb with order_date.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "Cities with highest refund rate",
        clarification: "Confirm value-based vs count-based refund rate and city cutoff.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Top support ticket reasons linked to refunded orders",
        clarification: "Confirm refunded-order join path and top issue ranking method.",
        answer: "Use refunded-order-linked tickets and rank issue types by ticket count.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];
    seededState.pending_inputs = [
      {
        input_key: "q2_scope",
        prompt: "Confirm refund-rate formula and top-N city cutoff.",
        question_number: 2
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Exclude question 2 from scope.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_questions.length).toBe(2);
    expect(body.state.scope_questions[0].question_number).toBe(1);
    expect(body.state.scope_questions[1].question_number).toBe(2);
    expect(body.state.scope_questions[1].question).toContain("Top support ticket reasons");
    expect(JSON.stringify(body.state.scope_questions).toLowerCase()).not.toContain("cities with highest refund rate");
    expect(body.state.pending_inputs).toEqual([]);
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.prep_pending).toBe(true);
    expect(body.assistant_message).toContain("Scope is locked for");

    await app.close();
  });

  it("removes a scope question when the user says they do not want that Q-number", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Do Not Want Q6" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Monthly refund trend",
        clarification: "Confirm date range.",
        answer: "Use the last 4 complete months.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "2-month comparison",
        clarification: "Confirm the comparison windows.",
        answer: "Use latest 2 complete months vs prior 2 complete months.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Top cities by refund rate",
        clarification: "Confirm formula and top-N.",
        answer: "Use refunded revenue / total revenue and top 5 cities.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 4,
        question: "Support tickets for refunded orders",
        clarification: "Confirm join path.",
        answer: "Join tickets to refunded orders via order_id.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 5,
        question: "Top issue types",
        clarification: "Confirm ranking method.",
        answer: "Rank issue types by ticket count.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 6,
        question: "[Suggested] Average support ticket resolution time",
        clarification: "Confirm whether to include only refunded-order-linked tickets.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "I don't want Q6.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_questions).toHaveLength(5);
    expect(JSON.stringify(body.state.scope_questions)).not.toContain("Q6");
    expect(JSON.stringify(body.state.scope_questions)).not.toContain("Average support ticket resolution time");
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.prep_pending).toBe(true);
    expect(body.assistant_message).not.toContain("- Q6:");
    expect(body.assistant_message).not.toContain("Average support ticket resolution time");

    await app.close();
  });

  it("uses authoritative pending-clarification context after removing a suggested scope question", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message: [
              "Questions in scope:",
              "- Q1: What is the monthly refund trend over the past 4 complete months?",
              "- Q2: How do the most recent 2 months compare to the prior 2 months?",
              "- Q3: Which cities have the highest refund rate?",
              "- Q4: How many support tickets were opened for refunded orders?",
              "- Q5: What were the top issue types?",
              "- Q6: [Suggested] What is the average support ticket resolution time?",
              "",
              "Pending clarifications:",
              "- Q1: Confirm date anchor, date column, and reporting granularity for the trend.",
              "- Q2: Confirm exact period A vs period B windows and whether to show absolute delta, percentage delta, or both.",
              "All confirmed! Here's the locked plan:",
              "",
              "Q6 is out of scope. Hit Run Data Preparation to kick things off!"
            ].join("\n")
          };
        }
      }
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Removal Context Guard" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "What is the monthly refund trend over the past 4 complete months?",
        clarification: "Confirm date anchor, date column, and reporting granularity for the trend.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question:
          "How do the most recent 2 months compare to the prior 2 months in terms of refund count and refund value?",
        clarification:
          "Confirm exact period A vs period B windows and whether to show absolute delta, percentage delta, or both.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Which cities have the highest refund rate over the past 4 complete months?",
        clarification: "Confirm refund-rate formula and city cutoff.",
        answer: "Use refunded revenue / total revenue and top 5 cities.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 4,
        question: "How many support tickets were opened for refunded orders over the past 4 complete months?",
        clarification: "Confirm refunded-order join path.",
        answer: "Join tickets to refunded orders via order_id.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 5,
        question: "What were the top issue types?",
        clarification: "Confirm ranking method.",
        answer: "Rank issue types by ticket count.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 6,
        question:
          "[Suggested] What is the average support ticket resolution time for tickets linked to refunded orders, broken down by issue type?",
        clarification: "Confirm whether to include only refunded-order-linked tickets.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];
    seededState.pending_inputs = [
      {
        input_key: "q1_scope",
        prompt: "Confirm trend granularity and date anchor.",
        question_number: 1
      },
      {
        input_key: "q2_scope",
        prompt: "Confirm comparison windows and delta format.",
        question_number: 2
      },
      {
        input_key: "q6_scope",
        prompt: "Confirm whether to include the suggested resolution-time cut.",
        question_number: 6
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "I don't want Q6.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_questions).toHaveLength(5);
    expect(body.state.pending_inputs).toEqual([
      {
        input_key: "q1_scope",
        prompt: "Confirm trend granularity and date anchor.",
        question_number: 1
      },
      {
        input_key: "q2_scope",
        prompt: "Confirm comparison windows and delta format.",
        question_number: 2
      }
    ]);
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.assistant_message).toContain("Still need clarification on 2 items before data preparation.");
    expect(body.assistant_message).toContain("Clarifications to confirm:");
    expect(body.assistant_message).not.toContain("Q6:");
    expect(body.assistant_message).not.toContain("All confirmed! Here's the locked plan:");
    expect(body.assistant_message).not.toContain("Hit Run Data Preparation to kick things off!");

    await app.close();
  });

  it("appends a new question during clarification and keeps prep locked until that appended question is clarified", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: createScopeVerificationFetchImpl(120),
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Append Scope Question" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "4-month refund trend",
        clarification: "Confirm month window and date anchor column.",
        answer: "Use the last 4 complete months on order_date.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "Cities with highest refund rate",
        clarification: "Confirm value-based vs count-based refund rate and city cutoff.",
        answer: "Use refunded revenue / total revenue and top 5 cities.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "New question: Which product categories have the highest refund rate by month?",
        state: seededState
      }
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.state.scope_clarification_pending).toBe(true);
    expect(firstBody.state.prep_pending).toBe(false);
    expect(firstBody.state.scope_questions.length).toBe(3);
    expect(firstBody.state.scope_questions[2].question_number).toBe(3);
    expect(firstBody.state.scope_questions[2].answer).toBeNull();
    expect(String(firstBody.state.scope_questions[2].question).toLowerCase()).toContain("product categories");
    expect(firstBody.assistant_message).toContain("Clarifications to confirm:");
    expect(firstBody.assistant_message).toContain("Q3");
    expect(firstBody.assistant_message).toContain("Run Data Preparation will appear once these are closed.");

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Use the last 4 complete months on order_date and rank the top 5 product categories.",
        state: firstBody.state
      }
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.state.scope_clarification_pending).toBe(false);
    expect(secondBody.state.prep_pending).toBe(true);
    expect(secondBody.state.scope_questions.length).toBe(3);
    expect(secondBody.state.scope_questions[2].answer).toContain("last 4 complete months");
    expect(secondBody.assistant_message).toContain("Scope is locked for");

    await app.close();
  });

  it("does not copy an explicit Q1 clarification onto other unanswered scope questions", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Compare refund trend for last 4 months and top cities by refund rate."
      }
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().state.scope_questions).toHaveLength(2);

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Q1: use the last 4 complete months on order_date.",
        state: first.json().state
      }
    });

    expect(second.statusCode).toBe(200);
    const body = second.json();
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.scope_questions[0].answer).toContain("last 4 complete months");
    expect(body.state.scope_questions[1].answer).toBeNull();
    expect(body.assistant_message).toContain("Clarifications to confirm:");
    expect(body.assistant_message).toContain("Q2");

    await app.close();
  });

  it("maps unnumbered clarification text for generated long-form scope questions", async () => {
    const app = buildWebApp({
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Long-form Unnumbered Mapping" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = true;
    seededState.scope_finalized = false;
    seededState.prep_pending = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question:
          "4-Month Monthly Refund Trend: How many orders had status='refunded' each month from Nov 2025 to Feb 2026, and what is the refunded revenue trend?",
        clarification:
          "Confirm whether to include February partial month and anchor on order_date for month buckets.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question:
          "Past 2 Months vs Prior 2 Months Refund Comparison: Compare Jan-Feb 2026 vs Nov-Dec 2025 deltas.",
        clarification:
          "Confirm comparison metric and date windows.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question:
          "Cities with Highest Refund Rate: Rank top cities by refund rate in the same Nov-Feb window.",
        clarification:
          "Confirm refund rate formula: refunded revenue / total revenue vs refunded orders / total orders.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "Go ahead with timeline including February partial month. Use refund rate as refunded revenue / total revenue. Also can you show me top city for each of the top 3 issue types for refunded orders?",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.prep_pending).toBe(false);
    expect(body.state.scope_questions[0].answer).toContain("February partial month");
    expect(body.state.scope_questions[2].answer).toContain("refunded revenue / total revenue");
    expect(body.state.scope_questions.length).toBeGreaterThanOrEqual(4);
    const lastQuestionText = String(
      body.state.scope_questions[body.state.scope_questions.length - 1]?.question ?? ""
    ).toLowerCase();
    expect(lastQuestionText).toContain("top city");
    expect(lastQuestionText).not.toContain("go ahead with timeline");
    expect(body.state.scope_questions.some((entry: { answer: string | null }) => !entry.answer)).toBe(true);
    expect(body.assistant_message).toContain("Questions in scope:");
    expect(body.assistant_message).toContain("Clarifications to confirm:");

    await app.close();
  });

  it("falls back to structured deep-analysis scoping when router decision is unavailable", async () => {
    let conversationCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_fallback",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "total_amount", data_type: "numeric", is_nullable: false }
                ],
                low_cardinality_columns: []
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: {
        provider: "openrouter",
        mode: "provider",
        async decide() {
          throw new Error("router unavailable");
        }
      },
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          conversationCalls += 1;
          return { message: "LLM layer rewrote the scoped-clarification prompt." };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I want a 4 month refund trend along with comparison of past 2 months vs prior 2 months for refunds. Also tell me cities with highest refund rate and top support ticket reasons."
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.scope_clarification_pending).toBe(true);
    expect(response.json().state.prep_pending).toBe(false);
    expect(response.json().state.scope_questions.length).toBeGreaterThanOrEqual(2);
    expect(response.json().assistant_message).toContain("Before data preparation");
    expect(conversationCalls).toBe(1);

    await app.close();
  });

  it("does not lock into prep_pending from free-form 'good to go' phrasing", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
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
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message: [
              "Great set of questions.",
              "Before we lock scope, should we anchor on order_date and use refunded orders only?",
              "Let me know and we'll be good to go."
            ].join(" ")
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "hello",
        state: {
          draft: {
            name: "Refund analysis",
            audience: "Executive",
            timezone: "UTC",
            schedule_cron: null,
            sql_template: "SELECT * FROM public.orders",
            metric_ids: ["metric_refunds"],
            dimension_ids: ["city"],
            allowed_relations: ["public.orders"],
            allowed_schemas: ["public"],
            insight_mode: "business"
          },
          scope_questions: [
            {
              question_number: 1,
              question: "Time window?",
              clarification: "Confirm window",
              answer: "Last 4 months"
            }
          ]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.prep_pending).toBe(false);
    expect(response.json().state.scope_pending).toBe(false);

    await app.close();
  });

  it("preserves prep decision buttons when provider returns draft updates", async () => {
    const router: QueryRouterClient = {
      provider: "openrouter",
      mode: "provider",
      async decide() {
        return {
          route: "deep_analysis",
          reason: "Multi-part diagnostic request",
          confidence: 0.94
        };
      }
    };

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_sales",
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                summary: "Sales rows",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "refund_amount", data_type: "numeric", is_nullable: true }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: [
              {
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                status: "OK",
                has_rls: false,
                force_rls: false,
                rls_active_for_me: false,
                policies_count_for_me: 0
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ row_count: 1000 }],
            row_count: 1,
            governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      query_router: router,
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond(input) {
          return {
            message: `${input.action_context}\n\nNoted.`,
            draft_updates: {
              metric_ids: ["metric_refunds"]
            }
          };
        }
      }
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message:
          "I need a refund trend by month. Also compare last 6 months vs prior 6 months."
      }
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().state.scope_clarification_pending).toBe(true);

    const firstState = first.json().state;
    const generatedAnswers = (firstState.scope_questions as Array<{ question_number: number }>)
      .map((entry) => {
        if (entry.question_number === 1) {
          return "Q1: Use order_date and last 6 full calendar months.";
        }
        if (entry.question_number === 2) {
          return "Q2: Compare against the previous 6 full months and include refunded status only.";
        }
        return `Q${entry.question_number}: Use standard defaults and keep the same 6-month timeline.`;
      })
      .join(" ");

    const second = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: generatedAnswers,
        state: firstState
      }
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().state.scope_clarification_pending).toBe(false);
    expect(second.json().state.prep_pending).toBe(true);

    await app.close();
  });

  it("sets prep_pending when assistant says scope is locked and ready to move to data preparation", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";
        if (url.endsWith("/connections/catalog") && method === "GET") {
          return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message: "Scope is locked — ready to move to data preparation when you are."
          };
        }
      }
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Prep Button Recovery" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = false;
    seededState.scope_finalized = true;
    seededState.prep_pending = false;
    seededState.prep_complete = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Refund trend",
        clarification: "Confirm date range",
        answer: "Use Nov-Feb",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "ok",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.prep_pending).toBe(true);
    expect(response.json().state.scope_clarification_pending).toBe(false);
    expect(response.json().state.scope_pending).toBe(false);

    await app.close();
  });

  it("does not promote to prep when assistant claims scope lock but clarifications are unresolved", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";
        if (url.endsWith("/connections/catalog") && method === "GET") {
          return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message: "All questions are confirmed. Scope is locked — ready to move to data preparation."
          };
        }
      }
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Scope Lock Guard" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_clarification_pending = false;
    seededState.scope_finalized = true;
    seededState.prep_pending = false;
    seededState.prep_complete = false;
    seededState.scope_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Refund trend",
        clarification: "Confirm date range",
        answer: "Use Nov-Feb",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "City refund rate",
        clarification: "Confirm formula",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "ok",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.scope_clarification_pending).toBe(true);
    expect(response.json().state.scope_finalized).toBe(false);
    expect(response.json().state.prep_pending).toBe(false);

    await app.close();
  });

  it("bypasses orchestrator on pending-decision turns so user confirmations do not fail", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";
        if (url.endsWith("/connections/catalog") && method === "GET") {
          return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return { message: "Continue scoping acknowledged." };
        },
        async orchestrateTurn() {
          throw new Error("orchestrator should not run on pending-decision turn");
        }
      }
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Pending Decision Orchestrator Bypass" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.prep_pending = true;
    seededState.scope_finalized = true;
    seededState.scope_clarification_pending = false;
    seededState.scope_pending = false;

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "continue scoping",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message.toLowerCase()).not.toContain("orchestrator_decision failed");
    expect(response.json().state.scope_clarification_pending).toBe(true);
    expect(response.json().state.prep_pending).toBe(false);

    await app.close();
  });

  it("bypasses orchestrator and conversational rewrite on report clarification follow-up turns", async () => {
    let orchestratorCalls = 0;
    let respondCalls = 0;
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";

        if (url.endsWith("/ui/rag/search") && method === "POST") {
          return new Response(JSON.stringify({ chunks: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/report-runs/run_followup/report-qa") && method === "POST") {
          return new Response(JSON.stringify({
            answer: "Clarification answer 1",
            citations: ["q_1"],
            grounded: true,
            requires_new_analysis: false
          }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          respondCalls += 1;
          throw new Error("conversation rewrite should not run for report clarification follow-up turns");
        },
        async orchestrateTurn() {
          orchestratorCalls += 1;
          throw new Error("orchestrator should not run for report clarification follow-up turns");
        }
      }
    });

    const seededState = {
      last_run_id: "run_followup",
      post_run_actions_pending: true,
      report_clarification_active: true
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "What changed in city-level refunds?",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).toContain("Clarification answer 1");
    expect(response.json().state.report_clarification_active).toBe(true);
    expect(orchestratorCalls).toBe(0);
    expect(respondCalls).toBe(0);

    await app.close();
  });

  it("bypasses orchestrator and conversational rewrite on business case clarification turns", async () => {
    let orchestratorCalls = 0;
    let respondCalls = 0;
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";

        if (url.endsWith("/ui/rag/search") && method === "POST") {
          return new Response(JSON.stringify({ chunks: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/report-runs/run_followup/business-case") && method === "POST") {
          return new Response(JSON.stringify({
            status: "complete",
            title: "Business case for tighter refund review rules",
            executive_summary: "The recommendation is viable if rollout assumptions hold.",
            recommendation: "Tighten refund review rules",
            baseline: ["Refund concentration is materially above baseline."],
            assumptions: ["Assume a $50k rollout cost and 2 analysts for the first quarter."],
            implementation_plan: ["Configure review rules", "Pilot the new process"],
            timeline_impact: [
              { period_label: "Time period 1 after implementation", impact: "Leakage begins to slow." },
              { period_label: "Time period 2 after implementation", impact: "Savings compound as adoption stabilizes." }
            ],
            financial_view: ["Compare avoided refunds against rollout cost."],
            operational_view: ["Review workload rises temporarily during adoption."],
            risks: ["Rules that are too strict may create customer friction."],
            kpis_to_track: ["Refund rate", "Review backlog"],
            citations: ["q_1"],
            additional_query_requests: []
          }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          respondCalls += 1;
          throw new Error("conversation rewrite should not run for business case follow-up turns");
        },
        async orchestrateTurn() {
          orchestratorCalls += 1;
          throw new Error("orchestrator should not run for business case follow-up turns");
        }
      }
    });

    const seededState = {
      last_run_id: "run_followup",
      post_run_actions_pending: true,
      business_case_active: true,
      business_case_selected_candidate_id: "q_1_r1",
      business_case_pending_clarification: "Please provide at least one implementation cost or staffing assumption.",
      business_case_candidates: [
        {
          candidate_id: "q_1_r1",
          question_id: "q_1",
          question_number: 1,
          question_text: "Refund trend",
          recommendation_index: 1,
          recommendation: "Tighten refund review rules",
          highlights: ["Refunds are concentrated in a small set of cases."],
          risks: ["Margin leakage continues without intervention."]
        }
      ]
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Assume a $50k rollout cost and 2 analysts for the first quarter.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).toContain("Business case for tighter refund review rules");
    expect(response.json().state.business_case_active).toBe(true);
    expect(orchestratorCalls).toBe(0);
    expect(respondCalls).toBe(0);

    await app.close();
  });

  it("recovers stale analysis-decision state back to prep decision when scope is locked", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";
        if (url.endsWith("/connections/catalog") && method === "GET") {
          return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return { message: "Scope is locked — ready to move to data preparation when you are." };
        }
      }
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Stale Scope Pending Recovery" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_pending = true;
    seededState.prep_pending = false;
    seededState.prep_complete = false;
    seededState.scope_finalized = true;
    seededState.scope_clarification_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Refund trend",
        clarification: "Confirm timeline",
        answer: "Use Nov-Feb",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "ok",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.scope_pending).toBe(false);
    expect(response.json().state.prep_pending).toBe(true);
    expect(response.json().state.scope_clarification_pending).toBe(false);

    await app.close();
  });

  it("recovers stale scope_clarification_pending when assistant confirms scope is fully locked", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";
        if (url.endsWith("/connections/catalog") && method === "GET") {
          return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message:
              "All six questions are fully confirmed. Scope is locked — here's the final plan."
          };
        }
      }
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Stale Scope Clarification Recovery" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_pending = false;
    seededState.prep_pending = false;
    seededState.prep_complete = false;
    seededState.scope_finalized = true;
    seededState.scope_clarification_pending = true;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Refund trend",
        clarification: "Confirm timeline",
        answer: "Use Nov-Feb",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "City refund rate",
        clarification: "Confirm formula",
        answer: "Use refunded revenue / total revenue",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "ok",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.scope_clarification_pending).toBe(false);
    expect(response.json().state.scope_finalized).toBe(true);
    expect(response.json().state.prep_pending).toBe(true);

    await app.close();
  });

  it("does not clear scoped questions when LLM draft updates arrive after scope answers", () => {
    const state = parseChatState(undefined);
    state.draft.name = "";
    state.draft.audience = "Executive";
    state.draft.timezone = "UTC";
    state.draft.sql_template = "SELECT * FROM public.demo_orders";
    state.draft.metric_ids = ["metric_refunds"];
    state.draft.dimension_ids = ["city"];
    state.draft.allowed_relations = ["public.demo_orders"];
    state.draft.allowed_schemas = ["public"];
    state.scope_clarification_pending = false;
    state.scope_finalized = true;
    state.scope_questions = [
      {
        question_number: 1,
        question:
          "What is the monthly refund trend for the last 4 complete months and 2v2 comparison?",
        clarification: "Confirm 4 complete months and compare recent 2 months vs prior 2 months.",
        answer:
          "Use the last 4 complete months and compare the most recent 2 complete months vs the prior 2 complete months.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];
    state.question_registry = [
      {
        question_number: 1,
        question_id: null,
        question_text: state.scope_questions[0]!.question,
        status: "scoped",
        group_id: null,
        clarification_needed: state.scope_questions[0]!.clarification,
        clarification_answer: state.scope_questions[0]!.answer,
        scope_clarified: true
      }
    ];

    const next = applyLlmDraftUpdates(state, {
      name: "Refund Trend & Support Analysis",
      allowed_relations: ["public.demo_orders", "public.demo_support_tickets"],
      allowed_schemas: ["public"]
    });

    expect(next.scope_questions).toHaveLength(1);
    expect(next.scope_questions[0]?.answer).toContain("last 4 complete months");
    expect(next.question_registry).toHaveLength(1);
    expect(next.scope_finalized).toBe(true);
  });

  it("advances to preparation when scope is already fully answered", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_sales",
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                summary: "Sales rows",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "refund_amount", data_type: "numeric", is_nullable: true }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: [
              {
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                status: "OK",
                has_rls: false,
                force_rls: false,
                rls_active_for_me: false,
                policies_count_for_me: 0
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ row_count: 1000 }],
            row_count: 1,
            governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "ok",
        state: {
          draft: {
            name: "Weekly Refund Report",
            audience: "Executive",
            timezone: "UTC",
            schedule_cron: null,
            sql_template: "SELECT * FROM analytics.sales",
            metric_ids: ["metric_refunds"],
            dimension_ids: ["city"],
            allowed_relations: ["analytics.sales"],
            allowed_schemas: ["analytics"],
            insight_mode: "business"
          },
          contract_id: null,
          last_run_id: null,
          last_query_id: null,
          last_exec_brief: null,
          conversation_history: [],
          prep_pending: false,
          prep_complete: false,
          scope_pending: false,
          metric_definitions: [],
          pending_metric_confirmations: [],
          pending_metric_resume_message: null,
          pending_metric_resume_mode: null,
          scope_clarification_pending: true,
          scope_source_prompt: "refund trend and comparison",
          scope_questions: [
            {
              question_number: 1,
              question: "Confirm 4-month window",
              clarification: "Use Nov-Feb window",
              answer: "Nov-Feb is correct",
              metric_key: null,
              metric_display_name: null,
              metric_definition_draft: null,
              metric_source_columns: []
            }
          ],
          pending_query_sql: null,
          pending_query_limit: null,
          pending_single_query_request: null,
          last_single_query_snapshot: null,
          single_query_log: [],
          planner_summary: null,
          preparation_summary: null,
          prepared_payloads: [],
          awaiting_pdf_confirmation: false,
          awaiting_post_run_refinement: false,
          refinement_active: false,
          refinement_questions_remaining: 0,
          awaiting_save_confirmation: false,
          awaiting_schedule_confirmation: false,
          awaiting_schedule_mode_selection: false,
          schedule_mode_pending: null,
          schedule_day_kind: null,
          awaiting_custom_day_input: false,
          last_concise_summary: null,
          last_token_usage: null
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.scope_clarification_pending).toBe(false);
    expect(response.json().state.prep_pending).toBe(true);
    expect(response.json().assistant_message).toContain("Scope is locked for");

    await app.close();
  });

  it("runs data preparation when prep decision is pending and user confirms with ok", async () => {
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";
      requests.push(`${method} ${url}`);

      if (url.endsWith("/report-contracts/contract_prep/prepare") && method === "POST") {
        return new Response(
          JSON.stringify({
            contract_id: "contract_prep",
            planner_summary: "Preparation summary",
            prepared_payloads: [
              {
                question_id: "q1",
                question_number: 1,
                question: "Refund trend",
                purpose: "Trend analysis",
                row_count_before_reduction: 320,
                prepared_row_count: 120,
                preparation_notes: [],
                warnings: []
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Prep Confirm Report" }
    });
    expect(initial.statusCode).toBe(200);

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "ok",
        state: {
          ...initial.json().state,
          contract_id: "contract_prep",
          prep_pending: true,
          prep_complete: false,
          scope_pending: false
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.prep_complete).toBe(true);
    expect(response.json().state.scope_pending).toBe(true);
    expect(response.json().assistant_message).toContain("Data preparation is complete");
    expect(response.json().assistant_message).not.toContain("Query quality:");
    expect(requests.some((entry) => entry.endsWith("POST http://api.local/report-contracts/contract_prep/prepare"))).toBe(true);

    await app.close();
  });

  it("does not mark preparation complete when no payloads are returned", async () => {
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";
      requests.push(`${method} ${url}`);

      if (url.endsWith("/report-contracts/contract_empty_prep/prepare") && method === "POST") {
        return new Response(
          JSON.stringify({
            contract_id: "contract_empty_prep",
            planner_summary: "No executable payloads were generated.",
            prepared_payloads: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Empty Prep Report" }
    });
    expect(initial.statusCode).toBe(200);

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_run_data_preparation__",
        state: {
          ...initial.json().state,
          contract_id: "contract_empty_prep",
          prep_pending: true,
          prep_complete: false,
          scope_pending: false
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.prep_complete).toBe(false);
    expect(response.json().state.prep_pending).toBe(true);
    expect(response.json().state.scope_pending).toBe(false);
    expect(response.json().assistant_message).toContain("did not produce validated payloads");
    expect(response.json().assistant_message).not.toContain("Data preparation is complete");
    expect(requests.some((entry) => entry.endsWith("POST http://api.local/report-contracts/contract_empty_prep/prepare"))).toBe(true);

    await app.close();
  });

  it("runs preparation from UI prep command even when prep_pending drifted false but scope is finalized", async () => {
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";
      requests.push(`${method} ${url}`);

      if (url.endsWith("/report-contracts/contract_direct_prep/prepare") && method === "POST") {
        return new Response(
          JSON.stringify({
            contract_id: "contract_direct_prep",
            planner_summary: "Prepared payloads",
            prepared_payloads: [
              {
                question_id: "q1",
                question_number: 1,
                question: "Refund trend",
                purpose: "Trend",
                row_count_before_reduction: 300,
                prepared_row_count: 120,
                preparation_notes: [],
                warnings: []
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: [
              {
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                status: "OK",
                has_rls: false,
                force_rls: false,
                rls_active_for_me: false,
                policies_count_for_me: 0
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ row_count: 1000 }],
            row_count: 1,
            governed_sql: "SELECT COUNT(*) AS row_count FROM public.demo_orders",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Drifted Prep State" }
    });
    expect(initial.statusCode).toBe(200);

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_run_data_preparation__",
        state: {
          ...initial.json().state,
          contract_id: "contract_direct_prep",
          prep_pending: false,
          prep_complete: false,
          scope_pending: false,
          scope_finalized: true,
          scope_clarification_pending: false,
          draft: {
            ...initial.json().state.draft,
            audience: "Executive",
            sql_template: "SELECT * FROM public.demo_orders",
            metric_ids: ["metric_refunds"],
            dimension_ids: ["city"],
            allowed_relations: ["public.demo_orders"],
            allowed_schemas: ["public"]
          },
          scope_questions: [
            {
              question_number: 1,
              question: "Refund trend over last 4 months",
              clarification: "Use order_date and refunded status",
              answer: "Use last 4 months and refunded status",
              metric_key: null,
              metric_display_name: null,
              metric_definition_draft: null,
              metric_source_columns: []
            }
          ]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.prep_complete).toBe(true);
    expect(response.json().state.scope_pending).toBe(true);
    expect(requests.some((entry) => entry.endsWith("POST http://api.local/report-contracts/contract_direct_prep/prepare"))).toBe(true);

    await app.close();
  });

  it("drops unavailable tables from scope when valid relations remain and continues to prep pending", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_orders",
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                summary: "Orders",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: [
              {
                qualified_name: "public.demo_orders",
                relation_type: "TABLE",
                status: "OK",
                has_rls: false,
                force_rls: false,
                rls_active_for_me: false,
                policies_count_for_me: 0
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ row_count: 1000 }],
            row_count: 1,
            governed_sql: "SELECT COUNT(*) AS row_count FROM public.demo_orders",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
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

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "looks good",
        state: {
          draft: {
            name: "Mixed Scope Report",
            audience: "Executive",
            timezone: "UTC",
            schedule_cron: null,
            sql_template: "SELECT * FROM public.demo_orders",
            metric_ids: ["metric_refunds"],
            dimension_ids: ["city"],
            allowed_relations: ["public.demo_orders", "analytics.sales"],
            allowed_schemas: ["public", "analytics"],
            insight_mode: "business"
          },
          contract_id: null,
          last_run_id: null,
          last_query_id: null,
          last_exec_brief: null,
          conversation_history: [],
          prep_pending: false,
          prep_complete: false,
          scope_pending: false,
          scope_finalized: false,
          scope_clarification_pending: true,
          scope_source_prompt: "refund scope",
          scope_questions: [
            {
              question_number: 1,
              question: "Refund trend",
              clarification: "Use last 4 months",
              answer: "Use Nov-Feb",
              metric_key: null,
              metric_display_name: null,
              metric_definition_draft: null,
              metric_source_columns: []
            }
          ],
          question_registry: [],
          pending_query_sql: null,
          pending_query_limit: null,
          pending_single_query_request: null,
          last_single_query_snapshot: null,
          single_query_log: [],
          planner_summary: null,
          preparation_summary: null,
          prepared_payloads: [],
          awaiting_pdf_confirmation: false,
          awaiting_post_run_refinement: false,
          refinement_active: false,
          refinement_questions_remaining: 0,
          awaiting_save_confirmation: false,
          awaiting_schedule_confirmation: false,
          awaiting_schedule_mode_selection: false,
          schedule_mode_pending: null,
          schedule_day_kind: null,
          awaiting_custom_day_input: false,
          last_concise_summary: null,
          last_token_usage: null
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.prep_pending).toBe(true);
    expect(response.json().state.scope_clarification_pending).toBe(false);
    expect(response.json().state.draft.allowed_relations).toEqual(["public.demo_orders"]);
    expect(response.json().assistant_message).toContain("Ignored unavailable tables from scope: analytics.sales.");

    await app.close();
  });

  it("accepts typed refinement while prep decision is pending and still blocks ad-hoc query execution", async () => {
    let queryCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/query") && method === "POST") {
        queryCalls += 1;
        return new Response(
          JSON.stringify({
            rows: [],
            row_count: 0,
            governed_sql: "SELECT 1",
            warnings: []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Prep Pending Report" }
    });
    expect(initial.statusCode).toBe(200);

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Use refund value and delta as both value and percentage",
        state: {
          ...initial.json().state,
          prep_pending: true,
          prep_complete: false,
          scope_pending: false
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).not.toContain("Data preparation decision pending");
    expect(response.json().assistant_message).not.toContain("Query completed");
    expect(queryCalls).toBe(0);

    await app.close();
  });

  it("accepts typed refinement while analysis decision is pending and still blocks ad-hoc query text", async () => {
    let queryCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/query") && method === "POST") {
        queryCalls += 1;
        return new Response(
          JSON.stringify({
            rows: [],
            row_count: 0,
            governed_sql: "SELECT 1",
            warnings: []
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Analysis Pending Report" }
    });
    expect(initial.statusCode).toBe(200);

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Use refund value only and keep city ranking to top 5",
        state: {
          ...initial.json().state,
          scope_pending: true,
          prep_complete: true,
          prepared_payloads: [
            {
              question_id: "q1",
              question_number: 1,
              question: "Refund trend",
              purpose: "Trend analysis",
              row_count_before_reduction: 320,
              prepared_row_count: 120,
              preparation_notes: [],
              warnings: []
            }
          ]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).not.toContain("Analysis decision pending");
    expect(response.json().assistant_message).not.toContain("Query completed");
    expect(queryCalls).toBe(0);

    await app.close();
  });

  it("keeps prep-decision messaging authoritative when LLM tries to suggest run report", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(
          JSON.stringify({
            business_id: "biz_test",
            business_context: "",
            cataloged_at: "2026-02-01T00:00:00.000Z",
            tables: [
              {
                table_id: "tbl_sales",
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                summary: "Sales rows",
                columns: [
                  { column_name: "order_date", data_type: "timestamp with time zone", is_nullable: false },
                  { column_name: "status", data_type: "text", is_nullable: false },
                  { column_name: "refund_amount", data_type: "numeric", is_nullable: true }
                ],
                low_cardinality_columns: [],
                sample_rows: [],
                row_count_estimate: 1000
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/tables") && method === "GET") {
        return new Response(
          JSON.stringify({
            relations: [
              {
                qualified_name: "analytics.sales",
                relation_type: "TABLE",
                status: "OK",
                has_rls: false,
                force_rls: false,
                rls_active_for_me: false,
                policies_count_for_me: 0
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/query") && method === "POST") {
        return new Response(
          JSON.stringify({
            rows: [{ row_count: 1000 }],
            row_count: 1,
            governed_sql: "SELECT COUNT(*) AS row_count FROM analytics.sales",
            warnings: []
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    };

    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: fetchImpl,
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message: "Great, everything is ready. Click Run Report now."
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "run",
        state: {
          draft: {
            name: "Scope Ready Report",
            audience: "Executive",
            timezone: "UTC",
            schedule_cron: null,
            sql_template: "SELECT * FROM analytics.sales",
            metric_ids: ["metric_refunds"],
            dimension_ids: ["city"],
            allowed_relations: ["analytics.sales"],
            allowed_schemas: ["analytics"],
            insight_mode: "business"
          }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.prep_pending).toBe(true);
    expect(response.json().assistant_message).toContain("Great, everything is ready. Click Run Report now.");

    await app.close();
  });

  it("recovers analysis decision and runs when prep is complete but scope flag drifted", async () => {
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";
      requests.push(`${method} ${url}`);

      if (url.endsWith("/report-contracts/contract_drift/run") && method === "POST") {
        return new Response(
          JSON.stringify({ run_id: "run_drift", status: "pending" }),
          {
            status: 202,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Drift Recovery Report" }
    });
    expect(initial.statusCode).toBe(200);

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "ok",
        state: {
          ...initial.json().state,
          contract_id: "contract_drift",
          prep_complete: true,
          prep_pending: false,
          scope_pending: false,
          prepared_payloads: [
            {
              question_id: "q1",
              question_number: 1,
              question: "Refund trend",
              purpose: "Trend analysis",
              row_count_before_reduction: 320,
              prepared_row_count: 120,
              preparation_notes: [],
              warnings: []
            }
          ]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).toContain("generating your report");
    expect(response.json().state.scope_pending).toBe(false);
    expect(response.json().state.pending_run_id).toBe("run_drift");
    expect(requests.some((entry) => entry.endsWith("POST http://api.local/report-contracts/contract_drift/run"))).toBe(true);

    await app.close();
  });

  it("switches between report clarification and business case follow-up modes after analysis", async () => {
    let clarificationCalls = 0;
    let businessCaseCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/report-contracts/contract_refine/run") && method === "POST") {
        return new Response(JSON.stringify({
          run_id: "run_refine",
          status: "pending"
        }), {
          status: 202,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-runs/run_refine/report-qa") && method === "POST") {
        clarificationCalls += 1;
        return new Response(
          JSON.stringify({
            answer: `Clarification answer ${clarificationCalls}`,
            citations: ["q_1"],
            grounded: true,
            requires_new_analysis: false
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/report-runs/run_refine/business-case/candidates") && method === "GET") {
        return new Response(JSON.stringify({
          candidates: [
            {
              candidate_id: "q_1_r1",
              question_id: "q_1",
              question_number: 1,
              question_text: "Refund trend",
              recommendation_index: 1,
              recommendation: "Tighten refund review rules",
              highlights: ["Refunds are concentrated in a small set of cases."],
              risks: ["Margin leakage continues without intervention."]
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-runs/run_refine/business-case") && method === "POST") {
        businessCaseCalls += 1;
        const rawBody = typeof init?.body === "string" ? init.body : "{}";
        const payload = JSON.parse(rawBody) as { assumption_notes?: string[] };
        if (!Array.isArray(payload.assumption_notes) || payload.assumption_notes.length === 0) {
          return new Response(JSON.stringify({
            status: "needs_clarification",
            clarification_prompt: "Please provide at least one implementation cost or staffing assumption.",
            missing_inputs: ["Implementation cost", "Staffing assumption"],
            additional_query_requests: []
          }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({
          status: "complete",
          title: "Business case for tighter refund review rules",
          executive_summary: "The recommendation is viable if rollout assumptions hold.",
          recommendation: "Tighten refund review rules",
          baseline: ["Refund concentration is materially above baseline."],
          assumptions: payload.assumption_notes,
          implementation_plan: ["Configure review rules", "Pilot the new process"],
          timeline_impact: [
            { period_label: "Time period 1 after implementation", impact: "Leakage begins to slow." },
            { period_label: "Time period 2 after implementation", impact: "Savings compound as adoption stabilizes." }
          ],
          financial_view: ["Compare avoided refunds against rollout cost."],
          operational_view: ["Review workload rises temporarily during adoption."],
          risks: ["Rules that are too strict may create customer friction."],
          kpis_to_track: ["Refund rate", "Review backlog"],
          citations: ["q_1"],
          additional_query_requests: []
        }), {
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Refinement Report" }
    });
    expect(initial.statusCode).toBe(200);

    const runReadyState = {
      ...initial.json().state,
      contract_id: "contract_refine",
      prep_complete: true,
      scope_pending: true
    };

    const analyzed = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_finish_scoping_run_analysis__",
        state: runReadyState
      }
    });

    expect(analyzed.statusCode).toBe(200);
    expect(analyzed.json().state.pending_run_id).toBe("run_refine");

    // Simulate browser polling completing: bridge state as if run succeeded
    const postPollStateRefine = {
      ...analyzed.json().state,
      pending_run_id: null,
      last_run_id: "run_refine",
      post_run_actions_pending: true,
      report_clarification_active: false,
      business_case_active: false,
      business_case_candidates: [],
      business_case_selected_candidate_id: null,
      business_case_assumption_notes: [],
      business_case_pending_clarification: null,
      awaiting_post_run_refinement: false,
      awaiting_pdf_confirmation: false
    };

    const clarifyStart = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_report_clarifications__", state: postPollStateRefine }
    });
    expect(clarifyStart.statusCode).toBe(200);
    expect(clarifyStart.json().state.report_clarification_active).toBe(true);

    const clarification = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "What changed in city-level refunds?", state: clarifyStart.json().state }
    });
    expect(clarification.statusCode).toBe(200);
    expect(clarification.json().assistant_message).toContain("Clarification answer 1");
    expect(clarification.json().state.report_clarification_active).toBe(true);

    const businessCaseStart = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_business_case_analysis__", state: clarification.json().state }
    });
    expect(businessCaseStart.statusCode).toBe(200);
    expect(businessCaseStart.json().assistant_message).toContain("Select a recommendation");
    expect(businessCaseStart.json().state.business_case_active).toBe(true);

    const businessCaseNeedsClarification = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "Q1 R1", state: businessCaseStart.json().state }
    });
    expect(businessCaseNeedsClarification.statusCode).toBe(200);
    expect(businessCaseNeedsClarification.json().assistant_message).toContain("Please provide at least one implementation cost");
    expect(businessCaseNeedsClarification.json().state.business_case_selected_candidate_id).toBe("q_1_r1");

    const businessCaseComplete = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Assume a $50k rollout cost and 2 analysts for the first quarter.",
        state: businessCaseNeedsClarification.json().state
      }
    });
    expect(businessCaseComplete.statusCode).toBe(200);
    expect(businessCaseComplete.json().assistant_message).toContain("Business case for tighter refund review rules");
    expect(businessCaseComplete.json().state.business_case_selected_candidate_id).toBeNull();
    expect(clarificationCalls).toBe(1);
    expect(businessCaseCalls).toBe(2);

    await app.close();
  });

  it("does not surface stale locked-plan or prep instructions from the LLM when scope is still unresolved", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";
        if (url.endsWith("/connections/catalog") && method === "GET") {
          return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message: [
              "Questions in scope:",
              "- Q1: What is the monthly refund trend over the past 4 complete months?",
              "- Q2: How do the most recent 2 months compare to the prior 2 months?",
              "- Q3: Which cities have the highest refund rate?",
              "- Q4: How many support tickets were opened for refunded orders?",
              "- Q5: What were the top issue types?",
              "- Q6: [Suggested] What is the average support ticket resolution time?",
              "",
              "Pending clarifications:",
              "- Q1: Confirm date anchor, date column, and reporting granularity for the trend.",
              "- Q2: Confirm exact period A vs period B windows and whether to show absolute delta, percentage delta, or both.",
              "All confirmed! Here's the locked plan:",
              "",
              "Q6 is out of scope. Hit Run Data Preparation to kick things off!"
            ].join("\n")
          };
        }
      }
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Stale Scope Narrative Guard" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_pending = false;
    seededState.prep_pending = false;
    seededState.prep_complete = false;
    seededState.scope_finalized = false;
    seededState.scope_clarification_pending = true;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Monthly refund trend",
        clarification: "Confirm date anchor, date column, and reporting granularity for the trend.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 2,
        question: "2-month comparison",
        clarification: "Confirm exact period A vs period B windows and whether to show absolute delta, percentage delta, or both.",
        answer: null,
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 3,
        question: "Top cities by refund rate",
        clarification: "Confirm formula and top-N.",
        answer: "Use refunded revenue / total revenue and top 5 cities.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 4,
        question: "Support tickets for refunded orders",
        clarification: "Confirm join path.",
        answer: "Join tickets to refunded orders via order_id.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      },
      {
        question_number: 5,
        question: "Top issue types",
        clarification: "Confirm ranking method.",
        answer: "Rank issue types by ticket count.",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "all confirmed",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.prep_pending).toBe(true);
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.assistant_message).not.toContain("Q6");
    expect(body.assistant_message).not.toContain("All confirmed! Here's the locked plan:");
    expect(body.assistant_message).not.toContain("kick things off");
    expect(body.assistant_message).toContain("Scope is locked for");
    expect(body.assistant_message).toContain("Run Data Preparation when you're ready.");

    await app.close();
  });

  it("runs prepare -> analysis -> post-run follow-ups and still supports pdf/save/schedule actions", async () => {
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
          status: "pending"
        }), {
          status: 202,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-runs/run_web_test/report-qa") && method === "POST") {
        return new Response(JSON.stringify({
          answer: "Revenue increased versus the prior period.",
          citations: ["q_1"],
          grounded: true,
          requires_new_analysis: false
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-runs/run_web_test/business-case/candidates") && method === "GET") {
        return new Response(JSON.stringify({
          candidates: [
            {
              candidate_id: "q_1_r1",
              question_id: "q_1",
              question_number: 1,
              question_text: "Revenue trend",
              recommendation_index: 1,
              recommendation: "Prioritize the highest-growth region",
              highlights: ["Revenue increased 12%"],
              risks: ["Growth is uneven across regions"]
            }
          ]
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/report-runs/run_web_test/business-case") && method === "POST") {
        const rawBody = typeof init?.body === "string" ? init.body : "{}";
        const payload = JSON.parse(rawBody) as { assumption_notes?: string[] };
        if (!Array.isArray(payload.assumption_notes) || payload.assumption_notes.length === 0) {
          return new Response(JSON.stringify({
            status: "needs_clarification",
            clarification_prompt: "Please provide at least one cost, budget, or staffing assumption.",
            missing_inputs: ["Cost assumption"],
            additional_query_requests: []
          }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({
          status: "complete",
          title: "Business case for prioritizing the highest-growth region",
          executive_summary: "The region-first rollout is viable if the staffing assumption holds.",
          recommendation: "Prioritize the highest-growth region",
          baseline: ["Revenue increased 12%."],
          assumptions: payload.assumption_notes,
          implementation_plan: ["Confirm target region", "Launch pilot rollout"],
          timeline_impact: [
            { period_label: "Time period 1 after implementation", impact: "Execution cost lands upfront and growth focus sharpens." },
            { period_label: "Time period 2 after implementation", impact: "Uplift compounds if the pilot economics hold." }
          ],
          financial_view: ["Measure uplift against the stated cost assumption."],
          operational_view: ["Field teams need temporary support during the pilot."],
          risks: ["Execution slippage could dilute impact."],
          kpis_to_track: ["Revenue growth", "Pilot conversion"],
          citations: ["q_1"],
          additional_query_requests: []
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
    expect(analyzed.json().state.pending_run_id).toBe("run_web_test");
    expect(analyzed.json().assistant_message).toContain("generating your report");

    // Simulate browser polling completing: bridge state as if run succeeded
    const postPollState = {
      ...analyzed.json().state,
      pending_run_id: null,
      last_run_id: "run_web_test",
      post_run_actions_pending: true,
      report_clarification_active: false,
      business_case_active: false,
      business_case_candidates: [],
      business_case_selected_candidate_id: null,
      business_case_assumption_notes: [],
      business_case_pending_clarification: null,
      awaiting_post_run_refinement: false,
      awaiting_pdf_confirmation: false,
      pdf_download_url: "/api/runs/run_web_test/pdf",
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
      ]
    };

    const qaMode = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_report_clarifications__", state: postPollState }
    });
    expect(qaMode.statusCode).toBe(200);
    expect(qaMode.json().state.report_clarification_active).toBe(true);

    const qa = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "what changed?", state: qaMode.json().state }
    });
    expect(qa.statusCode).toBe(200);
    expect(qa.json().assistant_message).toContain("Revenue increased");
    expect(qa.json().state.report_clarification_active).toBe(true);

    const businessCase = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_business_case_analysis__", state: qa.json().state }
    });
    expect(businessCase.statusCode).toBe(200);
    expect(businessCase.json().assistant_message).toContain("Select a recommendation");

    const businessCaseClarification = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "Q1 R1", state: businessCase.json().state }
    });
    expect(businessCaseClarification.statusCode).toBe(200);
    expect(businessCaseClarification.json().assistant_message).toContain("cost");

    const confirmPdf = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "__ui_generate_pdf_yes__", state: businessCaseClarification.json().state }
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
    expect(requests.some((request) => request.url.endsWith("/report-runs/run_web_test/report-qa"))).toBe(true);
    expect(requests.some((request) => request.url.endsWith("/report-runs/run_web_test/business-case/candidates"))).toBe(true);
    expect(requests.some((request) => request.url.endsWith("/report-runs/run_web_test/business-case"))).toBe(true);
    expect(requests.some((request) => request.url.endsWith("/report-runs/run_web_test/save"))).toBe(true);
    expect(requests.some((request) => request.url.endsWith("/report-contracts/contract_web_test/schedule"))).toBe(true);

    await app.close();
  });

  it("includes data preparation diagnostics in run output", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/report-contracts/contract_diag/run") && method === "POST") {
        return new Response(JSON.stringify({
          run_id: "run_diag",
          status: "pending"
        }), {
          status: 202,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Diagnostics Report" }
    });
    expect(initial.statusCode).toBe(200);

    const runReadyState = {
      ...initial.json().state,
      contract_id: "contract_diag",
      prep_complete: true,
      scope_pending: true
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_finish_scoping_run_analysis__",
        state: runReadyState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assistant_message).toContain("generating your report");
    expect(body.state.pending_run_id).toBe("run_diag");

    await app.close();
  });

  it("sanitizes provider text that mentions system/run-report click instructions", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async () =>
        new Response(JSON.stringify({ message: "Unhandled request" }), {
          status: 404,
          headers: { "content-type": "application/json" }
        }),
      conversation_client: {
        provider: "openrouter",
        mode: "provider",
        async respond() {
          return {
            message: "The system can auto-trigger this. Click Run Report to proceed."
          };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "hello" }
    });

    expect(response.statusCode).toBe(200);
    const assistant = response.json().assistant_message as string;
    expect(assistant.toLowerCase()).toContain("system");
    expect(assistant).toContain("Run Report");
    expect(assistant.toLowerCase()).toContain("click");

    await app.close();
  });

  it("returns a safe run error when final analysis response is non-json html", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/report-contracts/contract_run_test/run") && method === "POST") {
        return new Response("<!DOCTYPE html><html><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "content-type": "text/html" }
        });
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Weekly Revenue" }
    });
    expect(initial.statusCode).toBe(200);
    const readyToRunState = {
      ...initial.json().state,
      contract_id: "contract_run_test",
      prep_complete: true,
      scope_pending: true
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_finish_scoping_run_analysis__",
        state: readyToRunState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistant_message).toContain("Run could not be submitted.");
    expect(response.json().assistant_message).toContain("invalid format");
    expect(response.json().assistant_message).not.toContain("Unexpected token");
    expect(response.json().state.scope_pending).toBe(true);

    await app.close();
  });

  it("completes final analysis run in a single attempt (no auto-retry)", async () => {
    let runCalls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/report-contracts/contract_run_retry/run") && method === "POST") {
        runCalls += 1;
        return new Response(
          JSON.stringify({ run_id: "run_retry_ok", status: "pending" }),
          {
            status: 202,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/connections/catalog") && method === "GET") {
        return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
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

    const initial = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Weekly Revenue Retry" }
    });
    expect(initial.statusCode).toBe(200);
    const readyToRunState = {
      ...initial.json().state,
      contract_id: "contract_run_retry",
      prep_complete: true,
      scope_pending: true
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_finish_scoping_run_analysis__",
        state: readyToRunState
      }
    });

    expect(response.statusCode).toBe(200);
    expect(runCalls).toBe(1);
    expect(response.json().assistant_message).toContain("generating your report");
    expect(response.json().state.scope_pending).toBe(false);
    expect(response.json().state.pending_run_id).toBe("run_retry_ok");

    await app.close();
  });

  it("returns to scoping from analysis decision and requires fresh data preparation", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";
        if (url.endsWith("/connections/catalog") && method === "GET") {
          return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Continue Scoping Report" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_pending = true;
    seededState.prep_complete = true;
    seededState.prep_pending = false;
    seededState.scope_finalized = true;
    seededState.scope_clarification_pending = false;

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "__ui_continue_scoping__",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_pending).toBe(false);
    expect(body.state.scope_clarification_pending).toBe(true);
    expect(body.state.scope_finalized).toBe(false);
    expect(body.state.prep_complete).toBe(false);
    expect(body.state.prep_pending).toBe(false);
    expect(body.assistant_message).toContain("what looked off in the prepared data");

    await app.close();
  });

  it("treats typed feedback during analysis decision as scope refinement and clears stale prep", async () => {
    const app = buildWebApp({
      api_base_url: "http://api.local",
      fetch_impl: async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method?.toUpperCase() ?? "GET";
        if (url.endsWith("/connections/catalog") && method === "GET") {
          return new Response(JSON.stringify({ tables: [], business_context: "", cataloged_at: null }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ message: `Unhandled request: ${method} ${url}` }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      },
      conversation_client: createPassthroughConversationClient()
    });

    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "set name: Scope Refinement From Analysis" }
    });
    expect(bootstrap.statusCode).toBe(200);

    const seededState = bootstrap.json().state as Record<string, unknown>;
    seededState.scope_pending = true;
    seededState.prep_complete = true;
    seededState.prep_pending = false;
    seededState.scope_finalized = true;
    seededState.scope_clarification_pending = false;
    seededState.scope_questions = [
      {
        question_number: 1,
        question: "Monthly refund trend",
        clarification: "Confirm month range and comparison windows",
        answer: "Use Nov-Feb and compare Jan-Feb vs Nov-Dec",
        metric_key: null,
        metric_display_name: null,
        metric_definition_draft: null,
        metric_source_columns: []
      }
    ];

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "Q1: keep Nov-Feb but exclude partial February from comparison.",
        state: seededState
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.state.scope_pending).toBe(false);
    expect(body.state.scope_clarification_pending).toBe(false);
    expect(body.state.scope_finalized).toBe(true);
    expect(body.state.prep_complete).toBe(false);
    expect(body.state.prep_pending).toBe(true);
    expect(body.assistant_message).toContain("Scope is locked for");

    await app.close();
  });
});
