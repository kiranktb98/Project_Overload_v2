import { describe, expect, it } from "vitest";
import {
  createConversationClient,
  createPassthroughConversationClient,
  parseLlmResponse,
  validateDraftUpdates,
  type ConversationOrchestratorInput,
  type ConversationTurnInput
} from "../src/conversation";

const TURN_INPUT: ConversationTurnInput = {
  user_message: "hello",
  action_context: "Base response",
  history: [],
  state: {
    draft: {
      name: "",
      audience: "Executive",
      timezone: "UTC",
      schedule_cron: null,
      sql_template: "SELECT * FROM analytics.sales",
      metric_ids: ["metric_revenue"],
      dimension_ids: ["region"],
      allowed_relations: ["analytics.sales"],
      allowed_schemas: ["analytics"],
      insight_mode: "business" as const
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
    metric_definitions: [],
    pending_metric_confirmations: [],
    pending_metric_resume_message: null,
    pending_metric_resume_mode: null,
    scope_clarification_pending: false,
    scope_business_context: null,
    scope_source_prompt: null,
    scope_suggestions: [],
    scope_questions: [],
    pending_query_sql: null,
    pending_query_limit: null,
    pending_single_query_request: null,
    pending_followup_asks: [],
    last_single_query_snapshot: null,
    single_query_log: [],
    planner_summary: null,
    preparation_summary: null,
    prepared_payloads: [],
    post_run_actions_pending: false,
    report_clarification_active: false,
    business_case_active: false,
    business_case_candidates: [],
    business_case_selected_candidate_id: null,
    business_case_assumption_notes: [],
    business_case_pending_clarification: null,
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
};

describe("conversation client", () => {
  it("returns deterministic response in passthrough mode", async () => {
    const client = createPassthroughConversationClient();
    const response = await client.respond(TURN_INPUT);
    expect(response.message).toBe("Base response");
  });

  it("returns deterministic chat title in passthrough mode", async () => {
    const client = createPassthroughConversationClient();
    const response = await client.nameConversation?.({
      first_user_messages: ["show me monthly refunds", "compare with previous month"]
    });
    expect(response?.title).toContain("Show Me Monthly");
  });

  it("uses provider response text when available", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createConversationClient({
      provider: "openrouter",
      openrouter_api_key: "key",
      fetch_impl: async (input, init) => {
        calls.push({ input, init });

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "Natural AI response"
                }
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
    });

    const response = await client.respond(TURN_INPUT);
    expect(response.message).toBe("Natural AI response");

    const rawBody = typeof calls[0].init?.body === "string" ? calls[0].init?.body : "{}";
    expect(rawBody).toContain("Conversation history:");
    expect(rawBody).toContain("User message:");
    expect(rawBody).toContain("break them into numbered items (Q1, Q2, Q3)");
    expect(rawBody).toContain("CURRENT UTC DATE/TIME:");
  });

  it("throws when provider call fails", async () => {
    const client = createConversationClient({
      provider: "openai",
      openai_api_key: "key",
      fetch_impl: async () => {
        throw new Error("network down");
      }
    });

    await expect(client.respond(TURN_INPUT)).rejects.toThrow("network down");
  });

  it("throws when strict provider mode is enabled without keys", () => {
    expect(() =>
      createConversationClient({
        provider: "openrouter",
        require_provider: true
      })
    ).toThrow("WEB_CHAT_REQUIRE_PROVIDER is true");
  });

  it("normalizes orchestrator JSON shape drift before strict schema parse", async () => {
    const client = createConversationClient({
      provider: "openrouter",
      openrouter_api_key: "key",
      fetch_impl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    decision: {
                      intent_parts: [
                        {
                          type: "clarification",
                          text: "Use Nov-Feb comparison",
                          question_ref: null
                        }
                      ],
                      resolved_scope_answers: [
                        {
                          question_number: "Q1",
                          answer: "Nov 2025 to Feb 2026"
                        }
                      ],
                      pending_inputs: [
                        {
                          input_key: "q2_window",
                          prompt: "Confirm comparison periods"
                        }
                      ],
                      next_owner: "WAIT_FOR_USER",
                      state_updates: {
                        mark_scope_complete: "false",
                        summary: 42
                      }
                    }
                  })
                }
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
    });

    const input: ConversationOrchestratorInput = {
      user_message: "Compare last 2 months vs prior 2 months",
      state: TURN_INPUT.state,
      history: []
    };

    const decision = await client.orchestrateTurn?.(input);
    expect(decision).toBeDefined();
    expect(decision?.next_owner).toBe("wait_for_user");
    expect(decision?.intent_parts[0]?.type).toBe("other");
    expect(decision?.intent_parts[0]?.question_ref).toBeUndefined();
    expect(decision?.resolved_scope_answers[0]?.question_number).toBe(1);
    expect(decision?.state_updates.summary).toBeNull();
  });

  it("includes only relevant metric definitions in orchestrator prompt", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createConversationClient({
      provider: "openrouter",
      openrouter_api_key: "key",
      fetch_impl: async (input, init) => {
        calls.push({ input, init });
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent_parts: [{ type: "new_question", text: "refund trend analysis" }],
                    resolved_scope_answers: [],
                    new_scope_questions: [],
                    follow_up_requests: [],
                    pending_inputs: [],
                    next_owner: "query_planning_agent",
                    tool_calls: [],
                    state_updates: {
                      mark_scope_complete: false,
                      append_new_questions: false,
                      clear_pending_inputs: false,
                      summary: "ok"
                    }
                  })
                }
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
    });

    const stateWithMetrics = {
      ...TURN_INPUT.state,
      metric_definitions: [
        {
          metric_key: "refund_rate",
          display_name: "Refund Rate",
          definition: "refunded revenue / total revenue"
        },
        {
          metric_key: "gross_margin",
          display_name: "Gross Margin",
          definition: "(revenue - cogs) / revenue"
        }
      ]
    };

    await client.orchestrateTurn?.({
      user_message: "show refund rate by city for last 4 months",
      state: stateWithMetrics,
      history: []
    });

    const rawBody = typeof calls[0]?.init?.body === "string" ? calls[0].init.body : "{}";
    expect(rawBody).toContain("RELEVANT_METRIC_DEFINITIONS_FROM_DB_FOR_THIS_USER");
    expect(rawBody).toContain("refunded revenue / total revenue");
    expect(rawBody).not.toContain("(revenue - cogs) / revenue");
  });

  it("injects retrieved context and keeps it scoped to last 20 turns", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createConversationClient({
      provider: "openrouter",
      openrouter_api_key: "key",
      fetch_impl: async (input, init) => {
        calls.push({ input, init });
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent_parts: [{ type: "new_question", text: "refund city analysis" }],
                    resolved_scope_answers: [],
                    new_scope_questions: [],
                    follow_up_requests: [],
                    pending_inputs: [],
                    next_owner: "query_planning_agent",
                    tool_calls: [],
                    state_updates: {
                      mark_scope_complete: false,
                      append_new_questions: false,
                      clear_pending_inputs: false,
                      summary: "ok"
                    }
                  })
                }
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
    });

    const history = Array.from({ length: 25 }).map((_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content:
        index === 0
          ? "SHOULD_NOT_APPEAR_OLDEST_TURN"
          : `turn-${index} refund city context`,
      at: new Date(Date.UTC(2026, 1, 1, 0, index)).toISOString()
    }));

    const stateWithPrepared = {
      ...TURN_INPUT.state,
      scope_questions: [
        {
          question_number: 1,
          question: "Which cities have the highest refund rate?",
          clarification: "Use revenue-based refund rate.",
          answer: "Top 5 cities",
          metric_key: "refund_rate",
          metric_display_name: "Refund Rate",
          metric_definition_draft: "refunded revenue / total revenue",
          metric_source_columns: ["total_revenue", "refunded_revenue"]
        }
      ],
      prepared_payloads: [
        {
          question_id: "q1",
          question_number: 1,
          question: "Which cities have the highest refund rate?",
          purpose: "city risk ranking",
          group_id: "grp_q1",
          source_query_count: 1,
          row_count_before_reduction: 6,
          prepared_row_count: 6,
          validation: {
            observed_months: 4,
            missing_months: [],
            monthly_row_counts: [
              { month: "2025-11", row_count: 6 },
              { month: "2025-12", row_count: 6 }
            ],
            monthly_metric_totals: [
              { month: "2025-11", total: 10 },
              { month: "2025-12", total: 12 }
            ]
          },
          preparation_sqls: [],
          sample_rows: [],
          preparation_notes: ["refund rate by city prepared"],
          warnings: []
        }
      ]
    };

    await client.orchestrateTurn?.({
      user_message: "compare refund rate by city and explain top issue types",
      state: stateWithPrepared,
      history
    });

    const rawBody = typeof calls[0]?.init?.body === "string" ? calls[0].init.body : "{}";
    expect(rawBody).toContain("RETRIEVED_CONTEXT_FOR_THIS_TURN");
    expect(rawBody).toContain("Prepared payload Q1");
    expect(rawBody).toContain("Scope Q1");
    expect(rawBody).not.toContain("SHOULD_NOT_APPEAR_OLDEST_TURN");
  });

  it("uses OpenRouter embeddings + rerank in lv2 retrieval mode", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const client = createConversationClient({
      provider: "openrouter",
      openrouter_api_key: "key",
      rag_level: 2,
      fetch_impl: async (input, init) => {
        calls.push({ input, init });
        const url = String(input);
        const rawBody = typeof init?.body === "string" ? init.body : "{}";
        if (url.endsWith("/embeddings")) {
          const parsed = JSON.parse(rawBody) as { input?: string[] };
          const count = Array.isArray(parsed.input) ? parsed.input.length : 0;
          const data = Array.from({ length: count }).map((_, index) => ({
            object: "embedding",
            index,
            embedding: [1, Math.max(0, 10 - index), 0.5 * index]
          }));
          return new Response(JSON.stringify({ data }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.includes("/chat/completions") && rawBody.includes("retrieval reranker")) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      keep_labels: ["Scope Q1", "Current user request"]
                    })
                  }
                }
              ]
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" }
            }
          );
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent_parts: [{ type: "new_question", text: "refund trend" }],
                    resolved_scope_answers: [],
                    new_scope_questions: [],
                    follow_up_requests: [],
                    pending_inputs: [],
                    next_owner: "query_planning_agent",
                    tool_calls: [],
                    state_updates: {
                      mark_scope_complete: false,
                      append_new_questions: false,
                      clear_pending_inputs: false,
                      summary: "ok"
                    }
                  })
                }
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
    });

    await client.orchestrateTurn?.({
      user_message: "show refund trend by city",
      state: {
        ...TURN_INPUT.state,
        scope_questions: [
          {
            question_number: 1,
            question: "Which cities have the highest refund rate?",
            clarification: "Use revenue based rate",
            answer: null,
            metric_key: null,
            metric_display_name: null,
            metric_definition_draft: null,
            metric_source_columns: []
          }
        ]
      },
      history: [
        {
          role: "user",
          content: "Need city refund overview"
        }
      ]
    });

    expect(calls.some((entry) => String(entry.input).endsWith("/embeddings"))).toBe(true);
    expect(
      calls.some((entry) => {
        const body = typeof entry.init?.body === "string" ? entry.init.body : "";
        return String(entry.input).includes("/chat/completions") && body.includes("retrieval reranker");
      })
    ).toBe(true);
  });
});

