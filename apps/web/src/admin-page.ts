import { renderClaritectLogoImage } from "./brand";

type AdminPageKey = "dashboard" | "accounts" | "support" | "finance";

type AdminShellInput = {
  title: string;
  active: AdminPageKey;
  eyebrow: string;
  page_title: string;
  page_subtitle: string;
  page_badge: string;
  body: string;
  script: string;
};

const SHARED_STYLE = `
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");

  :root {
    --bg: #0F0B1A;
    --panel: rgba(20, 15, 34, 0.96);
    --panel-2: rgba(26, 18, 42, 0.94);
    --panel-3: rgba(31, 21, 49, 0.88);
    --line: rgba(107, 92, 138, 0.24);
    --ink: #F5F3FF;
    --ink-soft: #D7CFE6;
    --ink-muted: #9D90BC;
    --accent: #6C3AED;
    --accent-pink: #EC4899;
    --shadow: 0 28px 70px rgba(10, 6, 20, 0.52);
    --shadow-soft: 0 18px 40px rgba(10, 6, 20, 0.3);
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    min-height: 100vh;
    font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(circle at 14% 10%, rgba(108, 58, 237, 0.2), transparent 24%),
      radial-gradient(circle at 88% 8%, rgba(236, 72, 153, 0.12), transparent 24%),
      radial-gradient(circle at 50% 100%, rgba(108, 58, 237, 0.1), transparent 30%),
      linear-gradient(180deg, #0F0B1A 0%, #130F20 46%, #161122 100%);
  }
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(to right, rgba(107, 92, 138, 0.08) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(107, 92, 138, 0.05) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(circle at 50% 40%, rgba(0, 0, 0, 0.88), transparent 94%);
  }

  .page { width: 100%; padding: 14px; }
  .layout { display: grid; grid-template-columns: 236px minmax(0, 1fr); gap: 14px; height: calc(100vh - 28px); }
  .shell-card {
    border: 1px solid var(--line);
    border-radius: 28px;
    background:
      linear-gradient(180deg, rgba(20, 15, 34, 0.98), rgba(17, 12, 28, 0.98)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .sidebar, .content { position: relative; }
  .sidebar { display: flex; flex-direction: column; padding: 16px 15px 14px; }
  .content { overflow-y: auto; }
  .sidebar::before, .content::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 16% 0%, rgba(108, 58, 237, 0.18), transparent 26%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 30%);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 6px 16px;
    border-bottom: 1px solid rgba(107, 92, 138, 0.22);
    position: relative;
    z-index: 1;
  }
  .brand-badge { width: 58px; height: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .brand-badge img { width: 100%; height: 100%; display: block; object-fit: contain; filter: drop-shadow(0 10px 22px rgba(108, 58, 237, 0.2)); }
  .brand strong { display: block; font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase; }
  .brand span { display: block; margin-top: 3px; font-size: 0.64rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--ink-muted); }
  .nav-section { margin: 18px 8px 10px; font-size: 0.58rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--ink-muted); position: relative; z-index: 1; }
  .nav { display: flex; flex-direction: column; gap: 8px; position: relative; z-index: 1; }
  .nav-link {
    display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 13px; border-radius: 16px;
    border: 1px solid rgba(107, 92, 138, 0.16); color: #E7DFF7; text-decoration: none; background: rgba(28, 21, 45, 0.62);
    font-size: 0.86rem; font-weight: 600; transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
  }
  .nav-link:hover { transform: translateX(2px); border-color: rgba(236, 72, 153, 0.22); background: rgba(108, 58, 237, 0.14); }
  .nav-link.active { background: #6C3AED; border-color: rgba(245, 243, 255, 0.24); color: #F5F3FF; box-shadow: 0 14px 28px rgba(108, 58, 237, 0.22); }
  .nav-link small { color: inherit; opacity: 0.76; font-size: 0.72rem; font-weight: 600; }
  .sidebar-footer { margin-top: auto; display: grid; gap: 10px; position: relative; z-index: 1; }
  .sidebar-panel {
    border: 1px solid rgba(107, 92, 138, 0.2); border-radius: 18px; background: rgba(31, 21, 49, 0.82); padding: 12px 13px;
  }
  .sidebar-panel small { display: block; color: var(--ink-muted); font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 8px; }
  .sidebar-panel strong { display: block; font-size: 0.96rem; }
  .sidebar-panel span { display: block; margin-top: 4px; font-size: 0.8rem; color: var(--ink-soft); line-height: 1.55; }
  .logout-btn {
    width: 100%; min-height: 44px; border-radius: 14px; border: 1px solid rgba(107, 92, 138, 0.28); background: rgba(34, 25, 56, 0.94);
    color: #F5F3FF; font-family: Inter, "Sohne", "Suisse Intl", sans-serif; font-size: 0.78rem; font-weight: 700; cursor: pointer;
  }
  .content { padding: 22px; }
  .page-head { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
  .eyebrow { display: inline-block; margin-bottom: 10px; color: var(--accent-pink); font-size: 0.64rem; letter-spacing: 0.24em; text-transform: uppercase; }
  h1 { margin: 0; font-size: 1.52rem; line-height: 1.05; letter-spacing: -0.03em; }
  .page-subtitle { margin: 8px 0 0; max-width: 70ch; color: var(--ink-soft); line-height: 1.7; }
  .head-badge { flex-shrink: 0; padding: 9px 12px; border-radius: 999px; border: 1px solid rgba(107, 92, 138, 0.24); background: rgba(31, 21, 49, 0.86); font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); }
  .stack { position: relative; z-index: 1; display: grid; gap: 14px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .summary-card, .panel, .table-panel, .detail-panel, .empty-panel {
    border: 1px solid rgba(107, 92, 138, 0.2); border-radius: 22px; background: linear-gradient(180deg, rgba(28, 21, 45, 0.92), rgba(22, 17, 35, 0.94)); box-shadow: var(--shadow-soft);
  }
  .summary-card { padding: 16px; }
  .summary-card small { display: block; color: var(--ink-muted); font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 10px; }
  .summary-card strong { display: block; font-size: 1.35rem; line-height: 1.05; margin-bottom: 8px; }
  .summary-card span { display: block; color: var(--ink-soft); font-size: 0.84rem; line-height: 1.55; }
  .panel, .detail-panel, .empty-panel { padding: 18px; }
  .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  .panel h2, .detail-panel h2, .empty-panel h2 { margin: 0; font-size: 1rem; letter-spacing: -0.02em; }
  .panel p, .detail-panel p, .empty-panel p { margin: 8px 0 0; color: var(--ink-soft); line-height: 1.65; font-size: 0.88rem; }
  .shell-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.92fr); gap: 14px; align-items: start; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .toolbar input, .toolbar select, .toolbar textarea, .detail-panel input, .detail-panel select, .detail-panel textarea {
    width: 100%; min-height: 44px; border-radius: 14px; border: 1px solid rgba(107, 92, 138, 0.24); background: rgba(17, 12, 28, 0.88); color: var(--ink); padding: 0 12px; font-family: Inter, "Sohne", "Suisse Intl", sans-serif; font-size: 0.88rem;
  }
  .toolbar textarea, .detail-panel textarea { min-height: 112px; padding: 12px; resize: vertical; }
  .toolbar input::placeholder, .toolbar textarea::placeholder, .detail-panel input::placeholder, .detail-panel textarea::placeholder { color: #8F83AC; }
  .btn, .btn-subtle, .btn-ghost {
    display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border-radius: 14px; font-family: Inter, "Sohne", "Suisse Intl", sans-serif; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: transform 150ms ease, border-color 150ms ease, background 150ms ease; text-decoration: none;
  }
  .btn { border: 1px solid rgba(245, 243, 255, 0.22); background: #6C3AED; color: #F5F3FF; }
  .btn-subtle { border: 1px solid rgba(107, 92, 138, 0.24); background: rgba(31, 21, 49, 0.86); color: #F5F3FF; }
  .btn-ghost { border: 1px solid transparent; background: transparent; color: var(--ink-soft); }
  .btn:hover, .btn-subtle:hover, .btn-ghost:hover { transform: translateY(-1px); }
  .table-panel { overflow: hidden; }
  .table-scroll { overflow: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 13px 14px; border-bottom: 1px solid rgba(107, 92, 138, 0.14); vertical-align: top; }
  th { position: sticky; top: 0; background: rgba(22, 17, 35, 0.96); color: var(--ink-muted); font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.16em; z-index: 1; }
  td { color: var(--ink-soft); font-size: 0.84rem; line-height: 1.55; }
  tbody tr { transition: background 140ms ease; }
  tbody tr:hover { background: rgba(108, 58, 237, 0.07); }
  tbody tr.is-selected { background: rgba(108, 58, 237, 0.14); }
  .pill {
    display: inline-flex; align-items: center; gap: 7px; padding: 7px 10px; border-radius: 999px; border: 1px solid rgba(107, 92, 138, 0.22); background: rgba(31, 21, 49, 0.78); color: var(--ink-soft); font-size: 0.72rem; font-weight: 700; line-height: 1;
  }
  .pill[data-tone="good"] { color: #D7FFF8; border-color: rgba(125, 211, 199, 0.24); background: rgba(17, 73, 64, 0.36); }
  .pill[data-tone="warn"] { color: #FFF2CC; border-color: rgba(251, 191, 36, 0.24); background: rgba(89, 58, 8, 0.36); }
  .pill[data-tone="danger"] { color: #FFD7D7; border-color: rgba(248, 113, 113, 0.26); background: rgba(96, 32, 32, 0.38); }
  .metric-row, .detail-list, .timeline-list { display: grid; gap: 10px; }
  .detail-item {
    display: grid; gap: 4px; padding: 12px 13px; border-radius: 16px; border: 1px solid rgba(107, 92, 138, 0.16); background: rgba(18, 14, 29, 0.76);
  }
  .detail-item small { color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.16em; font-size: 0.6rem; }
  .detail-item strong { font-size: 0.95rem; color: var(--ink); }
  .detail-item span { color: var(--ink-soft); font-size: 0.82rem; line-height: 1.55; }
  .empty-panel { display: grid; place-items: center; text-align: center; min-height: 280px; }
  .split-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .table-actions { display: flex; align-items: center; gap: 8px; }
  .muted { color: var(--ink-muted); }
  .status-note { margin-top: 8px; min-height: 1.3rem; color: var(--ink-soft); font-size: 0.82rem; }
  .status-note[data-tone="danger"] { color: #FFC2C2; }
  .status-note[data-tone="good"] { color: #BDF2E8; }
  @media (max-width: 1180px) {
    .layout, .shell-grid { grid-template-columns: 1fr; }
    .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    .page { padding: 10px; }
    .content { padding: 16px; }
    .page-head { flex-direction: column; }
    .summary-grid, .split-grid { grid-template-columns: 1fr; }
    th, td { padding: 11px 10px; }
  }

  [data-theme="light"] {
    --bg: #F4F1FF;
    --panel: rgba(244, 241, 255, 0.96);
    --panel-2: rgba(248, 246, 255, 0.94);
    --panel-3: rgba(255, 255, 255, 0.88);
    --line: rgba(107, 92, 138, 0.18);
    --ink: #1A1533;
    --ink-soft: #3D2E6B;
    --ink-muted: #6B5B9E;
    --shadow: 0 28px 70px rgba(80, 60, 120, 0.14);
    --shadow-soft: 0 18px 40px rgba(80, 60, 120, 0.10);
  }
  [data-theme="light"] body {
    background:
      radial-gradient(circle at 14% 10%, rgba(108, 58, 237, 0.07), transparent 24%),
      radial-gradient(circle at 88% 8%, rgba(236, 72, 153, 0.04), transparent 24%),
      linear-gradient(180deg, #F4F1FF 0%, #EDE8FF 46%, #E8E2FF 100%);
    color: #1A1533;
  }
  [data-theme="light"] body::before {
    background-image:
      linear-gradient(to right, rgba(107, 92, 138, 0.12) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(107, 92, 138, 0.08) 1px, transparent 1px);
    mask-image: radial-gradient(circle at 50% 40%, rgba(0, 0, 0, 0.5), transparent 90%);
  }
  [data-theme="light"] .shell-card {
    background: linear-gradient(180deg, rgba(248, 246, 255, 0.98), rgba(242, 238, 255, 0.98));
    border-color: rgba(107, 92, 138, 0.18);
  }
  [data-theme="light"] .nav-link { color: #2D1F56; background: rgba(244, 241, 255, 0.5); border-color: rgba(107, 92, 138, 0.18); }
  [data-theme="light"] .nav-link:hover { background: rgba(108, 58, 237, 0.12); border-color: rgba(107, 92, 138, 0.28); transform: translateX(2px); }
  [data-theme="light"] .nav-link.active { background: #6C3AED; color: #F5F3FF; }
  [data-theme="light"] .sidebar-panel { background: rgba(255, 255, 255, 0.72); border-color: rgba(107, 92, 138, 0.16); }
  [data-theme="light"] .logout-btn { background: rgba(255, 255, 255, 0.94); border-color: rgba(107, 92, 138, 0.24); color: #1A1533; }
  [data-theme="light"] .summary-card,
  [data-theme="light"] .panel,
  [data-theme="light"] .table-panel,
  [data-theme="light"] .detail-panel,
  [data-theme="light"] .empty-panel { background: rgba(255, 255, 255, 0.82); border-color: rgba(107, 92, 138, 0.18); }
  [data-theme="light"] th { background: rgba(240, 237, 255, 0.96); color: #6B5B9E; }
  [data-theme="light"] tbody tr:hover { background: rgba(108, 58, 237, 0.06); }
  [data-theme="light"] .toolbar input,
  [data-theme="light"] .toolbar select,
  [data-theme="light"] .toolbar textarea,
  [data-theme="light"] .detail-panel input,
  [data-theme="light"] .detail-panel select,
  [data-theme="light"] .detail-panel textarea { background: rgba(248, 246, 255, 0.88); color: #1A1533; border-color: rgba(107, 92, 138, 0.28); }
  [data-theme="light"] .detail-item { background: rgba(244, 241, 255, 0.72); border-color: rgba(107, 92, 138, 0.16); }
  [data-theme="light"] .pill { background: rgba(244, 241, 255, 0.88); border-color: rgba(107, 92, 138, 0.22); color: #3D2E6B; }
  .theme-toggle-btn {
    display: flex; align-items: center; gap: 8px; width: 100%;
    min-height: 44px; padding: 0 14px; border-radius: 14px;
    border: 1px solid rgba(107, 92, 138, 0.24);
    background: rgba(34, 25, 56, 0.86); color: #F5F3FF;
    font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
    font-size: 0.78rem; font-weight: 700; cursor: pointer;
    transition: background 180ms ease, border-color 180ms ease;
  }
  .theme-toggle-btn:hover { transform: translateY(-1px); }
  [data-theme="light"] .theme-toggle-btn { background: rgba(255, 255, 255, 0.88); border-color: rgba(107, 92, 138, 0.24); color: #1A1533; }
`;

