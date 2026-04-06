import { renderClaritectFaviconLinks, renderClaritectLogoImage } from "./brand";

export function renderUsageMetricsPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect | Usage and AI balance</title>
    ${renderClaritectFaviconLinks()}
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");

      :root {
        --ink: #F5F3FF;
        --ink-soft: #D7CFE6;
        --ink-muted: #9D90BC;
        --line: rgba(107, 92, 138, 0.28);
        --line-soft: rgba(236, 72, 153, 0.24);
        --glow: rgba(236, 72, 153, 0.22);
        --shadow: 0 24px 60px rgba(10, 6, 20, 0.48);
        --shadow-soft: 0 12px 32px rgba(10, 6, 20, 0.32);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 14% 10%, rgba(108, 58, 237, 0.22), transparent 24%),
          radial-gradient(circle at 88% 8%, rgba(236, 72, 153, 0.15), transparent 26%),
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
        width: 100%;
        padding: 14px;
      }

      .layout {
        display: grid;
        grid-template-columns: 212px 1fr;
        height: calc(100vh - 28px);
        gap: 14px;
      }

      .platform-panel {
        position: relative;
        border: 1px solid var(--line);
        border-radius: 28px;
        background:
          linear-gradient(180deg, rgba(20, 15, 34, 0.98), rgba(17, 12, 28, 0.98)),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: column;
        padding: 16px 15px 14px;
        overflow: hidden;
      }

      .platform-panel::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 20% 0%, rgba(108, 58, 237, 0.18), transparent 26%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 30%);
      }

      .platform-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 6px 14px;
        margin-bottom: 10px;
        border-bottom: 1px solid rgba(107, 92, 138, 0.24);
        position: relative;
        z-index: 1;
      }

      .platform-brand-badge {
        width: 56px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .platform-brand-badge img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        filter: drop-shadow(0 8px 20px rgba(118, 93, 255, 0.22));
      }

      .platform-brand strong {
        display: block;
        font-size: 0.78rem;
        line-height: 1.1;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }

      .platform-brand span {
        display: block;
        margin-top: 2px;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.62rem;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }

      .platform-section {
        margin: 16px 8px 8px;
        font-size: 0.58rem;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: var(--ink-muted);
        position: relative;
        z-index: 1;
      }

      .platform-nav {
        display: flex;
        flex-direction: column;
        gap: 6px;
        position: relative;
        z-index: 1;
      }

      .platform-link {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 11px 12px;
        border-radius: 14px;
        color: #E1DAF4;
        text-decoration: none;
        border: 1px solid rgba(107, 92, 138, 0.14);
        font-size: 0.84rem;
        font-weight: 600;
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, color 140ms ease;
      }

      .platform-link .link-icon {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: #9D90BC;
      }
      .platform-link .link-icon svg {
        width: 16px;
        height: 16px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .platform-link:hover {
        transform: translateX(2px);
        background: rgba(108, 58, 237, 0.16);
        border-color: rgba(236, 72, 153, 0.18);
      }

      .platform-link.active {
        background: rgba(108, 58, 237, 0.92);
        border-color: rgba(245, 243, 255, 0.22);
        color: #f3f8ff;
        box-shadow: 0 14px 30px rgba(108, 58, 237, 0.24);
      }

      .platform-link.active .link-icon {
        color: #e8f1ff;
      }

      .platform-footer {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        position: relative;
        z-index: 1;
      }

      .platform-user {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 16px;
        padding: 11px 12px;
        background: rgba(31, 21, 49, 0.82);
      }

      .platform-user-avatar {
        width: 28px;
        height: 28px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(108, 58, 237, 0.34);
        color: #E1DAF4;
        background: rgba(46, 28, 76, 0.92);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      .platform-user small {
        display: block;
        color: #9D90BC;
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
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 16px;
        padding: 9px 11px 9px 12px;
        background: rgba(24, 18, 39, 0.84);
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
        border: 1px solid rgba(107, 92, 138, 0.28);
        border-radius: 12px;
        background: rgba(34, 25, 56, 0.94);
        color: #F5F3FF;
        padding: 7px 10px;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.64rem;
        cursor: pointer;
      }

      .content {
        border: 1px solid var(--line);
        border-radius: 32px;
        background:
          linear-gradient(180deg, rgba(20, 15, 34, 0.98), rgba(17, 12, 28, 0.99)),
          radial-gradient(circle at 100% 0%, rgba(108, 58, 237, 0.16), transparent 24%);
        box-shadow: var(--shadow);
        padding: 20px 22px 22px;
        overflow-y: auto;
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
        font-size: 1.2rem;
      }

      .sub {
        margin: 8px 0 0;
        color: var(--ink-soft);
        font-size: 0.88rem;
      }

      .eyebrow {
        display: inline-block;
        margin-bottom: 8px;
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #EC4899;
      }

      .badge {
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.62rem;
        color: var(--ink-soft);
        padding: 6px 10px 5px;
        border-radius: 999px;
        border: 1px solid rgba(107, 92, 138, 0.28);
        background: rgba(39, 28, 63, 0.94);
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(4, minmax(120px, 1fr));
        gap: 10px;
        margin-bottom: 14px;
      }

      .card {
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 18px;
        background: linear-gradient(160deg, rgba(31, 21, 49, 0.84), rgba(24, 18, 39, 0.9));
        padding: 12px;
        box-shadow: var(--shadow-soft);
      }

      .card small {
        display: block;
        color: var(--ink-soft);
        font-size: 0.7rem;
        margin-bottom: 6px;
      }

      .card strong {
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 1rem;
      }

      .table-wrap {
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 18px;
        background: rgba(24, 18, 39, 0.76);
        overflow: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 640px;
      }

      th, td {
        padding: 10px;
        font-size: 0.75rem;
        text-align: left;
        border-bottom: 1px solid rgba(107, 92, 138, 0.18);
      }

      th {
        color: var(--ink-soft);
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
      }

      @media (max-width: 1080px) {
        .page { padding: 0; }
        .layout { grid-template-columns: 1fr; gap: 0; min-height: 100vh; }
        .platform-panel { display: none; }
        .content { border-left: 1px solid var(--line); border-radius: 0; }
        .cards { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
      }

      [data-theme="light"] {
        --ink: #1A1533;
        --ink-soft: #3D2E6B;
        --ink-muted: #6B5B9E;
        --line: rgba(107, 92, 138, 0.22);
        --shadow: 0 24px 60px rgba(80, 60, 120, 0.14);
        --shadow-soft: 0 12px 32px rgba(80, 60, 120, 0.10);
      }
      [data-theme="light"] body {
        background:
          radial-gradient(circle at 14% 10%, rgba(108, 58, 237, 0.07), transparent 28%),
          radial-gradient(circle at 88% 8%, rgba(236, 72, 153, 0.05), transparent 28%),
          linear-gradient(180deg, #F4F1FF 0%, #EDE8FF 44%, #E8E2FF 100%);
        color: #1A1533;
      }
      [data-theme="light"] body::before {
        background-image: linear-gradient(to right, rgba(107, 92, 138, 0.12) 1px, transparent 1px);
        mask-image: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.5), transparent 88%);
      }
      [data-theme="light"] body::after { opacity: 0.12; }
      [data-theme="light"] .platform-panel {
        background: linear-gradient(180deg, rgba(244, 241, 255, 0.98), rgba(237, 232, 255, 0.98));
        border-color: rgba(107, 92, 138, 0.18);
      }
      [data-theme="light"] .platform-brand { border-bottom-color: rgba(107, 92, 138, 0.18); }
      [data-theme="light"] .platform-link { color: #2D1F56; background: rgba(244, 241, 255, 0.5); border-color: rgba(107, 92, 138, 0.18); }
      [data-theme="light"] .platform-link.active { background: rgba(108, 58, 237, 0.88); color: #F5F3FF; }
      [data-theme="light"] .platform-user,
      [data-theme="light"] .platform-support { background: rgba(255, 255, 255, 0.88); border-color: rgba(107, 92, 138, 0.18); color: #1A1533; }
      [data-theme="light"] .logout-btn { background: rgba(255, 255, 255, 0.94); border-color: rgba(107, 92, 138, 0.24); color: #1A1533; }
      [data-theme="light"] .content {
        background: linear-gradient(180deg, rgba(248, 246, 255, 0.98), rgba(242, 238, 255, 0.98));
        border-color: rgba(107, 92, 138, 0.18);
      }
      [data-theme="light"] .card { background: rgba(255, 255, 255, 0.72); border-color: rgba(107, 92, 138, 0.18); color: #1A1533; }
      [data-theme="light"] .badge { background: rgba(255, 255, 255, 0.88); color: #3D2E6B; border-color: rgba(107, 92, 138, 0.22); }
      [data-theme="light"] th { color: #6B5B9E; background: rgba(240, 237, 255, 0.96); }
      [data-theme="light"] tbody tr:hover { background: rgba(108, 58, 237, 0.06); }
      .theme-toggle-btn {
        display: flex; align-items: center; gap: 8px; width: 100%;
        padding: 9px 12px; border-radius: 14px;
        border: 1px solid rgba(107, 92, 138, 0.24);
        background: rgba(34, 25, 56, 0.86); color: #F5F3FF;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.75rem; font-weight: 600; cursor: pointer;
        transition: background 180ms ease, border-color 180ms ease;
      }
      .theme-toggle-btn:hover { background: rgba(108, 58, 237, 0.14); border-color: rgba(107, 92, 138, 0.32); }
      [data-theme="light"] .theme-toggle-btn { background: rgba(255, 255, 255, 0.88); border-color: rgba(107, 92, 138, 0.24); color: #1A1533; }
      [data-theme="light"] .table-wrap {
        background: rgba(248, 246, 255, 0.82);
        border-color: rgba(107, 92, 138, 0.18);
      }
      [data-theme="light"] .table-wrap h2 { color: #1A1533; }
    </style>
    <script>(function(){try{var t=localStorage.getItem("claritect_theme_v1");if(t==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})()</script>
  </head>
  <body>
    <div class="page">
      <div class="layout">
        <aside class="platform-panel">
          <div class="platform-brand">
            <div class="platform-brand-badge">${renderClaritectLogoImage("platform-brand-logo")}</div>
            <div>
              <strong>Claritect</strong>
              <span>Decision intelligence</span>
            </div>
          </div>
          <div class="platform-section">Core Platform</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/app"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>Chat Explorer</a>
            <a class="platform-link active" href="/usage"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></span>Usage &amp; AI</a>
          </nav>
          <div class="platform-section">Infrastructure</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/connect"><span class="link-icon"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></span>Data Sources</a>
            <a class="platform-link" href="/scheduled"><span class="link-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h3"/><path d="M8 18h6"/></svg></span>Scheduled Reports</a>
            <a class="platform-link" href="/config"><span class="link-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>Global Config</a>
          </nav>
          <div class="platform-section">Resources</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/connect/tls-guide" target="_blank" rel="noreferrer"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>SSL / TLS Guide</a>
          </nav>
          <div class="platform-footer">
            <div class="platform-user">
              <div class="platform-user-avatar">@</div>
              <div>
                <small>Customer workspace</small>
                <strong>Claritect User</strong>
              </div>
            </div>
            <div class="platform-support">
              <span>Support</span>
              <form method="post" action="/auth/logout">
                <button type="submit" class="logout-btn">Sign Out</button>
              </form>
            </div>
            <button id="theme-toggle-btn" class="theme-toggle-btn" type="button">
              <span id="theme-toggle-icon">☀️</span>
              <span id="theme-toggle-label">Light mode</span>
            </button>
          </div>
        </aside>

        <main class="content">
          <div class="content-head">
            <div>
              <span class="eyebrow">Operations</span>
              <h1>Platform Activity</h1>
              <p class="sub">Report delivery, schedule health, and platform usage for your Claritect workspace.</p>
            </div>
            <span class="badge">Live</span>
          </div>

          <section class="cards">
            <article class="card"><small>Reports Delivered</small><strong id="r-total">—</strong></article>
            <article class="card"><small>Success Rate</small><strong id="r-success">—</strong></article>
            <article class="card"><small>Avg Time to Insight</small><strong id="r-avg-time">—</strong></article>
            <article class="card"><small>Active Schedules</small><strong id="r-active-schedules">—</strong></article>
          </section>

          <section class="cards" style="margin-top:12px;">
            <article class="card"><small>Active Users</small><strong id="p-users">—</strong></article>
            <article class="card"><small>Last Activity</small><strong id="p-last-active">—</strong></article>
            <article class="card"><small>Reports This Week</small><strong id="p-week">—</strong></article>
            <article class="card"><small>Failed Reports</small><strong id="p-failed">—</strong></article>
          </section>

          <section class="table-wrap" style="margin-top:14px;">
            <h2 style="margin:0 0 14px;font-size:1rem;">Recent report runs</h2>
            <table>
              <thead>
                <tr>
                  <th>Completed</th>
                  <th>Contract</th>
                  <th>Trigger</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="report-rows">
                <tr><td colspan="5">Loading report activity...</td></tr>
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </div>

    <script>
      const THEME_STORAGE_KEY = "claritect_theme_v1";
      const themeToggleBtnEl = document.getElementById("theme-toggle-btn");
      const themeToggleIconEl = document.getElementById("theme-toggle-icon");
      const themeToggleLabelEl = document.getElementById("theme-toggle-label");
      function applyTheme(theme) {
        if (theme === "light") {
          document.documentElement.setAttribute("data-theme", "light");
          if (themeToggleIconEl) themeToggleIconEl.textContent = "🌙";
          if (themeToggleLabelEl) themeToggleLabelEl.textContent = "Dark mode";
        } else {
          document.documentElement.removeAttribute("data-theme");
          if (themeToggleIconEl) themeToggleIconEl.textContent = "☀️";
          if (themeToggleLabelEl) themeToggleLabelEl.textContent = "Light mode";
        }
        try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch(e) {}
      }
      applyTheme((function(){try{return localStorage.getItem(THEME_STORAGE_KEY);}catch(e){return null;}})()==="light"?"light":"dark");
      if (themeToggleBtnEl) {
        themeToggleBtnEl.addEventListener("click", function() {
          applyTheme(document.documentElement.getAttribute("data-theme")==="light"?"dark":"light");
        });
      }
    </script>
    <script>
      (() => {
        function esc(value) {
          return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\\"/g, "&quot;")
            .replace(/'/g, "&#39;");
        }
        function toNumber(value) {
          const n = Number(value);
          return Number.isFinite(n) ? n : 0;
        }

        function fmtTs(value) {
          const d = new Date(String(value || ""));
          return Number.isFinite(d.getTime()) ? d.toLocaleString() : "-";
        }

        function fmtDuration(startedAt, finishedAt) {
          const start = new Date(String(startedAt || ""));
          const end = new Date(String(finishedAt || ""));
          if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return "-";
          const ms = end.getTime() - start.getTime();
          if (ms < 0) return "-";
          if (ms < 60000) return Math.round(ms / 1000) + "s";
          return (ms / 60000).toFixed(1) + " min";
        }

        function fmtLastActive(isoString) {
          const d = new Date(String(isoString || ""));
          if (!Number.isFinite(d.getTime())) return "—";
          const now = new Date();
          const diffMs = now.getTime() - d.getTime();
          const diffDays = Math.floor(diffMs / 86400000);
          if (diffDays === 0) return "Today";
          if (diffDays === 1) return "Yesterday";
          if (diffDays < 7) return diffDays + " days ago";
          return d.toLocaleDateString();
        }

        function fmtAvgTime(ms) {
          const n = Number(ms);
          if (!Number.isFinite(n) || n <= 0) return "—";
          if (n < 60000) return Math.round(n / 1000) + "s";
          return (n / 60000).toFixed(1) + " min";
        }

        async function load() {
          const reportTbody = document.getElementById("report-rows");
          const [summaryResponse, activityResponse] = await Promise.all([
            fetch("/api/usage/summary"),
            fetch("/api/usage/activity")
          ]);
          const summaryPayload = await summaryResponse.json();
          const activityPayload = await activityResponse.json();

          if (!summaryResponse.ok || !activityResponse.ok) {
            reportTbody.innerHTML = "<tr><td colspan=\\"5\\">Unable to load report activity.</td></tr>";
            return;
          }

          const summary = summaryPayload.summary || {};
          const reports = summary.reports || {};
          const schedules = summary.schedules || {};
          const users = summary.users || {};
          const runs = Array.isArray(activityPayload.runs) ? activityPayload.runs : [];

          // Row 1 — report performance
          document.getElementById("r-total").textContent = String(toNumber(reports.total_runs));
          document.getElementById("r-success").textContent = toNumber(reports.total_runs) === 0
            ? "—"
            : Math.round(toNumber(reports.success_rate) * 100) + "%";
          document.getElementById("r-avg-time").textContent = fmtAvgTime(reports.average_duration_ms);
          document.getElementById("r-active-schedules").textContent = String(toNumber(schedules.active));

          // Row 2 — platform activity
          document.getElementById("p-users").textContent = String(toNumber(users.active || users.total));
          document.getElementById("p-last-active").textContent = fmtLastActive(users.most_recent_login_at);
          const weekAgo = Date.now() - 7 * 86400000;
          const recentRuns = runs.filter(function(r) {
            const t = new Date(String(r.finished_at || r.started_at || "")).getTime();
            return Number.isFinite(t) && t >= weekAgo;
          });
          document.getElementById("p-week").textContent = String(recentRuns.length);
          const failedCount = runs.filter(function(r) { return r.status === "failed"; }).length;
          document.getElementById("p-failed").textContent = String(failedCount);

          // Report runs table
          if (runs.length === 0) {
            reportTbody.innerHTML = "<tr><td colspan=\\"5\\">No report runs yet.</td></tr>";
          } else {
            reportTbody.innerHTML = runs.map(function(entry) {
              const statusClass = entry.status === "failed" ? " style=\\"color:#ef4444;\\"" : entry.status === "succeeded" ? " style=\\"color:#22c55e;\\"" : "";
              const shortContract = esc(String(entry.contract_id || "-").replace(/^contract_/, "").slice(0, 12)) + "…";
              return "<tr>" +
                "<td>" + fmtTs(entry.finished_at || entry.started_at) + "</td>" +
                "<td><code title=\\"" + esc(entry.contract_id || "") + "\\">" + shortContract + "</code></td>" +
                "<td>" + esc(entry.trigger || "-") + "</td>" +
                "<td>" + fmtDuration(entry.started_at, entry.finished_at) + "</td>" +
                "<td" + statusClass + ">" + esc(entry.status || "-") + "</td>" +
                "</tr>";
            }).join("");
          }
        }

        load().catch(function() {
          const reportTbody = document.getElementById("report-rows");
          reportTbody.innerHTML = "<tr><td colspan=\\"5\\">Unable to load report activity.</td></tr>";
        });
      })();
    </script>
  </body>
</html>`;
}