describe("parseLlmResponse", () => {
  it("returns plain message when no draft block present", () => {
    const result = parseLlmResponse("Just a normal reply.");
    expect(result.message).toBe("Just a normal reply.");
    expect(result.draft_updates).toBeUndefined();
  });

  it("extracts draft_updates from fenced JSON block", () => {
    const raw = [
      "Got it, focusing on refunds by product category.",
      "",
      "<<<DRAFT_UPDATES>>>",
      '{"metric_ids":["metric_refunds"],"dimension_ids":["product_category"],"allowed_relations":["public.orders"]}',
      "<<<END_DRAFT_UPDATES>>>"
    ].join("\n");

    const result = parseLlmResponse(raw);
    expect(result.message).toBe("Got it, focusing on refunds by product category.");
    expect(result.draft_updates).toBeDefined();
    expect(result.draft_updates?.metric_ids).toEqual(["metric_refunds"]);
    expect(result.draft_updates?.dimension_ids).toEqual(["product_category"]);
    expect(result.draft_updates?.allowed_relations).toEqual(["public.orders"]);
  });

  it("ignores malformed JSON in draft block", () => {
    const raw = "Reply text.\n<<<DRAFT_UPDATES>>>\nnot valid json\n<<<END_DRAFT_UPDATES>>>";
    const result = parseLlmResponse(raw);
    expect(result.message).toBe("Reply text.");
    expect(result.draft_updates).toBeUndefined();
  });

  it("handles missing close fence gracefully", () => {
    const raw = "Reply.\n<<<DRAFT_UPDATES>>>\n{\"name\":\"test\"}";
    const result = parseLlmResponse(raw);
    expect(result.message).toContain("Reply");
    expect(result.draft_updates).toBeUndefined();
  });
});

