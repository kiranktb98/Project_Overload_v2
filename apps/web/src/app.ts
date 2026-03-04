import { AsyncLocalStorage } from "node:async_hooks";
import Fastify from "fastify";
import { z } from "zod";
import {
  appendConversationTurn,
  applyLlmDraftUpdates,
  ChatTurnRequestSchema,
  createInitialChatState,
  createWebApiClient,
  fetchCatalogContext,
  handleChatTurn,
  parseChatState,
  parseScheduleParams
} from "./chat";
import {
  createConversationClientFromEnv,
  type ConversationClient
} from "./conversation";
import {
  createQueryRouterClientFromEnv,
  type QueryRouterClient
} from "./query-router";
import { renderChatPage } from "./page";
import { renderConnectionPage } from "./connect-page";
import { renderLoginPage } from "./login-page";
import { renderUsageMetricsPage } from "./usage-page";
import { renderGlobalConfigPage } from "./config-page";

export type WebAppDependencies = {
  api_base_url?: string;
  fetch_impl?: typeof fetch;
  conversation_client?: ConversationClient;
  query_router?: QueryRouterClient;
};

class ChatStageError extends Error {
  readonly stage: string;

  constructor(stage: string, cause: unknown) {
    let detail =
      cause instanceof Error && cause.message.trim().length > 0
        ? cause.message
        : typeof cause === "string" && cause.trim().length > 0
          ? cause
          : "Unknown error";
    if (detail.trim().startsWith("[")) {
      detail = "Provider response format mismatch.";
    }
    super(`Stage error: ${stage} failed. ${detail}`);
    this.name = "ChatStageError";
    this.stage = stage;
  }
}

const webUserContext = new AsyncLocalStorage<{ username: string }>();