const COMMON_CLIENT_SCRIPT = `
  const AdminUi = (() => {
    const api = {
      async get(url) {
        const response = await fetch(url, { credentials: 'same-origin' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload && payload.message ? payload.message : 'Unable to load data.');
        return payload;
      },
      async post(url, body) {
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload && payload.message ? payload.message : 'Unable to save changes.');
        return payload;
      }
    };

    function esc(value) {
      return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function formatNumber(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
      return new Intl.NumberFormat('en-US').format(value);
    }
    function formatMoney(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
    }
    function formatDateTime(value) {
      if (!value) return '--';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '--';
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    }
    function formatDate(value) {
      if (!value) return '--';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '--';
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
    }
    function formatRelative(value) {
      if (!value) return '--';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '--';
      const diffMs = date.getTime() - Date.now();
      const abs = Math.abs(diffMs);
      const minute = 60 * 1000;
      const hour = 60 * minute;
      const day = 24 * hour;
      const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
      if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
      if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
      return rtf.format(Math.round(diffMs / day), 'day');
    }
    function toneForStatus(value) {
      const text = String(value ?? '').toLowerCase();
      if (['active', 'paid', 'resolved', 'succeeded', 'healthy', 'open'].includes(text)) return 'good';
      if (['trial', 'pending', 'issued', 'paused'].includes(text)) return 'warn';
      if (['failed', 'overdue', 'closed', 'void', 'inactive', 'cancelled'].includes(text)) return 'danger';
      return 'neutral';
    }
    function pill(value, tone) {
      return '<span class="pill" data-tone="' + esc(tone || toneForStatus(value)) + '">' + esc(value) + '</span>';
    }
    function metricCard(label, value, hint) {
      return '<article class="summary-card"><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong><span>' + esc(hint || '') + '</span></article>';
    }
    function renderSummary(el, cards) {
      el.innerHTML = cards.map((card) => metricCard(card.label, card.value, card.hint)).join('');
    }
    function setNote(el, message, tone) {
      if (!el) return;
      el.textContent = message || '';
      el.dataset.tone = tone || 'neutral';
    }
    function emptyState(message) {
      return '<div class="empty-panel"><div><h2>Nothing here yet</h2><p>' + esc(message) + '</p></div></div>';
    }
    return { api, esc, formatNumber, formatMoney, formatDateTime, formatDate, formatRelative, toneForStatus, pill, renderSummary, setNote, emptyState };
  })();
`;

