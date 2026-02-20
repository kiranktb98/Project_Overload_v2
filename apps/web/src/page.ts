export function renderChatPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Overload | Report Contract Chat</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

      :root {
        --ink: #0d1a33;
        --ink-soft: #4b5f82;
        --surface: rgba(255, 255, 255, 0.92);
        --surface-strong: #ffffff;
        --line: rgba(16, 42, 84, 0.16);
        --line-soft: rgba(16, 42, 84, 0.08);
        --primary: #0f2e6d;
        --primary-2: #1f4d9c;
        --primary-3: #3674d8;
        --glow: rgba(42, 95, 188, 0.26);
        --shadow: 0 30px 60px rgba(9, 22, 50, 0.18);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Space Grotesk", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 8% 10%, rgba(31, 77, 156, 0.22), transparent 32%),
          radial-gradient(circle at 88% -8%, rgba(54, 116, 216, 0.24), transparent 34%),
          radial-gradient(circle at 56% 120%, rgba(80, 151, 255, 0.22), transparent 36%),
          linear-gradient(148deg, #edf3ff 0%, #e8f2ff 38%, #f7fafe 100%);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: linear-gradient(
          to right,
          rgba(22, 53, 110, 0.035) 1px,
          transparent 1px
        );
        background-size: 44px 44px;
        mask-image: radial-gradient(circle at 50% 35%, rgba(0, 0, 0, 0.85), transparent 80%);
      }

      .page {
        width: min(1520px, 100% - 28px);
        margin: 14px auto;
      }

      .chat-shell {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--surface);
        box-shadow: var(--shadow);
        backdrop-filter: blur(16px);
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: 93vh;
        overflow: hidden;
        animation: shell-reveal 360ms ease;
      }

      @keyframes shell-reveal {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .chat-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 18px 24px;
        border-bottom: 1px solid var(--line);
        background:
          linear-gradient(140deg, rgba(255, 255, 255, 0.94), rgba(245, 249, 255, 0.84));
      }

      .chat-head strong {
        font-size: 1.08rem;
        letter-spacing: 0.01em;
      }

      .chat-head-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .nav-link {
        color: #10336e;
        font-size: 0.76rem;
        text-decoration: none;
        font-family: "JetBrains Mono", monospace;
        padding: 6px 10px;
        border: 1px solid rgba(16, 51, 110, 0.16);
        border-radius: 999px;
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
      }

      .nav-link:hover {
        transform: translateY(-1px);
        border-color: rgba(16, 51, 110, 0.28);
        background: rgba(255, 255, 255, 0.76);
      }

      .status {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.7rem;
        color: var(--ink-soft);
        padding: 6px 11px;
        border-radius: 999px;
        border: 1px solid rgba(16, 42, 84, 0.16);
        background: rgba(255, 255, 255, 0.8);
      }

      .messages {
        padding: 24px;
        overflow-y: auto;
        max-height: calc(93vh - 148px);
        background:
          linear-gradient(180deg, rgba(250, 252, 255, 0.72), rgba(244, 248, 255, 0.35));
      }

      .bubble {
        width: fit-content;
        max-width: min(88%, 900px);
        margin-bottom: 14px;
        padding: 12px 16px;
        border-radius: 16px;
        line-height: 1.62;
        word-break: break-word;
        font-size: 0.92rem;
      }

      .bubble.user {
        margin-left: auto;
        color: #f7fbff;
        background: linear-gradient(135deg, #123379 0%, #2056ab 55%, #2b69cc 100%);
        border: 1px solid rgba(18, 51, 121, 0.35);
        box-shadow: 0 14px 26px rgba(18, 51, 121, 0.26);
        white-space: pre-wrap;
      }

      .bubble.assistant {
        background: var(--surface-strong);
        border: 1px solid rgba(16, 42, 84, 0.11);
        box-shadow: 0 10px 24px rgba(13, 26, 51, 0.08);
      }

      .bubble.assistant a {
        color: #1848a4;
        font-weight: 700;
      }

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
        font-family: "JetBrains Mono", monospace;
        font-size: 0.83em;
        background: rgba(16, 42, 84, 0.08);
        padding: 1px 6px;
        border-radius: 5px;
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

      .bubble.assistant h1 { font-size: 1.14rem; }
      .bubble.assistant h2 { font-size: 1.04rem; }
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

      .thinking-bubble {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--ink-soft);
        font-size: 0.84rem;
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
        background: var(--primary-2);
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
        margin-top: 12px;
        padding: 14px;
        border: 1px solid rgba(31, 77, 156, 0.21);
        border-radius: 12px;
        background: rgba(246, 250, 255, 0.95);
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
        border-radius: 8px;
        background: rgba(54, 116, 216, 0.1);
        border: 1px solid rgba(54, 116, 216, 0.18);
        font-size: 0.8rem;
      }

      .composer {
        border-top: 1px solid var(--line);
        padding: 16px 20px 20px;
        background: linear-gradient(180deg, rgba(250, 252, 255, 0.9), rgba(242, 247, 255, 0.8));
      }

      .composer form {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
      }

      .composer textarea {
        width: 100%;
        border-radius: 14px;
        border: 1px solid rgba(16, 42, 84, 0.2);
        padding: 13px 15px;
        min-height: 48px;
        background: rgba(255, 255, 255, 0.96);
        font-family: "JetBrains Mono", monospace;
        font-size: 0.82rem;
        color: var(--ink);
        resize: vertical;
        line-height: 1.5;
      }

      .composer textarea:focus {
        outline: none;
        border-color: var(--primary-3);
        box-shadow: 0 0 0 4px rgba(54, 116, 216, 0.14);
      }

      .composer button {
        border: 1px solid rgba(14, 42, 97, 0.28);
        border-radius: 14px;
        padding: 0 20px;
        min-height: 48px;
        cursor: pointer;
        color: #ffffff;
        background: linear-gradient(135deg, var(--primary), var(--primary-2) 54%, var(--primary-3));
        font-family: "Space Grotesk", sans-serif;
        font-weight: 700;
        letter-spacing: 0.01em;
        box-shadow: 0 14px 24px var(--glow);
        transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
      }

      .composer button:hover {
        transform: translateY(-1px);
        filter: saturate(1.06);
        box-shadow: 0 18px 28px rgba(29, 80, 173, 0.34);
      }

      .composer button:disabled {
        cursor: wait;
        opacity: 0.68;
      }

      .decision-panel {
        margin-bottom: 12px;
        border: 1px solid rgba(16, 42, 84, 0.15);
        background: rgba(255, 255, 255, 0.86);
        border-radius: 14px;
        padding: 11px 12px;
      }

      .decision-panel.hidden {
        display: none;
      }

      .decision-title {
        font-size: 0.8rem;
        color: var(--ink-soft);
        margin-bottom: 9px;
      }

      .decision-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .decision-btn {
        border: 1px solid rgba(14, 42, 97, 0.24);
        border-radius: 999px;
        background: linear-gradient(135deg, #173f85, #2863c5);
        color: #ffffff;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.73rem;
        padding: 7px 12px;
        cursor: pointer;
        box-shadow: 0 8px 16px rgba(31, 84, 178, 0.25);
        transition: transform 120ms ease, filter 120ms ease;
      }

      .decision-btn:hover {
        transform: translateY(-1px);
        filter: saturate(1.06);
      }

      @media (max-width: 900px) {
        .page {
          width: calc(100% - 16px);
          margin: 8px auto;
        }

        .chat-shell {
          min-height: 96vh;
          border-radius: 18px;
        }

        .messages {
          padding: 16px;
          max-height: calc(96vh - 154px);
        }

        .bubble {
          max-width: 96%;
        }

        .composer {
          padding: 12px 14px 16px;
        }

        .composer form {
          grid-template-columns: 1fr;
        }
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
            <textarea id="composer-input" rows="2" placeholder="Describe the report you want, e.g. weekly refund analysis by product category"></textarea>
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

          const scopeQuestions = Array.isArray(state.scope_questions) ? state.scope_questions : [];
          const hasAnsweredScopeItems =
            scopeQuestions.length > 0 &&
            scopeQuestions.every((entry) =>
              entry && typeof entry.answer === "string" && entry.answer.trim().length > 0
            );

          if (state.awaiting_post_run_refinement === true) {
            return {
              kind: "post-run",
              title: "Analysis is complete. Refine before PDF?",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Ask follow-up (max 2)", command: "__ui_refine_report__" },
                { label: "Generate report PDF", command: "__ui_generate_pdf_yes__" },
                { label: "Start new conversation", command: "__ui_start_new_conversation__" }
              ]
            };
          }

          if (state.refinement_active === true) {
            const remaining = Number.isFinite(state.refinement_questions_remaining)
              ? state.refinement_questions_remaining
              : 0;
            return {
              kind: "refinement",
              title: "Refinement mode active (" + remaining + " question" + (remaining === 1 ? "" : "s") + " left).",
              lockPlaceholder: "Ask follow-up questions or choose an option.",
              options: [
                { label: "Generate report PDF", command: "__ui_generate_pdf_yes__" },
                { label: "Start new conversation", command: "__ui_start_new_conversation__" }
              ]
            };
          }

          if (state.awaiting_pdf_confirmation === true) {
            return {
              kind: "pdf",
              title: "Generate customer-facing PDF now?",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Generate report PDF", command: "__ui_generate_pdf_yes__" },
                { label: "Not yet", command: "__ui_generate_pdf_no__" }
              ]
            };
          }

          if (state.awaiting_save_confirmation === true) {
            return {
              kind: "save",
              title: "Save this run in report logs?",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Save report log", command: "__ui_save_report_yes__" },
                { label: "Skip save", command: "__ui_save_report_no__" }
              ]
            };
          }

          if (state.awaiting_schedule_confirmation === true) {
            return {
              kind: "schedule-confirm",
              title: "Set up recurring schedule for this report?",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Schedule report", command: "__ui_schedule_setup_yes__" },
                { label: "Not now", command: "__ui_schedule_setup_no__" }
              ]
            };
          }

          if (state.awaiting_schedule_mode_selection === true) {
            return {
              kind: "schedule-mode",
              title: "Scheduling cadence pending.",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Weekly", command: "__ui_schedule_mode_weekly__" },
                { label: "Monthly", command: "__ui_schedule_mode_monthly__" },
                { label: "Quarterly", command: "__ui_schedule_mode_quarterly__" }
              ]
            };
          }

          if (state.schedule_mode_pending && state.schedule_day_kind === "weekday") {
            return {
              kind: "schedule-weekday",
              title: "Pick weekday for weekly schedule (UTC).",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Mon", command: "__ui_schedule_weekday_mon__" },
                { label: "Tue", command: "__ui_schedule_weekday_tue__" },
                { label: "Wed", command: "__ui_schedule_weekday_wed__" },
                { label: "Thu", command: "__ui_schedule_weekday_thu__" },
                { label: "Fri", command: "__ui_schedule_weekday_fri__" },
                { label: "Sat", command: "__ui_schedule_weekday_sat__" },
                { label: "Sun", command: "__ui_schedule_weekday_sun__" }
              ]
            };
          }

          if (state.schedule_mode_pending && state.schedule_day_kind === "monthday") {
            return {
              kind: "schedule-monthday",
              title: "Pick day of month (1-28).",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Day 1", command: "__ui_schedule_day_1__" },
                { label: "Day 15", command: "__ui_schedule_day_15__" },
                { label: "Day 28", command: "__ui_schedule_day_28__" },
                { label: "Custom day", command: "__ui_schedule_day_custom__" }
              ]
            };
          }

          if (typeof state.pending_query_sql === "string" && state.pending_query_sql.trim().length > 0) {
            return {
              kind: "query",
              title: "SQL decision pending.",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Run query", command: "__ui_run_query__" },
                { label: "Other instruction", command: "__ui_query_other_instruction__" }
              ]
            };
          }

          if (state.prep_pending === true) {
            return {
              kind: "prep",
              title: "Data preparation decision pending.",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Run Data Preparation", command: "__ui_run_data_preparation__" },
                { label: "Continue scoping", command: "__ui_continue_scoping__" }
              ]
            };
          }

          if (state.scope_pending === true) {
            return {
              kind: "analysis",
              title: "Analysis decision pending.",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Finish scoping and run analysis", command: "__ui_finish_scoping_run_analysis__" },
                { label: "Continue scoping", command: "__ui_continue_scoping__" }
              ]
            };
          }

          // Recovery fallback for stale state snapshots: keep workflow actionable.
          if (
            hasAnsweredScopeItems &&
            state.prep_complete !== true &&
            state.prep_pending !== true
          ) {
            return {
              kind: "prep",
              title: "Data preparation decision pending.",
              lockPlaceholder: "Workflow locked while this decision is pending.",
              options: [
                { label: "Run Data Preparation", command: "__ui_run_data_preparation__" },
                { label: "Continue scoping", command: "__ui_continue_scoping__" }
              ]
            };
          }

          if (
            state.prep_complete === true &&
            state.scope_pending !== true &&
            state.prep_pending !== true &&
            Array.isArray(state.prepared_payloads) &&
            state.prepared_payloads.length > 0
          ) {
            return {
              kind: "analysis",
              title: "Analysis decision pending.",
              lockPlaceholder: "Workflow locked while this decision is pending.",
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
          const allowInputWhileDeciding =
            Boolean(
              state &&
                (state.awaiting_custom_day_input === true ||
                  (decisionRef.value &&
                    decisionRef.value.kind === "refinement"))
            );
          composerStateRef.locked = Boolean(
            decisionRef.value &&
              decisionRef.value.kind !== "pdf" &&
              !allowInputWhileDeciding
          );
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
                allowed_schemas: allowedSchemas,
                insight_mode: "business"
              },
              contract_id: null,
              last_run_id: null,
              last_query_id: null,
              last_exec_brief: null,
              conversation_history: [],
              prep_pending: false,
              prep_complete: false,
              scope_pending: false,
              metric_definitions: [],
              pending_metric_confirmations: [],
              pending_metric_resume_message: null,
              pending_metric_resume_mode: null,
              scope_clarification_pending: false,
              scope_source_prompt: null,
              scope_questions: [],
              pending_query_sql: null,
              pending_query_limit: null,
              pending_single_query_request: null,
              last_single_query_snapshot: null,
              planner_summary: null,
              preparation_summary: null,
              prepared_payloads: [],
              awaiting_pdf_confirmation: false,
              awaiting_post_run_refinement: false,
              refinement_active: false,
              refinement_questions_remaining: 0,
              awaiting_save_confirmation: false,
              awaiting_schedule_confirmation: false,
              awaiting_schedule_mode_selection: false,
              schedule_mode_pending: null,
              schedule_day_kind: null,
              awaiting_custom_day_input: false,
              last_concise_summary: null,
              last_token_usage: null
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
        inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            formEl.requestSubmit();
          }
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
