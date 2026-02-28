import { describe, expect, it } from "vitest";
import {
  createConversationClient,
  createPassthroughConversationClient,
  parseLlmResponse,
  validateDraftUpdates,
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
    scope_questions: [],
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
