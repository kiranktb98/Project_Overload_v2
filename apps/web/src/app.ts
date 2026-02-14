import Fastify from "fastify";
import { z } from "zod";
import {
  ChatTurnRequestSchema,
  createWebApiClient,
  handleChatTurn,
  parseChatState
} from "./chat";
import { renderChatPage } from "./page";

export type WebAppDependencies = {
  api_base_url?: string;
  fetch_impl?: typeof fetch;
};

export function buildWebApp(options: WebAppDependencies = {}) {
  const app = Fastify({ logger: false });
  const apiBaseUrl =
    options.api_base_url ?? process.env.WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
  const apiClient = createWebApiClient({
    base_url: apiBaseUrl,
    fetch_impl: options.fetch_impl
  });

  app.get("/health", async () => ({ status: "ok", service: "web" }));
  app.get("/", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderChatPage());
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

      return reply.code(200).send(response);
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

  return app;
}
