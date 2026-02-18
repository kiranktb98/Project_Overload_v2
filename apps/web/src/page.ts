export function renderChatPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Overload | Report Contract Chat</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap");

      :root {
        --ink: #0f172a;
        --ink-soft: #334155;
        --paper: #f8fafc;
        --card: rgba(255, 255, 255, 0.92);
        --accent: #1e3a8a;
        --accent-2: #2563eb;
        --accent-3: #f59e0b;
        --line: rgba(15, 23, 42, 0.12);
        --shadow: 0 20px 45px rgba(15, 23, 42, 0.18);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Sora", sans-serif;
        color: var(--ink);
        min-height: 100vh;
        background:
          radial-gradient(circle at 12% 16%, rgba(34, 197, 94, 0.28), transparent 30%),
          radial-gradient(circle at 80% 0%, rgba(14, 165, 233, 0.30), transparent 34%),
          linear-gradient(145deg, #ecfeff 0%, #eff6ff 42%, #f8fafc 100%);
      }

      .page {
        width: min(1220px, 100% - 24px);
        margin: 16px auto;
      }

      .chat-shell {
        border: 1px solid var(--line);
        border-radius: 20px;
        background: var(--card);
        box-shadow: var(--shadow);
        backdrop-filter: blur(10px);
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: 90vh;
      }

      .chat-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--line);
      }

      .chat-head strong {
        font-size: 1rem;
      }

      .chat-head-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .nav-link {
        color: #075985;
        font-size: 0.78rem;
        text-decoration: none;
        font-family: "IBM Plex Mono", monospace;
        opacity: 0.8;
        transition: opacity 140ms ease;
      }

      .nav-link:hover {
        opacity: 1;
        text-decoration: underline;
      }

      .status {
        font-family: "IBM Plex Mono", monospace;
        font-size: 0.72rem;
        color: var(--ink-soft);
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.15);
        background: rgba(255, 255, 255, 0.74);
      }

      .messages {
        padding: 18px;
        overflow-y: auto;
        max-height: calc(90vh - 130px);
      }

      .bubble {
        width: fit-content;
        max-width: min(90%, 720px);
        margin-bottom: 12px;
        padding: 10px 14px;
        border-radius: 14px;
        line-height: 1.55;
        word-break: break-word;
        font-size: 0.92rem;
      }

      .bubble.user {
        margin-left: auto;
        background: rgba(14, 165, 233, 0.14);
        border: 1px solid rgba(14, 165, 233, 0.45);
        white-space: pre-wrap;
      }

      .bubble.assistant {
        background: rgba(15, 23, 42, 0.06);
        border: 1px solid rgba(15, 23, 42, 0.12);
      }

      .bubble.assistant a {
        color: #0369a1;
        font-weight: 700;
      }

      /* Markdown styles inside assistant bubbles */
      .bubble.assistant p {
        margin: 0 0 8px;
      }

      .bubble.assistant p:last-child {
        margin-bottom: 0;
      }

      .bubble.assistant strong {
        font-weight: 700;
      }

      .bubble.assistant em {
        font-style: italic;
      }

      .bubble.assistant code {
        font-family: "IBM Plex Mono", monospace;
        font-size: 0.84em;
        background: rgba(15, 23, 42, 0.08);
        padding: 1px 5px;
        border-radius: 4px;
      }

      .bubble.assistant h1,
      .bubble.assistant h2,
      .bubble.assistant h3,
      .bubble.assistant h4 {
        margin: 12px 0 6px;
        line-height: 1.3;
      }

      .bubble.assistant h1:first-child,
      .bubble.assistant h2:first-child,
      .bubble.assistant h3:first-child,
      .bubble.assistant h4:first-child {
        margin-top: 0;
      }

      .bubble.assistant h1 { font-size: 1.15rem; }
      .bubble.assistant h2 { font-size: 1.05rem; }
      .bubble.assistant h3 { font-size: 0.95rem; }
      .bubble.assistant h4 { font-size: 0.9rem; }

      .bubble.assistant ul,
      .bubble.assistant ol {
        margin: 4px 0 8px;
        padding-left: 20px;
      }

      .bubble.assistant li {
        margin-bottom: 3px;
      }

      /* Thinking indicator */
      .thinking-bubble {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--ink-soft);
        font-size: 0.85rem;
        font-style: italic;
      }

      .thinking-dots {
        display: flex;
        gap: 4px;
      }

      .thinking-dots span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--accent);
        animation: pulse 1.4s ease-in-out infinite;
      }

      .thinking-dots span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .thinking-dots span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes pulse {
        0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1); }
      }

      .exec-brief-embed {
        margin-top: 10px;
        padding: 14px;
        border: 1px solid rgba(14, 165, 233, 0.25);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.85);
        font-size: 0.85rem;
        line-height: 1.55;
        max-height: 480px;
        overflow-y: auto;
      }

      .exec-brief-embed h1 {
        font-size: 1.05rem;
        margin: 0 0 6px;
      }

      .exec-brief-embed h2 {
        font-size: 0.9rem;
        margin: 12px 0 4px;
        color: var(--ink);
      }

      .exec-brief-embed ul {
        margin: 4px 0;
        padding-left: 18px;
      }

      .exec-brief-embed li {
        margin-bottom: 3px;
      }

      .exec-brief-embed .confidence {
        margin-top: 10px;
        padding: 8px;
        border-radius: 6px;
        background: rgba(14, 165, 233, 0.06);
        border: 1px solid rgba(14, 165, 233, 0.15);
        font-size: 0.8rem;
      }

      .composer {
        border-top: 1px solid var(--line);
        padding: 14px 18px 18px;
      }

      .composer form {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
      }

      .composer input {
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(15, 23, 42, 0.2);
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.96);
        font-family: "IBM Plex Mono", monospace;
        font-size: 0.84rem;
      }

      .composer input:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
      }

      .composer button {
        border: 1px solid rgba(30, 58, 138, 0.28);
        border-radius: 12px;
        padding: 0 16px;
        min-height: 44px;
        cursor: pointer;
        color: #ffffff;
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
        font-family: "Sora", sans-serif;
        font-weight: 700;
        box-shadow: 0 10px 22px rgba(37, 99, 235, 0.24);
        transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
      }

      .composer button:hover {
        transform: translateY(-1px);
        filter: saturate(1.05);
        box-shadow: 0 14px 24px rgba(37, 99, 235, 0.3);
      }

      .composer button:disabled {
        cursor: wait;
        opacity: 0.65;
      }

      .decision-panel {
        margin-bottom: 10px;
        border: 1px solid rgba(15, 23, 42, 0.15);
        background: rgba(255, 255, 255, 0.85);
        border-radius: 12px;
        padding: 10px 12px;
      }

      .decision-panel.hidden {
        display: none;
      }

      .decision-title {
        font-size: 0.82rem;
        color: var(--ink-soft);
        margin-bottom: 8px;
      }

      .decision-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .decision-btn {
        border: 1px solid rgba(30, 58, 138, 0.26);
        border-radius: 999px;
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
        color: #ffffff;
        font-family: "IBM Plex Mono", monospace;
        font-size: 0.75rem;
        padding: 7px 12px;
        cursor: pointer;
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.22);
      }

      .decision-btn:hover {
        filter: saturate(1.06);
      }
    </style>
  </head>
  <body>
    <div class="page">
      <main class="chat-shell">
        <header class="chat-head">
          <strong>Project Overload</strong>
          <div class="chat-head-right">
            <a class="nav-link" href="/connect">Database</a>
            <span class="status" id="status">starting</span>
          </div>
        </header>
        <section class="messages" id="messages"></section>
        <section class="composer">
          <div id="decision-panel" class="decision-panel hidden"></div>
          <form id="composer-form">
            <input id="composer-input" autocomplete="off" placeholder="Describe the report you want, e.g. weekly refund analysis by product category" />
            <button id="composer-send" type="submit">Send</button>
          </form>
        </section>
      </main>
    </div>

    <script>
      (() => {
        const stateRef = { value: null };
        const messagesEl = document.getElementById("messages");
        const statusEl = document.getElementById("status");
        const inputEl = document.getElementById("composer-input");
        const sendButtonEl = document.getElementById("composer-send");
        const formEl = document.getElementById("composer-form");
        const decisionPanelEl = document.getElementById("decision-panel");
        const runtimeStatusRef = { mode: "checking provider", busy: false };
        const composerStateRef = { busy: false, locked: false };
        const decisionRef = { value: null };
        const defaultInputPlaceholder =
          "Describe the report you want, e.g. weekly refund analysis by product category";

        /* ── Thinking indicator ── */
        const thinkingMessages = {
          chatting: ["Thinking...", "Pondering your question...", "Mulling it over..."],
          planning: ["Exploring the data...", "Mapping the terrain...", "Scouting the columns...", "Learning the data shapes..."],
          analyzing: ["Cooking insights...", "Sherlocking the data...", "Connecting the dots..."],
          running: ["Scouring the seven seas...", "Crunching the numbers...", "Mining for gold..."]
        };

        let thinkingEl = null;
        let thinkingInterval = null;

        function showThinking(phase) {
          hideThinking();
          const messages = thinkingMessages[phase] || thinkingMessages.chatting;
          let idx = 0;

          const bubble = document.createElement("div");
          bubble.className = "bubble assistant thinking-bubble";
          bubble.id = "thinking-indicator";

          const dots = document.createElement("div");
          dots.className = "thinking-dots";
          dots.innerHTML = "<span></span><span></span><span></span>";

          const text = document.createElement("span");
          text.textContent = messages[0];

          bubble.appendChild(dots);
          bubble.appendChild(text);
          messagesEl.appendChild(bubble);
          messagesEl.scrollTop = messagesEl.scrollHeight;

          thinkingEl = bubble;
          thinkingInterval = setInterval(() => {
            idx = (idx + 1) % messages.length;
            text.textContent = messages[idx];
          }, 3000);
        }

        function hideThinking() {
          if (thinkingInterval) {
            clearInterval(thinkingInterval);
            thinkingInterval = null;
          }
          if (thinkingEl) {
            thinkingEl.remove();
            thinkingEl = null;
          }
        }

        /* ── Markdown renderer ── */
        function renderMarkdown(text) {
          // Escape HTML entities to prevent XSS
          const esc = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          const lines = esc.split("\\n");
          const out = [];
          let inList = false;
          let listTag = "";

          function closeList() {
            if (inList) {
              out.push("</" + listTag + ">");
              inList = false;
              listTag = "";
            }
          }

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Headings
            const headingMatch = line.match(/^(#{1,4})\\s+(.+)$/);
            if (headingMatch) {
              closeList();
              const level = headingMatch[1].length;
              out.push("<h" + level + ">" + inlineFormat(headingMatch[2]) + "</h" + level + ">");
              continue;
            }

            // Unordered list items
            const ulMatch = line.match(/^[\\-\\*]\\s+(.+)$/);
            if (ulMatch) {
              if (!inList || listTag !== "ul") {
                closeList();
                out.push("<ul>");
                inList = true;
                listTag = "ul";
              }
              out.push("<li>" + inlineFormat(ulMatch[1]) + "</li>");
              continue;
            }

            // Ordered list items
            const olMatch = line.match(/^\\d+\\.\\s+(.+)$/);
            if (olMatch) {
              if (!inList || listTag !== "ol") {
                closeList();
                out.push("<ol>");
                inList = true;
                listTag = "ol";
              }
              out.push("<li>" + inlineFormat(olMatch[1]) + "</li>");
              continue;
            }

            closeList();

            // Blank line → paragraph break
            if (line.trim() === "") {
              out.push("<br>");
              continue;
            }

            // Regular text
            out.push("<p>" + inlineFormat(line) + "</p>");
          }

          closeList();
          return out.join("");
        }

        function inlineFormat(text) {
          return text
            .replace(/\`([^\`]+)\`/g, "<code>$1</code>")
            .replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>")
            .replace(/\\*(.+?)\\*/g, "<em>$1</em>");
        }

        /* ── Status ── */
        function setBusy(isBusy) {
          runtimeStatusRef.busy = isBusy;
          composerStateRef.busy = isBusy;
          syncComposerAvailability();
          renderStatus();
        }

        function renderStatus() {
          const activity = runtimeStatusRef.busy
            ? "processing"
            : decisionRef.value
              ? "awaiting decision"
              : "idle";
          statusEl.textContent = runtimeStatusRef.mode + " | " + activity;
        }

        
        function getDecisionFromState(state) {
          if (!state || typeof state !== "object") {
            return null;
          }

          if (typeof state.pending_query_sql === "string" && state.pending_query_sql.trim().length > 0) {
            return {
              kind: "query",
              title: "Choose how to proceed with this SQL request.",
              lockPlaceholder: "Select 'Run query' or 'Other instruction' first.",
              options: [
                { label: "Run query", command: "__ui_run_query__" },
                { label: "Other instruction", command: "__ui_query_other_instruction__" }
              ]
            };
          }

          if (state.scope_pending === true) {
            return {
              kind: "analysis",
              title: "Analysis scope is ready. Choose next step.",
              lockPlaceholder: "Select 'Finish scoping and run analysis' or 'Continue scoping' first.",
              options: [
                { label: "Finish scoping and run analysis", command: "__ui_finish_scoping_run_analysis__" },
                { label: "Continue scoping", command: "__ui_continue_scoping__" }
              ]
            };
          }

          return null;
        }

        function syncComposerAvailability() {
          const disabled = composerStateRef.busy || composerStateRef.locked;
          sendButtonEl.disabled = disabled;
          inputEl.disabled = disabled;
          inputEl.placeholder =
            composerStateRef.locked && decisionRef.value
              ? decisionRef.value.lockPlaceholder
              : defaultInputPlaceholder;
        }

        function renderDecisionPanel() {
          if (!decisionRef.value) {
            decisionPanelEl.classList.add("hidden");
            decisionPanelEl.innerHTML = "";
            return;
          }

          decisionPanelEl.classList.remove("hidden");
          decisionPanelEl.innerHTML = "";

          const title = document.createElement("div");
          title.className = "decision-title";
          title.textContent = decisionRef.value.title;
          decisionPanelEl.appendChild(title);

          const actions = document.createElement("div");
          actions.className = "decision-actions";

          for (const option of decisionRef.value.options) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "decision-btn";
            button.textContent = option.label;
            button.addEventListener("click", () => {
              submitMessage(option.command, {
                displayMessage: option.label,
                forceWhenLocked: true
              });
            });
            actions.appendChild(button);
          }

          decisionPanelEl.appendChild(actions);
        }

        function refreshDecisionFromState(state) {
          decisionRef.value = getDecisionFromState(state);
          composerStateRef.locked = Boolean(decisionRef.value);
          syncComposerAvailability();
          renderDecisionPanel();
          renderStatus();
        }

        /* ── Messages ── */
        function appendMessage(role, text, downloadUrl, execBriefHtml) {
          hideThinking();

          const bubble = document.createElement("div");
          bubble.className = "bubble " + role;

          const content = document.createElement("div");
          if (role === "assistant") {
            content.innerHTML = renderMarkdown(text);
          } else {
            content.textContent = text;
          }
          bubble.appendChild(content);

          if (role === "assistant" && typeof execBriefHtml === "string" && execBriefHtml.length > 0) {
            const briefContainer = document.createElement("div");
            briefContainer.className = "exec-brief-embed";
            briefContainer.innerHTML = execBriefHtml;
            bubble.appendChild(briefContainer);
          }

          if (role === "assistant" && typeof downloadUrl === "string" && downloadUrl.length > 0) {
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.textContent = "Download PDF";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            bubble.appendChild(document.createElement("br"));
            bubble.appendChild(link);
          }

          messagesEl.appendChild(bubble);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        /* ── Submit ── */
        async function submitMessage(message, options) {
          const opts = options || {};
          if (composerStateRef.locked && !opts.forceWhenLocked) {
            return;
          }

          const value = String(message || "").trim();
          if (!value) {
            return;
          }

          const displayMessage =
            typeof opts.displayMessage === "string" && opts.displayMessage.trim().length > 0
              ? opts.displayMessage.trim()
              : value;

          appendMessage("user", displayMessage);
          setBusy(true);
          const isRunConfirm = /^(confirm|yes|go ahead|proceed|looks good|lgtm|run it|do it|execute|approved|ok|okay|sure|start)\b/i.test(value);
          showThinking(isRunConfirm ? "planning" : "chatting");

          try {
            const response = await fetch("/api/chat", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                message: value,
                state: stateRef.value
              })
            });

            const payload = await response.json();
            if (!response.ok) {
              const errorText = payload && typeof payload.message === "string" ? payload.message : "Chat request failed";
              appendMessage("assistant", "Error: " + errorText);
              return;
            }

            stateRef.value = payload.state;
            refreshDecisionFromState(stateRef.value);
            appendMessage("assistant", payload.assistant_message, payload.pdf_download_url, payload.exec_brief_html);
          } catch (error) {
            const errorText = error instanceof Error ? error.message : "Unknown error";
            appendMessage("assistant", "Network error: " + errorText);
          } finally {
            hideThinking();
            setBusy(false);
            if (!composerStateRef.locked) {
              inputEl.focus();
            }
          }
        }
        async function loadRuntimeStatus() {
          try {
            const response = await fetch("/api/chat/runtime", { method: "GET" });
            const payload = await response.json();
            if (!response.ok) {
              runtimeStatusRef.mode = "provider unavailable";
              renderStatus();
              return;
            }

            const provider =
              payload && typeof payload.provider === "string" ? payload.provider : "unknown";
            const mode = payload && typeof payload.mode === "string" ? payload.mode : "unknown";
            runtimeStatusRef.mode = provider + " (" + mode + ")";
          } catch (_error) {
            runtimeStatusRef.mode = "provider unavailable";
          }

          renderStatus();
        }

        /* ── DB context bootstrap ── */
        async function loadDbContextForChat() {
          try {
            const response = await fetch("/api/db/context", { method: "GET" });
            const payload = await response.json();

            if (!response.ok || !payload || payload.connected !== true) {
              return;
            }

            const allowedRelations = Array.isArray(payload.allowed_relations) ? payload.allowed_relations : [];
            const allowedSchemas = Array.isArray(payload.allowed_schemas) ? payload.allowed_schemas : [];
            const defaultRelation = allowedRelations.length > 0 ? allowedRelations[0] : null;

            stateRef.value = {
              draft: {
                name: "",
                audience: "Executive",
                timezone: "UTC",
                schedule_cron: null,
                sql_template: defaultRelation ? "SELECT * FROM " + defaultRelation : "SELECT 1",
                metric_ids: ["metric_revenue"],
                dimension_ids: ["region"],
                allowed_relations: allowedRelations,
                allowed_schemas: allowedSchemas
              },
              contract_id: null,
              last_run_id: null,
              last_query_id: null,
              last_exec_brief: null,
              conversation_history: [],
              scope_pending: false,
              pending_query_sql: null,
              pending_query_limit: null,
              planner_summary: null
            };
            refreshDecisionFromState(stateRef.value);

            appendMessage(
              "assistant",
              "I see you have a database connected with **" + allowedRelations.length + " table" + (allowedRelations.length === 1 ? "" : "s") + "** available. Tell me what you'd like to analyze and I'll get started!"
            );
          } catch (_error) {
            // Ignore optional context bootstrap failures.
          }
        }

        /* ── Init ── */
        formEl.addEventListener("submit", (event) => {
          event.preventDefault();
          const value = inputEl.value;
          inputEl.value = "";
          submitMessage(value);
        });

        appendMessage(
          "assistant",
          "Hey! Tell me what report you'd like to build - **who's the audience** and **what metric matters most**? I'll handle the rest."
        );
        refreshDecisionFromState(stateRef.value);
        renderStatus();
        loadRuntimeStatus();
        loadDbContextForChat();
        if (!composerStateRef.locked) {
          inputEl.focus();
        }
      })();
    </script>
  </body>
</html>`;
}
