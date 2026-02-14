import { describe, expect, it } from "vitest";
import {
  createConversationClient,
  createPassthroughConversationClient,
  type ConversationTurnInput
} from "../src/conversation";

const TURN_INPUT: ConversationTurnInput = {
  user_message: "hello",
  deterministic_response: "Base response",
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
      allowed_schemas: ["analytics"]
    },
    contract_id: null,
    last_run_id: null,
    last_exec_brief: null
  }
};

describe("conversation client", () => {
  it("returns deterministic response in passthrough mode", async () => {
    const client = createPassthroughConversationClient();
    const response = await client.respond(TURN_INPUT);
    expect(response).toBe("Base response");
  });

  it("uses provider response text when available", async () => {
    const client = createConversationClient({
      provider: "openrouter",
      openrouter_api_key: "key",
      fallback_to_deterministic: false,
      fetch_impl: async () =>
        new Response(
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
        )
    });

    const response = await client.respond(TURN_INPUT);
    expect(response).toBe("Natural AI response");
  });

  it("falls back to deterministic when provider call fails and fallback is enabled", async () => {
    const client = createConversationClient({
      provider: "openai",
      openai_api_key: "key",
      fallback_to_deterministic: true,
      fetch_impl: async () => {
        throw new Error("network down");
      }
    });

    const response = await client.respond(TURN_INPUT);
    expect(response).toBe("Base response");
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