export function buildWebApp(options: WebAppDependencies = {}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });
  const apiBaseUrl = normalizeApiBaseUrl(
    options.api_base_url ?? process.env.WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000"
  );
  const apiClient = createWebApiClient({
    base_url: apiBaseUrl,
    fetch_impl: options.fetch_impl,
    header_provider: () => {
      const ctx = webUserContext.getStore();
      const headers: Record<string, string> = { ...buildApiAuthHeader() };
      if (ctx?.username) {
        headers["x-ui-user"] = ctx.username;
      }
      return headers;
    }
  });
  const conversationClient =
    options.conversation_client ?? createConversationClientFromEnv({ fetch_impl: options.fetch_impl });
  const queryRouter =
    options.query_router ?? createQueryRouterClientFromEnv({ fetch_impl: options.fetch_impl });
  const authEnabled = isUiAuthEnabled();
  const orchestratorEnabled = isConversationOrchestratorEnabled();

  // Thread user identity into AsyncLocalStorage so apiClient headers resolve per-user
  app.addHook("preHandler", async (request) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    if (username) {
      webUserContext.enterWith({ username });
    }
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!authEnabled) {
      return;
    }

    const pathname = request.url.split("?")[0];
    if (pathname === "/health" || pathname === "/login" || pathname === "/auth/login") {
      return;
    }

    if (isAuthenticatedRequest(request.headers.cookie)) {
      return;
    }

    if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
      return reply.code(401).send({
        message: "Unauthorized"
      });
    }

    return reply.redirect("/login");
  });

  app.get("/login", async (request, reply) => {
    if (authEnabled && isAuthenticatedRequest(request.headers.cookie)) {
      return reply.redirect("/");
    }
    return reply.type("text/html; charset=utf-8").send(renderLoginPage());
  });

  const LoginPayloadSchema = z.object({
    username: z.string(),
    password: z.string()
  });

  app.post("/auth/login", async (request, reply) => {
    if (!authEnabled) {
      return reply.code(200).send({ ok: true, bypassed: true });
    }

    const parsed = LoginPayloadSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid login payload"
      });
    }

    const username = parsed.data.username.trim();
    const password = parsed.data.password;

    let loginResponse: Response;
    try {
      loginResponse = await (options.fetch_impl ?? fetch)(`${apiBaseUrl}/ui/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildApiAuthHeader()
        },
        body: JSON.stringify({ username, password })
      });
    } catch {
      return reply.code(502).send({
        message: `Cannot reach API server at ${apiBaseUrl}.`
      });
    }

    if (!loginResponse.ok) {
      return reply.code(401).send({
        message: "Invalid credentials"
      });
    }

    const encodedUser = encodeURIComponent(username);
    reply.header("set-cookie", [
      "po_demo_auth=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800",
      `po_user=${encodedUser}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    ]);
    return reply.code(200).send({ ok: true });
  });

  app.post("/auth/logout", async (_request, reply) => {
    if (authEnabled) {
      reply.header(
        "set-cookie",
        [
          "po_demo_auth=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
          "po_user=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
        ]
      );
    }
    return reply.redirect("/login");
  });

  app.get("/health", async () => ({ status: "ok", service: "web" }));
  app.get("/api/chat/runtime", async () => ({
    provider: conversationClient.provider,
    mode: conversationClient.mode,
    query_router_provider: queryRouter.provider,
    query_router_mode: queryRouter.mode
  }));

  const ChatNameRequestSchema = z.object({
    messages: z.array(z.string().trim().min(1)).min(1).max(2)
  });

  app.post("/api/chat/name", async (request, reply) => {
    const parsed = ChatNameRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid naming payload",
        issues: parsed.error.issues
      });
    }

    try {
      const catalogCtx = await fetchCatalogContext(apiClient);
      if (!conversationClient.nameConversation) {
        return reply.code(503).send({
          message: "Conversation title service unavailable"
        });
      }
      const result = await conversationClient.nameConversation({
        first_user_messages: parsed.data.messages,
        catalog_summary: catalogCtx.catalog_summary,
        business_context: catalogCtx.business_context
      });

      return reply.code(200).send({
        title: result.title
      });
    } catch (error) {
      return reply.code(502).send({
        message: error instanceof Error ? error.message : "Conversation title generation failed"
      });
    }
  });

  app.get("/", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderChatPage());
  });

  app.get("/connect", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderConnectionPage());
  });

  app.get("/usage", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderUsageMetricsPage());
  });

  app.get("/config", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderGlobalConfigPage());
  });

  app.post("/api/chat", async (request, reply) => {
    const parsed = ChatTurnRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid chat payload",
        issues: parsed.error.issues
      });
    }

    const state = coerceIncomingChatState(parsed.data.state);
    const userSettings = await loadUserSettingsSafe(apiClient);
    const hydratedState = hydrateStateFromUserSettings(state, userSettings);
    const sessionId = typeof parsed.data.chat_session_id === "string" ? parsed.data.chat_session_id.trim() : "";
    const ragMemory = await loadRagMemorySafe(apiClient, {
      session_id: sessionId.length > 0 ? sessionId : null,
      query_text: parsed.data.message,
      limit: 12
    });

    try {
      let orchestratorDecision: Awaited<
        ReturnType<NonNullable<ConversationClient["orchestrateTurn"]>>
      > | null = null;

      const skipOrchestratorForMessage =
        isUiControlMessage(parsed.data.message) || hasPendingWorkflowDecision(hydratedState);
      if (orchestratorEnabled && conversationClient.orchestrateTurn && !skipOrchestratorForMessage) {
        try {
          const catalogCtx = await fetchCatalogContext(apiClient);
          const businessContext =
            userSettings.business_context.trim().length > 0
              ? userSettings.business_context
              : catalogCtx.business_context;
          orchestratorDecision = await conversationClient.orchestrateTurn({
            user_message: parsed.data.message,
            state: hydratedState,
            history: hydratedState.conversation_history,
            catalog_summary: catalogCtx.catalog_summary,
            business_context: businessContext,
            retrieved_context: ragMemory
          });
        } catch (orchestratorError) {
          console.error("[orchestrator] decision failed:", orchestratorError);
          throw new ChatStageError("orchestrator_decision", orchestratorError);
        }
      }

      const response = await handleChatTurn({
        message: parsed.data.message,
        state: hydratedState,
        api_client: apiClient,
        query_router: queryRouter,
        orchestrator_decision: orchestratorDecision
      });

      const catalogCtx = await fetchCatalogContext(apiClient);
      const businessContext =
        userSettings.business_context.trim().length > 0
          ? userSettings.business_context
          : catalogCtx.business_context;
      let conversationResponse: Awaited<ReturnType<ConversationClient["respond"]>>;
      try {
        conversationResponse = await conversationClient.respond({
          user_message: parsed.data.message,
          action_context: response.assistant_message,
          state: response.state,
          history: hydratedState.conversation_history,
          catalog_summary: catalogCtx.catalog_summary,
          business_context: businessContext,
          retrieved_context: ragMemory
        });
      } catch (conversationError) {
        const normalizedState = normalizeWorkflowDecisionState(response.state);
        const parsedResponseState = parseChatState(normalizedState);
        const hasAuthoritativeExecutionOutcome =
          isExecutionOutcomeContext(response.assistant_message) ||
          isDecisionPendingContext(response.assistant_message) ||
          Boolean(parsedResponseState.pending_run_id);

        if (hasAuthoritativeExecutionOutcome) {
          const nextState = appendConversationTurn(
            normalizedState,
            parsed.data.message,
            response.assistant_message
          );
          return reply.code(200).send({
            ...response,
            state: nextState,
            assistant_message: response.assistant_message
          });
        }

        throw new ChatStageError("conversation_response", conversationError);
      }

      const aiMessage = enforceExecutionTruth(
        conversationResponse.message,
        response.assistant_message
      );
      let safeAiMessage = sanitizeCustomerFacingAssistantMessage(aiMessage);
      let stateAfterLlm = response.state;
      if (conversationResponse.draft_updates) {
        stateAfterLlm = applyLlmDraftUpdates(response.state, conversationResponse.draft_updates, {
          preserve_prepared_state: hasPendingWorkflowDecision(response.state)
        });
      }
      stateAfterLlm = syncDecisionStateFromAssistantMessage(stateAfterLlm, aiMessage);
      stateAfterLlm = normalizeWorkflowDecisionState(stateAfterLlm);
      safeAiMessage = ensureScopeQuestionsVisible(safeAiMessage, stateAfterLlm);

      // Detect <<<SCHEDULE_PARAMS>>> block from LLM response
      const scheduleParams = parseScheduleParams(safeAiMessage);
      if (scheduleParams) {
        safeAiMessage = safeAiMessage
          .replace(/<<<SCHEDULE_PARAMS>>>[\s\S]*?<<<END_SCHEDULE_PARAMS>>>/g, "")
          .trim();
        stateAfterLlm = { ...stateAfterLlm, schedule_pending: true, pending_schedule: scheduleParams };
      }

      const nextState = appendConversationTurn(stateAfterLlm, parsed.data.message, safeAiMessage);
      void apiClient
        .indexRagTurn({
          session_id: sessionId.length > 0 ? sessionId : null,
          chunks: [
            {
              source: "user_turn",
              label: "User message",
              text: parsed.data.message
            },
            {
              source: "assistant_turn",
              label: "Assistant reply",
              text: safeAiMessage
            }
          ]
        })
        .catch((error) => {
          app.log.warn(
            { err: error, path: "/api/chat" },
            "RAG index update failed; chat response already returned."
          );
        });

      return reply.code(200).send({
        ...response,
        state: nextState,
        assistant_message: safeAiMessage
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          message: "Invalid chat state",
          issues: error.issues
        });
      }

      const safeMessage =
        error instanceof ChatStageError
          ? error.message
          : `Stage error: chat_turn failed. ${error instanceof Error ? error.message : "Unknown error"}`;
      app.log.error(
        {
          err: error,
          path: "/api/chat"
        },
        "Chat route failed; returning explicit stage failure."
      );
      const nextState = appendConversationTurn(hydratedState, parsed.data.message, safeMessage);
      return reply.code(200).send({
        assistant_message: safeMessage,
        state: nextState
      });
    }
  });

  app.get("/api/chat/sessions", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    if (!username) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/ui/chat-sessions",
      additional_headers: { "x-ui-user": username },
      reply
    });
  });

  app.put("/api/chat/sessions/:id", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    if (!username) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const { id } = request.params as { id: string };
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "PUT",
      path: `/ui/chat-sessions/${encodeURIComponent(id)}`,
      body: request.body,
      additional_headers: { "x-ui-user": username },
      reply
    });
  });

  app.get("/api/run-status/:runId", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    try {
      const status = await apiClient.getRunStatus(runId);
      return reply.code(200).send(status);
    } catch (error) {
      return reply.code(502).send({
        message: error instanceof Error ? error.message : "Failed to fetch run status"
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

  app.get("/api/db/context", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/connections/active",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/db/tables", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/connections/tables",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/db/test", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/test",
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/db/connect", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/connect",
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/db/allowlist", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/allowlist",
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/db/validate", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/validate",
      body: {},
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/db/fix-script", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/fix-script",
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/db/query-logs", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/connections/query-logs",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/db/query", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/query",
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/db/catalog", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/connections/catalog",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/db/catalog/refresh", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/catalog/refresh",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/db/catalogue", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/catalogue",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/db/business-context", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/business-context",
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/db/disconnect", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/disconnect",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  // ── Global Config (metric definitions) ──
  app.get("/api/config/global", async (_request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/config/global",
      reply
    });
  });

  app.put("/api/config/global", async (request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "PUT",
      path: "/config/global",
      body: request.body,
      reply
    });
  });

  // ── Per-User Settings (metric definitions + business context) ──
  app.get("/api/config/user-settings", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/config/user-settings",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.put("/api/config/user-settings", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "PUT",
      path: "/config/user-settings",
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  return app;
}

function isUiControlMessage(message: string): boolean {
  return /^__ui_[a-z0-9_]+__$/i.test(message.trim());
}

function coerceIncomingChatState(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return parseChatState(value);
  }

  const initial = createInitialChatState();
  const incoming = value as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    ...initial,
    ...incoming
  };

  if (incoming.draft && typeof incoming.draft === "object" && !Array.isArray(incoming.draft)) {
    merged.draft = {
      ...initial.draft,
      ...(incoming.draft as Record<string, unknown>)
    };
  }

  return parseChatState(merged);
}

