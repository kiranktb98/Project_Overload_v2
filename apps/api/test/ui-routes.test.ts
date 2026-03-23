import { afterEach, describe, expect, it, vi } from "vitest";
import { createStubAnalystClient } from "@project-overload/llm-client";
import { buildApiApp } from "../src/app";
import { InMemoryMetadataStore } from "../src/store/create-store";

const ORIGINAL_AUTH_REQUIRED = process.env.API_AUTH_REQUIRED;
const ORIGINAL_AUTH_TOKEN = process.env.API_AUTH_TOKEN;
const ORIGINAL_OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ORIGINAL_OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL;

afterEach(() => {
  process.env.API_AUTH_REQUIRED = ORIGINAL_AUTH_REQUIRED;
  process.env.API_AUTH_TOKEN = ORIGINAL_AUTH_TOKEN;
  process.env.OPENROUTER_API_KEY = ORIGINAL_OPENROUTER_API_KEY;
  process.env.OPENROUTER_BASE_URL = ORIGINAL_OPENROUTER_BASE_URL;
  vi.unstubAllGlobals();
});

describe("ui auth and chat sessions", () => {
  it("authenticates krypton123 with the shared demo password", async () => {
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
        username: "krypton123",
        password: "test123"
      }
    });

    expect(login.statusCode).toBe(200);
    expect(login.json().user.username).toBe("krypton123");

    await app.close();
  });

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
  }, 30_000);

  it("preserves created_at and advances updated_at when chat sessions are saved again", async () => {
    process.env.API_AUTH_REQUIRED = "false";
    delete process.env.API_AUTH_TOKEN;

    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      analyst_client: createStubAnalystClient()
    });

    await app.inject({
      method: "POST",
      url: "/ui/auth/login",
      payload: {
        username: "test123",
        password: "test123"
      }
    });

    const basePayload = {
      session: {
        id: "chat_2",
        title: "Follow-up QA",
        title_auto: false,
        naming_in_progress: false,
        state: {
          draft: {
            name: "Follow-up QA"
          }
        },
        user_messages: ["what changed in refunds"],
        db_bootstrapped: true,
        messages: [
          {
            role: "assistant",
            text: "Hello",
            download_url: null,
            exec_brief_html: null,
            at: new Date().toISOString()
          }
        ]
      }
    };

    const first = await app.inject({
      method: "PUT",
      url: "/ui/chat-sessions/chat_2",
      headers: {
        "x-ui-user": "test123"
      },
      payload: basePayload
    });
    expect(first.statusCode).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await app.inject({
      method: "PUT",
      url: "/ui/chat-sessions/chat_2",
      headers: {
        "x-ui-user": "test123"
      },
      payload: {
        session: {
          ...basePayload.session,
          title: "Follow-up QA Updated",
          messages: [
            ...basePayload.session.messages,
            {
              role: "user",
              text: "what changed in refunds",
              download_url: null,
              exec_brief_html: null,
              at: new Date().toISOString()
            }
          ]
        }
      }
    });
    expect(second.statusCode).toBe(200);

    const firstSession = first.json().session;
    const secondSession = second.json().session;
    expect(secondSession.created_at).toBe(firstSession.created_at);
    expect(Date.parse(secondSession.updated_at)).toBeGreaterThanOrEqual(Date.parse(firstSession.updated_at));

    await app.close();
  });

  it("preserves updated_at when an identical chat session is saved again", async () => {
    process.env.API_AUTH_REQUIRED = "false";
    delete process.env.API_AUTH_TOKEN;

    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      analyst_client: createStubAnalystClient()
    });

    await app.inject({
      method: "POST",
      url: "/ui/auth/login",
      payload: {
        username: "test123",
        password: "test123"
      }
    });

    const messageAt = new Date("2026-03-10T10:00:00.000Z").toISOString();
    const payload = {
      session: {
        id: "chat_2_static",
        title: "Static session",
        title_auto: false,
        naming_in_progress: false,
        state: {
          draft: {
            name: "Static session"
          }
        },
        user_messages: ["show me refunds"],
        db_bootstrapped: true,
        messages: [
          {
            role: "assistant",
            text: "Hello",
            download_url: null,
            exec_brief_html: null,
            at: messageAt
          }
        ]
      }
    };

    const first = await app.inject({
      method: "PUT",
      url: "/ui/chat-sessions/chat_2_static",
      headers: {
        "x-ui-user": "test123"
      },
      payload
    });
    expect(first.statusCode).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await app.inject({
      method: "PUT",
      url: "/ui/chat-sessions/chat_2_static",
      headers: {
        "x-ui-user": "test123"
      },
      payload
    });
    expect(second.statusCode).toBe(200);

    const firstSession = first.json().session;
    const secondSession = second.json().session;
    expect(secondSession.created_at).toBe(firstSession.created_at);
    expect(secondSession.updated_at).toBe(firstSession.updated_at);

    await app.close();
  });

  it("indexes and searches per-user rag memory chunks", async () => {
    process.env.API_AUTH_REQUIRED = "false";
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_BASE_URL = "https://example.openrouter.local/v1";

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [{ embedding: [0.12, 0.34, 0.56] }]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      analyst_client: createStubAnalystClient()
    });

    await app.inject({
      method: "POST",
      url: "/ui/auth/login",
      payload: { username: "test123", password: "test123" }
    });

    const indexResponse = await app.inject({
      method: "POST",
      url: "/ui/rag/index-turn",
      headers: { "x-ui-user": "test123" },
      payload: {
        session_id: "chat_123",
        chunks: [
          {
            source: "assistant_turn",
            label: "Assistant reply",
            text: "Refund rate is refunded revenue over total revenue."
          }
        ]
      }
    });
    expect(indexResponse.statusCode).toBe(200);
    expect(indexResponse.json().indexed).toBe(1);

    const searchResponse = await app.inject({
      method: "POST",
      url: "/ui/rag/search",
      headers: { "x-ui-user": "test123" },
      payload: {
        session_id: "chat_123",
        query_text: "What is the refund rate definition?",
        limit: 5
      }
    });

    expect(searchResponse.statusCode).toBe(200);
    const body = searchResponse.json();
    expect(Array.isArray(body.chunks)).toBe(true);
    expect(body.chunks.length).toBeGreaterThan(0);
    expect(body.chunks[0].text).toContain("Refund rate");

    await app.close();
  });
});
