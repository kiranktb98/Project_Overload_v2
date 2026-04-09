import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { z } from "zod";
import {
  appendConversationTurn,
  applyLlmDraftUpdates,
  buildDisplayClarificationPromptForScopeQuestion,
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
import { renderAdminLoggedOutPage, renderCustomerLoggedOutPage } from "./logout-page";
import { renderUsageMetricsPage } from "./usage-page";
import {
  renderHomePage,
  renderPitchPage,
  renderPricingPage,
  renderPrivacyPolicyPage,
  renderSignupPage,
  renderTermsOfServicePage
} from "./public-page";
import { renderGlobalConfigPage } from "./config-page";
import { renderScheduledReportsPage } from "./scheduled-page";
import { CLARITECT_FAVICON_SVG } from "./brand";
import { createZohoSheetClient } from "./zoho-sheet";
import {
  renderAdminAccountsPage,
  renderAdminDashboardPage,
  renderAdminFinancePage,
  renderAdminLoginPage,
  renderAdminSupportPage
} from "./admin-page";
import { HELP_WIDGET_STYLES, renderHelpWidget } from "./help-widget";

const DB_CONNECTION_GUIDE_HTML = readFileSync(
  new URL("../../../docs/DB_CONNECTION_GUIDE.html", import.meta.url),
  "utf8"
);
const SSL_TLS_GUIDE_HTML = readFileSync(
  new URL("../../../docs/SSL_TLS_GUIDE.html", import.meta.url),
  "utf8"
);
const AI_DISCOVERABILITY_PLAN_HTML = readFileSync(
  new URL("../../../docs/AI_DISCOVERABILITY_PLAN.html", import.meta.url),
  "utf8"
);
const CLARITECT_LOGO_SVG = readFileSync(
  new URL("./assets/claritect-logo.svg", import.meta.url),
  "utf8"
);
const ROBOTS_TXT = readFileSync(
  new URL("../public/robots.txt", import.meta.url),
  "utf8"
);
const SITEMAP_XML = readFileSync(
  new URL("../public/sitemap.xml", import.meta.url),
  "utf8"
);
const LLMS_TXT = readFileSync(
  new URL("../public/llms.txt", import.meta.url),
  "utf8"
);
const AI_PLUGIN_JSON = readFileSync(
  new URL("../public/.well-known/ai-plugin.json", import.meta.url),
  "utf8"
);
const AI_PLUGIN_OPENAPI = readFileSync(
  new URL("../public/.well-known/openapi.yaml", import.meta.url),
  "utf8"
);

export type WebAppDependencies = {
  api_base_url?: string;
  fetch_impl?: typeof fetch;
  conversation_client?: ConversationClient;
  query_router?: QueryRouterClient;
};

class ChatStageError extends Error {
  readonly stage: string;

  constructor(stage: string, cause: unknown) {
    void cause;
    super(`Something went wrong while processing your message — please try again in a moment.`);
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
  const contentSecurityPolicy = [
    "default-src 'self' https:",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "script-src 'self' 'unsafe-inline' https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "block-all-mixed-content"
  ].join("; ");
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
  const zohoSheetClient = createZohoSheetClient({ fetch_impl: options.fetch_impl });
  const authEnabled = isUiAuthEnabled();
  const orchestratorEnabled = isConversationOrchestratorEnabled();

  // Allow HTML form POSTs (e.g. logout buttons) without body parsing
  app.addContentTypeParser("application/x-www-form-urlencoded", (_request, _payload, done) => {
    done(null, {});
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Content-Security-Policy", contentSecurityPolicy);
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "SAMEORIGIN");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    return payload;
  });

  // Thread user identity into AsyncLocalStorage so apiClient headers resolve per-user
  app.addHook("preHandler", async (request) => {
    const pathname = request.url.split("?")[0];
    const username = getRequestUsername(request.headers.cookie, pathname);
    if (username) {
      webUserContext.enterWith({ username });
    }
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!authEnabled) {
      return;
    }

    const pathname = request.url.split("?")[0];
    if (isPublicPath(pathname)) {
      return;
    }

    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin/")) {
      if (isAdminAuthenticatedRequest(request.headers.cookie)) {
        return;
      }
      if (pathname.startsWith("/api/")) {
        return reply.code(401).send({ message: "Unauthorized" });
      }
      return reply.redirect("/admin/login");
    }

    if (isCustomerAuthenticatedRequest(request.headers.cookie)) {
      return;
    }

    if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    return reply.redirect("/login");
  });

  app.get("/login", async (request, reply) => {
    if (authEnabled && isCustomerAuthenticatedRequest(request.headers.cookie)) {
      return reply.redirect("/app");
    }
    if (authEnabled && isAdminAuthenticatedRequest(request.headers.cookie)) {
      return reply.redirect("/admin");
    }
    return reply.type("text/html; charset=utf-8").send(renderLoginPage());
  });

  app.get("/admin/login", async (request, reply) => {
    if (authEnabled && isAdminAuthenticatedRequest(request.headers.cookie)) {
      return reply.redirect("/admin");
    }
    return reply.type("text/html; charset=utf-8").send(renderAdminLoginPage());
  });

  app.get("/logout", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderCustomerLoggedOutPage());
  });

  app.get("/admin/logout", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderAdminLoggedOutPage());
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

  app.post("/admin/auth/login", async (request, reply) => {
    if (!authEnabled) {
      return reply.code(200).send({ ok: true, bypassed: true });
    }

    const parsed = LoginPayloadSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid login payload" });
    }

    const username = parsed.data.username.trim();
    const password = parsed.data.password;

    let loginResponse: Response;
    try {
      loginResponse = await (options.fetch_impl ?? fetch)(`${apiBaseUrl}/ui/auth/admin/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildApiAuthHeader()
        },
        body: JSON.stringify({ username, password })
      });
    } catch {
      return reply.code(502).send({ message: `Cannot reach API server at ${apiBaseUrl}.` });
    }

    if (!loginResponse.ok) {
      return reply.code(401).send({ message: "Invalid admin credentials" });
    }

    reply.header("set-cookie", [
      "claritect_admin_auth=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800",
      `claritect_admin_user=${encodeURIComponent(username)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
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
    return reply.redirect("/logout");
  });

  app.post("/admin/auth/logout", async (_request, reply) => {
    if (authEnabled) {
      reply.header("set-cookie", [
        "claritect_admin_auth=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        "claritect_admin_user=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
      ]);
    }
    return reply.redirect("/admin/logout");
  });

  app.get("/health", async () => ({ status: "ok", service: "web" }));

  app.get("/assets/claritect-logo.svg", async (_request, reply) => {
    return reply.type("image/svg+xml; charset=utf-8").send(CLARITECT_LOGO_SVG);
  });
  app.get("/favicon.svg", async (_request, reply) => {
    return reply.type("image/svg+xml; charset=utf-8").send(CLARITECT_FAVICON_SVG);
  });
  app.get("/favicon.ico", async (_request, reply) => reply.redirect("/favicon.svg"));
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

  app.get("/", async (request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderHomePage());
  });

  app.get("/pitch.html", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderPitchPage());
  });

  app.get("/pricing", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderPricingPage());
  });

  app.get("/privacy-policy", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderPrivacyPolicyPage());
  });

  app.get("/privacy-policy.html", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderPrivacyPolicyPage());
  });

  app.get("/terms-of-service", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderTermsOfServicePage());
  });

  app.get("/terms-of-service.html", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderTermsOfServicePage());
  });

  app.get("/blog", async (_request, reply) => {
    return reply.redirect("/");
  });

  app.get("/blog.html", async (_request, reply) => {
    return reply.redirect("/");
  });

  app.get("/robots.txt", async (_request, reply) => {
    return reply.type("text/plain; charset=utf-8").send(ROBOTS_TXT);
  });

  app.get("/sitemap.xml", async (_request, reply) => {
    return reply.type("application/xml; charset=utf-8").send(SITEMAP_XML);
  });

  app.get("/llms.txt", async (_request, reply) => {
    return reply.type("text/plain; charset=utf-8").send(LLMS_TXT);
  });

  app.get("/.well-known/ai-plugin.json", async (_request, reply) => {
    return reply.type("application/json; charset=utf-8").send(AI_PLUGIN_JSON);
  });

  app.get("/.well-known/openapi.yaml", async (_request, reply) => {
    return reply.type("application/yaml; charset=utf-8").send(AI_PLUGIN_OPENAPI);
  });

  app.get("/signup", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderSignupPage());
  });

  const EarlyAccessRequestSchema = z.object({
    source: z.enum(["home", "signup"]).default("home"),
    email: z.string().trim().email().max(320),
    name: z.string().trim().max(120).optional(),
    company: z.string().trim().max(120).optional(),
    referrer: z.string().trim().max(2048).optional()
  });

  app.post("/api/public/early-access", async (request, reply) => {
    const parsed = EarlyAccessRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        message: "Please enter a valid work email."
      });
    }

    if (!zohoSheetClient.is_configured) {
      request.log.warn("Early-access submission skipped because Zoho Sheet is not configured.");
      return reply.code(503).send({
        ok: false,
        message: "Early-access capture is not configured yet. Please email hello@claritect.io."
      });
    }

    try {
      await zohoSheetClient.appendEarlyAccessLead({
        source: parsed.data.source,
        email: parsed.data.email,
        name: normalizeOptionalFormText(parsed.data.name),
        company: normalizeOptionalFormText(parsed.data.company),
        referrer: normalizeOptionalFormText(parsed.data.referrer),
        user_agent: getHeaderValue(request.headers["user-agent"]),
        submitted_at: new Date().toISOString()
      });

      return reply.code(200).send({
        ok: true,
        message: "Thanks. We have your early-access request and will reach out soon."
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Failed to append early-access lead to Zoho Sheet."
      );
      return reply.code(502).send({
        ok: false,
        message: "We could not save your request right now. Please try again or email hello@claritect.io."
      });
    }
  });

  app.get("/connect/guide", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(DB_CONNECTION_GUIDE_HTML);
  });

  app.get("/connect/tls-guide", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(SSL_TLS_GUIDE_HTML);
  });

  app.get("/internal/ai-plan", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(AI_DISCOVERABILITY_PLAN_HTML);
  });

  // ── Help chat ──────────────────────────────────────────────────────────────
  const HELP_SYSTEM_PROMPT = `You are the Claritect in-app assistant. Help users with the screen they are currently on.

Claritect lets teams connect a database, allowlist tables, ask natural-language questions, and generate read-only analyses or reports.

Core facts:
- Data Sources: pick provider, enter credentials, test connection, choose allowlisted tables, activate.
- Governance: only allowlisted tables can be queried. Claritect is SELECT-only and must not modify customer data.
- Chat Explorer: users ask questions, Claritect scopes the request, prepares data, then runs analysis.
- Usage & AI: shows activity, report runs, failures, AI usage, and balance.
- Scheduled Reports: recurring reports use saved cadence, local time, and timezone.
- Global Config: tenant-level settings and defaults.
- SSL/TLS: Auto is best for most cloud databases; Require is strict production TLS; Off is local/dev only.

Response rules:
- Keep replies short: 1-3 sentences or at most 3 bullets.
- Answer the exact question first.
- Use the provided current screen context. Do not give generic onboarding steps unless relevant.
- Do not use markdown headings unless the user asks for a checklist.
- Only answer questions about how to use Claritect or how to raise a support ticket.
- Do not disclose backend architecture, infrastructure, codebase, vendors, model providers, APIs, API keys, deployment details, databases, repositories, environment variables, or internal tools.
- If asked about internal implementation, refuse briefly and redirect to product usage or support.
- Never make up features. If unsure, point to /connect/guide or ask the user to contact hello@claritect.io.`;

  const HelpChatSchema = z.object({
    message: z.string().trim().min(1).max(2000),
    session_id: z.string().trim().min(1).max(128).optional(),
    screen_context: z.object({
      path: z.string().trim().max(128).optional(),
      title: z.string().trim().max(200).optional(),
      screen: z.string().trim().max(80).optional()
    }).optional(),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(4000)
    })).max(16).default([])
  });

  app.post("/api/help/chat", async (request, reply) => {
    const parsed = HelpChatSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ reply: "Invalid request." });
    }
    const body = parsed.data;
    if (isHelpInternalDetailsQuestion(body.message)) {
      return {
        reply: HELP_SCOPE_REPLY,
        session_id: body.session_id ?? randomUUID()
      };
    }
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return {
        reply: buildHelpFallbackReply(body.message, body.screen_context),
        session_id: body.session_id ?? randomUUID()
      };
    }

    try {
      const screenContext = formatHelpScreenContext(body.screen_context);
      const messages = [
        { role: "system", content: HELP_SYSTEM_PROMPT },
        { role: "system", content: screenContext },
        ...body.history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: body.message }
      ];

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "https://claritect.app",
          "X-Title": process.env.OPENROUTER_APP_NAME ?? "Claritect"
        },
        body: JSON.stringify({
          model: "anthropic/claude-haiku-4.5",
          messages,
          max_tokens: 240,
          temperature: 0.25
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        request.log.warn({ statusCode: response.status }, "help-chat provider failed; using fallback reply");
        return {
          reply: buildHelpFallbackReply(body.message, body.screen_context),
          session_id: body.session_id ?? randomUUID()
        };
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const rawText = data.choices?.[0]?.message?.content?.trim() ?? "Sorry, I didn't get a response. Try rephrasing your question.";
      const text = containsHelpInternalDetails(rawText) ? HELP_SCOPE_REPLY : rawText;

      // Persist conversation to DB — fire and forget, don't block the response
      const updatedMessages = [
        ...body.history,
        { role: "user" as const, content: body.message },
        { role: "assistant" as const, content: text }
      ];
      const username = getCustomerUsername(request.headers.cookie) ?? "unknown";
      const sessionId = body.session_id ?? randomUUID();
      void fetch(`${apiBaseUrl}/help-chat/sessions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildApiAuthHeader()
        },
        body: JSON.stringify({
          session_id: sessionId,
          username,
          messages: updatedMessages
        })
      }).catch(() => { /* non-critical */ });

      return { reply: text, session_id: sessionId };
    } catch (err) {
      request.log.error({ err }, "help-chat error");
      return {
        reply: buildHelpFallbackReply(body.message, body.screen_context),
        session_id: body.session_id ?? randomUUID()
      };
    }
  });

  function withHelpWidget(html: string): string {
    const widget = `<style>${HELP_WIDGET_STYLES}</style>${renderHelpWidget()}`;
    return html.replace("</body>", `${widget}</body>`);
  }

  app.get("/connect", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(withHelpWidget(renderConnectionPage()));
  });

  app.get("/usage", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(withHelpWidget(renderUsageMetricsPage()));
  });

  app.get("/config", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(withHelpWidget(renderGlobalConfigPage()));
  });

  app.get("/scheduled", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(withHelpWidget(renderScheduledReportsPage()));
  });

  app.get("/app", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(withHelpWidget(renderChatPage()));
  });

  app.get("/admin", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderAdminDashboardPage());
  });

  app.get("/admin/accounts", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderAdminAccountsPage());
  });

  app.get("/admin/support", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderAdminSupportPage());
  });

  app.get("/admin/finance", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderAdminFinancePage());
  });

  app.get("/admin/customers", async (_request, reply) => reply.redirect("/admin/accounts"));
  app.get("/admin/users", async (_request, reply) => reply.redirect("/admin/accounts"));
  app.get("/admin/connections", async (_request, reply) => reply.redirect("/admin/accounts"));
  app.get("/admin/reports", async (_request, reply) => reply.redirect("/admin/accounts"));
  app.get("/admin/schedules", async (_request, reply) => reply.redirect("/admin/accounts"));
  app.get("/admin/billing", async (_request, reply) => reply.redirect("/admin/finance"));

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
    let failureStateSnapshot = hydratedState;
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
      const normalizedResponseState = normalizeWorkflowDecisionState(response.state);
      failureStateSnapshot = normalizedResponseState;

      if (shouldBypassConversationalRewrite(normalizedResponseState, response.assistant_message)) {
        const nextState = appendConversationTurn(
          normalizedResponseState,
          parsed.data.message,
          response.assistant_message
        );
        failureStateSnapshot = nextState;
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
                text: response.assistant_message
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
          assistant_message: response.assistant_message
        });
      }

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
          state: normalizedResponseState,
          history: hydratedState.conversation_history,
          catalog_summary: catalogCtx.catalog_summary,
          business_context: businessContext,
          retrieved_context: ragMemory
        });
      } catch (conversationError) {
        if (isStrictLlmRenderedOutputEnabled()) {
          failureStateSnapshot = normalizedResponseState;
          throw new ChatStageError("conversation_response", conversationError);
        }
        const parsedResponseState = parseChatState(normalizedResponseState);
        const hasAuthoritativeExecutionOutcome =
          isExecutionOutcomeContext(response.assistant_message) ||
          shouldBypassConversationalRewrite(normalizedResponseState, response.assistant_message) ||
          isDecisionPendingContext(response.assistant_message) ||
          Boolean(parsedResponseState.pending_run_id);

        if (hasAuthoritativeExecutionOutcome) {
          const nextState = appendConversationTurn(
            normalizedResponseState,
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

      const aiMessage = isStrictLlmRenderedOutputEnabled()
        ? conversationResponse.message
        : enforceExecutionTruth(
            conversationResponse.message,
            response.assistant_message
          );
      let safeAiMessage = isStrictLlmRenderedOutputEnabled()
        ? conversationResponse.message
        : sanitizeCustomerFacingAssistantMessage(aiMessage);
      let stateAfterLlm = normalizedResponseState;
      if (conversationResponse.draft_updates) {
        stateAfterLlm = applyLlmDraftUpdates(normalizedResponseState, conversationResponse.draft_updates, {
          preserve_prepared_state: hasPendingWorkflowDecision(normalizedResponseState)
        });
      }
      stateAfterLlm = syncDecisionStateFromAssistantMessage(stateAfterLlm, aiMessage);
      stateAfterLlm = normalizeWorkflowDecisionState(stateAfterLlm);
      if (shouldUseAuthoritativeScopeActionContext(safeAiMessage, response.assistant_message, stateAfterLlm)) {
        safeAiMessage = response.assistant_message;
      }
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
      failureStateSnapshot = nextState;
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
          : `Something went wrong while processing your message — please try again in a moment.`;
      app.log.error(
        {
          err: error,
          path: "/api/chat"
        },
        "Chat route failed; returning explicit stage failure."
      );
      const nextState = appendConversationTurn(
        normalizeWorkflowDecisionState(failureStateSnapshot),
        parsed.data.message,
        safeMessage
      );
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

  app.get("/api/runs/:runId/html", async (request, reply) => {
    const { runId } = request.params as { runId: string };

    try {
      const response = await apiClient.downloadRunHtml(runId);
      const html = await response.text();

      return reply
        .code(200)
        .header("content-type", response.headers.get("content-type") ?? "text/html; charset=utf-8")
        .send(html);
    } catch (error) {
      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Unable to fetch HTML report"
      });
    }
  });

  app.get("/api/runs/:runId/schedule-draft", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    const { runId } = request.params as { runId: string };
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: `/report-runs/${encodeURIComponent(runId)}/schedule-draft`,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/runs/:runId/schedule-profile", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    const { runId } = request.params as { runId: string };
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: `/report-runs/${encodeURIComponent(runId)}/schedule-profile`,
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/scheduled-reports", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/scheduled-reports",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/scheduled-reports/:contractId", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    const { contractId } = request.params as { contractId: string };
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: `/scheduled-reports/${encodeURIComponent(contractId)}`,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/scheduled-reports/:contractId/status", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    const { contractId } = request.params as { contractId: string };
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: `/scheduled-reports/${encodeURIComponent(contractId)}/status`,
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
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

  app.get("/api/usage/summary", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/usage/summary",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/usage/activity", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/usage/activity",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/usage/ai", async (request, reply) => {
    const username = getAuthenticatedUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/usage/ai",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/overview", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/admin/overview",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/accounts", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/admin/accounts",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/accounts/:tenantId", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    const tenantId = encodeURIComponent(String((request.params as { tenantId?: string } | undefined)?.tenantId ?? ""));
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: `/admin/accounts/${tenantId}`,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/support", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/admin/support",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/admin/support", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: "/admin/support",
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.post("/api/admin/support/:ticketId/status", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    const ticketId = encodeURIComponent(String((request.params as { ticketId?: string } | undefined)?.ticketId ?? ""));
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "POST",
      path: `/admin/support/${ticketId}/status`,
      body: request.body,
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/finance", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/admin/finance",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/customers", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/admin/customers",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/users", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/admin/users",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/connections", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/admin/connections",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/reports", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/admin/reports",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/schedules", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/admin/schedules",
      additional_headers: username ? { "x-ui-user": username } : undefined,
      reply
    });
  });

  app.get("/api/admin/billing", async (request, reply) => {
    const username = getAdminUsername(request.headers.cookie);
    return proxyToApi({
      fetch_impl: options.fetch_impl,
      api_base_url: apiBaseUrl,
      method: "GET",
      path: "/admin/billing",
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
    /^Scope is locked for\b/i.test(actionContext) ||
    /^Scope clarifications captured for all questions\./i.test(actionContext) ||
    /^Need clarification for \d+\s+(?:scope\s+)?item(?:s)?\b/i.test(actionContext) ||
    /^Still need clarification on \d+\s+item(?:s)?\b/i.test(actionContext) ||
    /^Before data preparation,/i.test(actionContext) ||
    /^Data preparation decision pending/i.test(actionContext) ||
    /^Analysis decision pending/i.test(actionContext) ||
    /^SQL decision pending/i.test(actionContext)
  );
}

function shouldBypassConversationalRewrite(state: unknown, actionContext: string): boolean {
  const parsed = parseChatState(state);
  return (
    parsed.report_clarification_active === true ||
    parsed.business_case_active === true ||
    /^Report clarification mode is on\./i.test(actionContext) ||
    /^Select a recommendation for business case analysis/i.test(actionContext) ||
    /^No business case candidates are loaded for this run yet\./i.test(actionContext)
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
    (/^Ready to prepare data for:/i.test(actionContext) || /^Scope is locked for\b/i.test(actionContext)) &&
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

function hasPreparationBlockedCue(message: string): boolean {
  return /\bno data to analyze\b|\bthere'?s no data\b|\bappears to be empty\b|\bno tables are scoped\b|\bcannot run yet\b|\bcheck that data is being loaded\b|\bdoes not exist\b|\bnot accessible\b/i.test(
    message
  );
}

function syncDecisionStateFromAssistantMessage(state: unknown, assistantMessage: string) {
  const nextState = parseChatState(state);
  pruneResolvedScopePendingInputs(nextState);
  const lowerMessage = assistantMessage.toLowerCase();

  const hasAnsweredScope =
    nextState.scope_questions.length > 0 &&
    nextState.scope_questions.every(
      (q: { answer?: string | null }) => q.answer && q.answer.trim().length > 0
    );

  const scopeLockSignal =
    /\ball\s+\w+\s+questions?\s+(?:are|is)\s+(?:fully\s+)?confirmed\b/.test(
      lowerMessage
    ) ||
    /\bscope is locked\b/.test(lowerMessage);

  const hasInputRequestCue =
    /\b(let me know|please confirm|confirm (?:the|which|whether)|should (?:we|i)|would you|do you want|reply with|still pending|need clarification|clarification needed|i still need|does that work|works for you|any tweaks)\b/.test(
      lowerMessage
    );

  const shouldAllowScopeLockSync =
    scopeLockSignal &&
    !hasInputRequestCue;

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

  const lower = lowerMessage;

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
    hasInputRequestCue;

  const explicitScopeLockSignal =
    scopeLockSignal &&
    !isAskingQuestions &&
    nextState.scope_questions.length > 0;
  const hasPrepBlockerCue = hasPreparationBlockedCue(assistantMessage);
  const hasUnansweredScopeItems = nextState.scope_questions.some(
    (entry: { answer?: string | null }) => !entry.answer || entry.answer.trim().length === 0
  );

  if (prepSignal) {
    if (
      !nextState.prep_complete &&
      !isAskingQuestions &&
      !hasPrepBlockerCue &&
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
      parsed.post_run_actions_pending ||
      parsed.report_clarification_active ||
      parsed.business_case_active ||
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
  pruneResolvedScopePendingInputs(parsed);

  const hasAnsweredScopeItems =
    parsed.scope_questions.length > 0 &&
    parsed.scope_questions.every((entry) => Boolean(entry.answer && entry.answer.trim().length > 0));
  const hasScopeReadyContext = hasScopeReadyContextInHistory(parsed);
  const hasUnansweredScopeItems = parsed.scope_questions.some(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  );
  const hasPendingScopeInputs = Array.isArray(parsed.pending_inputs) && parsed.pending_inputs.length > 0;
  const hasBlockingDecision =
    Boolean(parsed.pending_query_sql) ||
    parsed.pending_single_query_request !== null ||
    parsed.pending_metric_confirmations.length > 0 ||
    hasPendingScopeInputs ||
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
      ? hasAnsweredScopeItems && !hasUnansweredScopeItems && !hasPendingScopeInputs
      : hasScopeReadyContext;

  if (
    canPromoteToPrep &&
    (hasScopeReadyContext || parsed.scope_finalized) &&
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

function pruneResolvedScopePendingInputs(
  state: ReturnType<typeof parseChatState>
): ReturnType<typeof parseChatState> {
  if (!Array.isArray(state.pending_inputs) || state.pending_inputs.length === 0) {
    return state;
  }

  state.pending_inputs = state.pending_inputs.filter((entry) => {
    if (typeof entry.question_number !== "number") {
      return true;
    }
    const target = state.scope_questions.find((question) => question.question_number === entry.question_number);
    if (!target) {
      return true;
    }
    return !target.answer || target.answer.trim().length === 0;
  });

  return state;
}

function hasScopeReadyContextInHistory(state: ReturnType<typeof parseChatState>): boolean {
  const lastAssistant = [...state.conversation_history]
    .reverse()
    .find((turn) => turn.role === "assistant");
  if (!lastAssistant) {
    return false;
  }

  const text = lastAssistant.content.toLowerCase();
  if (hasPreparationBlockedCue(text)) {
    return false;
  }
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

function isPublicPath(pathname: string): boolean {
  return pathname === "/" ||
    pathname === "/pitch.html" ||
    pathname === "/pricing" ||
    pathname === "/privacy-policy" ||
    pathname === "/privacy-policy.html" ||
    pathname === "/terms-of-service" ||
    pathname === "/terms-of-service.html" ||
    pathname === "/blog" ||
    pathname === "/blog.html" ||
    pathname === "/signup" ||
    pathname === "/api/public/early-access" ||
    pathname === "/health" ||
    pathname === "/login" ||
    pathname === "/logout" ||
      pathname === "/auth/login" ||
      pathname === "/admin/login" ||
      pathname === "/admin/logout" ||
      pathname === "/admin/auth/login" ||
      pathname === "/favicon.svg" ||
      pathname === "/favicon.ico" ||
      pathname === "/assets/claritect-logo.svg" ||
      pathname === "/connect/guide" ||
    pathname === "/connect/tls-guide" ||
    pathname === "/internal/ai-plan" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/llms.txt" ||
    pathname === "/.well-known/ai-plugin.json" ||
    pathname === "/.well-known/openapi.yaml";
}

function normalizeOptionalFormText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return normalizeOptionalFormText(value[0]);
  }
  return normalizeOptionalFormText(value);
}

function formatHelpScreenContext(screenContext: { path?: string; title?: string; screen?: string } | undefined): string {
  const screen = normalizeOptionalFormText(screenContext?.screen) ?? "Unknown screen";
  const path = normalizeOptionalFormText(screenContext?.path) ?? "unknown path";
  const title = normalizeOptionalFormText(screenContext?.title);
  const titleLine = title ? `\nBrowser title: ${title}` : "";
  return `Current user screen: ${screen}\nCurrent path: ${path}${titleLine}\nUse this screen context to answer narrowly and avoid generic product tours.`;
}

const HELP_SCOPE_REPLY = "I can only help with using Claritect or raising a support ticket. For support, send the issue, screenshot, and page URL to hello@claritect.io.";

function isHelpInternalDetailsQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  const asksImplementation =
    /\b(backend|infra|infrastructure|architecture|stack|codebase|repo|repository|source code|deployment|hosting|server|database|db|env|environment variable|secret|api key|token|provider|vendor|model|llm|ai model|which ai|what ai|openrouter|openai|anthropic|claude|railway|neon|fastify|node|typescript)\b/.test(lower) ||
    /\b(which|what|where|how)\b.*\b(api|apis|app|apps|tool|tools|service|services|model|models|ai|llm|backend|database|hosting|deployment)\b/.test(lower);

  const clearlyProductUsage =
    /\b(how do i|how to|where do i|connect|query|report|schedule|usage|balance|credits|ticket|support|login|logout|open|download|data source|allowlist|ssl|tls)\b/.test(lower) &&
    !/\b(which|what)\b.*\b(api|apis|app|apps|tool|tools|model|models|ai|llm|backend|hosting|deployment)\b/.test(lower);

  return asksImplementation && !clearlyProductUsage;
}

function containsHelpInternalDetails(message: string): boolean {
  return /\b(openrouter|openai|anthropic|claude|railway|neon|fastify|api key|environment variable|source code|repository|typescript|node\.?js)\b/i.test(message);
}

function buildHelpFallbackReply(message: string, screenContext: { path?: string; title?: string; screen?: string } | undefined): string {
  const lower = message.toLowerCase();
  const screen = normalizeOptionalFormText(screenContext?.screen)?.toLowerCase() ?? "";
  const path = normalizeOptionalFormText(screenContext?.path)?.toLowerCase() ?? "";
  const onChatExplorer = screen.includes("chat") || path === "/app";

  if (onChatExplorer && /\b(open|view|see|finished|completed|html|report|new tab)\b/.test(lower)) {
    return "When the run finishes, use Open report in new tab below the assistant response. If you only see Download PDF, generate the PDF first and the HTML report link will appear beside it.";
  }

  if (/\b(connect|database|db|credentials|tables|allowlist)\b/.test(lower)) {
    return "Go to Data Sources, enter the database details, test the connection, then select the tables Claritect is allowed to read.";
  }

  if (/\b(schedule|scheduled|recurring|cadence)\b/.test(lower)) {
    return "Open Scheduled Reports, choose the saved report, set cadence plus timezone, then review the next-run summary before saving.";
  }

  if (/\b(usage|credits|balance|openrouter|tokens)\b/.test(lower)) {
    return "Open Usage & AI to see query activity, report runs, AI usage, and the latest available AI balance.";
  }

  if (onChatExplorer) {
    return "In Chat Explorer, ask one clear business question first. Claritect will scope it, prepare data, then show the run/report actions when analysis is ready.";
  }

  return "I can help with this screen. Ask what you want to do next, and I will keep it short.";
}

function isCustomerAuthenticatedRequest(cookieHeader: string | undefined): boolean {
  return getCookieValue(cookieHeader, "po_demo_auth") === "1" && getCustomerUsername(cookieHeader) !== null;
}

function isAdminAuthenticatedRequest(cookieHeader: string | undefined): boolean {
  return getCookieValue(cookieHeader, "claritect_admin_auth") === "1" && getAdminUsername(cookieHeader) !== null;
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

function getRequestUsername(cookieHeader: string | undefined, pathname: string): string | null {
  if (pathname.startsWith("/admin")) {
    return getAdminUsername(cookieHeader);
  }
  return getCustomerUsername(cookieHeader);
}

function getAuthenticatedUsername(cookieHeader: string | undefined): string | null {
  return getCustomerUsername(cookieHeader);
}

function getCustomerUsername(cookieHeader: string | undefined): string | null {
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

function getAdminUsername(cookieHeader: string | undefined): string | null {
  const raw = getCookieValue(cookieHeader, "claritect_admin_user");
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
  if (parsed.scope_questions.length === 0) {
    return message;
  }

  const inScopeFlow = parsed.scope_clarification_pending || parsed.scope_finalized;
  if (!inScopeFlow) {
    return message;
  }

  const hasMergedScopeLine = /\bQ\d+\s*(?:\+|\/|&)\s*Q\d+\b/i.test(message);

  const hasQuestionList =
    /(^|\n)\s*[-*]\s*Q\d+\s*:/i.test(message) || /(^|\n)\s*Q\d+\s*:/i.test(message);

  const messageQuestionNumbers = new Set<number>();
  const qNumberPattern = /\bQ(\d+)\b/gi;
  let qMatch: RegExpExecArray | null = qNumberPattern.exec(message);
  while (qMatch) {
    const parsedNumber = Number.parseInt(qMatch[1] ?? "", 10);
    if (Number.isFinite(parsedNumber) && parsedNumber > 0) {
      messageQuestionNumbers.add(parsedNumber);
    }
    qMatch = qNumberPattern.exec(message);
  }

  const includeSuggestionsInCanonicalList = !parsed.scope_finalized;
  const visibleQuestionNumbers = new Set([
    ...parsed.scope_questions.map((entry) => entry.question_number),
    ...(
      includeSuggestionsInCanonicalList
        ? parsed.scope_suggestions.map((entry) =>
            getScopeSuggestionDisplayQuestionNumberForRender(
              parsed.scope_questions.length,
              entry.suggestion_number
            )
          )
        : []
    )
  ]);
  const hasAllVisibleQuestionNumbers =
    visibleQuestionNumbers.size > 0 &&
    Array.from(visibleQuestionNumbers.values()).every((questionNumber) =>
      messageQuestionNumbers.has(questionNumber)
    );
  const hasOnlyVisibleQuestionNumbers =
    hasAllVisibleQuestionNumbers &&
    messageQuestionNumbers.size === visibleQuestionNumbers.size;

  if (hasQuestionList && hasOnlyVisibleQuestionNumbers && !hasMergedScopeLine) {
    return message;
  }

  const questionLines = [
    ...parsed.scope_questions.map((entry) => `- Q${entry.question_number}: ${entry.question}`),
    ...(
      includeSuggestionsInCanonicalList
        ? parsed.scope_suggestions.map(
            (entry) =>
              `- ${getScopeSuggestionDisplayLabelForRender(parsed.scope_questions.length, entry.suggestion_number)}: ${entry.question}`
          )
        : []
    )
  ].join("\n");
  const pendingClarifications = parsed.scope_questions.filter(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  );
  const shouldShowPendingClarifications =
    parsed.scope_clarification_pending &&
    pendingClarifications.length > 0 &&
    !/clarification needed:/i.test(message);
  const pendingClarificationLines = shouldShowPendingClarifications
    ? pendingClarifications
        .map((entry) => {
          const clarificationText = buildDisplayClarificationPromptForScopeQuestion(
            parsed,
            entry
          );
          return `- Q${entry.question_number}: ${clarificationText}`;
        })
        .join("\n")
    : null;

  if (questionLines.trim().length === 0) {
    return message;
  }

  // Keep model-authored narrative intact below the canonical scoped-question list.
  // Merged labels like Q4+Q5 are allowed in clarification narrative, but never as the
  // canonical planned-question list at the top (which is always one row per Qn).
  const validRenderedQuestionNumbers = visibleQuestionNumbers;

  const sanitizedMessage = normalizeSuggestionLabelsInNarrative(
    sanitizeMergedScopeLabelsInNarrative(
      stripOutOfScopeQuestionBlocks(
        message,
        validRenderedQuestionNumbers
      )
    ),
    parsed
  );

  const questionHeader = "Questions in scope:";
  return [
    questionHeader,
    questionLines,
    pendingClarificationLines ? "\nClarifications to confirm:" : null,
    pendingClarificationLines,
    "",
    sanitizedMessage
  ]
    .filter((line): line is string => typeof line === "string" && line.length > 0)
    .join("\n");
}

function sanitizeMergedScopeLabelsInNarrative(message: string): string {
  return message.replace(/\bQ(\d+)\s*(?:\+|\/|&)\s*Q(\d+)\b/gi, "Q$1 and Q$2");
}

function getScopeSuggestionDisplayQuestionNumberForRender(
  scopeQuestionCount: number,
  suggestionNumber: number
): number {
  return scopeQuestionCount + suggestionNumber;
}

function getScopeSuggestionDisplayLabelForRender(
  scopeQuestionCount: number,
  suggestionNumber: number
): string {
  return `Q${getScopeSuggestionDisplayQuestionNumberForRender(scopeQuestionCount, suggestionNumber)} (suggested)`;
}

function normalizeSuggestionLabelsInNarrative(
  message: string,
  parsed: {
    scope_questions: Array<{ question_number: number }>;
    scope_suggestions: Array<{ suggestion_number: number }>;
  }
): string {
  let normalized = message;
  for (const entry of parsed.scope_suggestions) {
    const displayLabel = getScopeSuggestionDisplayLabelForRender(
      parsed.scope_questions.length,
      entry.suggestion_number
    );
    const tokenPattern = new RegExp(`\\bS${entry.suggestion_number}\\b`, "gi");
    normalized = normalized.replace(tokenPattern, displayLabel);
  }

  return normalized;
}

function stripOutOfScopeQuestionBlocks(message: string, validQuestionNumbers: Set<number>): string {
  if (validQuestionNumbers.size === 0 || message.trim().length === 0) {
    return message;
  }

  const lines = message.split("\n");
  const kept: string[] = [];
  let skippingOutOfScopeBlock = false;

  for (const line of lines) {
    const referencedQuestionNumbers = Array.from(line.matchAll(/\bQ(\d+)\b/gi))
      .map((match) => Number.parseInt(match[1] ?? "", 10))
      .filter((value) => Number.isInteger(value) && value > 0);
    const startsQuestionBlock = /^\s*(?:[-*]\s*)?Q\d+\b/i.test(line);
    const isIndentedContinuation =
      /^\s{2,}\S/.test(line) ||
      /^(?:\s*)(?:Recorded answer|Clarification needed|Proposed default|Why it may help)\b/i.test(line);

    if (referencedQuestionNumbers.some((value) => !validQuestionNumbers.has(value))) {
      skippingOutOfScopeBlock = true;
      continue;
    }

    if (skippingOutOfScopeBlock) {
      if (startsQuestionBlock || isIndentedContinuation || line.trim().length === 0) {
        continue;
      }
      skippingOutOfScopeBlock = false;
    }

    kept.push(line);
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function shouldUseAuthoritativeScopeActionContext(
  modelMessage: string,
  actionContext: string,
  state: unknown
): boolean {
  const parsed = parseChatState(state);
  if (parsed.scope_questions.length === 0) {
    return false;
  }

  const authoritativePrePrepScopeFlow =
    parsed.scope_clarification_pending ||
    parsed.prep_pending ||
    (parsed.scope_finalized && !parsed.prep_complete);
  if (!authoritativePrePrepScopeFlow || !isDecisionPendingContext(actionContext)) {
    return false;
  }

  if (
    /\bquestions in scope\b/i.test(actionContext) ||
    /\bclarifications to confirm\b/i.test(actionContext) ||
    /\bneed clarification for\b/i.test(actionContext) ||
    /\bscope is locked for\b/i.test(actionContext) ||
    /\brun data preparation when/i.test(actionContext)
  ) {
    return true;
  }

  const inScopeDecisionFlow =
    parsed.scope_clarification_pending ||
    parsed.prep_pending ||
    parsed.scope_pending ||
    (parsed.scope_finalized && !parsed.prep_complete);
  if (!inScopeDecisionFlow) {
    return false;
  }

  const lowerModelMessage = modelMessage.toLowerCase();
  const hasUnansweredScopeItems = parsed.scope_questions.some(
    (entry) => !entry.answer || entry.answer.trim().length === 0
  );
  if (
    hasUnansweredScopeItems &&
    (
      /\ball\s+confirmed\b/.test(lowerModelMessage) ||
      /\bconfirmed\s+all\b/.test(lowerModelMessage) ||
      /\ball\s+questions?\s+(?:are|is)\s+confirmed\b/.test(lowerModelMessage) ||
      /\bscope is locked\b/.test(lowerModelMessage) ||
      /\brun data prep(?:aration)?\b/.test(lowerModelMessage) ||
      /\bready to prepare data\b/.test(lowerModelMessage)
    )
  ) {
    return true;
  }

  const stateQuestionNumbers = new Set(parsed.scope_questions.map((entry) => entry.question_number));
  const modelQuestionNumbers = new Set<number>();
  const qNumberPattern = /\bQ(\d+)\b/gi;
  let match: RegExpExecArray | null = qNumberPattern.exec(modelMessage);
  while (match) {
    const questionNumber = Number.parseInt(match[1] ?? "", 10);
    if (Number.isInteger(questionNumber) && questionNumber > 0) {
      modelQuestionNumbers.add(questionNumber);
    }
    match = qNumberPattern.exec(modelMessage);
  }

  if (Array.from(modelQuestionNumbers).some((questionNumber) => !stateQuestionNumbers.has(questionNumber))) {
    return true;
  }

  if (/\bout of scope\b/i.test(modelMessage)) {
    return true;
  }

  return false;
}

function isConversationOrchestratorEnabled(): boolean {
  const raw = (process.env.WEB_ENABLE_CONVERSATION_ORCHESTRATOR ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

function isStrictLlmRenderedOutputEnabled(): boolean {
  const raw = (process.env.WEB_CHAT_STRICT_LLM_RENDER ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}
