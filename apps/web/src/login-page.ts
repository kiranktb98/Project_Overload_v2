import { renderClaritectFaviconLinks, renderClaritectLogoImage } from "./brand";

export function renderLoginPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect | Customer login</title>
    ${renderClaritectFaviconLinks()}
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");

      :root {
        --ink: #F5F3FF;
        --ink-soft: #D7CFE6;
        --ink-muted: #9D90BC;
        --line: rgba(107, 92, 138, 0.28);
        --line-soft: rgba(236, 72, 153, 0.24);
        --surface: rgba(20, 15, 34, 0.96);
        --surface-2: rgba(26, 18, 42, 0.94);
        --primary: #6C3AED;
        --primary-2: #EC4899;
        --primary-3: #EC4899;
        --shadow: 0 30px 70px rgba(10, 6, 20, 0.58);
        --shadow-soft: 0 18px 40px rgba(10, 6, 20, 0.34);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 14% 12%, rgba(108, 58, 237, 0.22), transparent 24%),
          radial-gradient(circle at 88% 10%, rgba(236, 72, 153, 0.15), transparent 26%),
          radial-gradient(circle at 50% 100%, rgba(108, 58, 237, 0.12), transparent 30%),
          linear-gradient(180deg, #0F0B1A 0%, #130F20 44%, #161122 100%);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: linear-gradient(to right, rgba(107, 92, 138, 0.08) 1px, transparent 1px);
        background-size: 60px 60px;
        mask-image: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.86), transparent 92%);
      }

      body::after {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 18% 22%, rgba(108, 58, 237, 0.18), transparent 20%),
          radial-gradient(circle at 78% 16%, rgba(236, 72, 153, 0.18), transparent 24%);
        filter: blur(34px);
        opacity: 0.9;
      }

      .page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 20px;
      }

      .layout {
        position: relative;
        width: min(1120px, 100%);
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(360px, 430px);
        gap: 18px;
        align-items: stretch;
      }

      .hero {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 30px;
        padding: 30px 30px 26px;
        background:
          linear-gradient(180deg, rgba(20, 15, 34, 0.98), rgba(17, 12, 28, 0.98)),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
        box-shadow: var(--shadow);
      }

      .hero::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 14% 0%, rgba(108, 58, 237, 0.18), transparent 26%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 32%);
      }

      .hero-copy,
      .card {
        position: relative;
        z-index: 1;
      }

      .eyebrow {
        display: inline-block;
        margin-bottom: 10px;
        font-size: 0.64rem;
        text-transform: uppercase;
        letter-spacing: 0.24em;
        color: #EC4899;
      }

      .hero h1 {
        margin: 0;
        max-width: 14ch;
        font-size: clamp(2.5rem, 5vw, 4.6rem);
        line-height: 0.94;
        letter-spacing: -0.05em;
      }

      .hero p {
        max-width: 560px;
        margin: 16px 0 0;
        color: var(--ink-soft);
        font-size: 1rem;
        line-height: 1.65;
      }

      .hero-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 20px;
      }

      .hero-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        border: 1px solid rgba(107, 92, 138, 0.28);
        background: rgba(31, 21, 49, 0.82);
        padding: 9px 14px;
        color: #F5F3FF;
        font-size: 0.82rem;
        font-weight: 600;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 28px;
      }

      .hero-card {
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 20px;
        padding: 16px;
        background: linear-gradient(160deg, rgba(31, 21, 49, 0.78), rgba(24, 18, 39, 0.9));
        box-shadow: var(--shadow-soft);
      }

      .hero-card small {
        display: block;
        font-size: 0.64rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--ink-muted);
        margin-bottom: 10px;
      }

      .hero-card strong {
        display: block;
        font-size: 1.1rem;
        margin-bottom: 8px;
      }

      .hero-card span {
        display: block;
        color: var(--ink-soft);
        font-size: 0.83rem;
        line-height: 1.55;
      }

      .card {
        border: 1px solid var(--line);
        border-radius: 28px;
        background:
          linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%),
          radial-gradient(circle at 100% 0%, rgba(113, 122, 255, 0.12), transparent 24%);
        box-shadow: var(--shadow);
        padding: 26px 24px 24px;
        overflow: hidden;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 18px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(107, 92, 138, 0.24);
      }

      .badge {
        width: 56px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .badge img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        filter: drop-shadow(0 10px 22px rgba(118, 93, 255, 0.24));
      }

      .brand-copy strong {
        display: block;
        font-size: 0.82rem;
        line-height: 1.1;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }

      .brand-copy span {
        display: block;
        margin-top: 4px;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.66rem;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }

      .card h2 {
        margin: 0;
        font-size: 1.3rem;
      }

      .sub {
        margin: 8px 0 0;
        color: var(--ink-soft);
        font-size: 0.9rem;
        line-height: 1.6;
      }

      label {
        display: block;
        font-size: 0.72rem;
        color: var(--ink-soft);
        margin: 14px 0 7px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      input {
        width: 100%;
        border-radius: 14px;
        border: 1px solid rgba(107, 92, 138, 0.28);
        padding: 13px 14px;
        background: rgba(24, 18, 39, 0.84);
        color: #edf3ff;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.82rem;
      }

      input:focus {
        outline: none;
        border-color: #EC4899;
        box-shadow: 0 0 0 4px rgba(108, 58, 237, 0.18);
      }

      button {
        margin-top: 18px;
        width: 100%;
        border: 1px solid rgba(107, 92, 138, 0.32);
        border-radius: 14px;
        padding: 13px 14px;
        color: #F5F3FF;
        cursor: pointer;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-weight: 700;
        background: #6C3AED;
        box-shadow: 0 12px 28px rgba(108, 58, 237, 0.24);
      }

      .status {
        min-height: 22px;
        margin-top: 12px;
        color: #fca5a5;
        font-size: 0.77rem;
      }

      .hint {
        margin-top: 14px;
        font-size: 0.72rem;
        color: var(--ink-soft);
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        line-height: 1.6;
      }

      .hint strong {
        color: #F5F3FF;
      }

      .hint-grid {
        display: grid;
        gap: 10px;
        margin-top: 18px;
      }

      .hint-card {
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 16px;
        padding: 12px 14px;
        background: rgba(31, 21, 49, 0.76);
      }

      .hint-card small {
        display: block;
        margin-bottom: 6px;
        font-size: 0.64rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }

      .hint-card span {
        display: block;
        color: var(--ink-soft);
        font-size: 0.78rem;
        line-height: 1.55;
      }

      @media (max-width: 980px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .hero {
          padding: 24px 22px 22px;
        }

        .hero h1 {
          max-width: none;
          font-size: clamp(2.1rem, 11vw, 3.4rem);
        }

        .hero-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .page {
          padding: 12px;
        }

        .card,
        .hero {
          border-radius: 24px;
          padding-left: 18px;
          padding-right: 18px;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="layout">
        <section class="hero">
          <div class="hero-copy">
            <span class="eyebrow">Decision intelligence</span>
            <h1>Launch governed analytics from one live workspace.</h1>
            <p>Claritect keeps scoping, governed SQL, report generation, and follow-up decision support in one premium operating surface so teams can move quickly without losing trust in the evidence.</p>
            <div class="hero-pills">
              <span class="hero-pill">Scoped analysis</span>
              <span class="hero-pill">Governed SQL</span>
              <span class="hero-pill">Business-ready reports</span>
            </div>
            <div class="hero-grid">
              <article class="hero-card">
                <small>Flow</small>
                <strong>One thread</strong>
                <span>Keep prep, report creation, clarifications, and recommendations inside a single working conversation.</span>
              </article>
              <article class="hero-card">
                <small>Trust</small>
                <strong>Evidence first</strong>
                <span>Use capped, read-only query runs with report sections grounded in the prepared payload.</span>
              </article>
              <article class="hero-card">
                <small>Output</small>
                <strong>Executive-ready</strong>
                <span>Move from raw tables to polished HTML reports and follow-up business case analysis without switching tools.</span>
              </article>
            </div>
          </div>
        </section>

        <main class="card">
          <div class="brand">
            <div class="badge">${renderClaritectLogoImage("brand-logo")}</div>
            <div class="brand-copy">
              <strong>Claritect</strong>
              <span>Customer access</span>
            </div>
          </div>
          <h2>Sign in to continue</h2>
          <p class="sub">Access the chat workspace, data sources, usage insights, scheduled reports, and global definitions from the same governed surface.</p>
          <form id="login-form">
            <label for="username">Username</label>
            <input id="username" name="username" autocomplete="username" required />
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required />
            <button type="submit">Sign In</button>
            <div class="status" id="status"></div>
          </form>
          <div class="hint">Demo credentials: <strong>test123</strong> / <strong>test123</strong>, <strong>krypton123</strong> / <strong>test123</strong>, or <strong>test456</strong> / <strong>test456</strong></div>
          <div class="hint-grid">
            <div class="hint-card">
              <small>Best for</small>
              <span>Testing chat scoping, report generation, clarification flows, and the governance shell without touching production data.</span>
            </div>
            <div class="hint-card">
              <small>Workspace</small>
              <span>The same login unlocks the connection wizard, live query metrics, and global business context used during planning.</span>
            </div>
          </div>
        </main>
      </div>
    </div>

    <script>
      (() => {
        const form = document.getElementById("login-form");
        const statusEl = document.getElementById("status");
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          statusEl.textContent = "";
          const username = String(document.getElementById("username").value || "");
          const password = String(document.getElementById("password").value || "");

          const response = await fetch("/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password })
          });

          if (!response.ok) {
            statusEl.textContent = "Invalid credentials. Use test123 / test123, krypton123 / test123, or test456 / test456.";
            return;
          }

          window.location.href = "/app";
        });
      })();
    </script>
  </body>
</html>`;
}
