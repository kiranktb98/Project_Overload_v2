import Fastify from "fastify";
import { z } from "zod";
import {
  appendConversationTurn,
  applyLlmDraftUpdates,
  ChatTurnRequestSchema,
  createWebApiClient,
  fetchCatalogContext,
  handleChatTurn,
  parseChatState
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
  const apiBaseUrl =
    options.api_base_url ?? process.env.WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";
  const apiClient = createWebApiClient({
    base_url: apiBaseUrl,
    fetch_impl: options.fetch_impl
  });
  const conversationClient =
    options.conversation_client ?? createConversationClientFromEnv({ fetch_impl: options.fetch_impl });
  const queryRouter =
    options.query_router ?? createQueryRouterClientFromEnv({ fetch_impl: options.fetch_impl });

  app.get("/health", async () => ({ status: "ok", service: "web" }));
  app.get("/api/chat/runtime", async () => ({
    provider: conversationClient.provider,
    mode: conversationClient.mode,
    query_router_provider: queryRouter.provider,
    query_router_mode: queryRouter.mode
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
        api_client: apiClient,
        query_router: queryRouter
      });

      if (shouldBypassConversationForAction(response.assistant_message, response.state)) {
        const nextState = appendConversationTurn(response.state, parsed.data.message, response.assistant_message);
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
          "Conversation provider failed; returning deterministic action context."
        );
        const nextState = appendConversationTurn(response.state, parsed.data.message, response.assistant_message);
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
      let stateAfterLlm = response.state;
      if (conversationResponse.draft_updates) {
        stateAfterLlm = applyLlmDraftUpdates(response.state, conversationResponse.draft_updates);
      }
      stateAfterLlm = syncDecisionStateFromAssistantMessage(stateAfterLlm, aiMessage);
      const nextState = appendConversationTurn(stateAfterLlm, parsed.data.message, aiMessage);

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

function enforceExecutionTruth(modelMessage: string, actionContext: string): string {
  const queryExecuted =
    /\bQuery ID:\s*[a-z0-9_-]+\b/i.test(actionContext) ||
    /\bQuery returned\s+\d+/i.test(actionContext);
  const reportExecuted = /\bReport executed\b/i.test(actionContext);

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

  if (
    parsedState.prep_pending ||
    parsedState.scope_pending ||
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
    nextState.prep_pending ||
    nextState.scope_pending ||
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
  const prepSignal = /\brun data preparation\b/.test(lower);
  const prepContext = /\b(scope|ready|locked|go ahead|choose|click|hit)\b/.test(lower);
  if (prepSignal && prepContext && !nextState.prep_complete) {
    nextState.prep_pending = true;
    nextState.scope_pending = false;
    return nextState;
  }

  const analysisSignal = /\bfinish scoping and run analysis\b/.test(lower);
  if (analysisSignal && nextState.prep_complete) {
    nextState.scope_pending = true;
    nextState.prep_pending = false;
  }

  return nextState;
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

async function proxyToApi(input: {
  fetch_impl?: typeof fetch;
  api_base_url: string;
  method: "GET" | "POST";
  path: string;
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } };
  body?: unknown;
}) {
  const fetcher = input.fetch_impl ?? fetch;

  let response: Response;
  try {
    response = await fetcher(`${input.api_base_url}${input.path}`, {
      method: input.method,
      headers: {
        "content-type": "application/json"
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body)
    });
  } catch {
    return input.reply.code(502).send({
      message: `Cannot reach API server at ${input.api_base_url}. Is the API running? (pnpm --filter api dev)`
    });
  }

  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : {};
  return input.reply.code(response.status).send(payload);
}
