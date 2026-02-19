import { describe, expect, it } from "vitest";
import { buildWebApp } from "../src/app";
import { createPassthroughConversationClient } from "../src/conversation";
import type { QueryRouterClient } from "../src/query-router";

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
    expect(body.assistant_message).toContain("Routing decision:");
    expect(body.assistant_message).toContain("Ready to prepare data for:");
    expect(body.state.prep_pending).toBe(true);
    expect(body.state.scope_pending).toBe(false);

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

  it("falls back to deterministic action context when conversation provider throws", async () => {
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
    expect(response.json().assistant_message).toContain("No specific action was executed for this message.");

    await app.close();
  });

  it("executes simple direct query even when scope confirmation is pending", async () => {
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
    expect(response.json().assistant_message).toContain("Query completed. Query ID:");
    expect(response.json().assistant_message).not.toContain("Please choose one option first");
    expect(response.json().state.scope_pending).toBe(true);

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
          concise_summary: "Test Report summary",
          prepared_payloads: [],
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
    expect(response.json().assistant_message).toContain("Report executed. Run ID: run_web_test.");
    expect(response.json().state.awaiting_pdf_confirmation).toBe(true);
    expect(conversationCalls).toBe(0);

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

  it("includes data preparation diagnostics in run output", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.endsWith("/report-contracts/contract_diag/run") && method === "POST") {
        return new Response(JSON.stringify({
          run_id: "run_diag",
          exec_brief: {
            what_changed: ["Refunds increased in top 2 cities"],
            why: ["Ticket backlog rose"],
            so_what: ["Support load is increasing faster than demand"],
            what_to_do: ["Prioritize issue type triage"],
            confidence: { score: 0.88, rationale: "Coverage validated." },
            appendix_refs: ["evidence_contract_diag_1"],
            deltas_vs_last_run: [],
            generated_at: "2026-01-01T00:00:00.000Z"
          },
          concise_summary: "Diagnostic summary",
          prepared_payloads: [
            {
              question_id: "q_1",
              question_number: 1,
              question: "Refund trend",
              purpose: "Trend",
              row_count_before_reduction: 620,
              prepared_row_count: 120,
              source_query_count: 2,
              validation: {
                expected_months: 6,
                observed_months: 4,
                missing_months: ["2025-09", "2025-10"],
                monthly_row_counts: [
                  { month: "2025-09", row_count: 0 },
                  { month: "2025-10", row_count: 0 },
                  { month: "2025-11", row_count: 28 },
                  { month: "2025-12", row_count: 31 },
                  { month: "2026-01", row_count: 34 },
                  { month: "2026-02", row_count: 12 }
                ],
                metric_column: "refund_amount",
                monthly_metric_totals: [
                  { month: "2025-11", total: 10400 },
                  { month: "2025-12", total: 11250 },
                  { month: "2026-01", total: 12100 },
                  { month: "2026-02", total: 3900 }
                ]
              },
              preparation_notes: ["Source query 1 quality score: 92/100"],
              warnings: []
            }
          ],
          token_usage: {
            input_tokens: 300,
            output_tokens: 140,
            total_tokens: 440,
            by_agent: {}
          }
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
    expect(body.assistant_message).toContain("Data prep validation:");
    expect(body.assistant_message).toContain("Validation timeline: GAP (4/6 months, 67%) | missing: 2025-09, 2025-10");
    expect(body.assistant_message).toContain("MoM refund_amount");

    await app.close();
  });
});
