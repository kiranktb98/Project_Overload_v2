import { afterEach, describe, expect, it } from "vitest";
import { createStubAnalystClient } from "@project-overload/llm-client";
import { buildApiApp } from "../src/app";
import { InMemoryMetadataStore } from "../src/store/create-store";

const ORIGINAL_AUTH_REQUIRED = process.env.API_AUTH_REQUIRED;
const ORIGINAL_AUTH_TOKEN = process.env.API_AUTH_TOKEN;

afterEach(() => {
  process.env.API_AUTH_REQUIRED = ORIGINAL_AUTH_REQUIRED;
  process.env.API_AUTH_TOKEN = ORIGINAL_AUTH_TOKEN;
});

describe("ui auth and chat sessions", () => {
  it("authenticates test123 and persists chat sessions", async () => {
    process.env.API_AUTH_REQUIRED = "false";
    delete process.env.API_AUTH_TOKEN;

    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      analyst_client: createStubAnalystClient()
    });

    const login = await app.inject({
      method: "POST",
      url: "/ui/auth/login",
      payload: {
        username: "test123",
        password: "test123"
      }
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.username).toBe("test123");

    const unauthorizedList = await app.inject({
      method: "GET",
      url: "/ui/chat-sessions"
    });
    expect(unauthorizedList.statusCode).toBe(401);

    const sessionPayload = {
      session: {
        id: "chat_1",
        title: "Revenue QA",
        title_auto: false,
        naming_in_progress: false,
        state: {
          draft: {
            name: "Revenue QA"
          }
        },
        user_messages: ["show me monthly sales", "filter paid only"],
        db_bootstrapped: true,
        messages: [
          {
            role: "assistant",
            text: "Hello",
            download_url: null,
            exec_brief_html: null,
            at: new Date().toISOString()
          },
          {
            role: "user",
            text: "show me monthly sales",
            download_url: null,
            exec_brief_html: null,
            at: new Date().toISOString()
          }
        ]
      }
    };

    const upsert = await app.inject({
      method: "PUT",
      url: "/ui/chat-sessions/chat_1",
      headers: {
        "x-ui-user": "test123"
      },
      payload: sessionPayload
    });
    expect(upsert.statusCode).toBe(200);
    expect(upsert.json().session.id).toBe("chat_1");

    const list = await app.inject({
      method: "GET",
      url: "/ui/chat-sessions",
      headers: {
        "x-ui-user": "test123"
      }
    });
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.json().sessions)).toBe(true);
    expect(list.json().sessions).toHaveLength(1);
    expect(list.json().sessions[0].id).toBe("chat_1");

    await app.close();
  });
});
