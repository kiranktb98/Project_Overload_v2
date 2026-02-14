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
        width: min(1120px, 100% - 32px);
        margin: 28px auto;
        display: grid;
        grid-template-columns: minmax(230px, 320px) 1fr;
        gap: 18px;
      }

      .panel,
      .chat-shell {
        border: 1px solid var(--line);
        border-radius: 20px;
        background: var(--card);
        box-shadow: var(--shadow);
        backdrop-filter: blur(10px);
      }

      .panel {
        padding: 18px;
      }

      .panel h1 {
        margin: 0 0 10px;
        font-size: 1.05rem;
      }

      .panel p {
        margin: 0;
        color: var(--ink-soft);
        line-height: 1.45;
      }

      .chips {
        margin-top: 14px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        appearance: none;
        border: 1px solid rgba(14, 165, 233, 0.35);
        background: rgba(14, 165, 233, 0.08);
        color: var(--ink);
        border-radius: 999px;
        padding: 8px 12px;
        font-family: "IBM Plex Mono", monospace;
        font-size: 0.72rem;
        cursor: pointer;
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
      }

      .chip:hover {
        transform: translateY(-1px);
        border-color: rgba(14, 165, 233, 0.7);
        background: rgba(14, 165, 233, 0.16);
      }

      .chat-shell {
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: 72vh;
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
        max-height: calc(72vh - 130px);
      }

      .bubble {
        width: fit-content;
        max-width: min(90%, 720px);
        margin-bottom: 12px;
        padding: 10px 12px;
        border-radius: 14px;
        line-height: 1.45;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .bubble.user {
        margin-left: auto;
        background: rgba(14, 165, 233, 0.14);
        border: 1px solid rgba(14, 165, 233, 0.45);
      }

      .bubble.assistant {
        background: rgba(15, 23, 42, 0.06);
        border: 1px solid rgba(15, 23, 42, 0.12);
      }

      .bubble.assistant a {
        color: #0369a1;
        font-weight: 700;
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
        font-size: 0.78rem;
      }

      @media (max-width: 940px) {
        .page {
          grid-template-columns: 1fr;
        }

        .chat-shell {
          min-height: 68vh;
        }

        .messages {
          max-height: calc(68vh - 130px);
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <aside class="panel">
        <h1>Report Contract Chat</h1>
        <p>
          Define one contract with guardrails, then save and run it. This UI keeps the workflow deterministic:
          set fields, preview, save, run.
        </p>
        <div class="chips" id="chips">
          <button class="chip" data-command="set name: Weekly CEO Revenue">set name</button>
          <button class="chip" data-command="set audience: CEO">set audience</button>
          <button class="chip" data-command="set timezone: Asia/Kolkata">set timezone</button>
          <button class="chip" data-command="set schedule: 0 18 * * 5">set schedule</button>
          <button class="chip" data-command="preview">preview</button>
          <button class="chip" data-command="save">save</button>
          <button class="chip" data-command="run">run</button>
          <button class="chip" data-command="list contracts">list contracts</button>
          <button class="chip" data-command="help">help</button>
        </div>
      </aside>

      <main class="chat-shell">
        <header class="chat-head">
          <strong>Planner + Guardrails Chat</strong>
          <span class="status" id="status">idle</span>
        </header>
        <section class="messages" id="messages"></section>
        <section class="composer">
          <form id="composer-form">
            <input id="composer-input" autocomplete="off" placeholder="Describe the report you want. Example: I need a weekly CEO revenue report by region." />
            <button id="composer-send" type="submit">Send</button>
          </form>
          <div class="hint">Every turn runs through server-side <code>/api/chat</code>, AI response generation, and existing API contracts.</div>
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
        const chipsEl = document.getElementById("chips");

        function setBusy(isBusy) {
          statusEl.textContent = isBusy ? "processing" : "idle";
          sendButtonEl.disabled = isBusy;
          inputEl.disabled = isBusy;
        }

        function appendMessage(role, text, downloadUrl) {
          const bubble = document.createElement("div");
          bubble.className = "bubble " + role;

          const content = document.createElement("div");
          content.textContent = text;
          bubble.appendChild(content);

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

        async function submitMessage(message) {
          const value = String(message || "").trim();
          if (!value) {
            return;
          }

          appendMessage("user", value);
          setBusy(true);

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
            appendMessage("assistant", payload.assistant_message, payload.pdf_download_url);
          } catch (error) {
            const errorText = error instanceof Error ? error.message : "Unknown error";
            appendMessage("assistant", "Network error: " + errorText);
          } finally {
            setBusy(false);
            inputEl.focus();
          }
        }

        formEl.addEventListener("submit", (event) => {
          event.preventDefault();
          const value = inputEl.value;
          inputEl.value = "";
          submitMessage(value);
        });

        chipsEl.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) {
            return;
          }

          if (!target.dataset.command) {
            return;
          }

          submitMessage(target.dataset.command);
        });

        appendMessage(
          "assistant",
          "Chat is ready. Tell me what report you want, or use commands. After a run, ask: what did you find?"
        );
        inputEl.focus();
      })();
    </script>
  </body>
</html>`;
}