async function loadUserSettingsSafe(apiClient: ReturnType<typeof createWebApiClient>): Promise<{
  metric_definitions: Array<{ metric_key: string; display_name: string; definition: string }>;
  business_context: string;
}> {
  try {
    const settings = await apiClient.getUserSettings();
    return {
      metric_definitions: Array.isArray(settings.metric_definitions)
        ? settings.metric_definitions
            .map((entry) => ({
              metric_key: String(entry.metric_key ?? "").trim(),
              display_name: String(entry.display_name ?? "").trim(),
              definition: String(entry.definition ?? "").trim()
            }))
            .filter(
              (entry) =>
                entry.metric_key.length > 0 &&
                entry.display_name.length > 0 &&
                entry.definition.length > 0
            )
        : [],
      business_context:
        typeof settings.business_context === "string" ? settings.business_context : ""
    };
  } catch {
    return { metric_definitions: [], business_context: "" };
  }
}

async function loadRagMemorySafe(
  apiClient: ReturnType<typeof createWebApiClient>,
  payload: {
    session_id: string | null;
    query_text: string;
    limit: number;
  }
): Promise<Array<{ source: string; label: string; text: string }>> {
  try {
    const chunks = await apiClient.searchRagMemory(payload);
    return chunks.map((entry) => ({
      source: entry.source,
      label: entry.label,
      text: entry.text
    }));
  } catch {
    return [];
  }
}

