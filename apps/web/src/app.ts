import Fastify from "fastify";
import { z } from "zod";
import {
  appendConversationTurn,
  ChatTurnRequestSchema,
  createWebApiClient,
  handleChatTurn,
  parseChatState
} from "./chat";
import {
  createConversationClientFromEnv,
  type ConversationClient
} from "./conversation";
import { renderChatPage } from "./page";
import { renderConnectionPage } from "./connect-page";

export type WebAppDependencies = {
  api_base_url?: string;
  fetch_impl?: typeof fetch;
  conversation_client?: ConversationClient;
};

export function buildWebApp(options: WebAppDependencies = {}) {
  const app = Fastify({ logger: false });
  const apiBaseUrl =
    options.api_base_url ?? process.env.WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
  const apiClient = createWebApiClient({
    base_url: apiBaseUrl,
    fetch_impl: options.fetch_impl
  });
  const conversationClient =
    options.conversation_client ?? createConversationClientFromEnv({ fetch_impl: options.fetch_impl });

  app.get("/health", async () => ({ status: "ok", service: "web" }));
  app.get("/api/chat/runtime", async () => ({
    provider: conversationClient.provider,
    mode: conversationClient.mode
  }));

  app.get("/", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderChatPage());
  });

  app.get("/connect", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderConnectionPage());
  });

  app.post("/api/chat", async (request, reply) => {
    const parsed = ChatTurnRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid chat payload",
        issues: parsed.error.issues
      });
    }

    const state = parseChatState(parsed.data.state);

    try {
      const response = await handleChatTurn({
        message: parsed.data.message,
        state,
        api_client: apiClient
      });
      const aiMessage = await conversationClient.respond({
        user_message: parsed.data.message,
        deterministic_response: response.assistant_message,
        state: response.state,
        history: state.conversation_history
      });
      const nextState = appendConversationTurn(response.state, parsed.data.message, aiMessage);

      return reply.code(200).send({
        ...response,
        state: nextState,
        assistant_message: aiMessage
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          message: "Invalid chat state",
          issues: error.issues
        });
      }

      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Chat command failed",
        state
      });
    }
  });

  app.get("/api/runs/:runId/pdf", async (request, reply) => {
    const { runId } = request.params as { runId: string };

    try {
      const response = await apiClient.downloadRunPdf(runId);
      const arrayBuffer = await response.arrayBuffer();
      const contentDisposition = response.headers.get("content-disposition");

      if (contentDisposition) {
        reply.header("content-disposition", contentDisposition);
      }

      return reply
        .code(200)
        .header("content-type", response.headers.get("content-type") ?? "application/pdf")
        .send(Buffer.from(arrayBuffer));
    } catch (error) {
      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Unable to fetch PDF"
      });
    }
  });

  app.get("/api/db/context", async (_request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/connections/active",
      reply
    });
  });

  app.get("/api/db/tables", async (_request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/connections/tables",
      reply
    });
  });

  app.post("/api/db/test", async (request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/test",
      body: request.body,
      reply
    });
  });

  app.post("/api/db/connect", async (request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/connect",
      body: request.body,
      reply
    });
  });

  app.post("/api/db/allowlist", async (request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/allowlist",
      body: request.body,
      reply
    });
  });

  app.post("/api/db/fix-script", async (request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/fix-script",
      body: request.body,
      reply
    });
  });

  app.get("/api/db/query-logs", async (_request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/connections/query-logs",
      reply
    });
  });

  app.post("/api/db/query", async (request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/query",
      body: request.body,
      reply
    });
  });

  app.post("/api/db/disconnect", async (_request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/disconnect",
      reply
    });
  });

  return app;
}

async function proxyToApi(input: {
  fetch_impl?: typeof fetch;
  api_base_url: string;
  method: "GET" | "POST";
  path: string;
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } };
  body?: unknown;
}) {
  const fetcher = input.fetch_impl ?? fetch;
  const response = await fetcher(`${input.api_base_url}${input.path}`, {
    method: input.method,
    headers: {
      "content-type": "application/json"
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body)
  });

  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : {};
  return input.reply.code(response.status).send(payload);
}
