import Fastify from "fastify";
import { z } from "zod";
import {
  appendConversationTurn,
  applyLlmDraftUpdates,
  ChatTurnRequestSchema,
  createWebApiClient,
  fetchCatalogContext,
  handleChatTurn,
  parseChatState,
  parseScheduleParams
} from "./chat";
import {
  buildDeterministicConversationTitle,
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
    fetch_impl: options.fetch_impl
  });
  const conversationClient =
    options.conversation_client ?? createConversationClientFromEnv({ fetch_impl: options.fetch_impl });
  const queryRouter =
    options.query_router ?? createQueryRouterClientFromEnv({ fetch_impl: options.fetch_impl });
  const authEnabled = isUiAuthEnabled();

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
      const result = conversationClient.nameConversation
        ? await conversationClient.nameConversation({
            first_user_messages: parsed.data.messages,
            catalog_summary: catalogCtx.catalog_summary,
            business_context: catalogCtx.business_context
          })
        : { title: buildDeterministicConversationTitle(parsed.data.messages) };

      return reply.code(200).send({
        title: result.title
      });
    } catch {
      return reply.code(200).send({
        title: buildDeterministicConversationTitle(parsed.data.messages)
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

    const state = parseChatState(parsed.data.state);

    try {
      const response = await handleChatTurn({
        message: parsed.data.message,
        state,
        api_client: apiClient,
        query_router: queryRouter
      });

      const bypassForCriticalAction =
        shouldBypassConversationForAction(response.assistant_message, response.state) &&
        (isUiControlMessage(parsed.data.message) ||
          isExecutionOutcomeContext(response.assistant_message) ||
          isDecisionPendingContext(response.assistant_message));
      const allowDeterministicBypass = conversationClient.mode !== "provider" || bypassForCriticalAction;
      if (
        allowDeterministicBypass &&
        shouldBypassConversationForAction(response.assistant_message, response.state)
      ) {
        const normalizedState = normalizeWorkflowDecisionState(response.state);
        const nextState = appendConversationTurn(normalizedState, parsed.data.message, response.assistant_message);
        return reply.code(200).send({
          ...response,
          state: nextState,
          assistant_message: response.assistant_message
        });
      }

      const catalogCtx = await fetchCatalogContext(apiClient);
      let conversationResponse: Awaited<ReturnType<ConversationClient["respond"]>>;
      try {
        conversationResponse = await conversationClient.respond({
          user_message: parsed.data.message,
          action_context: response.assistant_message,
          state: response.state,
          history: state.conversation_history,
          catalog_summary: catalogCtx.catalog_summary,
          business_context: catalogCtx.business_context
        });
      } catch (conversationError) {
        app.log.warn(
          {
            err: conversationError,
            path: "/api/chat"
          },
          "Conversation provider failed."
        );
        if (conversationClient.mode === "provider") {
          let providerFallbackMessage =
            "I hit a temporary AI connectivity issue while drafting that response. Please retry in a few seconds.";
          const runMatch = response.assistant_message.match(/Report executed\. Run ID:\s*([a-zA-Z0-9_-]+)/i);
          if (runMatch?.[1]) {
            providerFallbackMessage =
              `Report run completed (Run ID: ${runMatch[1]}), but I hit a temporary AI connectivity issue while drafting the narrative. Please retry in a few seconds.`;
          } else {
            const queryMatch = response.assistant_message.match(/Query (?:completed|failed)\. Query ID:\s*([a-zA-Z0-9_-]+)/i);
            if (queryMatch?.[1]) {
              providerFallbackMessage =
                `Query finished (Query ID: ${queryMatch[1]}), but I hit a temporary AI connectivity issue while drafting the explanation. Please retry in a few seconds.`;
            }
          }
          const normalizedState = normalizeWorkflowDecisionState(response.state);
          const nextState = appendConversationTurn(normalizedState, parsed.data.message, providerFallbackMessage);
          return reply.code(200).send({
            ...response,
            state: nextState,
            assistant_message: providerFallbackMessage
          });
        }
        const normalizedState = normalizeWorkflowDecisionState(response.state);
        const nextState = appendConversationTurn(normalizedState, parsed.data.message, response.assistant_message);
        return reply.code(200).send({
          ...response,
          state: nextState,
          assistant_message: response.assistant_message
        });
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

      // Detect <<<SCHEDULE_PARAMS>>> block from LLM response
      const scheduleParams = parseScheduleParams(safeAiMessage);
      if (scheduleParams) {
        safeAiMessage = safeAiMessage
          .replace(/<<<SCHEDULE_PARAMS>>>[\s\S]*?<<<END_SCHEDULE_PARAMS>>>/g, "")
          .trim();
        stateAfterLlm = { ...stateAfterLlm, schedule_pending: true, pending_schedule: scheduleParams };
      }

      const nextState = appendConversationTurn(stateAfterLlm, parsed.data.message, safeAiMessage);

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

      const safeMessage = buildSafeChatFailureMessage(error);
      app.log.error(
        {
          err: error,
          path: "/api/chat"
        },
        "Chat route failed; returning safe fallback message."
      );
      const nextState = appendConversationTurn(state, parsed.data.message, safeMessage);
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

  app.post("/api/db/validate", async (_request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/validate",
      body: {},
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

  app.get("/api/db/catalog", async (_request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/connections/catalog",
      reply
    });
  });

  app.post("/api/db/catalog/refresh", async (_request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/catalog/refresh",
      reply
    });
  });

  app.post("/api/db/catalogue", async (_request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/catalogue",
      reply
    });
  });

  app.post("/api/db/business-context", async (request, reply) => {
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/connections/business-context",
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

function isUiControlMessage(message: string): boolean {
  return /^__ui_[a-z0-9_]+__$/i.test(message.trim());
}

function isExecutionOutcomeContext(actionContext: string): boolean {
  return (
    /^Query completed\. Query ID:/i.test(actionContext) ||
    /^Query failed\. Query ID:/i.test(actionContext) ||
    /^Report executed\. Run ID:/i.test(actionContext) ||
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
    return [
      "I haven't executed a report run yet.",
      "The workflow is paused at a pending execution decision."
    ].join("\n");
  }

  if (!preparationExecuted && looksLikePreparationExecutionClaim(modelMessage)) {
    return actionContext;
  }

  return modelMessage;
}

function shouldBypassConversationForAction(actionContext: string, state: unknown): boolean {
  const parsedState = parseChatState(state);
  if (parsedState.pending_query_sql) {
    return true;
  }
  if (parsedState.pending_single_query_request) {
    return true;
  }
  if (parsedState.pending_metric_confirmations.length > 0) {
    return true;
  }

  if (
    parsedState.prep_pending ||
    parsedState.scope_pending ||
    parsedState.scope_clarification_pending ||
    parsedState.awaiting_post_run_refinement ||
    parsedState.refinement_active ||
    parsedState.awaiting_pdf_confirmation ||
    parsedState.awaiting_save_confirmation ||
    parsedState.awaiting_schedule_confirmation ||
    parsedState.awaiting_schedule_mode_selection ||
    parsedState.awaiting_custom_day_input
  ) {
    return true;
  }

  if (
    /^Query completed\. Query ID:/i.test(actionContext) ||
    /^Query failed\. Query ID:/i.test(actionContext) ||
    /^Report executed\. Run ID:/i.test(actionContext) ||
    /^Data preparation completed/i.test(actionContext) ||
    /^Ready to prepare data for:/i.test(actionContext) ||
    /^Before execution, (please confirm the metric definition|i need one quick metric-definition confirmation)/i.test(actionContext) ||
    /^Before data preparation, I need one clarification/i.test(actionContext) ||
    /^Prepared payloads:/i.test(actionContext) ||
    /^Before I run that query, I need one clarification:/i.test(actionContext) ||
    /^Contract saved\. ID:/i.test(actionContext)
  ) {
    return true;
  }

  return false;
}

function syncDecisionStateFromAssistantMessage(state: unknown, assistantMessage: string) {
  const nextState = parseChatState(state);

  if (
    nextState.pending_query_sql ||
    nextState.pending_single_query_request ||
    nextState.pending_metric_confirmations.length > 0 ||
    nextState.prep_pending ||
    nextState.scope_pending ||
    nextState.scope_clarification_pending ||
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
  const prepSignal = /\brun data preparation\b/.test(lower);
  const prepContext = /\b(scope|ready|locked|go ahead|choose|click|hit)\b/.test(lower);

  // Broader scope-confirmation phrases the LLM naturally uses
  const scopeConfirmedSignal =
    /\bscope is (locked|confirmed|set|ready|finalized)\b/.test(lower) ||
    /\b(locked in|all set|we'?re (all )?set|good to go)\b/.test(lower) ||
    /\b(scope confirmed|confirmed scope|scope.{0,10}locked)\b/.test(lower) ||
    /\bkick.{0,20}(analysis|preparation|things off)\b/.test(lower) ||
    /\bready to prepare data\b/.test(lower) ||
    /\bdraft is ready\b/.test(lower) ||
    /\brun data preparation\b/.test(lower);

  if ((prepSignal && prepContext) || scopeConfirmedSignal) {
    if (!nextState.prep_complete) {
      nextState.prep_pending = true;
      nextState.scope_pending = false;
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

  if (
    hasAnsweredScopeItems &&
    !parsed.scope_clarification_pending &&
    !parsed.prep_complete &&
    !parsed.prep_pending &&
    !parsed.scope_pending
  ) {
    parsed.prep_pending = true;
  }

  if (
    parsed.prep_complete &&
    parsed.prepared_payloads.length > 0 &&
    !parsed.scope_pending &&
    !parsed.prep_pending &&
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
  if (/```sql/.test(lower) && /\b(i['’]?m|i am|let me|running|executing|querying|pulling)\b/.test(lower)) {
    return true;
  }

  return (
    /\b(i['’]?m|i am|we['’]?re|we are)\s+(running|executing|querying|pulling)\b/i.test(message) ||
    /\b(i|we)\s+(ran|executed|queried|pulled)\b/i.test(message) ||
    /\bquery\s+is\s+running\b/i.test(message) ||
    /\b(as soon as|once)\s+[^.]{0,80}\b(query|results?)\b[^.]{0,80}\b(come back|completes?|finishes?|loads?)\b/i.test(message)
  );
}

function looksLikeReportExecutionClaim(message: string): boolean {
  return (
    /\b(i['’]?m|i am|we['’]?re|we are)\s+(running|executing)\s+(the\s+)?report\b/i.test(message) ||
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

function buildSafeChatFailureMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "Chat command failed";
  if (
    /fetch failed|network|socket|timed out|econn|enotfound|temporarily unavailable|unexpected token|not valid json|doctype|<html|non-json/i.test(
      rawMessage
    )
  ) {
    return [
      "That step did not return a completion signal yet.",
      "No data was changed. Please retry the same action once."
    ].join("\n");
  }

  return `I could not complete that action safely. ${rawMessage}`;
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
  sanitized = sanitized.replace(/\bthe system\b/gi, "the workflow");
  sanitized = sanitized.replace(/\bsystem\b/gi, "workflow");
  sanitized = sanitized.replace(/\bauto-?trigger(?:ed|ing)?\b/gi, "continued");
  sanitized = sanitized.replace(/\bRun Report\b/gi, "Finish scoping and run analysis");
  sanitized = sanitized.replace(/\b(?:click|tap|press|hit)\b/gi, "choose");

  return sanitized;
}