function hydrateStateFromUserSettings(
  state: ReturnType<typeof parseChatState>,
  settings: {
    metric_definitions: Array<{ metric_key: string; display_name: string; definition: string }>;
    business_context: string;
  }
) {
  const next = parseChatState(state);
  if (settings.metric_definitions.length > 0) {
    next.metric_definitions = settings.metric_definitions.map((entry) => ({
      metric_key: entry.metric_key,
      display_name: entry.display_name,
      definition: entry.definition
    }));
  }
  if (settings.business_context.trim().length > 0) {
    next.scope_business_context = settings.business_context;
  }
  return next;
}

function isExecutionOutcomeContext(actionContext: string): boolean {
  return (
    /^Query completed\. Query ID:/i.test(actionContext) ||
    /^Query failed\. Query ID:/i.test(actionContext) ||
    /^Report executed\. Run ID:/i.test(actionContext) ||
    /^I['’]m generating your report/i.test(actionContext) ||
    /^Run execution did not complete\./i.test(actionContext) ||
    /^Run could not start\./i.test(actionContext) ||
    /^Data preparation completed/i.test(actionContext) ||
    /^Data preparation did not complete\./i.test(actionContext) ||
    /^Preparation could not start yet\./i.test(actionContext)
  );
}

function isDecisionPendingContext(actionContext: string): boolean {
  return (
    /^Analysis is staged and waiting on the current workflow decision\./i.test(actionContext) ||
    /^Ready to prepare data for:/i.test(actionContext) ||
    /^Scope clarifications captured for all questions\./i.test(actionContext) ||
    /^Need clarification for \d+ scope item/i.test(actionContext) ||
    /^Before data preparation,/i.test(actionContext) ||
    /^Data preparation decision pending/i.test(actionContext) ||
    /^Analysis decision pending/i.test(actionContext) ||
    /^SQL decision pending/i.test(actionContext)
  );
}

function enforceExecutionTruth(modelMessage: string, actionContext: string): string {
  const queryExecuted =
    /\bQuery ID:\s*[a-z0-9_-]+\b/i.test(actionContext) ||
    /\bQuery returned\s+\d+/i.test(actionContext);
  const reportExecuted = /\bReport executed\b/i.test(actionContext);
  const reportInFlight = /\bgenerating your report\b/i.test(actionContext);
  const decisionPending = isDecisionPendingContext(actionContext);
  const preparationExecuted = /^Data preparation completed/i.test(actionContext);

  if (!queryExecuted && looksLikeQueryExecutionClaim(modelMessage)) {
    if (
      /\bquery is ready, but waiting for your confirmation\b/i.test(actionContext) ||
      /\bchoose "run query"\b/i.test(actionContext)
    ) {
      return actionContext;
    }

    return [
      "I haven't executed a SQL query yet.",
      "Ask in plain language (for example: total sales in the last month, or sales in Bengaluru) and I'll run a safe query directly."
    ].join("\n");
  }

  if (!reportExecuted && looksLikeReportExecutionClaim(modelMessage)) {
    if (reportInFlight || decisionPending) {
      return actionContext;
    }
    return [
      "I haven't executed a report run yet.",
      "The workflow is paused at a pending execution decision."
    ].join("\n");
  }

  if (
    reportInFlight &&
    /\b(execution didn['’]t go through|did not go through|network error on its end|try running it again)\b/i.test(modelMessage)
  ) {
    return actionContext;
  }

  if (
    /^Ready to prepare data for:/i.test(actionContext) &&
    /\b(run report|execute report|finish scoping and run analysis)\b/i.test(modelMessage)
  ) {
    return actionContext;
  }

  if (
    /^Analysis is staged and waiting on the current workflow decision\./i.test(actionContext) &&
    /\brun data preparation\b/i.test(modelMessage)
  ) {
    return actionContext;
  }

  if (!preparationExecuted && looksLikePreparationExecutionClaim(modelMessage)) {
    return actionContext;
  }

  return modelMessage;
}

function syncDecisionStateFromAssistantMessage(state: unknown, assistantMessage: string) {
  const nextState = parseChatState(state);

  const hasAnsweredScope =
    nextState.scope_questions.length > 0 &&
    nextState.scope_questions.every(
      (q: { answer?: string | null }) => q.answer && q.answer.trim().length > 0
    );

  const scopeLockSignal =
    /\ball\s+\w+\s+questions?\s+(?:are|is)\s+(?:fully\s+)?confirmed\b/.test(
      assistantMessage.toLowerCase()
    ) ||
    /\bscope is locked\b/.test(assistantMessage.toLowerCase());

  const shouldAllowScopeLockSync =
    scopeLockSignal &&
    !/\?/.test(assistantMessage);

  if (
    nextState.pending_query_sql ||
    nextState.pending_single_query_request ||
    nextState.pending_metric_confirmations.length > 0 ||
    nextState.prep_pending ||
    nextState.scope_pending ||
    (nextState.scope_clarification_pending && !shouldAllowScopeLockSync) ||
    nextState.awaiting_post_run_refinement ||
    nextState.refinement_active ||
    nextState.awaiting_pdf_confirmation ||
    nextState.awaiting_save_confirmation ||
    nextState.awaiting_schedule_confirmation ||
    nextState.awaiting_schedule_mode_selection ||
    nextState.awaiting_custom_day_input
  ) {
    return nextState;
  }

  const queryCandidate = extractPendingSqlFromAssistantMessage(assistantMessage);
  if (queryCandidate) {
    nextState.pending_query_sql = queryCandidate;
    nextState.pending_query_limit = null;
    return nextState;
  }

  const lower = assistantMessage.toLowerCase();

  // ── Prep-pending triggers (show "Run Data Preparation" button) ──
  const prepSignal =
    /\brun data preparation\b/.test(lower) ||
    /\bready to prepare data\b/.test(lower) ||
    /\bready to move to data prep(?:aration)?\b/.test(lower) ||
    /\bdata preparation decision pending\b/.test(lower) ||
    /\bscope clarifications captured for all questions\b/.test(lower) ||
    /\ball\s+\w+\s+questions?\s+(?:are|is)\s+(?:fully\s+)?confirmed\b/.test(lower) ||
    /\bscope is locked and waiting on the current workflow decision\b/.test(lower) ||
    /\bscope is locked\b.*\bdata prep(?:aration)?\b/.test(lower) ||
    /\bscope is locked\b/.test(lower);

  // Guard: if the assistant is still asking for input, don't trigger prep.
  const isAskingQuestions =
    /\?/.test(assistantMessage) ||
    /\b(let me know|please confirm|confirm (?:the|which|whether)|should (?:we|i)|would you|do you want)\b/.test(
      lower
    );

  const explicitScopeLockSignal =
    scopeLockSignal &&
    !isAskingQuestions &&
    nextState.scope_questions.length > 0;
  const hasUnansweredScopeItems = nextState.scope_questions.some(
    (entry: { answer?: string | null }) => !entry.answer || entry.answer.trim().length === 0
  );

  if (prepSignal) {
    if (
      !nextState.prep_complete &&
      !isAskingQuestions &&
      (hasAnsweredScope || explicitScopeLockSignal) &&
      !hasUnansweredScopeItems &&
      nextState.pending_inputs.length === 0
    ) {
      nextState.scope_finalized = true;
      nextState.scope_clarification_pending = false;
      nextState.prep_pending = true;
      nextState.scope_pending = false;
      nextState.pending_inputs = [];
      return nextState;
    }
  }

  // ── Scope-pending triggers (show "Finish scoping and run analysis" button) ──
  const analysisSignal =
    /\bfinish scoping and run analysis\b/.test(lower) ||
    /\b(run report|execute report|generate report)\b/.test(lower);

  if (analysisSignal && nextState.prep_complete) {
    nextState.scope_pending = true;
    nextState.prep_pending = false;
    return nextState;
  }

  return nextState;
}

function hasPendingWorkflowDecision(state: unknown): boolean {
  const parsed = parseChatState(state);
  return Boolean(
    parsed.pending_query_sql ||
      parsed.pending_single_query_request ||
      parsed.pending_metric_confirmations.length > 0 ||
      parsed.prep_pending ||
      parsed.scope_pending ||
      parsed.scope_clarification_pending ||
      parsed.awaiting_post_run_refinement ||
      parsed.refinement_active ||
      parsed.awaiting_pdf_confirmation ||
      parsed.awaiting_save_confirmation ||
      parsed.awaiting_schedule_confirmation ||
      parsed.awaiting_schedule_mode_selection ||
      parsed.awaiting_custom_day_input
  );
}

function normalizeWorkflowDecisionState(state: unknown) {
  const parsed = parseChatState(state);

  const hasAnsweredScopeItems =
    parsed.scope_questions.length > 0 &&
    parsed.scope_questions.every((entry) => Boolean(entry.answer && entry.answer.trim().length > 0));
  const hasScopeReadyContext = hasScopeReadyContextInHistory(parsed);
  const hasUnansweredScopeItems = parsed.scope_questions.some(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  );
  const hasBlockingDecision =
    Boolean(parsed.pending_query_sql) ||
    parsed.pending_single_query_request !== null ||
    parsed.pending_metric_confirmations.length > 0 ||
    (parsed.scope_clarification_pending && hasUnansweredScopeItems) ||
    parsed.awaiting_post_run_refinement ||
    parsed.refinement_active ||
    parsed.awaiting_pdf_confirmation ||
    parsed.awaiting_save_confirmation ||
    parsed.awaiting_schedule_confirmation ||
    parsed.awaiting_schedule_mode_selection ||
    parsed.awaiting_custom_day_input;

  if (hasUnansweredScopeItems) {
    parsed.scope_clarification_pending = true;
    parsed.scope_finalized = false;
    parsed.prep_pending = false;
    parsed.scope_pending = false;
  }

  const hasScopeQuestions = parsed.scope_questions.length > 0;
  const canPromoteToPrep =
    hasScopeQuestions
      ? hasAnsweredScopeItems && !hasUnansweredScopeItems
      : hasScopeReadyContext;

  if (
    canPromoteToPrep &&
    hasScopeReadyContext &&
    !hasBlockingDecision &&
    !parsed.prep_complete
  ) {
    parsed.scope_finalized = true;
    parsed.scope_clarification_pending = false;
    parsed.scope_pending = false;
    parsed.prep_pending = true;
  }

  if (
    parsed.prep_complete &&
    parsed.prepared_payloads.length > 0 &&
    !parsed.scope_pending &&
    !parsed.prep_pending &&
    !parsed.pending_run_id &&
    !parsed.awaiting_post_run_refinement &&
    !parsed.refinement_active &&
    !parsed.awaiting_pdf_confirmation &&
    !parsed.awaiting_save_confirmation &&
    !parsed.awaiting_schedule_confirmation &&
    !parsed.awaiting_schedule_mode_selection &&
    !parsed.awaiting_custom_day_input
  ) {
    parsed.scope_pending = true;
  }

  return parsed;
}

function hasScopeReadyContextInHistory(state: ReturnType<typeof parseChatState>): boolean {
  const lastAssistant = [...state.conversation_history]
    .reverse()
    .find((turn) => turn.role === "assistant");
  if (!lastAssistant) {
    return false;
  }

  const text = lastAssistant.content.toLowerCase();
  return (
    text.includes("scope clarifications captured for all questions") ||
    text.includes("ready to prepare data for:") ||
    /\ball\s+\w+\s+questions?\s+(?:are|is)\s+(?:fully\s+)?confirmed\b/.test(text) ||
    text.includes("scope is locked and waiting on the current workflow decision") ||
    text.includes("ready to move to data preparation") ||
    text.includes("ready to move to data prep") ||
    /\bscope is locked\b.*\bdata prep(?:aration)?\b/.test(text) ||
    /\bscope is locked\b/.test(text)
  );
}

function extractPendingSqlFromAssistantMessage(message: string): string | null {
  const candidates = [
    extractFencedSql(message),
    extractQueryPrefixedSql(message),
    extractLeadingSqlBlock(message)
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const normalized = normalizeSqlCandidate(candidate);
    if (isLikelySelectSql(normalized)) {
      return normalized;
    }
  }

  return null;
}

function isLikelySelectSql(sql: string): boolean {
  return (
    (/^\s*select\b/i.test(sql) && /\bfrom\b/i.test(sql)) ||
    (/^\s*with\b/i.test(sql) && /\bselect\b/i.test(sql))
  );
}

function extractFencedSql(message: string): string | null {
  const fencedMatch = message.match(/```(?:sql)?\s*\n?([\s\S]*?)```/i);
  if (!fencedMatch) {
    return null;
  }
  return fencedMatch[1].trim();
}

function extractQueryPrefixedSql(message: string): string | null {
  const prefixedMatch = message.match(
    /(?:^|\n)\s*`?query\s*:\s*((?:select|with)[\s\S]*?)(?=\n\s*\n|$)/i
  );
  if (!prefixedMatch) {
    return null;
  }
  return prefixedMatch[1].trim();
}

function extractLeadingSqlBlock(message: string): string | null {
  const sqlMatch = message.match(
    /(?:^|\n)\s*((?:select|with)[\s\S]*?)(?=\n\s*\n|$)/i
  );
  if (!sqlMatch) {
    return null;
  }

  return sqlMatch[1].trim();
}

function normalizeSqlCandidate(value: string): string {
  const cleaned = value
    .replace(/^\s*`+/, "")
    .replace(/`+\s*$/, "")
    .trim();
  const withoutEllipsis = cleaned.replace(/\n\s*(?:\.{3}|…)\s*$/u, "").trim();
  return withoutEllipsis.replace(/;+\s*$/g, "").replace(/\s+$/g, "");
}

function looksLikeQueryExecutionClaim(message: string): boolean {
  const lower = message.toLowerCase();
  const hasQuerySignal =
    /sql/.test(lower) ||
    /\b(query|sql|statement|select|dataset|sample|data\s+pull|results?)\b/.test(lower);
  if (!hasQuerySignal) {
    return false;
  }

  const isReportOnlyLanguage =
    /\b(report|analysis)\b/.test(lower) && !/\b(query|sql|statement|select)\b/.test(lower);
  if (isReportOnlyLanguage) {
    return false;
  }

  return (
    /\b(?:i.?m|i am|we.?re|we are)\s+(running|executing|querying|pulling)\s+(?:the\s+)?(?:query|sql|statement|select|dataset|sample|data\s+pull)\b/i.test(
      message
    ) ||
    /\b(i|we)\s+(ran|executed|queried|pulled)\s+(?:the\s+)?(?:query|sql|statement|dataset|sample|data)\b/i.test(
      message
    ) ||
    /\bquery\s+is\s+running\b/i.test(message) ||
    /\b(as soon as|once)\s+[^.]{0,80}\b(query|results?)\b[^.]{0,80}\b(come back|completes?|finishes?|loads?)\b/i.test(message)
  );
}

function looksLikeReportExecutionClaim(message: string): boolean {
  return (
    /\b(?:i.?m|i am|we.?re|we are)\s+(running|executing)\s+(the\s+)?report\b/i.test(message) ||
    /\b(report|run)\s+is\s+running\b/i.test(message) ||
    /\b(report)\s+(executed|completed)\b/i.test(message)
  );
}

function looksLikePreparationExecutionClaim(message: string): boolean {
  return (
    /\bdata preparation\b/i.test(message) &&
    /\b(completed|finished|done|prepared)\b/i.test(message)
  );
}

function isUiAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  const raw = (process.env.WEB_FAKE_AUTH ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

function isAuthenticatedRequest(cookieHeader: string | undefined): boolean {
  return getCookieValue(cookieHeader, "po_demo_auth") === "1" && getAuthenticatedUsername(cookieHeader) !== null;
}

async function proxyToApi(input: {
  fetch_impl?: typeof fetch;
  api_base_url: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } };
  additional_headers?: Record<string, string>;
  body?: unknown;
}) {
  const fetcher = input.fetch_impl ?? fetch;
  const requestHeaders: Record<string, string> = {
    ...buildApiAuthHeader(),
    ...(input.additional_headers ?? {})
  };
  if (input.body !== undefined) {
    requestHeaders["content-type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetcher(`${input.api_base_url}${input.path}`, {
      method: input.method,
      headers: requestHeaders,
      body: input.body === undefined ? undefined : JSON.stringify(input.body)
    });
  } catch {
    return input.reply.code(502).send({
      message: `Cannot reach API server at ${input.api_base_url}. Is the API running? (pnpm --filter api dev)`
    });
  }

  const text = await response.text();
  let payload: unknown = {};
  if (text.trim().length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      return input.reply.code(502).send({
        message: "API returned a non-JSON response. Please retry in a few seconds."
      });
    }
  }
  return input.reply.code(response.status).send(payload);
}

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "http://127.0.0.1:4000";
  }
  return trimmed.replace(/\/+$/, "");
}

function buildApiAuthHeader(): Record<string, string> {
  const token = (process.env.WEB_INTERNAL_API_KEY ?? "").trim();
  if (!token) {
    return {};
  }
  return { "x-api-key": token };
}

function getAuthenticatedUsername(cookieHeader: string | undefined): string | null {
  const raw = getCookieValue(cookieHeader, "po_user");
  if (!raw) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(raw).trim();
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

function getCookieValue(cookieHeader: string | undefined, key: string): string | null {
  if (!cookieHeader || cookieHeader.length === 0) {
    return null;
  }

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [cookieKey, ...valueParts] = part.trim().split("=");
    if (cookieKey === key) {
      const joined = valueParts.join("=").trim();
      return joined.length > 0 ? joined : null;
    }
  }

  return null;
}

function sanitizeCustomerFacingAssistantMessage(message: string): string {
  let sanitized = message;
  sanitized = sanitized.replace(/\bthe system\b/gi, "this process");
  sanitized = sanitized.replace(/\bsystem\b/gi, "process");
  sanitized = sanitized.replace(/\bthe workflow\b/gi, "this process");
  sanitized = sanitized.replace(/\bworkflow\b/gi, "process");
  sanitized = sanitized.replace(/\bauto-?trigger(?:ed|ing)?\b/gi, "continued");
  sanitized = sanitized.replace(/\bRun Report\b/gi, "Finish scoping and run analysis");
  sanitized = sanitized.replace(/\b(?:click|tap|press|hit|use)\b/gi, "choose");
  sanitized = sanitized.replace(/\bbutton\b/gi, "step");
  sanitized = sanitized.replace(/\bdecision pending\b/gi, "next step pending");
  // Preserve newlines for markdown readability and table rendering.
  sanitized = sanitized.replace(/[ \t]{2,}/g, " ");
  sanitized = sanitized.replace(/[ \t]+\n/g, "\n");
  sanitized = sanitized.replace(/\n{3,}/g, "\n\n");

  return sanitized;
}

function ensureScopeQuestionsVisible(message: string, state: unknown): string {
  const parsed = parseChatState(state);
  if (!parsed.scope_clarification_pending || parsed.scope_questions.length === 0) {
    return message;
  }

  const hasQuestionList =
    /(^|\n)\s*[-*]\s*Q\d+\s*:/i.test(message) || /(^|\n)\s*Q\d+\s*:/i.test(message);
  if (hasQuestionList) {
    return message;
  }

  const questionLines = parsed.scope_questions
    .map((entry) => `- Q${entry.question_number}: ${entry.question}`)
    .join("\n");

  if (questionLines.trim().length === 0) {
    return message;
  }

  return ["Questions in scope:", questionLines, "", message].join("\n");
}

function isConversationOrchestratorEnabled(): boolean {
  const raw = (process.env.WEB_ENABLE_CONVERSATION_ORCHESTRATOR ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}



