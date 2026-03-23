export function renderScheduledReportsPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Overload | Scheduled Reports</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Mona+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap");
      :root { --ink:#edf4ff; --ink-soft:#9cb2dc; --ink-muted:#6680b3; --line:rgba(104,137,206,.18); --line-strong:rgba(133,181,255,.34); --panel:rgba(7,17,42,.92); --panel-2:rgba(5,12,34,.98); --accent:#66a7ff; --accent-2:#6c6cff; --accent-3:#7fd0ff; --shadow:0 24px 60px rgba(1,8,28,.44); }
      * { box-sizing:border-box; }
      body { margin:0; min-height:100vh; font-family:"Mona Sans",sans-serif; color:var(--ink); background:radial-gradient(circle at 14% 10%, rgba(110,165,255,.17), transparent 24%), radial-gradient(circle at 88% 8%, rgba(104,92,255,.15), transparent 26%), linear-gradient(180deg,#020714 0%,#06112e 44%,#061533 100%); }
      body::before { content:""; position:fixed; inset:0; pointer-events:none; background-image:linear-gradient(to right, rgba(108,138,214,.05) 1px, transparent 1px); background-size:60px 60px; mask-image:radial-gradient(circle at 50% 45%, rgba(0,0,0,.86), transparent 92%); }
      .page { padding:14px; }
      .layout { display:grid; grid-template-columns:212px 1fr; gap:14px; min-height:calc(100vh - 28px); }
      .platform-panel,.content-shell { border:1px solid var(--line); border-radius:28px; box-shadow:var(--shadow); overflow:hidden; }
      .platform-panel { position:relative; background:linear-gradient(180deg, rgba(10,22,55,.98), rgba(5,14,36,.98)), linear-gradient(180deg, rgba(255,255,255,.02), transparent); padding:16px 15px 14px; display:flex; flex-direction:column; }
      .platform-panel::before { content:""; position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 20% 0%, rgba(118,171,255,.14), transparent 26%), linear-gradient(180deg, rgba(255,255,255,.04), transparent 30%); }
      .platform-brand { display:flex; align-items:center; gap:10px; padding:8px 6px 14px; margin-bottom:10px; border-bottom:1px solid rgba(130,162,231,.14); position:relative; z-index:1; }
      .platform-brand-badge { width:42px; height:42px; border-radius:15px; display:grid; place-items:center; font-weight:800; color:#f3f8ff; background:linear-gradient(145deg,var(--accent),var(--accent-2) 56%,var(--accent-3)); box-shadow:0 14px 32px rgba(76,122,255,.34); }
      .platform-brand strong { display:block; font-size:.78rem; line-height:1.1; letter-spacing:.09em; text-transform:uppercase; }
      .platform-brand span { display:block; margin-top:2px; font-family:"JetBrains Mono",monospace; font-size:.62rem; letter-spacing:.24em; text-transform:uppercase; color:var(--ink-muted); }
      .platform-section { margin:16px 8px 8px; font-size:.58rem; letter-spacing:.24em; text-transform:uppercase; color:var(--ink-muted); position:relative; z-index:1; }
      .platform-nav { display:flex; flex-direction:column; gap:6px; position:relative; z-index:1; }
      .platform-link { display:flex; align-items:center; gap:8px; padding:11px 12px; border-radius:14px; color:#9eb3d9; text-decoration:none; border:1px solid rgba(117,148,214,.06); font-size:.84rem; font-weight:600; transition:transform 140ms ease,border-color 140ms ease,background 140ms ease,color 140ms ease; }
      .platform-link svg { width:16px; height:16px; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
      .platform-link:hover { transform:translateX(2px); background:rgba(33,62,129,.36); border-color:rgba(112,152,244,.26); }
      .platform-link.active { background:linear-gradient(135deg, rgba(72,99,255,.9), rgba(89,92,255,.92) 54%, rgba(109,208,255,.82)); border-color:rgba(151,191,255,.4); color:#f3f8ff; box-shadow:0 14px 28px rgba(67,93,222,.28); }
      .platform-footer { margin-top:auto; display:flex; flex-direction:column; gap:10px; position:relative; z-index:1; }
      .platform-user,.platform-support { display:flex; align-items:center; gap:10px; border:1px solid rgba(111,147,220,.14); border-radius:16px; padding:11px 12px; background:rgba(10,24,58,.76); }
      .platform-user-avatar { width:28px; height:28px; border-radius:11px; display:grid; place-items:center; border:1px solid #2f4d95; color:#9cb3e3; background:rgba(13,31,78,.9); box-shadow:inset 0 1px 0 rgba(255,255,255,.06); }
      .platform-user small { display:block; color:#6e86bd; font-size:.63rem; text-transform:uppercase; letter-spacing:.12em; }
      .platform-user strong { display:block; margin-top:2px; font-size:.81rem; }
      .platform-support { justify-content:space-between; padding:9px 11px 9px 12px; background:rgba(7,18,45,.82); }
      .platform-support span { color:var(--ink-soft); font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; }
      .platform-support form { margin:0; }
      .logout-btn { border:1px solid rgba(122,155,226,.22); border-radius:12px; background:rgba(16,36,84,.9); color:#cfddff; padding:7px 10px; font-family:"JetBrains Mono",monospace; font-size:.64rem; cursor:pointer; }
      .content-shell { background:linear-gradient(180deg, rgba(5,12,34,.98), rgba(3,10,26,.99)); display:flex; flex-direction:column; }
      .badge,.mini-pill,.status-pill { padding:7px 10px; border-radius:999px; font-family:"JetBrains Mono",monospace; font-size:.68rem; border:1px solid rgba(127,171,255,.18); background:rgba(16,35,83,.88); color:#d7e6ff; }
      .workspace { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(360px,1fr); gap:16px; padding:18px; align-items:start; }
      .surface { border:1px solid var(--line); border-radius:24px; background:linear-gradient(180deg, rgba(10,24,58,.92), rgba(8,20,49,.92)); overflow:hidden; }
      .detail-surface { position:relative; transition:border-color 150ms ease, box-shadow 150ms ease, background 150ms ease; }
      .detail-surface::before { content:""; position:absolute; inset:0 auto 0 0; width:3px; background:linear-gradient(180deg, rgba(116,175,255,0), rgba(116,175,255,.9), rgba(108,108,255,.75)); opacity:0; transition:opacity 150ms ease; }
      .detail-surface[data-status="succeeded"] { border-color:rgba(110,214,194,.26); box-shadow:0 18px 34px rgba(3,14,31,.24), inset 0 1px 0 rgba(255,255,255,.03); background:linear-gradient(180deg, rgba(9,28,56,.94), rgba(7,20,45,.96)); }
      .detail-surface[data-status="succeeded"]::before { opacity:1; background:linear-gradient(180deg, rgba(141,240,218,0), rgba(141,240,218,.94), rgba(102,167,255,.75)); }
      .detail-surface[data-status="failed"] { border-color:rgba(245,156,156,.24); box-shadow:0 18px 34px rgba(3,14,31,.24), inset 0 1px 0 rgba(255,255,255,.03); }
      .detail-surface[data-status="failed"]::before { opacity:1; background:linear-gradient(180deg, rgba(252,165,165,0), rgba(252,165,165,.92), rgba(245,120,120,.7)); }
      .surface-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:18px 18px 14px; border-bottom:1px solid rgba(126,160,227,.1); }
      .surface-header h2 { margin:0; font-size:1rem; }
      .surface-header p { margin:6px 0 0; color:var(--ink-soft); font-size:.82rem; }
      .reports-grid { display:grid; grid-template-columns:repeat(3, minmax(240px,1fr)); gap:14px; padding:18px; align-content:start; }
      .tile { position:relative; display:grid; gap:12px; align-content:start; text-align:left; border:1px solid rgba(118,152,226,.14); border-radius:20px; padding:16px; background:linear-gradient(180deg, rgba(11,27,65,.94), rgba(8,20,49,.98)); cursor:pointer; transition:transform 150ms ease,border-color 150ms ease,box-shadow 150ms ease,background 150ms ease; box-shadow:inset 0 1px 0 rgba(255,255,255,.03); overflow:hidden; }
      .tile::before { content:""; position:absolute; inset:0 auto 0 0; width:3px; background:linear-gradient(180deg, rgba(116,175,255,0), rgba(116,175,255,.9), rgba(108,108,255,.75)); opacity:0; transition:opacity 150ms ease; }
      .tile:hover,.tile.active { transform:translateY(-2px); border-color:var(--line-strong); box-shadow:0 16px 30px rgba(4,11,29,.24); }
      .tile.active { background:linear-gradient(180deg, rgba(15,33,78,.96), rgba(9,22,56,.98)); }
      .tile.active::before { opacity:1; }
      .tile[data-status="succeeded"].active { border-color:rgba(110,214,194,.28); box-shadow:0 18px 32px rgba(2,14,30,.3), 0 0 0 1px rgba(110,214,194,.08); }
      .tile[data-status="succeeded"].active::before { background:linear-gradient(180deg, rgba(141,240,218,0), rgba(141,240,218,.94), rgba(102,167,255,.75)); }
      .tile[data-status="failed"].active { border-color:rgba(245,156,156,.28); box-shadow:0 18px 32px rgba(2,14,30,.3), 0 0 0 1px rgba(245,156,156,.08); }
      .tile[data-status="failed"].active::before { background:linear-gradient(180deg, rgba(252,165,165,0), rgba(252,165,165,.92), rgba(245,120,120,.74)); }
      .tile h3 { margin:0; font-size:.95rem; line-height:1.36; letter-spacing:-.01em; overflow-wrap:anywhere; color:var(--ink); }
      .tile-meta { display:flex; flex-wrap:wrap; gap:8px; margin:0; }
      .tile-meta .mini-pill:last-child { max-width:100%; white-space:normal; line-height:1.45; }
      .tile-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .stat { padding:10px; border-radius:14px; background:rgba(255,255,255,.03); border:1px solid rgba(121,155,226,.08); min-height:72px; min-width:0; }
      .stat span { display:block; font-size:.62rem; letter-spacing:.18em; text-transform:uppercase; color:var(--ink-muted); }
      .stat strong { display:block; margin-top:6px; font-size:.88rem; line-height:1.35; overflow-wrap:anywhere; color:var(--ink); }
      .stat.status-positive strong { color:#8df0da; }
      .stat.status-negative strong { color:#fca5a5; }
      .status-mark { display:inline-flex; align-items:center; justify-content:center; min-width:1.05rem; min-height:1.05rem; font-size:1rem; line-height:1; font-weight:800; font-family:"Mona Sans",sans-serif; border:none; background:transparent; box-shadow:none; }
      .status-positive .status-mark { color:#8df0da; }
      .status-negative .status-mark { color:#fca5a5; }
      .status-neutral .status-mark { color:#d8e4ff; }
      .detail-body { padding:18px; display:grid; gap:14px; min-height:520px; align-content:start; }
      .detail-card,.empty-state { padding:16px; border-radius:18px; border:1px solid rgba(118,152,226,.12); background:var(--panel); box-shadow:inset 0 1px 0 rgba(255,255,255,.03); }
      .empty-state { margin:18px; border-style:dashed; }
      .empty-state h3,.detail-card h3 { margin:0 0 10px; font-size:.96rem; }
      .empty-state p,.detail-card p { margin:0; color:var(--ink-soft); line-height:1.62; }
      .detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .detail-row,.question-plan,.run-item { padding:12px 13px; border-radius:14px; background:rgba(255,255,255,.03); border:1px solid rgba(121,155,226,.08); }
      .detail-row span { display:block; font-size:.62rem; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-muted); }
      .detail-row strong { display:block; margin-top:6px; font-size:.86rem; line-height:1.45; color:var(--ink); }
      .question-list,.run-list { display:flex; flex-direction:column; gap:10px; }
      .question-plan { padding:0; overflow:hidden; }
      .question-toggle { width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 15px; background:transparent; border:0; color:var(--ink); text-align:left; cursor:pointer; font:inherit; }
      .question-toggle strong { display:block; margin:0; font-size:.84rem; line-height:1.45; color:var(--ink); }
      .question-chevron { color:var(--ink-soft); display:inline-flex; align-items:center; justify-content:center; transition:transform 160ms ease, color 160ms ease; }
      .question-chevron svg { width:.9rem; height:.9rem; display:block; stroke:currentColor; fill:none; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
      .question-plan[data-collapsed="false"] .question-chevron { transform:rotate(180deg); color:#dbe8ff; }
      .question-body { display:grid; gap:8px; padding:0 15px 15px; border-top:1px solid rgba(121,155,226,.08); }
      .question-plan[data-collapsed="true"] .question-body { display:none; }
      .question-body p { font-size:.78rem; line-height:1.65; margin:0; }
      .run-item { display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .run-copy strong { display:block; font-size:.82rem; color:var(--ink); }
      .run-copy span { display:block; margin-top:5px; color:var(--ink-soft); font-size:.75rem; }
      .run-actions { display:flex; align-items:center; gap:8px; }
      .status-pill { display:inline-flex; align-items:center; gap:6px; }
      .status-pill .status-mark { min-width:1rem; min-height:1rem; font-size:.92rem; }
      .status-pill.succeeded { color:#5eead4; } .status-pill.failed { color:#fca5a5; }
      .open-btn { appearance:none; border:1px solid rgba(144,180,255,.24); border-radius:12px; background:linear-gradient(135deg, rgba(79,112,255,.92), rgba(92,199,255,.86)); color:#fff; padding:9px 12px; font-weight:700; cursor:pointer; }
      .toggle-btn { appearance:none; border:1px solid rgba(144,180,255,.2); border-radius:12px; background:rgba(12,30,72,.94); color:#dce7ff; padding:9px 12px; font-weight:700; cursor:pointer; transition:background 140ms ease, border-color 140ms ease, transform 140ms ease; }
      .toggle-btn:hover { transform:translateY(-1px); border-color:rgba(164,196,255,.3); background:rgba(19,40,92,.98); }
      .toggle-btn.pause { color:#ffd8a8; border-color:rgba(255,196,122,.22); background:rgba(61,40,11,.54); }
      .toggle-btn.activate { color:#8df0da; border-color:rgba(141,240,218,.22); background:rgba(10,53,47,.46); }
      .mono { font-family:"JetBrains Mono",monospace; }
      @media (max-width: 1560px) { .reports-grid { grid-template-columns:repeat(3,minmax(220px,1fr)); } }
      @media (max-width: 1320px) { .workspace { grid-template-columns:1fr; } .reports-grid { grid-template-columns:repeat(2,minmax(220px,1fr)); } }
      @media (max-width: 980px) { .layout { grid-template-columns:1fr; } .reports-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .detail-grid { grid-template-columns:1fr; } .run-item { flex-direction:column; align-items:flex-start; } .run-actions { width:100%; justify-content:space-between; } }
      @media (max-width: 640px) { .page { padding:10px; } .reports-grid { grid-template-columns:1fr; } }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="layout">
        <aside class="platform-panel">
          <div class="platform-brand"><div class="platform-brand-badge">*</div><div><strong>Project Overload</strong><span>Decision cockpit</span></div></div>
          <div class="platform-section">Core Platform</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>Chat Explorer</a>
            <a class="platform-link" href="/usage"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></span>Usage Metrics</a>
          </nav>
          <div class="platform-section">Infrastructure</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/connect"><span class="link-icon"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></span>Data Sources</a>
            <a class="platform-link active" href="/scheduled"><span class="link-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h3"/><path d="M8 18h6"/></svg></span>Scheduled Reports</a>
            <a class="platform-link" href="/config"><span class="link-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>Global Config</a>
          </nav>
          <div class="platform-footer">
            <div class="platform-user"><div class="platform-user-avatar">@</div><div><small>Admin Profile</small><strong>Project Owner</strong></div></div>
            <div class="platform-support"><span>Support</span><form method="POST" action="/auth/logout"><button class="logout-btn" type="submit">Sign Out</button></form></div>
          </div>
        </aside>
        <main class="content-shell">
          <section class="workspace">
            <section class="surface">
              <div class="surface-header"><div><h2>Scheduled report types</h2><p>Each tile is one report contract with its own schedule profile and run history.</p></div><div class="badge" id="grid-badge">0 profiles</div></div>
              <div id="reports-grid" class="reports-grid"></div>
              <div id="empty-state" class="empty-state" style="display:none;"><h3>No scheduled reports yet</h3><p>Once a report is scheduled from chat, it will appear here with its cadence, rerun instructions, and full run history.</p></div>
            </section>
            <aside class="surface detail-surface" id="detail-surface" data-status="idle">
              <div class="surface-header"><div><h2 id="detail-title">Select a scheduled report</h2><p id="detail-subtitle">Pick a tile to inspect cadence, question handling, and completed runs.</p></div><div class="badge" id="detail-badge">Waiting</div></div>
              <div class="detail-body" id="detail-body"><div class="detail-card"><h3>What we’ll show here</h3><p class="mono">Cadence, schedule instructions, per-question next-run behavior, and every completed run you can reopen in chat.</p></div></div>
            </aside>
          </section>
        </main>
      </div>
    </div>
    <script>
      (function () {
        const gridEl = document.getElementById("reports-grid");
        const emptyEl = document.getElementById("empty-state");
        const detailTitleEl = document.getElementById("detail-title");
        const detailSubtitleEl = document.getElementById("detail-subtitle");
        const detailBadgeEl = document.getElementById("detail-badge");
        const detailBodyEl = document.getElementById("detail-body");
        const detailSurfaceEl = document.getElementById("detail-surface");
        const gridBadgeEl = document.getElementById("grid-badge");
        let items = [];
        let activeContractId = null;

        function esc(value) { return String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\"/g,"&quot;").replace(/'/g,"&#39;"); }
        function rel(iso) {
          if (!iso) return "No runs yet";
          const t = Date.parse(iso);
          if (!Number.isFinite(t)) return iso;
          const diffMin = Math.round((Date.now() - t) / 60000);
          if (diffMin < 1) return "just now";
          if (diffMin < 60) return diffMin + "m ago";
          const diffHr = Math.round(diffMin / 60);
          if (diffHr < 24) return diffHr + "h ago";
          return Math.round(diffHr / 24) + "d ago";
        }
        function stamp(iso) {
          if (!iso) return "Run time unavailable";
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return iso;
          return d.toLocaleString(undefined, { year:"numeric", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
        }
        function cadence(value) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Scheduled"; }
        function statusVariant(value) {
          const raw = String(value || "").trim().toLowerCase();
          if (raw === "succeeded" || raw === "success") return "succeeded";
          if (raw === "failed" || raw === "error") return "failed";
          return "neutral";
        }
        function statusMark(value) {
          const variant = statusVariant(value);
          if (variant === "succeeded") return { symbol: "✓", label: "Succeeded" };
          if (variant === "failed") return { symbol: "✕", label: "Failed" };
          return { symbol: "•", label: titleCase(value || "Scheduled") || "Scheduled" };
        }
        function titleCase(value) {
          const raw = String(value || "").trim();
          if (!raw) return "";
          return raw.charAt(0).toUpperCase() + raw.slice(1);
        }
        function profileStatusVariant(value) {
          const raw = String(value || "").trim().toLowerCase();
          if (raw === "active") return "succeeded";
          if (raw === "paused") return "neutral";
          return "neutral";
        }
        function profileStatusMark(value) {
          const raw = String(value || "").trim().toLowerCase();
          if (raw === "active") return { symbol: "✓", label: "Active" };
          if (raw === "paused") return { symbol: "⏸", label: "Paused" };
          return { symbol: "•", label: titleCase(value || "Scheduled") || "Scheduled" };
        }
        function statusMark(value) {
          const variant = statusVariant(value);
          if (variant === "succeeded") return { icon: iconMarkup("check"), label: "Succeeded" };
          if (variant === "failed") return { icon: iconMarkup("x"), label: "Failed" };
          return { icon: iconMarkup("dot"), label: titleCase(value || "Scheduled") || "Scheduled" };
        }
        function profileStatusMark(value) {
          const raw = String(value || "").trim().toLowerCase();
          if (raw === "active") return { icon: iconMarkup("check"), label: "Active" };
          if (raw === "paused") return { icon: iconMarkup("pause"), label: "Paused" };
          return { icon: iconMarkup("dot"), label: titleCase(value || "Scheduled") || "Scheduled" };
        }
        function iconMarkup(kind) {
          if (kind === "check") {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7.8"/></svg>';
          }
          if (kind === "x") {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10"/><path d="M17 7L7 17"/></svg>';
          }
          if (kind === "pause") {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12"/><path d="M16 6v12"/></svg>';
          }
          if (kind === "chevron") {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
          }
          return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/></svg>';
        }
        function statusMark(value) {
          const variant = statusVariant(value);
          if (variant === "succeeded") return { symbol: "\u2713", label: "Succeeded" };
          if (variant === "failed") return { symbol: "\u2718", label: "Failed" };
          return { symbol: "\u2022", label: titleCase(value || "Scheduled") || "Scheduled" };
        }
        function profileStatusMark(value) {
          const raw = String(value || "").trim().toLowerCase();
          if (raw === "active") return { symbol: "\u2713", label: "Active" };
          if (raw === "paused") return { symbol: "\u2022", label: "Paused" };
          return { symbol: "\u2022", label: titleCase(value || "Scheduled") || "Scheduled" };
        }
        function describeCron(value) {
          const raw = String(value || "").trim();
          if (!raw) return "Schedule pending";
          const parts = raw.split(" ").filter(Boolean);
          if (parts.length < 5) return raw;
          const minute = parts[0];
          const hour = parts[1];
          const dayOfMonth = parts[2];
          const month = parts[3];
          const dayOfWeek = parts[4];
          const isDigits = function (input) {
            return /^[0-9]+$/.test(String(input || ""));
          };
          if (minute === "0" && isDigits(hour) && isDigits(dayOfMonth) && month === "*" && dayOfWeek === "*") {
            const h = Number(hour);
            const hourLabel = Number.isFinite(h) ? String(h).padStart(2, "0") + ":00" : hour + ":" + minute.padStart(2, "0");
            return "Every month on day " + dayOfMonth + " at " + hourLabel;
          }
          if (minute === "0" && isDigits(hour) && dayOfMonth === "*" && month === "*" && isDigits(dayOfWeek)) {
            const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const dayName = names[Number(dayOfWeek)] || "Day " + dayOfWeek;
            const h = Number(hour);
            const hourLabel = Number.isFinite(h) ? String(h).padStart(2, "0") + ":00" : hour + ":" + minute.padStart(2, "0");
            return "Every " + dayName + " at " + hourLabel;
          }
          return raw;
        }
        function updateHero() {
          gridBadgeEl.textContent = items.length + " profile" + (items.length === 1 ? "" : "s");
        }
        function renderGrid() {
          gridEl.innerHTML = "";
          if (!items.length) { emptyEl.style.display = "block"; return; }
          emptyEl.style.display = "none";
          for (const item of items) {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "tile" + (item.contract_id === activeContractId ? " active" : "");
            const profileStatus = String(item.status || "active");
            const tileStatus = profileStatusVariant(profileStatus);
            const statusClass = tileStatus === "succeeded" ? " status-positive" : tileStatus === "failed" ? " status-negative" : " status-neutral";
            const mark = profileStatusMark(profileStatus);
            card.setAttribute("data-status", tileStatus);
            card.innerHTML =
              "<h3>" + esc(item.report_title) + "</h3>" +
              '<div class="tile-meta"><span class="mini-pill">' + esc(cadence(item.frequency)) + '</span><span class="mini-pill mono">' + esc(item.timezone) + '</span><span class="mini-pill mono">' + esc(describeCron(item.schedule_cron)) + '</span></div>' +
              '<div class="tile-stats">' +
                '<div class="stat"><span>Questions</span><strong>' + esc(item.question_count) + '</strong></div>' +
                '<div class="stat"><span>Runs</span><strong>' + esc(item.run_count) + '</strong></div>' +
                '<div class="stat"><span>Latest</span><strong>' + esc(rel(item.latest_run_at)) + '</strong></div>' +
                '<div class="stat' + statusClass + '"><span>Status</span><strong><span class="status-mark" aria-label="' + esc(mark.label) + '">' + esc(mark.symbol) + '</span></strong></div>' +
              "</div>";
            card.addEventListener("click", function () {
              activeContractId = item.contract_id;
              renderGrid();
              void loadDetail(item.contract_id);
            });
            gridEl.appendChild(card);
          }
        }
        async function loadList() {
          gridEl.innerHTML = '<div class="detail-card">Loading scheduled reports…</div>';
          const response = await fetch("/api/scheduled-reports");
          const payload = await response.json();
          items = Array.isArray(payload.items) ? payload.items : [];
          updateHero();
          renderGrid();
          if (items.length > 0) {
            activeContractId = items[0].contract_id;
            renderGrid();
            await loadDetail(items[0].contract_id);
          }
        }
        async function loadDetail(contractId) {
          detailTitleEl.textContent = "Loading scheduled report";
          detailSubtitleEl.textContent = "Fetching cadence, question plan, and run history.";
          detailBadgeEl.textContent = "Loading";
          if (detailSurfaceEl) detailSurfaceEl.setAttribute("data-status", "idle");
          detailBodyEl.innerHTML = '<div class="detail-card">Loading details…</div>';
          const response = await fetch("/api/scheduled-reports/" + encodeURIComponent(contractId));
          const payload = await response.json();
          if (!response.ok) {
            detailTitleEl.textContent = "Scheduled report unavailable";
            detailSubtitleEl.textContent = payload && payload.message ? payload.message : "Unable to load this schedule.";
            detailBadgeEl.textContent = "Error";
            detailBodyEl.innerHTML = "";
            return;
          }
          const profile = payload.profile || {};
          const runs = Array.isArray(payload.runs) ? payload.runs : [];
          const questions = Array.isArray(profile.question_execution_plan) ? profile.question_execution_plan : [];
          const profileStatus = String(profile.status || "active");
          if (detailSurfaceEl) detailSurfaceEl.setAttribute("data-status", profileStatusVariant(profileStatus));
          detailTitleEl.textContent = profile.report_title || "Scheduled report";
          detailSubtitleEl.textContent = describeCron(profile.schedule_cron) + " in " + (profile.timezone || "UTC") + ".";
          detailBadgeEl.textContent = titleCase(profileStatus);
          const questionsHtml = questions.length
            ? questions.map((entry) => '<div class="question-plan" data-collapsed="true"><button class="question-toggle" type="button"><strong>Q' + esc(entry.question_number) + ": " + esc(entry.question_text) + '</strong><span class="question-chevron">⌄</span></button><div class="question-body"><p><span class="mono">Current scope:</span> ' + esc(entry.current_scope_summary) + '</p><p><span class="mono">Next run:</span> ' + esc(entry.next_run_behavior) + "</p></div></div>").join("")
            : '<div class="question-plan"><p>No per-question rerun notes were stored yet.</p></div>';
          const runsHtml = runs.length
            ? runs.map((run) => {
                const runMark = statusMark(run.status || "scheduled");
                const runState = statusVariant(run.status || "scheduled");
                return '<div class="run-item"><div class="run-copy"><strong>' + esc(stamp(run.finished_at || run.started_at)) + '</strong><span class="mono">Run ' + esc(run.run_id) + " • " + esc(run.trigger || "manual") + '</span></div><div class="run-actions"><span class="status-pill ' + esc(runState) + '"><span class="status-mark" aria-label="' + esc(runMark.label) + '">' + esc(runMark.symbol) + '</span></span><button class="open-btn" type="button" data-run-id="' + esc(run.run_id) + '">Open in chat</button></div></div>';
              }).join("")
            : '<div class="question-plan"><p>No runs exist yet for this schedule. The cadence is saved and waiting for its first execution window.</p></div>';
          const toggleLabel = profileStatus === "active" ? "Pause report" : "Activate report";
          const toggleClass = profileStatus === "active" ? "pause" : "activate";
          detailBodyEl.innerHTML =
            '<div class="detail-card"><h3>Schedule summary</h3><div class="detail-grid">' +
              '<div class="detail-row"><span>Cadence</span><strong>' + esc(cadence(profile.frequency)) + '</strong></div>' +
              '<div class="detail-row"><span>Timezone</span><strong class="mono">' + esc(profile.timezone || "UTC") + '</strong></div>' +
              '<div class="detail-row"><span>Schedule</span><strong>' + esc(describeCron(profile.schedule_cron)) + '</strong></div>' +
              '<div class="detail-row"><span>Windowing</span><strong>' + esc(profile.windowing_instructions || "Reuse current rolling logic") + '</strong></div>' +
            '</div><div style="display:flex;justify-content:flex-end;margin-top:12px;"><button class="toggle-btn ' + esc(toggleClass) + '" type="button" id="schedule-status-toggle">' + esc(toggleLabel) + '</button></div></div>' +
            '<div class="detail-card"><h3>Question handling on future runs</h3><div class="question-list">' + questionsHtml + '</div></div>' +
            '<div class="detail-card"><h3>Completed runs</h3><div class="run-list">' + runsHtml + '</div></div>';
          detailBodyEl.querySelectorAll(".question-chevron").forEach(function (node) {
            node.innerHTML = iconMarkup("chevron");
          });
          detailBodyEl.querySelectorAll(".run-actions .status-mark").forEach(function (node, index) {
            const run = runs[index];
            const runMark = statusMark(run && run.status ? run.status : "scheduled");
            node.textContent = runMark.symbol;
          });
          const toggleButton = detailBodyEl.querySelector("#schedule-status-toggle");
          if (toggleButton) {
            toggleButton.addEventListener("click", async function () {
              toggleButton.disabled = true;
              const nextStatus = profileStatus === "active" ? "paused" : "active";
              const toggleResponse = await fetch("/api/scheduled-reports/" + encodeURIComponent(contractId) + "/status", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ status: nextStatus })
              });
              if (!toggleResponse.ok) {
                toggleButton.disabled = false;
                return;
              }
              await loadList();
            });
          }
          detailBodyEl.querySelectorAll(".question-toggle").forEach(function (button) {
            button.addEventListener("click", function () {
              const parent = button.closest(".question-plan");
              if (!parent) return;
              const collapsed = parent.getAttribute("data-collapsed") === "true";
              parent.setAttribute("data-collapsed", collapsed ? "false" : "true");
            });
          });
          detailBodyEl.querySelectorAll("[data-run-id]").forEach(function (button) {
            button.addEventListener("click", function () {
              const runId = button.getAttribute("data-run-id");
              if (!runId) return;
              window.location.href = "/?scheduled_run_id=" + encodeURIComponent(runId);
            });
          });
        }
        void loadList().catch(function (error) {
          console.error(error);
          items = [];
          updateHero();
          gridEl.innerHTML = "";
          emptyEl.style.display = "block";
          if (detailSurfaceEl) detailSurfaceEl.setAttribute("data-status", "idle");
          detailTitleEl.textContent = "Could not load scheduled reports";
          detailSubtitleEl.textContent = "Please refresh the page once the API is available.";
          detailBadgeEl.textContent = "Error";
        });
      })();
    </script>
  </body>
</html>`;
}