describe("validateDraftUpdates", () => {
  it("accepts valid string and array fields", () => {
    const result = validateDraftUpdates({
      name: "Refund Analysis",
      metric_ids: ["metric_refunds"],
      allowed_relations: ["public.orders"]
    });
    expect(result).toBeDefined();
    expect(result?.name).toBe("Refund Analysis");
    expect(result?.metric_ids).toEqual(["metric_refunds"]);
    expect(result?.allowed_relations).toEqual(["public.orders"]);
  });

  it("rejects sql_template that is not a SELECT", () => {
    const result = validateDraftUpdates({
      sql_template: "DROP TABLE orders"
    });
    expect(result).toBeUndefined();
  });

  it("accepts sql_template starting with SELECT", () => {
    const result = validateDraftUpdates({
      sql_template: "SELECT * FROM public.orders"
    });
    expect(result?.sql_template).toBe("SELECT * FROM public.orders");
  });

  it("only accepts business or data for insight_mode", () => {
    expect(validateDraftUpdates({ insight_mode: "business" })?.insight_mode).toBe("business");
    expect(validateDraftUpdates({ insight_mode: "data" })?.insight_mode).toBe("data");
    expect(validateDraftUpdates({ insight_mode: "invalid" })).toBeUndefined();
  });

  it("returns undefined for non-object input", () => {
    expect(validateDraftUpdates(null)).toBeUndefined();
    expect(validateDraftUpdates("string")).toBeUndefined();
    expect(validateDraftUpdates([])).toBeUndefined();
  });

  it("returns undefined for empty object", () => {
    expect(validateDraftUpdates({})).toBeUndefined();
  });
});