function renderNavLink(href: string, label: string, active: boolean, note: string): string {
  return `<a class="nav-link${active ? " active" : ""}" href="${href}"><span>${label}</span><small>${note}</small></a>`;
}

function renderAdminShell(input: AdminShellInput): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title}</title>
    <style>${SHARED_STYLE}</style>
    <script>(function(){try{var t=localStorage.getItem("claritect_theme_v1");if(t==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})()</script>
  </head>
  <body>
    <div class="page">
      <div class="layout">
        <aside class="shell-card sidebar">
          <div class="brand">
            <div class="brand-badge">${renderClaritectLogoImage("admin-brand-logo")}</div>
            <div><strong>Claritect</strong><span>Admin console</span></div>
          </div>
          <div class="nav-section">Backoffice</div>
          <nav class="nav" aria-label="Admin navigation">
            ${renderNavLink("/admin", "Dashboard", input.active === "dashboard", "Health")}
            ${renderNavLink("/admin/accounts", "Accounts", input.active === "accounts", "Operating table")}
            ${renderNavLink("/admin/support", "Support", input.active === "support", "Tickets")}
            ${renderNavLink("/admin/finance", "Finance", input.active === "finance", "Cost and credits")}
          </nav>
          <div class="sidebar-footer">
            <div class="sidebar-panel"><small>Session</small><strong>Claritect admin</strong><span>Use this console for accounts, support, and finance operations.</span></div>
            <div class="sidebar-panel"><small>Scope</small><strong>Backoffice only</strong><span>Customer schedules and report detail stay summarized unless you open an account drilldown.</span></div>
            <form method="POST" action="/admin/auth/logout"><button class="logout-btn" type="submit">Sign out</button></form>
            <button id="theme-toggle-btn" class="theme-toggle-btn" type="button">
              <span id="theme-toggle-icon">☀️</span>
              <span id="theme-toggle-label">Light mode</span>
            </button>
          </div>
        </aside>
        <main class="shell-card content">
          <header class="page-head">
            <div>
              <span class="eyebrow">${input.eyebrow}</span>
              <h1>${input.page_title}</h1>
              <p class="page-subtitle">${input.page_subtitle}</p>
            </div>
            <div class="head-badge">${input.page_badge}</div>
          </header>
          <div class="stack">${input.body}</div>
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
    <script>${COMMON_CLIENT_SCRIPT}</script>
    <script>${input.script}</script>
  </body>
</html>`;
}

export function renderAdminDashboardPage(): string {
  return renderAdminShell({
    title: "Claritect | Admin dashboard",
    active: "dashboard",
    eyebrow: "Claritect operations",
    page_title: "Admin console",
    page_subtitle:
      "Watch the platform at account level: support pressure, plan-credit usage, infrastructure cost, and OpenRouter runway in one place.",
    page_badge: "Live overview",
    body: `
      <section class="summary-grid" id="overview-summary"></section>
      <section class="shell-grid">
        <div class="stack">
          <section class="table-panel">
            <div class="panel-head panel" style="border:none; border-radius:0; background:transparent; box-shadow:none; padding:18px 18px 0;">
              <div><h2>Watchlist</h2><p>Accounts that need attention based on support load, failed runs, and plan-credit pressure.</p></div>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr><th>Account</th><th>Status</th><th>Open tickets</th><th>Failed runs</th><th>Run credits</th><th>Last activity</th></tr>
                </thead>
                <tbody id="overview-watchlist"></tbody>
              </table>
            </div>
          </section>
          <div class="split-grid">
            <section class="panel">
              <div class="panel-head"><div><h2>Recent tickets</h2><p>Newest support movement across all accounts.</p></div></div>
              <div class="timeline-list" id="overview-tickets"></div>
            </section>
            <section class="panel">
              <div class="panel-head"><div><h2>Credit watch</h2><p>Plan entitlements, AI usage, and infra posture by account.</p></div></div>
              <div class="timeline-list" id="overview-finance"></div>
            </section>
          </div>
        </div>
        <aside class="stack">
          <section class="detail-panel">
            <div class="panel-head"><div><h2>Operations snapshot</h2><p>OpenRouter credit position, limit pressure, and current infrastructure model.</p></div></div>
            <div class="detail-list" id="overview-ops"></div>
          </section>
          <section class="detail-panel">
            <div class="panel-head"><div><h2>OpenRouter balance history</h2><p>Recent balance snapshots captured by the control plane.</p></div></div>
            <div class="detail-list" id="overview-history"></div>
          </section>
        </aside>
      </section>
    `,
    script: `
      (() => {
        const summaryEl = document.getElementById('overview-summary');
        const watchlistEl = document.getElementById('overview-watchlist');
        const opsEl = document.getElementById('overview-ops');
        const historyEl = document.getElementById('overview-history');
        const ticketsEl = document.getElementById('overview-tickets');
        const financeEl = document.getElementById('overview-finance');

        AdminUi.api.get('/api/admin/overview').then((payload) => {
          const overview = payload.overview || {};
          AdminUi.renderSummary(summaryEl, [
            { label: 'Customers', value: AdminUi.formatNumber(overview.customers || 0), hint: 'Customer accounts on the control plane' },
            { label: 'Users', value: AdminUi.formatNumber(overview.active_users || 0), hint: 'Currently enabled seats across all accounts' },
            { label: 'Connections', value: AdminUi.formatNumber(overview.connections || 0), hint: 'Governed sources connected across accounts' },
            { label: 'Open tickets', value: AdminUi.formatNumber(overview.open_tickets || 0), hint: 'Support threads not yet closed' }
          ]);

          const watchlist = Array.isArray(payload.watchlist) ? payload.watchlist : [];
          watchlistEl.innerHTML = watchlist.length
            ? watchlist.map((item) => '<tr><td><strong>' + AdminUi.esc(item.account_name) + '</strong><br /><span class="muted">' + AdminUi.esc(item.plan_tier) + '</span></td><td>' + AdminUi.pill(item.account_status || 'active') + '</td><td>' + AdminUi.esc(AdminUi.formatNumber(item.open_tickets || 0)) + '</td><td>' + AdminUi.esc(AdminUi.formatNumber(item.failed_runs || 0)) + '</td><td>' + AdminUi.esc(AdminUi.formatNumber(item.current_period_report_runs || 0)) + ' / ' + AdminUi.esc(AdminUi.formatNumber(item.monthly_runs_limit || 0)) + '</td><td>' + AdminUi.esc(AdminUi.formatRelative(item.last_activity_at)) + '</td></tr>').join('')
            : '<tr><td colspan="6">No accounts in the watchlist.</td></tr>';

          const balance = payload.openrouter_balance || {};
          const openRouterBalanceValue = balance.remaining_credits == null ? balance.total_credits : balance.remaining_credits;
          opsEl.innerHTML = [
            { label: 'OpenRouter balance', value: openRouterBalanceValue == null ? 'Unavailable' : AdminUi.formatNumber(openRouterBalanceValue), hint: balance.remaining_credits == null && balance.total_credits != null ? 'Using total credits because remaining credits were not returned.' : 'Source: ' + AdminUi.esc(balance.source || 'unknown') },
            { label: 'Urgent tickets', value: AdminUi.formatNumber(overview.urgent_tickets || 0), hint: 'Highest priority support load' },
            { label: 'Accounts near limits', value: AdminUi.formatNumber(overview.accounts_near_limits || 0), hint: 'Accounts close to run, schedule, or AI-credit limits' },
            { label: 'Infra cost in play', value: AdminUi.formatMoney(overview.latest_infra_cost_usd || 0), hint: 'Current infrastructure ledger total' }
          ].map((item) => '<div class="detail-item"><small>' + AdminUi.esc(item.label) + '</small><strong>' + AdminUi.esc(item.value) + '</strong><span>' + item.hint + '</span></div>').join('');

          const history = Array.isArray(payload.openrouter_history) ? payload.openrouter_history : [];
          historyEl.innerHTML = history.length
            ? history.map((item) => '<div class="detail-item"><small>' + AdminUi.esc(AdminUi.formatDateTime(item.captured_at)) + '</small><strong>' + AdminUi.esc(item.remaining_credits == null ? 'Unavailable' : AdminUi.formatNumber(item.remaining_credits) + ' credits') + '</strong><span>Source: ' + AdminUi.esc(item.source) + (item.stale_reason ? ' | ' + AdminUi.esc(item.stale_reason) : '') + '</span></div>').join('')
            : '<div class="detail-item"><small>History</small><strong>No balance history yet</strong><span>Balance snapshots will appear here as the control plane refreshes them.</span></div>';

          const tickets = Array.isArray(payload.recent_tickets) ? payload.recent_tickets : [];
          ticketsEl.innerHTML = tickets.length
            ? tickets.map((item) => '<div class="detail-item"><small>' + AdminUi.esc(item.account_name) + '</small><strong>' + AdminUi.esc(item.title) + '</strong><span>' + AdminUi.pill(item.status) + ' ' + AdminUi.pill(item.priority, item.priority === 'urgent' ? 'danger' : item.priority === 'high' ? 'warn' : 'neutral') + '</span></div>').join('')
            : '<div class="detail-item"><small>Tickets</small><strong>No active ticket pressure</strong><span>Support will appear here once tickets open or change state.</span></div>';

          const finance = Array.isArray(payload.credit_watch) ? payload.credit_watch : [];
          financeEl.innerHTML = finance.length
            ? finance.map((item) => '<div class="detail-item"><small>' + AdminUi.esc(item.account_name) + '</small><strong>' + AdminUi.esc(item.plan_tier) + '</strong><span>Runs ' + AdminUi.esc(AdminUi.formatNumber(item.current_period_report_runs || 0)) + '/' + AdminUi.esc(AdminUi.formatNumber(item.monthly_runs_limit || 0)) + ' | AI ' + (item.estimated_ai_cost_usd == null ? '--' : AdminUi.formatMoney(item.estimated_ai_cost_usd)) + '</span></div>').join('')
            : '<div class="detail-item"><small>Credits</small><strong>No credit pressure</strong><span>Accounts will show here once usage approaches configured limits.</span></div>';
        }).catch((error) => {
          summaryEl.innerHTML = AdminUi.emptyState(error.message || 'Unable to load admin overview.');
          watchlistEl.innerHTML = '<tr><td colspan="6">' + AdminUi.esc(error.message || 'Unable to load watchlist.') + '</td></tr>';
          opsEl.innerHTML = '';
          historyEl.innerHTML = '';
          ticketsEl.innerHTML = '';
          financeEl.innerHTML = '';
        });
      })();
    `
  });
}

export function renderAdminAccountsPage(): string {
  return renderAdminShell({
    title: "Claritect | Accounts",
    active: "accounts",
    eyebrow: "Backoffice table",
    page_title: "Customer operating table",
    page_subtitle:
      "One row per account with users, connections, plan entitlements, report usage, schedule slots, support load, and current cost posture.",
    page_badge: "Accounts",
    body: `
      <section class="summary-grid" id="accounts-summary"></section>
      <section class="shell-grid">
        <div class="stack">
          <section class="panel">
            <div class="panel-head"><div><h2>Search and focus</h2><p>Filter the operating table by account name, plan, owner, or provider. Select a row to open the compact credits-and-ops drilldown.</p></div></div>
            <div class="toolbar"><input id="accounts-search" type="search" placeholder="Search account, owner, plan, provider..." /></div>
          </section>
          <section class="table-panel">
            <div class="table-scroll">
              <table>
                <thead>
                  <tr><th>Account</th><th>Users</th><th>Connections</th><th>Status</th><th>Report credits</th><th>Schedule slots</th><th>Support</th><th>Infra</th><th></th></tr>
                </thead>
                <tbody id="accounts-table"></tbody>
              </table>
            </div>
          </section>
        </div>
        <aside class="stack">
          <section class="detail-panel">
            <div class="panel-head"><div><h2>Account drilldown</h2><p>Compact profile, plan credits, people, connections, support, and infrastructure context for the selected account.</p></div></div>
            <div id="accounts-detail"></div>
          </section>
        </aside>
      </section>
    `,
    script: `
      (() => {
        const summaryEl = document.getElementById('accounts-summary');
        const searchEl = document.getElementById('accounts-search');
        const tableEl = document.getElementById('accounts-table');
        const detailEl = document.getElementById('accounts-detail');
        let items = [];
        let selectedTenantId = null;

        function filteredRows(query) {
          const needle = String(query || '').trim().toLowerCase();
          if (!needle) return items;
          return items.filter((item) => {
            const haystack = [item.account_name, item.owner, item.plan_tier, item.account_status, ...(Array.isArray(item.connection_providers) ? item.connection_providers : [])].join(' ').toLowerCase();
            return haystack.includes(needle);
          });
        }

        function renderTable(rows) {
          tableEl.innerHTML = rows.length
            ? rows.map((item) => '<tr class="' + (selectedTenantId === item.tenant_id ? 'is-selected' : '') + '"><td><strong>' + AdminUi.esc(item.account_name) + '</strong><br /><span class="muted">' + AdminUi.esc(item.owner || 'Unassigned') + ' | ' + AdminUi.esc(item.plan_tier) + '</span></td><td>' + AdminUi.esc(AdminUi.formatNumber(item.user_count || 0)) + '</td><td>' + AdminUi.esc(AdminUi.formatNumber(item.connection_count || 0)) + '<br /><span class="muted">' + AdminUi.esc((item.connection_providers || []).join(', ') || 'No provider') + '</span></td><td>' + AdminUi.pill(item.account_status || 'active') + '</td><td>' + AdminUi.esc(AdminUi.formatNumber(item.current_period_report_runs || 0)) + ' / ' + AdminUi.esc(AdminUi.formatNumber(item.monthly_runs_limit || 0)) + '<br /><span class="muted">' + AdminUi.esc(AdminUi.formatNumber(item.report_runs || 0)) + ' total runs</span></td><td>' + AdminUi.esc(AdminUi.formatNumber(item.active_schedules || 0)) + ' / ' + AdminUi.esc(AdminUi.formatNumber(item.scheduled_reports_limit || 0)) + '<br /><span class="muted">' + AdminUi.esc(AdminUi.formatNumber(item.total_schedules || 0)) + ' total schedules</span></td><td>' + AdminUi.esc(AdminUi.formatNumber(item.open_tickets || 0)) + ' open</td><td>' + AdminUi.formatMoney(item.current_infra_cost_usd || 0) + '</td><td><button class="btn-subtle" type="button" data-tenant="' + AdminUi.esc(item.tenant_id) + '">View</button></td></tr>').join('')
            : '<tr><td colspan="9">No accounts match the current filter.</td></tr>';
        }

        function renderDetail(payload) {
          if (!payload || !payload.account) {
            detailEl.innerHTML = AdminUi.emptyState('Select an account to see the compact backoffice detail.');
            return;
          }
          const profile = payload.profile || {};
          const account = payload.account || {};
          const usage = payload.usage || {};
          const users = Array.isArray(payload.users) ? payload.users : [];
          const connections = Array.isArray(payload.connections) ? payload.connections : [];
          const tickets = Array.isArray(payload.recent_tickets) ? payload.recent_tickets : [];
          const infra = Array.isArray(payload.recent_infra_costs) ? payload.recent_infra_costs : [];
          detailEl.innerHTML =
            '<div class="detail-list">' +
              '<div class="detail-item"><small>Account</small><strong>' + AdminUi.esc(account.account_name || profile.name || 'Account') + '</strong><span>' + AdminUi.pill(account.account_status || profile.status || 'unknown') + ' ' + AdminUi.pill(account.plan_tier || profile.plan_tier || 'Plan') + '</span></div>' +
              '<div class="detail-item"><small>Primary contact</small><strong>' + AdminUi.esc(profile.primary_contact_name || 'Not set') + '</strong><span>' + AdminUi.esc(profile.primary_contact_email || 'No contact email') + '</span></div>' +
              '<div class="detail-item"><small>Entitlements</small><strong>Seats ' + AdminUi.esc(profile.entitlements?.seats ?? '--') + ' | Reports ' + AdminUi.esc(profile.entitlements?.monthly_runs ?? '--') + '</strong><span>Schedules: ' + AdminUi.esc(profile.entitlements?.scheduled_reports ?? '--') + ' | AI credits: ' + (profile.entitlements?.ai_budget_usd == null ? 'Not configured' : AdminUi.formatMoney(profile.entitlements.ai_budget_usd)) + '</span></div>' +
            '</div>' +
            '<div class="split-grid" style="margin-top:12px;">' +
              '<div class="detail-item"><small>Users</small><strong>' + AdminUi.esc(AdminUi.formatNumber(users.length)) + '</strong><span>' + AdminUi.esc(users.slice(0, 3).map((user) => user.display_name || user.username).join(', ') || 'No users') + '</span></div>' +
              '<div class="detail-item"><small>Connections</small><strong>' + AdminUi.esc(AdminUi.formatNumber(connections.length)) + '</strong><span>' + AdminUi.esc(connections.map((entry) => entry.provider).join(', ') || 'No governed source connected') + '</span></div>' +
              '<div class="detail-item"><small>Report credits</small><strong>' + AdminUi.esc(AdminUi.formatNumber(usage.current_period_report_runs || 0)) + ' used</strong><span>Remaining this month: ' + AdminUi.esc(AdminUi.formatNumber(usage.remaining_report_credits == null ? 0 : usage.remaining_report_credits)) + '</span></div>' +
              '<div class="detail-item"><small>AI credits</small><strong>' + (usage.remaining_ai_credits_usd == null ? 'Not configured' : AdminUi.formatMoney(usage.remaining_ai_credits_usd)) + '</strong><span>Estimated AI usage: ' + AdminUi.formatMoney(usage.estimated_ai_cost_usd || 0) + ' | Tokens: ' + AdminUi.esc(AdminUi.formatNumber(usage.current_period_total_tokens || 0)) + '</span></div>' +
            '</div>' +
            '<div class="panel" style="margin-top:12px;"><div class="panel-head"><div><h2>Recent ops and support</h2><p>Just the most recent support and infrastructure touchpoints for this account.</p></div></div><div class="detail-list">' +
              (tickets.slice(0, 3).map((ticket) => '<div class="detail-item"><small>Ticket</small><strong>' + AdminUi.esc(ticket.title) + '</strong><span>' + AdminUi.pill(ticket.status) + '</span></div>').join('') || '<div class="detail-item"><small>Ticket</small><strong>No current support pressure</strong><span>Support history will appear here once tickets exist.</span></div>') +
              (infra.slice(0, 2).map((entry) => '<div class="detail-item"><small>Infra cost</small><strong>' + AdminUi.esc(AdminUi.formatDate(entry.period_end)) + '</strong><span>' + AdminUi.formatMoney(entry.total_cost_usd) + ' total</span></div>').join('') || '<div class="detail-item"><small>Infra cost</small><strong>No cost ledger entries</strong><span>Cost snapshots will appear once sync has run for this account.</span></div>') +
            '</div></div>';
        }

        function selectTenant(tenantId) {
          selectedTenantId = tenantId;
          renderTable(filteredRows(searchEl.value));
          detailEl.innerHTML = '<div class="detail-item"><small>Loading</small><strong>Fetching account detail</strong><span>Please wait while we load the selected account.</span></div>';
          AdminUi.api.get('/api/admin/accounts/' + encodeURIComponent(tenantId)).then(renderDetail).catch((error) => {
            detailEl.innerHTML = '<div class="detail-item"><small>Error</small><strong>Unable to load account detail</strong><span>' + AdminUi.esc(error.message || 'Unknown error') + '</span></div>';
          });
        }

        searchEl.addEventListener('input', () => renderTable(filteredRows(searchEl.value)));
        tableEl.addEventListener('click', (event) => {
          const button = event.target.closest('[data-tenant]');
          if (!button) return;
          selectTenant(button.dataset.tenant);
        });

        AdminUi.api.get('/api/admin/accounts').then((payload) => {
          const summary = payload.summary || {};
          items = Array.isArray(payload.items) ? payload.items : [];
          AdminUi.renderSummary(summaryEl, [
            { label: 'Accounts', value: AdminUi.formatNumber(summary.accounts || 0), hint: 'Customer workspaces on the control plane' },
            { label: 'Users', value: AdminUi.formatNumber(summary.total_users || 0), hint: 'Seats across all accounts' },
            { label: 'Connections', value: AdminUi.formatNumber(summary.total_connections || 0), hint: 'Governed data sources connected' },
            { label: 'Active schedules', value: AdminUi.formatNumber(summary.total_active_schedules || 0), hint: 'Schedules still running in the fleet' }
          ]);
          renderTable(items);
          if (items[0]) selectTenant(items[0].tenant_id);
          else renderDetail(null);
        }).catch((error) => {
          summaryEl.innerHTML = AdminUi.emptyState(error.message || 'Unable to load accounts.');
          tableEl.innerHTML = '<tr><td colspan="9">' + AdminUi.esc(error.message || 'Unable to load accounts.') + '</td></tr>';
          renderDetail(null);
        });
      })();
    `
  });
}

export function renderAdminSupportPage(): string {
  return renderAdminShell({
    title: "Claritect | Support",
    active: "support",
    eyebrow: "Customer operations",
    page_title: "Support ticket system",
    page_subtitle:
      "Track system-created and manual support tickets, keep ownership clear, and close loops without leaving the admin console.",
    page_badge: "Support",
    body: `
      <section class="summary-grid" id="support-summary"></section>
      <section class="shell-grid">
        <div class="stack">
          <section class="table-panel">
            <div class="table-scroll">
              <table>
                <thead>
                  <tr><th>Ticket</th><th>Account</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Last activity</th><th></th></tr>
                </thead>
                <tbody id="support-table"></tbody>
              </table>
            </div>
          </section>
        </div>
        <aside class="stack">
          <section class="detail-panel">
            <div class="panel-head"><div><h2>Create ticket</h2><p>Open a manual support thread tied to a specific customer account.</p></div></div>
            <div class="detail-list">
              <select id="support-tenant"></select>
              <input id="support-title" type="text" placeholder="Title" />
              <div class="split-grid">
                <select id="support-priority"><option value="medium">Medium priority</option><option value="low">Low priority</option><option value="high">High priority</option><option value="urgent">Urgent priority</option></select>
                <input id="support-category" type="text" value="general" placeholder="Category" />
              </div>
              <input id="support-requester" type="text" placeholder="Requester name" />
              <input id="support-email" type="email" placeholder="Requester email" />
              <input id="support-assignee" type="text" placeholder="Assignee" />
              <input id="support-due" type="datetime-local" />
              <textarea id="support-message" placeholder="Describe what needs attention..."></textarea>
              <button class="btn" id="support-create-btn" type="button">Create ticket</button>
              <div class="status-note" id="support-create-note"></div>
            </div>
          </section>
          <section class="detail-panel">
            <div class="panel-head"><div><h2>Selected ticket</h2><p>Update status, owner, due date, or the latest message.</p></div></div>
            <div id="support-detail"></div>
          </section>
        </aside>
      </section>
    `,
    script: `
      (() => {
        const summaryEl = document.getElementById('support-summary');
        const tableEl = document.getElementById('support-table');
        const detailEl = document.getElementById('support-detail');
        const tenantSelect = document.getElementById('support-tenant');
        const titleInput = document.getElementById('support-title');
        const priorityInput = document.getElementById('support-priority');
        const categoryInput = document.getElementById('support-category');
        const requesterInput = document.getElementById('support-requester');
        const emailInput = document.getElementById('support-email');
        const assigneeInput = document.getElementById('support-assignee');
        const dueInput = document.getElementById('support-due');
        const messageInput = document.getElementById('support-message');
        const createBtn = document.getElementById('support-create-btn');
        const createNote = document.getElementById('support-create-note');
        let tickets = [];
        let accounts = [];
        let selectedTicketId = null;

        function renderTicketDetail(ticket) {
          if (!ticket) {
            detailEl.innerHTML = AdminUi.emptyState('Select a ticket to update status or assign ownership.');
            return;
          }
          detailEl.innerHTML = '<div class="detail-list"><div class="detail-item"><small>Ticket</small><strong>' + AdminUi.esc(ticket.title) + '</strong><span>' + AdminUi.pill(ticket.status) + ' ' + AdminUi.pill(ticket.priority, ticket.priority === 'urgent' ? 'danger' : ticket.priority === 'high' ? 'warn' : 'neutral') + '</span></div><div class="split-grid"><select id="ticket-status"><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><input id="ticket-assignee" type="text" placeholder="Assignee" /></div><input id="ticket-due" type="datetime-local" /><textarea id="ticket-message" placeholder="Latest message"></textarea><button class="btn" id="ticket-save-btn" type="button">Save update</button><div class="status-note" id="ticket-save-note"></div></div>';
          document.getElementById('ticket-status').value = ticket.status;
          document.getElementById('ticket-assignee').value = ticket.assignee || '';
          document.getElementById('ticket-due').value = ticket.due_at ? ticket.due_at.slice(0, 16) : '';
          document.getElementById('ticket-message').value = ticket.latest_message || '';
          document.getElementById('ticket-save-btn').addEventListener('click', async () => {
            const noteEl = document.getElementById('ticket-save-note');
            AdminUi.setNote(noteEl, 'Saving ticket update...', 'neutral');
            try {
              await AdminUi.api.post('/api/admin/support/' + encodeURIComponent(ticket.id) + '/status', {
                status: document.getElementById('ticket-status').value,
                assignee: document.getElementById('ticket-assignee').value || null,
                due_at: document.getElementById('ticket-due').value ? new Date(document.getElementById('ticket-due').value).toISOString() : null,
                latest_message: document.getElementById('ticket-message').value || null
              });
              AdminUi.setNote(noteEl, 'Ticket updated.', 'good');
              load();
            } catch (error) {
              AdminUi.setNote(noteEl, error.message || 'Unable to update ticket.', 'danger');
            }
          });
        }

        function renderTable() {
          tableEl.innerHTML = tickets.length
            ? tickets.map((item) => '<tr class="' + (selectedTicketId === item.id ? 'is-selected' : '') + '"><td><strong>' + AdminUi.esc(item.title) + '</strong><br /><span class="muted">' + AdminUi.esc(item.category) + '</span></td><td>' + AdminUi.esc(item.account_name) + '</td><td>' + AdminUi.pill(item.status) + '</td><td>' + AdminUi.pill(item.priority, item.priority === 'urgent' ? 'danger' : item.priority === 'high' ? 'warn' : 'neutral') + '</td><td>' + AdminUi.esc(item.assignee || 'Unassigned') + '</td><td>' + AdminUi.esc(AdminUi.formatRelative(item.last_activity_at)) + '</td><td><button class="btn-subtle" type="button" data-ticket="' + AdminUi.esc(item.id) + '">Open</button></td></tr>').join('')
            : '<tr><td colspan="7">No tickets yet.</td></tr>';
        }

        function populateAccountOptions() {
          tenantSelect.innerHTML = accounts.map((account) => '<option value="' + AdminUi.esc(account.tenant_id) + '">' + AdminUi.esc(account.name) + '</option>').join('');
        }

        function load() {
          return AdminUi.api.get('/api/admin/support').then((payload) => {
            const summary = payload.summary || {};
            tickets = Array.isArray(payload.items) ? payload.items : [];
            accounts = Array.isArray(payload.account_options) ? payload.account_options : [];
            AdminUi.renderSummary(summaryEl, [
              { label: 'Tickets', value: AdminUi.formatNumber(summary.total || 0), hint: 'Support threads tracked in backoffice' },
              { label: 'Open', value: AdminUi.formatNumber(summary.open || 0), hint: 'New tickets needing triage' },
              { label: 'Pending', value: AdminUi.formatNumber(summary.pending || 0), hint: 'Tickets waiting on follow-through' },
              { label: 'Urgent', value: AdminUi.formatNumber(summary.urgent || 0), hint: 'Highest priority tickets across customers' }
            ]);
            populateAccountOptions();
            renderTable();
            const selected = tickets.find((ticket) => ticket.id === selectedTicketId) || tickets[0] || null;
            selectedTicketId = selected ? selected.id : null;
            renderTicketDetail(selected);
          });
        }

        tableEl.addEventListener('click', (event) => {
          const button = event.target.closest('[data-ticket]');
          if (!button) return;
          selectedTicketId = button.dataset.ticket;
          renderTable();
          renderTicketDetail(tickets.find((ticket) => ticket.id === selectedTicketId) || null);
        });

        createBtn.addEventListener('click', async () => {
          AdminUi.setNote(createNote, 'Creating ticket...', 'neutral');
          try {
            await AdminUi.api.post('/api/admin/support', {
              tenant_id: tenantSelect.value,
              title: titleInput.value,
              priority: priorityInput.value,
              category: categoryInput.value,
              requester_name: requesterInput.value || null,
              requester_email: emailInput.value || null,
              assignee: assigneeInput.value || null,
              latest_message: messageInput.value,
              due_at: dueInput.value ? new Date(dueInput.value).toISOString() : null
            });
            titleInput.value = '';
            messageInput.value = '';
            AdminUi.setNote(createNote, 'Ticket created.', 'good');
            await load();
          } catch (error) {
            AdminUi.setNote(createNote, error.message || 'Unable to create ticket.', 'danger');
          }
        });

        load().catch((error) => {
          summaryEl.innerHTML = AdminUi.emptyState(error.message || 'Unable to load support.');
          tableEl.innerHTML = '<tr><td colspan="7">' + AdminUi.esc(error.message || 'Unable to load support data.') + '</td></tr>';
          renderTicketDetail(null);
        });
      })();
    `
  });
}

export function renderAdminFinancePage(): string {
  return renderAdminShell({
    title: "Claritect | Finance",
    active: "finance",
    eyebrow: "Cost and credits",
    page_title: "Finance console",
    page_subtitle:
      "Track estimated infrastructure cost, OpenRouter balance, and customer plan credits without dropping into schedule-by-schedule detail.",
    page_badge: "Finance",
    body: `
      <section class="summary-grid" id="finance-summary"></section>
      <section class="shell-grid">
        <div class="stack">
          <section class="table-panel">
            <div class="panel-head panel" style="border:none; border-radius:0; background:transparent; box-shadow:none; padding:18px 18px 0;">
              <div><h2>Plan credits and AI usage</h2><p>Customer-level product entitlements, usage, and estimated AI spend for the current month.</p></div>
            </div>
            <div class="table-scroll">
              <table>
                <thead><tr><th>Account</th><th>Report credits</th><th>Schedule slots</th><th>AI credits</th><th>AI usage</th><th>Infra cost</th></tr></thead>
                <tbody id="finance-margin-table"></tbody>
              </table>
            </div>
          </section>
          <section class="table-panel">
            <div class="panel-head panel" style="border:none; border-radius:0; background:transparent; box-shadow:none; padding:18px 18px 0;"><div><h2>Estimated infra cost ledger</h2><p>API, worker, storage, and shared platform cost snapshots from the configured runtime model.</p></div></div>
            <div class="table-scroll">
              <table>
                <thead><tr><th>Account</th><th>Period end</th><th>Total</th><th>Breakdown</th></tr></thead>
                <tbody id="finance-infra"></tbody>
              </table>
            </div>
          </section>
        </div>
        <aside class="stack">
          <section class="detail-panel">
            <div class="panel-head"><div><h2>OpenRouter balance</h2><p>Current balance, source, and live runway signal from the shared Claritect OpenRouter account.</p></div></div>
            <div class="detail-list" id="finance-balance"></div>
          </section>
          <section class="detail-panel">
            <div class="panel-head"><div><h2>OpenRouter balance history</h2><p>Recent control-plane captures from the OpenRouter account used by Claritect.</p></div></div>
            <div class="detail-list" id="finance-history"></div>
          </section>
        </aside>
      </section>
    `,
    script: `
      (() => {
        const summaryEl = document.getElementById('finance-summary');
        const marginTableEl = document.getElementById('finance-margin-table');
        const infraEl = document.getElementById('finance-infra');
        const balanceEl = document.getElementById('finance-balance');
        const historyEl = document.getElementById('finance-history');

        AdminUi.api.get('/api/admin/finance').then((payload) => {
          const summary = payload.summary || {};
          const margins = Array.isArray(payload.credit_accounts) ? payload.credit_accounts : [];
          const infra = Array.isArray(payload.infra_costs) ? payload.infra_costs : [];
          const history = Array.isArray(payload.history) ? payload.history : [];
          const balance = payload.balance || {};
          const openRouterBalanceValue = balance.remaining_credits == null ? balance.total_credits : balance.remaining_credits;

          AdminUi.renderSummary(summaryEl, [
            { label: 'Accounts', value: AdminUi.formatNumber(summary.accounts || 0), hint: 'Customer accounts tracked in the control plane' },
            { label: 'Runs this month', value: AdminUi.formatNumber(summary.current_period_report_runs || 0), hint: 'Real report runs counted in the current month window' },
            { label: 'Infra total', value: AdminUi.formatMoney(summary.infra_cost_total_usd || 0), hint: 'Estimated infrastructure cost from the configured stack model' },
            { label: 'OpenRouter balance', value: openRouterBalanceValue == null ? 'Unavailable' : AdminUi.formatNumber(openRouterBalanceValue), hint: balance.remaining_credits == null && balance.total_credits != null ? 'Using total credits because remaining credits were not returned.' : 'Current shared OpenRouter credits remaining' }
          ]);

          marginTableEl.innerHTML = margins.length
            ? margins.map((item) => '<tr><td><strong>' + AdminUi.esc(item.account_name) + '</strong><br /><span class="muted">' + AdminUi.esc(item.plan_tier) + '</span></td><td>' + AdminUi.esc(AdminUi.formatNumber(item.current_period_report_runs || 0)) + ' / ' + AdminUi.esc(AdminUi.formatNumber(item.monthly_runs_limit || 0)) + '</td><td>' + AdminUi.esc(AdminUi.formatNumber(item.active_schedules || 0)) + ' / ' + AdminUi.esc(AdminUi.formatNumber(item.scheduled_reports_limit || 0)) + '</td><td>' + (item.ai_budget_usd == null ? 'Not configured' : AdminUi.formatMoney(item.ai_budget_usd)) + '</td><td>' + AdminUi.formatMoney(item.estimated_ai_cost_usd || 0) + '<br /><span class="muted">' + AdminUi.esc(AdminUi.formatNumber(item.current_period_total_tokens || 0)) + ' tokens</span></td><td>' + AdminUi.formatMoney(item.current_infra_cost_usd || 0) + '</td></tr>').join('')
            : '<tr><td colspan="6">No plan-credit rows yet.</td></tr>';

          infraEl.innerHTML = infra.length
            ? infra.slice(0, 10).map((item) => '<tr><td><strong>' + AdminUi.esc(item.account_name) + '</strong></td><td>' + AdminUi.esc(AdminUi.formatDate(item.period_end)) + '</td><td>' + AdminUi.formatMoney(item.total_cost_usd || 0) + '</td><td><span class="muted">API ' + AdminUi.formatMoney(item.api_cost_usd || 0) + ' | Worker ' + AdminUi.formatMoney(item.worker_cost_usd || 0) + '</span></td></tr>').join('')
            : '<tr><td colspan="4">No infra cost entries yet.</td></tr>';

          balanceEl.innerHTML = [
            { label: 'Balance credits', value: openRouterBalanceValue == null ? 'Unavailable' : AdminUi.formatNumber(openRouterBalanceValue), hint: balance.remaining_credits == null && balance.total_credits != null ? 'Using total credits because remaining credits were not returned.' : 'Current OpenRouter balance snapshot' },
            { label: 'Used credits', value: balance.used_credits == null ? '--' : AdminUi.formatNumber(balance.used_credits), hint: 'Credits already spent from the current bucket' },
            { label: 'Total credits', value: balance.total_credits == null ? '--' : AdminUi.formatNumber(balance.total_credits), hint: 'Total credits reported by the upstream provider' },
            { label: 'Source', value: balance.source || 'unknown', hint: balance.stale_reason || 'Latest fetched balance source' }
          ].map((item) => '<div class="detail-item"><small>' + AdminUi.esc(item.label) + '</small><strong>' + AdminUi.esc(item.value) + '</strong><span>' + AdminUi.esc(item.hint) + '</span></div>').join('');

          historyEl.innerHTML = history.length
            ? history.map((item) => '<div class="detail-item"><small>' + AdminUi.esc(AdminUi.formatDateTime(item.captured_at)) + '</small><strong>' + AdminUi.esc(item.remaining_credits == null ? 'Unavailable' : AdminUi.formatNumber(item.remaining_credits) + ' credits') + '</strong><span>Source: ' + AdminUi.esc(item.source) + (item.stale_reason ? ' | ' + AdminUi.esc(item.stale_reason) : '') + '</span></div>').join('')
            : '<div class="detail-item"><small>History</small><strong>No balance history yet</strong><span>History will fill as the admin and usage surfaces refresh balance snapshots.</span></div>';
        }).catch((error) => {
          summaryEl.innerHTML = AdminUi.emptyState(error.message || 'Unable to load finance data.');
          marginTableEl.innerHTML = '<tr><td colspan="6">' + AdminUi.esc(error.message || 'Unable to load finance data.') + '</td></tr>';
          infraEl.innerHTML = '<tr><td colspan="4"></td></tr>';
          balanceEl.innerHTML = '';
          historyEl.innerHTML = '';
        });
      })();
    `
  });
}

export function renderAdminLoginPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect | Admin login</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");
      :root { --ink:#F5F3FF; --ink-soft:#D7CFE6; --ink-muted:#9D90BC; --line:rgba(107,92,138,0.24); }
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 20px;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif; color: var(--ink);
        background:
          radial-gradient(circle at 14% 12%, rgba(108, 58, 237, 0.22), transparent 24%),
          radial-gradient(circle at 88% 10%, rgba(236, 72, 153, 0.15), transparent 26%),
          radial-gradient(circle at 50% 100%, rgba(108, 58, 237, 0.12), transparent 30%),
          linear-gradient(180deg, #0F0B1A 0%, #130F20 44%, #161122 100%);
      }
      .card {
        width: min(460px, 100%); border: 1px solid var(--line); border-radius: 28px; padding: 24px;
        background: linear-gradient(180deg, rgba(20, 15, 34, 0.98), rgba(17, 12, 28, 0.98)); box-shadow: 0 28px 70px rgba(10, 6, 20, 0.48);
      }
      .brand { width: 72px; height: 30px; margin-bottom: 14px; }
      .brand img { width: 100%; height: 100%; display: block; object-fit: contain; }
      .eyebrow { display: inline-block; margin-bottom: 10px; color: #EC4899; font-size: 0.64rem; letter-spacing: 0.24em; text-transform: uppercase; }
      h1 { margin: 0; font-size: 1.8rem; }
      p { color: var(--ink-soft); line-height: 1.7; }
      label { display: block; margin: 14px 0 8px; color: var(--ink-soft); font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; }
      input {
        width: 100%; min-height: 48px; border-radius: 14px; border: 1px solid rgba(107,92,138,0.24); background: rgba(17, 12, 28, 0.88); color: var(--ink);
        padding: 0 12px; font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
      }
      button {
        width: 100%; min-height: 48px; margin-top: 18px; border-radius: 14px; border: 1px solid rgba(245,243,255,0.22);
        background: #6C3AED; color: #F5F3FF; font-family: Inter, "Sohne", "Suisse Intl", sans-serif; font-size: 0.86rem; font-weight: 700; cursor: pointer;
      }
      .meta { margin-top: 14px; color: var(--ink-muted); font-size: 0.76rem; }
      .error { min-height: 1.4rem; margin-top: 10px; color: #FFC2C2; font-size: 0.84rem; }
    </style>
  </head>
  <body>
    <form class="card" id="admin-login-form">
      <div class="brand">${renderClaritectLogoImage("admin-login-logo")}</div>
      <span class="eyebrow">Claritect operations</span>
      <h1>Admin login</h1>
      <p>Use the dedicated Claritect login for customer operations, finance visibility, and support management.</p>
      <label for="username">Username</label>
      <input id="username" name="username" autocomplete="username" required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <div class="error" id="login-error"></div>
      <button type="submit">Open admin console</button>
      <div class="meta">Demo admin: claritect_admin / test123</div>
    </form>
    <script>
      document.getElementById('admin-login-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';
        const response = await fetch('/admin/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: form.username.value, password: form.password.value })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          errorEl.textContent = payload && payload.message ? payload.message : 'Invalid admin credentials.';
          return;
        }
        window.location.href = '/admin';
      });
    </script>
  </body>
</html>`;
}
