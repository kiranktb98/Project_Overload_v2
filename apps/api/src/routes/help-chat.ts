import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MetadataStore } from "../store";
import { resolveRequestContext } from "../security/request-context";

const SaveHelpChatSchema = z.object({
  session_id: z.string().trim().min(1).max(128),
  username: z.string().trim().min(1).max(128),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4000)
  })).min(1).max(200)
});

export function registerHelpChatRoutes(app: FastifyInstance, store: MetadataStore): void {
  app.post("/help-chat/sessions", async (request, reply) => {
    const context = resolveRequestContext(request);
    const body = SaveHelpChatSchema.parse(request.body);
    const record = await store.saveHelpChatSession(
      body.session_id,
      body.username,
      body.messages,
      context
    );
    return reply.code(200).send(record);
  });

  app.get("/help-chat/sessions", async (request) => {
    const context = resolveRequestContext(request);
    return store.listHelpChatSessions(context);
  });

  app.get("/help-chat/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const context = resolveRequestContext(request);
    const record = await store.getHelpChatSession(id, context);
    if (!record) return reply.code(404).send({ message: "Session not found" });
    return record;
  });
}
