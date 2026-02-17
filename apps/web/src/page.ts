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
        --accent: #0ea5e9;
        --accent-2: #22c55e;
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
        width: min(860px, 100% - 32px);
        margin: 28px auto;
      }

      .chat-shell {
        border: 1px solid var(--line);
        border-radius: 20px;
        background: var(--card);
        box-shadow: var(--shadow);
        backdrop-filter: blur(10px);
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: 82vh;
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
        max-height: calc(82vh - 130px);
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
        border: none;
        border-radius: 12px;
        padding: 0 16px;
        min-height: 44px;
        cursor: pointer;
        color: #082f49;
        background: linear-gradient(130deg, var(--accent), var(--accent-2));
        font-family: "Sora", sans-serif;
        font-weight: 700;
        transition: transform 140ms ease, filter 140ms ease;
      }

      .composer button:hover {
        transform: translateY(-1px);
        filter: saturate(1.08);
      }

      .composer button:disabled {
        cursor: wait;
        opacity: 0.65;
      }

      .hint {
        margin-top: 10px;
        color: var(--ink-soft);
        font-size: 0.75rem;
        text-align: center;
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
          <form id="composer-form">
            <input id="composer-input" autocomplete="off" placeholder="Describe the report you want, e.g. weekly refund analysis by product category" />
            <button id="composer-send" type="submit">Send</button>
          </form>
          <div class="hint">Powered by AI &mdash; each message runs through the analysis pipeline</div>
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
        const runtimeStatusRef = { mode: "checking provider", busy: false };

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
          renderStatus();
          sendButtonEl.disabled = isBusy;
          inputEl.disabled = isBusy;
        }

        function renderStatus() {
          const activity = runtimeStatusRef.busy ? "processing" : "idle";
          statusEl.textContent = runtimeStatusRef.mode + " | " + activity;
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
        async function submitMessage(message) {
          const value = String(message || "").trim();
          if (!value) {
            return;
          }

          appendMessage("user", value);
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
            appendMessage("assistant", payload.assistant_message, payload.pdf_download_url, payload.exec_brief_html);
          } catch (error) {
            const errorText = error instanceof Error ? error.message : "Unknown error";
            appendMessage("assistant", "Network error: " + errorText);
          } finally {
            hideThinking();
            setBusy(false);
            inputEl.focus();
          }
        }

        /* ── Runtime status ── */
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
              last_exec_brief: null,
              conversation_history: []
            };

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
        renderStatus();
        loadRuntimeStatus();
        loadDbContextForChat();
        inputEl.focus();
      })();
    </script>
  </body>
</html>`;
}
