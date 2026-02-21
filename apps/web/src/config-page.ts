export function renderGlobalConfigPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Overload | Global Config</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

      :root {
        --ink: #e9f1ff;
        --ink-soft: #6f86b4;
        --line: #14386f;
        --line-soft: #20509d;
        --glow: rgba(85, 72, 255, 0.45);
        --shadow: 0 18px 48px rgba(1, 8, 32, 0.44);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Space Grotesk", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at -8% 22%, rgba(80, 110, 255, 0.15), transparent 26%),
          radial-gradient(circle at 104% -8%, rgba(98, 80, 255, 0.12), transparent 24%),
          linear-gradient(180deg, #02071b 0%, #030b27 50%, #030d2e 100%);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: linear-gradient(to right, rgba(108, 138, 214, 0.05) 1px, transparent 1px);
        background-size: 60px 60px;
        mask-image: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.86), transparent 92%);
      }

      .page {
        width: 100%;
      }

      .layout {
        display: grid;
        grid-template-columns: 198px 1fr;
        min-height: 100vh;
      }

      .platform-panel {
        border: 1px solid var(--line);
        border-right: 1px solid #112f62;
        background: linear-gradient(180deg, rgba(6, 17, 47, 0.98), rgba(5, 13, 36, 0.98));
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: column;
        padding: 14px 14px 12px;
      }

      .platform-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 6px 14px;
        margin-bottom: 6px;
        border-bottom: 1px solid #173469;
      }

      .platform-brand-badge {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-weight: 700;
        color: #f3f8ff;
        background: linear-gradient(135deg, #4e3eff, #6e56ff);
        box-shadow: 0 12px 20px rgba(82, 73, 255, 0.36);
      }

      .platform-brand strong {
        display: block;
        font-size: 0.76rem;
        line-height: 1.1;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .platform-brand span {
        display: block;
        margin-top: 2px;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.63rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #8199c6;
      }

      .platform-section {
        margin: 14px 8px 8px;
        font-size: 0.62rem;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: var(--ink-soft);
      }

      .platform-nav {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .platform-link {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 11px;
        border-radius: 11px;
        color: #90a7d8;
        text-decoration: none;
        border: 1px solid transparent;
        font-size: 0.84rem;
        font-weight: 500;
      }

      .platform-link .link-icon {
        width: 22px;
        text-align: center;
        color: #6f8ac1;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.7rem;
      }

      .platform-link:hover {
        background: rgba(24, 49, 112, 0.45);
        border-color: #2f4f9e;
      }

      .platform-link.active {
        background: linear-gradient(135deg, #4e3dff, #5d4dff 55%, #6d5dff);
        border-color: rgba(143, 160, 255, 0.48);
        color: #f3f8ff;
        box-shadow: 0 10px 22px rgba(82, 74, 255, 0.32);
      }

      .platform-link.active .link-icon {
        color: #e8f1ff;
      }

      .platform-footer {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .platform-user {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid #1d366f;
        border-radius: 12px;
        padding: 9px 10px;
        background: rgba(8, 20, 53, 0.92);
      }

      .platform-user-avatar {
        width: 28px;
        height: 28px;
        border-radius: 9px;
        display: grid;
        place-items: center;
        border: 1px solid #2f4d95;
        color: #9cb3e3;
        background: rgba(12, 29, 72, 0.9);
      }

      .platform-user small {
        display: block;
        color: #6e86bd;
        font-size: 0.63rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .platform-user strong {
        display: block;
        margin-top: 2px;
        font-size: 0.81rem;
      }

      .platform-support {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border: 1px solid #1e366f;
        border-radius: 12px;
        padding: 8px 10px 8px 11px;
        background: rgba(7, 17, 46, 0.9);
      }

      .platform-support span {
        color: var(--ink-soft);
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .platform-support form {
        margin: 0;
      }

      .logout-btn {
        border: 1px solid #2f4e9f;
        border-radius: 10px;
        background: rgba(15, 33, 79, 0.92);
        color: #cfddff;
        padding: 6px 9px;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.64rem;
        cursor: pointer;
      }

      .content {
        border: 1px solid var(--line);
        border-left: none;
        background: linear-gradient(180deg, rgba(4, 11, 33, 0.98), rgba(2, 8, 26, 0.99));
        box-shadow: var(--shadow);
        padding: 16px 20px 20px;
      }

      .content-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      h1 {
        margin: 0;
        font-size: 1.08rem;
      }

      .sub {
        margin: 5px 0 0;
        color: var(--ink-soft);
        font-size: 0.84rem;
      }

      .badge {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.62rem;
        color: var(--ink-soft);
        padding: 6px 10px 5px;
        border-radius: 999px;
        border: 1px solid #29498e;
        background: rgba(10, 29, 70, 0.88);
      }

      .section {
        border: 1px solid #1f3f82;
        border-radius: 14px;
        background: linear-gradient(160deg, rgba(8, 22, 56, 0.96), rgba(6, 18, 46, 0.96));
        padding: 14px;
      }

      label {
        display: block;
        font-size: 0.75rem;
        color: var(--ink-soft);
        margin-bottom: 8px;
      }

      textarea {
        width: 100%;
        min-height: 180px;
        border-radius: 12px;
        border: 1px solid #2f4d95;
        padding: 12px;
        resize: vertical;
        background: rgba(9, 24, 58, 0.94);
        color: #edf3ff;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.8rem;
      }

      textarea:focus {
        outline: none;
        border-color: #5d7eff;
        box-shadow: 0 0 0 4px rgba(90, 112, 236, 0.2);
      }

      .actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
      }

      button {
        border: 1px solid rgba(128, 144, 255, 0.48);
        border-radius: 12px;
        padding: 10px 14px;
        color: #fff;
        cursor: pointer;
        background: linear-gradient(135deg, #4f3eff, #5f4dff 56%, #6c5cff);
        font-family: "Space Grotesk", sans-serif;
        font-weight: 700;
        box-shadow: 0 10px 22px var(--glow);
      }

      .status {
        margin-top: 10px;
        font-size: 0.78rem;
        color: var(--ink-soft);
      }

      @media (max-width: 1080px) {
        .layout { grid-template-columns: 1fr; }
        .platform-panel { display: none; }
        .content { border-left: 1px solid var(--line); }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="layout">
        <aside class="platform-panel">
          <div class="platform-brand">
            <div class="platform-brand-badge">*</div>
            <div>
              <strong>Project Overload</strong>
              <span>Enterprise</span>
            </div>
          </div>
          <div class="platform-section">Core Platform</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/"><span class="link-icon">[]</span>Chat Explorer</a>
            <a class="platform-link" href="/usage"><span class="link-icon">=</span>Usage Metrics</a>
          </nav>
          <div class="platform-section">Infrastructure</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/connect"><span class="link-icon">DB</span>Data Sources</a>
            <a class="platform-link active" href="/config"><span class="link-icon">CFG</span>Global Config</a>
          </nav>
          <div class="platform-footer">
            <div class="platform-user">
              <div class="platform-user-avatar">@</div>
              <div>
                <small>Admin Profile</small>
                <strong>Project Owner</strong>
              </div>
            </div>
            <div class="platform-support">
              <span>Support</span>
              <form method="post" action="/auth/logout">
                <button type="submit" class="logout-btn">Sign Out</button>
              </form>
            </div>
          </div>
        </aside>

        <main class="content">
          <div class="content-head">
            <div>
              <h1>Global Config</h1>
              <p class="sub">Business context lives here and is used across chat planning and report generation.</p>
            </div>
            <span class="badge">Workspace Config</span>
          </div>

          <section class="section">
            <label for="business-context">Business Context</label>
            <textarea id="business-context" placeholder="Describe what this business does, key revenue model, and core operational constraints."></textarea>
            <div class="actions">
              <button id="save-config" type="button">Save Global Config</button>
            </div>
            <div class="status" id="status">Loading current config...</div>
          </section>
        </main>
      </div>
    </div>

    <script>
      (() => {
        const textarea = document.getElementById("business-context");
        const statusEl = document.getElementById("status");
        const saveBtn = document.getElementById("save-config");

        async function loadConfig() {
          const response = await fetch("/api/db/context");
          const payload = await response.json();
          if (!response.ok) {
            statusEl.textContent = "No active data source yet. Connect a source in Data Sources, then save business context.";
            return;
          }
          textarea.value = typeof payload.business_context === "string" ? payload.business_context : "";
          statusEl.textContent = "Loaded.";
        }

        async function saveConfig() {
          statusEl.textContent = "Saving...";
          const response = await fetch("/api/db/business-context", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ business_context: String(textarea.value || "") })
          });
          const payload = await response.json();
          if (!response.ok) {
            statusEl.textContent = payload && typeof payload.message === "string" ? payload.message : "Failed to save.";
            return;
          }
          statusEl.textContent = "Saved.";
        }

        saveBtn.addEventListener("click", () => {
          saveConfig().catch(() => {
            statusEl.textContent = "Failed to save.";
          });
        });

        loadConfig().catch(() => {
          statusEl.textContent = "Failed to load config.";
        });
      })();
    </script>
  </body>
</html>`;
}
