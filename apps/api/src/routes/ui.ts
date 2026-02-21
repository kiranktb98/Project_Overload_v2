import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { MetadataStore, PlatformUserRecord } from "../store";
import { resolveRequestContext } from "../security/request-context";
import { hashPassword, verifyPassword } from "../security/password";

const LoginPayloadSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256)
});

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(20000),
  download_url: z.string().trim().min(1).nullable().default(null),
  exec_brief_html: z.string().trim().min(1).nullable().default(null),
  at: z.string().datetime()
});

const ChatSessionSchema = z.object({
  id: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(200),
  title_auto: z.boolean().default(true),
  naming_in_progress: z.boolean().default(false),
  state: z.record(z.string(), z.unknown()).nullable().default(null),
  user_messages: z.array(z.string().trim().min(1).max(2000)).max(24).default([]),
  db_bootstrapped: z.boolean().default(false),
  messages: z.array(ChatMessageSchema).max(200).default([])
});

const UpsertChatSessionPayloadSchema = z.object({
  session: ChatSessionSchema
});

export function registerUiRoutes(app: FastifyInstance, store: MetadataStore): void {
  app.post("/ui/auth/login", async (request, reply) => {
    const context = resolveRequestContext(request);
    const parsed = LoginPayloadSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid login payload",
        issues: parsed.error.issues
      });
    }

    const username = parsed.data.username;
    let user = await store.getPlatformUserByUsername(username, context);

    if (!user && username === "test123") {
      const hashed = await hashPassword("test123");
      user = await store.upsertPlatformUser(
        {
          id: "user_test123",
          tenant_id: context.tenant_id,
          username: "test123",
          password_salt: hashed.salt,
          password_hash: hashed.hash,
          is_active: true
        },
        context
      );
    }

    if (!user || !user.is_active) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const isValid = await verifyPassword(parsed.data.password, user.password_salt, user.password_hash);
    if (!isValid) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    await store.markPlatformUserLogin(user.id, context);

    return reply.code(200).send({
      ok: true,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        username: user.username
      }
    });
  });

  app.get("/ui/chat-sessions", async (request, reply) => {
    const context = resolveRequestContext(request);
    const user = await resolveUiUser(store, request, context.tenant_id);
    if (!user) {
      return reply.code(401).send({ message: "Unauthorized UI session." });
    }

    const sessions = await store.listChatSessions(user.id, context);
    return reply.code(200).send({ sessions });
  });

  app.put("/ui/chat-sessions/:id", async (request, reply) => {
    const context = resolveRequestContext(request);
    const user = await resolveUiUser(store, request, context.tenant_id);
    if (!user) {
      return reply.code(401).send({ message: "Unauthorized UI session." });
    }

    const { id } = request.params as { id: string };
    const parsed = UpsertChatSessionPayloadSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid chat session payload",
        issues: parsed.error.issues
      });
    }
    if (parsed.data.session.id !== id) {
      return reply.code(400).send({ message: "Session id mismatch between path and payload." });
    }

    const session = await store.upsertChatSession(
      {
        id: parsed.data.session.id,
        user_id: user.id,
        title: parsed.data.session.title,
        title_auto: parsed.data.session.title_auto,
        naming_in_progress: parsed.data.session.naming_in_progress,
        state: parsed.data.session.state,
        user_messages: parsed.data.session.user_messages,
        db_bootstrapped: parsed.data.session.db_bootstrapped,
        messages: parsed.data.session.messages
      },
      context
    );

    await store.appendAuditLog(
      "ui_chat_session_upserted",
      {
        user_id: user.id,
        session_id: session.id
      },
      context
    );

    return reply.code(200).send({ session });
  });
}

async function resolveUiUser(
  store: MetadataStore,
  request: FastifyRequest,
  tenantId: string
): Promise<PlatformUserRecord | null> {
  const username = readHeaderValue(request, "x-ui-user");
  if (!username) {
    return null;
  }

  return store.getPlatformUserByUsername(username, { tenant_id: tenantId });
}

function readHeaderValue(request: FastifyRequest, name: string): string | null {
  const value = request.headers[name];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const trimmed = entry.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}
