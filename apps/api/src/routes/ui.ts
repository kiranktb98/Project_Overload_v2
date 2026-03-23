import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
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

const RagChunkInputSchema = z.object({
  source: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(256),
  text: z.string().trim().min(1).max(8000)
});

const RagIndexPayloadSchema = z.object({
  session_id: z.string().trim().max(128).optional().nullable(),
  chunks: z.array(RagChunkInputSchema).min(1).max(24)
});

const RagSearchPayloadSchema = z.object({
  session_id: z.string().trim().max(128).optional().nullable(),
  query_text: z.string().trim().min(1).max(4000),
  limit: z.number().int().min(1).max(24).default(12)
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

    const demoUsers: Record<string, { id: string; password: string }> = {
      test123: { id: "user_test123", password: "test123" },
      krypton123: { id: "user_krypton123", password: "test123" },
      test456: { id: "user_test456", password: "test456" }
    };

    const demo = demoUsers[username];
    if (!user && demo) {
      const hashed = await hashPassword(demo.password);
      user = await store.upsertPlatformUser(
        {
          id: demo.id,
          tenant_id: context.tenant_id,
          username,
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

  app.post("/ui/rag/index-turn", async (request, reply) => {
    const context = resolveRequestContext(request);
    const user = await resolveUiUser(store, request, context.tenant_id);
    if (!user) {
      return reply.code(401).send({ message: "Unauthorized UI session." });
    }

    const parsed = RagIndexPayloadSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid RAG index payload",
        issues: parsed.error.issues
      });
    }

    const sessionId = (parsed.data.session_id ?? "").trim();
    const texts = parsed.data.chunks.map((entry) => entry.text);
    const embeddings = await createOpenRouterEmbeddings(texts);
    if (embeddings.length !== parsed.data.chunks.length) {
      return reply.code(502).send({
        message: "Embedding service returned mismatched vector count."
      });
    }

    await store.upsertChatRagChunks(
      parsed.data.chunks.map((chunk, index) => ({
        user_id: user.id,
        session_id: sessionId,
        source: chunk.source,
        label: chunk.label,
        text_content: chunk.text,
        content_hash: computeRagContentHash({
          source: chunk.source,
          label: chunk.label,
          text: chunk.text
        }),
        embedding: embeddings[index]
      })),
      context
    );

    await store.appendAuditLog(
      "ui_rag_indexed",
      {
        user_id: user.id,
        session_id: sessionId,
        chunk_count: parsed.data.chunks.length
      },
      context
    );

    return reply.code(200).send({
      indexed: parsed.data.chunks.length
    });
  });

  app.post("/ui/rag/search", async (request, reply) => {
    const context = resolveRequestContext(request);
    const user = await resolveUiUser(store, request, context.tenant_id);
    if (!user) {
      return reply.code(401).send({ message: "Unauthorized UI session." });
    }

    const parsed = RagSearchPayloadSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid RAG search payload",
        issues: parsed.error.issues
      });
    }

    const [queryEmbedding] = await createOpenRouterEmbeddings([parsed.data.query_text]);
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return reply.code(502).send({
        message: "Embedding service did not return query vector."
      });
    }

    const chunks = await store.searchChatRagChunks(
      {
        user_id: user.id,
        session_id: (parsed.data.session_id ?? "").trim(),
        embedding: queryEmbedding,
        limit: parsed.data.limit
      },
      context
    );

    return reply.code(200).send({ chunks });
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

function computeRagContentHash(input: { source: string; label: string; text: string }): string {
  return createHash("sha256")
    .update(`${input.source}\n${input.label}\n${input.text}`)
    .digest("hex");
}

async function createOpenRouterEmbeddings(input: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing on API server.");
  }

  const baseUrl = (process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const model = process.env.OPENROUTER_EMBEDDING_MODEL?.trim() || "openai/text-embedding-3-small";
  const timeoutMs = Math.max(10_000, Number.parseInt(process.env.LLM_TIMEOUT_MS ?? "900000", 10));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...(process.env.OPENROUTER_APP_NAME ? { "X-Title": process.env.OPENROUTER_APP_NAME } : {}),
        ...(process.env.OPENROUTER_APP_URL ? { "HTTP-Referer": process.env.OPENROUTER_APP_URL } : {})
      },
      body: JSON.stringify({
        model,
        input
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter embeddings failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      throw new Error("OpenRouter embeddings response missing data array.");
    }

    const vectors = payload.data
      .map((entry) => {
        if (!isRecord(entry) || !Array.isArray(entry.embedding)) {
          return null;
        }
        const values = entry.embedding
          .map((value) => (typeof value === "number" ? value : Number.NaN))
          .filter((value) => Number.isFinite(value));
        return values.length > 0 ? values : null;
      })
      .filter((entry): entry is number[] => Array.isArray(entry));

    return vectors;
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
