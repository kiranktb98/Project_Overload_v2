export function renderConnectionPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Overload | Database Connection Wizard</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

      :root {
        --ink: #e9f1ff;
        --ink-soft: #6f86b4;
        --line: #14386f;
        --line-soft: rgba(60, 104, 184, 0.42);
        --surface: rgba(7, 19, 50, 0.98);
        --surface-strong: rgba(9, 24, 60, 0.98);
        --primary: #4e3dff;
        --primary-2: #5f4dff;
        --primary-3: #6f5fff;
        --warn: #f59f0b;
        --danger: #ef4444;
        --ok: #22c55e;
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

      .workspace {
        padding: 16px 18px 18px;
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
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: #6f8ac1;
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

      .card {
        border: 1px solid #1f3f82;
        border-radius: 14px;
        background: var(--surface);
        box-shadow: var(--shadow);
        padding: 14px;
        margin-bottom: 12px;
      }

      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .step-track {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 12px;
      }

      .step-pill {
        border: 1px solid #234785;
        border-radius: 12px;
        padding: 9px 10px;
        background: rgba(8, 23, 58, 0.88);
        color: var(--ink-soft);
        font-size: 0.74rem;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .step-pill .num {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        border: 1px solid #335899;
        display: grid;
        place-items: center;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.68rem;
      }

      .step-pill.active {
        border-color: rgba(143, 160, 255, 0.48);
        color: #f3f8ff;
        background: linear-gradient(135deg, #4e3dff, #5d4dff 55%, #6d5dff);
      }

      .top h1 {
        margin: 0;
        font-size: 1.1rem;
      }

      .top a {
        text-decoration: none;
        color: #d9e6ff;
        border: 1px solid #2a4b91;
        background: rgba(9, 26, 66, 0.95);
        padding: 8px 10px;
        border-radius: 10px;
        font-size: 0.72rem;
        font-family: "JetBrains Mono", monospace;
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
      }

      .top a:hover {
        transform: translateY(-1px);
        border-color: rgba(143, 160, 255, 0.48);
        background: rgba(12, 32, 79, 0.96);
      }

      .mode-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .mode-btn {
        border: 1px solid #2b4f96;
        border-radius: 12px;
        padding: 11px;
        text-align: left;
        background: rgba(8, 22, 56, 0.9);
        color: #c8d9ff;
        cursor: pointer;
      }

      .mode-btn strong {
        display: block;
        font-size: 0.8rem;
        margin-bottom: 4px;
      }

      .mode-btn small {
        display: block;
        color: var(--ink-soft);
        font-size: 0.71rem;
      }

      .mode-btn.active {
        border-color: rgba(143, 160, 255, 0.48);
        background: linear-gradient(134deg, var(--primary), var(--primary-2), var(--primary-3));
        color: #ffffff;
      }

      .mode-btn.active small {
        color: rgba(235, 244, 255, 0.92);
      }

      .panel-hidden {
        display: none;
      }

      h2 {
        margin: 14px 0 8px;
        font-size: 0.88rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #9fb4e0;
      }

      label {
        display: block;
        font-size: 0.78rem;
        color: var(--ink-soft);
        margin-bottom: 6px;
      }

      input,
      textarea,
      button,
      select {
        font-family: "JetBrains Mono", monospace;
      }

      input,
      textarea,
      select {
        width: 100%;
        border-radius: 12px;
        border: 1px solid #2e4d8f;
        padding: 11px 12px;
        background: rgba(9, 24, 58, 0.94);
        color: #edf3ff;
      }

      input:focus,
      textarea:focus,
      select:focus {
        outline: none;
        border-color: #5d7eff;
        box-shadow: 0 0 0 4px rgba(90, 112, 236, 0.2);
      }

      textarea {
        min-height: 140px;
        resize: vertical;
      }

      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .row + .row,
      .row + div,
      div + .row {
        margin-top: 10px;
      }

      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      button {
        border-radius: 11px;
        padding: 10px 14px;
        cursor: pointer;
        font-size: 0.76rem;
        border: 1px solid transparent;
        color: #fff;
        transition: transform 130ms ease, box-shadow 130ms ease, filter 130ms ease;
      }

      button:hover {
        transform: translateY(-1px);
        filter: saturate(1.03);
      }

      .primary {
        border: 1px solid rgba(143, 160, 255, 0.48);
        background: linear-gradient(134deg, var(--primary), var(--primary-2), var(--primary-3));
        color: #ffffff;
        box-shadow: 0 10px 22px rgba(82, 74, 255, 0.32);
      }

      .secondary {
        background: rgba(10, 28, 68, 0.96);
        color: #dbe8ff;
        border: 1px solid #2f4d95;
      }

      .warn {
        background: rgba(245, 159, 11, 0.18);
        color: #ffe4b8;
        border: 1px solid rgba(245, 159, 11, 0.48);
      }

      .danger {
        background: rgba(239, 68, 68, 0.18);
        color: #ffd2d2;
        border: 1px solid rgba(239, 68, 68, 0.5);
      }

      .muted {
        color: var(--ink-soft);
        font-size: 0.75rem;
      }

      .status {
        font-size: 0.76rem;
        color: var(--ink-soft);
        margin-bottom: 8px;
      }

      .kvs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 10px;
      }

      .kv {
        border: 1px solid #2a4b91;
        border-radius: 12px;
        padding: 10px 12px;
        background: rgba(9, 25, 61, 0.92);
        min-height: 56px;
      }

      .kv .k {
        display: block;
        font-size: 0.7rem;
        color: var(--ink-soft);
        margin-bottom: 6px;
      }

      .kv .v {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.72rem;
        color: #dbe7ff;
        word-break: break-word;
      }

      .table-list {
        border: 1px solid #2a4b91;
        border-radius: 12px;
        padding: 10px;
        max-height: 360px;
        overflow: auto;
        background: rgba(9, 25, 61, 0.92);
      }

      .table-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
        font-size: 0.76rem;
        padding: 4px 6px;
        border-radius: 8px;
      }

      .table-item:hover {
        background: rgba(39, 71, 140, 0.45);
      }

      .badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-left: auto;
      }

      .badge {
        font-size: 0.66rem;
        border-radius: 999px;
        padding: 3px 8px;
        border: 1px solid #35579f;
        background: rgba(19, 39, 88, 0.86);
        color: #9db4e3;
        white-space: nowrap;
      }

      .badge.ok {
        background: rgba(30, 168, 91, 0.2);
        border-color: rgba(30, 168, 91, 0.45);
        color: #7be5aa;
      }

      .badge.warn {
        background: rgba(245, 159, 11, 0.2);
        border-color: rgba(245, 159, 11, 0.46);
        color: #ffd999;
      }

      .badge.danger {
        background: rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.48);
        color: #ffcdcd;
      }

      .output {
        border: 1px solid #2f4d95;
        border-radius: 12px;
        padding: 10px;
        max-height: 360px;
        overflow: auto;
        background: linear-gradient(165deg, #0d214f 0%, #123266 70%, #163f77 100%);
        color: #dceafe;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.73rem;
        white-space: pre-wrap;
      }

      .validation-panel {
        margin-top: 12px;
        border: 1px solid #2a4b91;
        border-radius: 14px;
        background: rgba(9, 25, 61, 0.92);
        overflow: hidden;
      }

      .validation-summary {
        padding: 10px 14px;
        font-size: 0.8rem;
        font-weight: 600;
        border-bottom: 1px solid var(--line-soft);
      }

      .validation-summary.all-ok {
        background: rgba(30, 168, 91, 0.16);
        color: #7be5aa;
      }

      .validation-summary.has-errors {
        background: rgba(239, 68, 68, 0.16);
        color: #ffc5c5;
      }

      .val-table {
        padding: 8px 14px;
        border-bottom: 1px solid var(--line-soft);
        font-size: 0.76rem;
      }

      .val-table:last-child {
        border-bottom: none;
      }

      .val-table-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        cursor: pointer;
      }

      .val-icon-ok { color: var(--ok); }
      .val-icon-fail { color: var(--danger); }

      .val-cols {
        margin-top: 6px;
        padding-left: 22px;
        display: none;
      }

      .val-cols.expanded {
        display: block;
      }

      .val-col {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 0;
        color: var(--ink-soft);
      }

      .val-col.fail {
        color: #ffcdcd;
      }

      .val-spinner {
        text-align: center;
        padding: 12px;
        color: var(--ink-soft);
        font-size: 0.8rem;
        font-style: italic;
      }

      .callout {
        border-radius: 14px;
        border: 1px solid rgba(245, 159, 11, 0.46);
        background: rgba(245, 159, 11, 0.16);
        padding: 10px 12px;
        font-size: 0.76rem;
        color: #ffd999;
        margin-top: 10px;
      }

      .callout strong {
        color: #ffeecf;
      }

      .governance-summary {
        margin-top: 10px;
        border-radius: 12px;
        padding: 10px 12px;
        border: 1px solid rgba(30, 168, 91, 0.42);
        background: rgba(30, 168, 91, 0.16);
        color: #9ff1c4;
        font-size: 0.74rem;
      }

      .modal {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(8, 20, 41, 0.52);
        z-index: 50;
      }

      .modal.open {
        display: flex;
      }

      .modal-card {
        width: min(920px, 100%);
        border-radius: 20px;
        border: 1px solid #3d61ab;
        background: rgba(10, 26, 62, 0.98);
        box-shadow: 0 24px 60px rgba(5, 16, 34, 0.3);
        padding: 16px;
      }

      .modal-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }

      .modal-title h2 {
        margin: 0;
      }

      .modal-body textarea {
        min-height: 260px;
        background: linear-gradient(165deg, #0e2240 0%, #0f2749 70%, #14345f 100%);
        color: #dceafe;
      }

      @media (max-width: 980px) {
        .layout { grid-template-columns: 1fr; }
        .platform-panel { display: none; }
        .workspace { padding: 12px; }
        .step-track { grid-template-columns: 1fr; }

        .kvs {
          grid-template-columns: 1fr;
        }

        .row {
          grid-template-columns: 1fr;
        }
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
            <a class="platform-link" href="/"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>Chat Explorer</a>
            <a class="platform-link" href="/usage"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></span>Usage Metrics</a>
          </nav>
          <div class="platform-section">Infrastructure</div>
          <nav class="platform-nav">
            <a class="platform-link active" href="/connect"><span class="link-icon"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></span>Data Sources</a>
            <a class="platform-link" href="/config"><span class="link-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>Global Config</a>
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
        <main class="workspace">
          <header class="card top">
            <h1>1-Click Database Connection Wizard</h1>
            <a href="/">Open Chat Interface</a>
          </header>

          <section class="step-track">
            <div class="step-pill active" id="step-pill-source"><span class="num">1</span><span>Source</span></div>
            <div class="step-pill" id="step-pill-governance"><span class="num">2</span><span>Governance</span></div>
            <div class="step-pill" id="step-pill-activate"><span class="num">3</span><span>Activate</span></div>
          </section>

      <section class="card">
        <h2 style="margin-top: 0;">Data Sources</h2>
        <div class="mode-grid">
          <button class="mode-btn" id="mode-edit" type="button">
            <strong>Edit connected databases</strong>
            <small>View active source details, keep/remove allowlisted tables, and disconnect safely.</small>
          </button>
          <button class="mode-btn" id="mode-connect" type="button">
            <strong>Connect new DB or tables</strong>
            <small>Run Source -> Governance -> Activate flow with automatic validation and catalog indexing.</small>
          </button>
        </div>
        <div class="status" id="connection-status">No active runtime connection.</div>
      </section>

      <section class="card panel-hidden" id="edit-panel">
        <h2 style="margin-top: 0;">Edit Connected Databases</h2>
        <div id="edit-empty" class="callout panel-hidden"><strong>No active source.</strong> Use <em>Connect new DB or tables</em> to start setup.</div>
        <div id="edit-content" class="panel-hidden">
          <div class="kvs">
            <div class="kv"><span class="k">Connection ID</span><span class="v" id="edit-connection-id">-</span></div>
            <div class="kv"><span class="k">Provider</span><span class="v" id="edit-provider">-</span></div>
            <div class="kv"><span class="k">Database</span><span class="v" id="edit-database">-</span></div>
            <div class="kv"><span class="k">Connected At</span><span class="v" id="edit-connected-at">-</span></div>
            <div class="kv" style="grid-column: 1 / -1;"><span class="k">Connection String (masked)</span><span class="v" id="edit-connection-string">Stored encrypted server-side.</span></div>
          </div>

          <div class="row" style="margin-top: 10px;">
            <div>
              <label for="edit-schema-filter">Schema filter</label>
              <select id="edit-schema-filter"></select>
            </div>
            <div>
              <label for="edit-search-filter">Search</label>
              <input id="edit-search-filter" placeholder="sales, customers, reporting..." />
            </div>
          </div>

          <div class="actions">
            <button class="secondary" id="edit-select-all">Select all visible</button>
            <button class="secondary" id="edit-select-none">Select none</button>
            <button class="primary" id="edit-save-allowlist">Save allowlist changes</button>
            <button class="warn" id="edit-disconnect">Disconnect source</button>
          </div>
          <div class="table-list" id="edit-table-list"></div>
          <div id="edit-validation-container"></div>
        </div>
      </section>

      <section class="card panel-hidden" id="connect-flow-panel">
        <h2 style="margin-top: 0;">STEP A - Source</h2>
        <div class="row">
          <div>
            <label for="connection-name">Connection Name</label>
            <input id="connection-name" placeholder="Customer Prod Read Replica" />
          </div>
          <div>
            <label for="query-limit">Safe Query Limit</label>
            <input id="query-limit" type="number" min="1" max="2000" value="200" />
          </div>
        </div>

        <div style="margin-top: 10px;">
          <label for="connection-provider">Data Source</label>
          <select id="connection-provider">
            <option value="postgres">Postgres</option>
            <option value="supabase">Supabase (Postgres)</option>
            <option value="neon">Neon (Postgres)</option>
            <option value="mysql">MySQL (coming soon)</option>
            <option value="snowflake">Snowflake (coming soon)</option>
            <option value="bigquery">BigQuery (coming soon)</option>
          </select>
          <p class="muted">Postgres-compatible sources (Postgres/Supabase/Neon) are enabled in this runtime.</p>
        </div>

        <div>
          <label for="connection-string">Connection String</label>
          <input id="connection-string" type="password" placeholder="postgresql://user:pass@host:5432/db?sslmode=require" />
          <p class="muted">Credentials never run in the browser. This string is sent to the server, stored encrypted, and used for governed SELECT-only execution.</p>
        </div>

        <details style="margin-top: 10px;">
          <summary class="muted" style="cursor: pointer;"><strong>Advanced TLS</strong> (optional)</summary>
          <div style="margin-top: 10px;">
            <label for="tls-ca-pem">Custom CA (PEM)</label>
            <textarea id="tls-ca-pem" placeholder="-----BEGIN CERTIFICATE-----\n..."></textarea>
            <p class="muted">If you see TLS errors like "self-signed certificate in certificate chain", paste your org/DB root CA here (PEM). This is used only for this session.</p>
          </div>
        </details>

        <div class="actions">
          <button class="secondary" id="test-connection">Test Connection</button>
          <button class="primary" id="connect-source">Connect source & continue</button>
        </div>

        <div class="kvs" id="test-metadata" style="display:none;">
          <div class="kv"><span class="k">current_user</span><span class="v" id="meta-user"></span></div>
          <div class="kv"><span class="k">current_database</span><span class="v" id="meta-db"></span></div>
          <div class="kv" style="grid-column: 1 / -1;"><span class="k">version</span><span class="v" id="meta-version"></span></div>
        </div>

        <div id="test-notes"></div>

      </section>

      <section class="card panel-hidden" id="governance-panel">
        <h2 style="margin-top: 0;">STEP B - Governance</h2>
        <p class="muted">Pick allowlist tables/views. After save, validation and catalog indexing run automatically.</p>
        <div class="row">
          <div>
            <label for="schema-filter">Schema filter</label>
            <select id="schema-filter"></select>
          </div>
          <div>
            <label for="search-filter">Search</label>
            <input id="search-filter" placeholder="sales, customers, reporting..." />
          </div>
        </div>

        <div class="actions">
          <button class="secondary" id="select-recommended">Select recommended</button>
          <button class="secondary" id="select-ok">Select all OK</button>
          <button class="secondary" id="select-none">Select none</button>
          <button class="primary" id="save-allowlist">Save governance & continue</button>
          <button class="danger" id="open-fix-script">Fix-it script</button>
        </div>
        <div class="table-list" id="table-list"></div>
        <div class="governance-summary panel-hidden" id="governance-summary"></div>
        <div id="validation-container"></div>
      </section>

      <section class="card panel-hidden" id="activate-panel">
        <h2>STEP C - Activate (Safe Query)</h2>
        <p class="muted"><strong>Read-only enforced</strong> and <strong>SELECT-only enforced</strong>. Exactly one statement (no semicolons). Allowlist enforced. LIMIT enforced.</p>
        <label for="safe-sql">SQL</label>
        <textarea id="safe-sql">SELECT * FROM public.sales LIMIT 50</textarea>
        <div class="actions">
          <button class="primary" id="run-query">Run Query</button>
          <button class="secondary" id="refresh-logs">Refresh audit logs</button>
          <button class="primary" id="submit-connection">Submit connected source</button>
        </div>
        <div class="output" id="query-output"></div>
      </section>
        </main>
      </div>
    </div>

    <div class="modal" id="fix-modal" aria-hidden="true">
      <div class="modal-card">
        <div class="modal-title">
          <h2>STEP C - Fix-it Script (1 copy/paste)</h2>
          <button class="secondary" id="close-fix-modal">Close</button>
        </div>
        <p class="muted">
          We found your DB is protected (good). Run this 1-time script as an admin to create a read-only role and grant access only to your selected allowlist.
          If RLS is enabled, it also creates a permissive SELECT policy for the reader role (MVP/testing).
        </p>
        <div class="modal-body">
          <label for="fix-script">Generated script</label>
          <textarea id="fix-script" spellcheck="false"></textarea>
          <div class="actions" style="margin-top: 10px;">
            <button class="primary" id="copy-fix-script">Copy script</button>
            <button class="warn" id="ran-fix-script">I ran the script</button>
          </div>
          <p class="muted" id="fix-status"></p>
        </div>
      </div>
    </div>

    <div class="modal" id="error-modal" aria-hidden="true">
      <div class="modal-card" style="width:min(680px, 100%);">
        <div class="modal-title">
          <h2 id="error-title">Action failed</h2>
          <button class="secondary" id="close-error-modal">Close</button>
        </div>
        <p class="muted" id="error-message"></p>
      </div>
    </div>

    <script>
      (() => {
        const elements = {
          status: document.getElementById("connection-status"),
          modeEditBtn: document.getElementById("mode-edit"),
          modeConnectBtn: document.getElementById("mode-connect"),
          editPanel: document.getElementById("edit-panel"),
          connectFlowPanel: document.getElementById("connect-flow-panel"),
          governancePanel: document.getElementById("governance-panel"),
          activatePanel: document.getElementById("activate-panel"),
          stepSource: document.getElementById("step-pill-source"),
          stepGovernance: document.getElementById("step-pill-governance"),
          stepActivate: document.getElementById("step-pill-activate"),
          editEmpty: document.getElementById("edit-empty"),
          editContent: document.getElementById("edit-content"),
          editConnectionId: document.getElementById("edit-connection-id"),
          editProvider: document.getElementById("edit-provider"),
          editDatabase: document.getElementById("edit-database"),
          editConnectedAt: document.getElementById("edit-connected-at"),
          editConnectionString: document.getElementById("edit-connection-string"),
          editSchemaFilter: document.getElementById("edit-schema-filter"),
          editSearchFilter: document.getElementById("edit-search-filter"),
          editTableList: document.getElementById("edit-table-list"),
          editSelectAllBtn: document.getElementById("edit-select-all"),
          editSelectNoneBtn: document.getElementById("edit-select-none"),
          editSaveAllowlistBtn: document.getElementById("edit-save-allowlist"),
          editDisconnectBtn: document.getElementById("edit-disconnect"),
          editValidationContainer: document.getElementById("edit-validation-container"),
          name: document.getElementById("connection-name"),
          provider: document.getElementById("connection-provider"),
          connectionString: document.getElementById("connection-string"),
          tlsCaPem: document.getElementById("tls-ca-pem"),
          queryLimit: document.getElementById("query-limit"),
          schemaFilter: document.getElementById("schema-filter"),
          searchFilter: document.getElementById("search-filter"),
          tableList: document.getElementById("table-list"),
          governanceSummary: document.getElementById("governance-summary"),
          sql: document.getElementById("safe-sql"),
          output: document.getElementById("query-output"),
          testBtn: document.getElementById("test-connection"),
          connectSourceBtn: document.getElementById("connect-source"),
          runBtn: document.getElementById("run-query"),
          refreshLogsBtn: document.getElementById("refresh-logs"),
          submitConnectionBtn: document.getElementById("submit-connection"),
          selectRecommendedBtn: document.getElementById("select-recommended"),
          selectOkBtn: document.getElementById("select-ok"),
          selectNoneBtn: document.getElementById("select-none"),
          saveAllowlistBtn: document.getElementById("save-allowlist"),
          metaBlock: document.getElementById("test-metadata"),
          metaUser: document.getElementById("meta-user"),
          metaDb: document.getElementById("meta-db"),
          metaVersion: document.getElementById("meta-version"),
          testNotes: document.getElementById("test-notes"),
          openFixScriptBtn: document.getElementById("open-fix-script"),
          fixModal: document.getElementById("fix-modal"),
          fixScript: document.getElementById("fix-script"),
          fixStatus: document.getElementById("fix-status"),
          closeFixModalBtn: document.getElementById("close-fix-modal"),
          copyFixScriptBtn: document.getElementById("copy-fix-script"),
          ranFixScriptBtn: document.getElementById("ran-fix-script"),
          validationContainer: document.getElementById("validation-container"),
          errorModal: document.getElementById("error-modal"),
          errorTitle: document.getElementById("error-title"),
          errorMessage: document.getElementById("error-message"),
          closeErrorModalBtn: document.getElementById("close-error-modal")
        };

        const state = {
          mode: "connect",
          context: null,
          relations: [],
          selected: new Set(),
          testResult: null,
          lastValidation: null,
          lastCatalog: null,
          wizard: {
            source_tested: false,
            source_connected: false,
            governance_saved: false
          }
        };

        function showOutput(value) {
          elements.output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        }

        function openModal(modalEl) {
          modalEl.classList.add("open");
          modalEl.setAttribute("aria-hidden", "false");
        }

        function closeModal(modalEl) {
          modalEl.classList.remove("open");
          modalEl.setAttribute("aria-hidden", "true");
        }

        function showError(message, title) {
          elements.errorTitle.textContent = title || "Action failed";
          elements.errorMessage.textContent = String(message || "Unknown error");
          openModal(elements.errorModal);
        }

        function setWizardStep(step) {
          const current = step === "governance" || step === "activate" ? step : "source";
          elements.stepSource.classList.toggle("active", current === "source");
          elements.stepGovernance.classList.toggle("active", current === "governance");
          elements.stepActivate.classList.toggle("active", current === "activate");
        }

        function resetConnectWizardState() {
          state.wizard.source_tested = false;
          state.wizard.source_connected = false;
          state.wizard.governance_saved = false;
          elements.governanceSummary.classList.add("panel-hidden");
          elements.validationContainer.innerHTML = "";
          elements.metaBlock.style.display = "none";
          elements.testNotes.innerHTML = "";
          if (!state.context || !state.context.connected) {
            state.selected = new Set();
            state.relations = [];
            renderSchemaFilter(elements.schemaFilter);
            renderSchemaFilter(elements.editSchemaFilter);
            renderAllRelationLists();
          }
        }

        function setMode(mode) {
          state.mode = mode === "edit" ? "edit" : "connect";
          const editMode = state.mode === "edit";
          elements.modeEditBtn.classList.toggle("active", editMode);
          elements.modeConnectBtn.classList.toggle("active", !editMode);
          elements.editPanel.classList.toggle("panel-hidden", !editMode);
          elements.connectFlowPanel.classList.toggle("panel-hidden", editMode);
          elements.governancePanel.classList.toggle(
            "panel-hidden",
            editMode || !state.wizard.source_connected
          );
          elements.activatePanel.classList.toggle(
            "panel-hidden",
            editMode || !state.wizard.governance_saved
          );

          if (editMode) {
            setWizardStep("source");
          } else if (state.wizard.governance_saved) {
            setWizardStep("activate");
          } else if (state.wizard.source_connected) {
            setWizardStep("governance");
          } else {
            setWizardStep("source");
          }
        }

        function maskConnectionString(raw) {
          const value = String(raw || "").trim();
          if (!value) {
            return "Stored encrypted server-side.";
          }
          try {
            const url = new URL(value);
            const user = url.username || "user";
            const host = url.hostname || "host";
            const db = (url.pathname || "").replace(/^\\//, "") || "db";
            return url.protocol + "//" + user + ":****@" + host + "/" + db;
          } catch {
            return value.slice(0, 12) + "...";
          }
        }

        function renderValidation(result, container) {
          const target = container || elements.validationContainer;
          const summaryClass = result.ok ? "all-ok" : "has-errors";
          const icon = result.ok ? "&#10004;" : "&#10008;";

          let html = '<div class="validation-panel">';
          html += '<div class="validation-summary ' + summaryClass + '">' + icon + ' ' + escapeHtml(result.summary) + '</div>';

          if (Array.isArray(result.tables)) {
            for (const table of result.tables) {
              const tIcon = table.accessible ? '<span class="val-icon-ok">&#10004;</span>' : '<span class="val-icon-fail">&#10008;</span>';
              const tableId = "val-" + table.name.replace(/[^a-z0-9]/gi, "-");

              html += '<div class="val-table">';
              html += '<div class="val-table-header" data-toggle="' + tableId + '">' + tIcon + ' ' + escapeHtml(table.name);
              if (table.error) {
                html += ' <span style="font-weight:400;color:#991b1b">(' + escapeHtml(table.error) + ')</span>';
              }
              if (table.columns && table.columns.length > 0) {
                const failCount = table.columns.filter(function(c) { return !c.accessible; }).length;
                if (failCount > 0) {
                  html += ' <span style="font-weight:400;color:#991b1b">(' + failCount + ' column' + (failCount > 1 ? 's' : '') + ' inaccessible)</span>';
                }
              }
              html += '</div>';

              if (table.columns && table.columns.length > 0) {
                html += '<div class="val-cols" id="' + tableId + '">';
                for (const col of table.columns) {
                  const cIcon = col.accessible ? '<span class="val-icon-ok">&#10004;</span>' : '<span class="val-icon-fail">&#10008;</span>';
                  const cClass = col.accessible ? "val-col" : "val-col fail";
                  html += '<div class="' + cClass + '">' + cIcon + ' ' + escapeHtml(col.name) + ' <span style="opacity:0.6">(' + escapeHtml(col.data_type) + ')</span>';
                  if (col.error) {
                    html += ' — ' + escapeHtml(col.error);
                  }
                  html += '</div>';
                }
                html += '</div>';
              }

              html += '</div>';
            }
          }

          html += '</div>';
          target.innerHTML = html;

          // Toggle column details on table header click
          target.addEventListener("click", function(e) {
            const toggleEl = e.target.closest("[data-toggle]");
            if (!toggleEl) return;
            const colsEl = document.getElementById(toggleEl.dataset.toggle);
            if (colsEl) colsEl.classList.toggle("expanded");
          });
        }

        function escapeHtml(value) {
          return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        }

        async function request(path, method, body) {
          const response = await fetch(path, {
            method,
            headers: { "content-type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body)
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message = payload && typeof payload.message === "string"
              ? payload.message
              : "Request failed";
            throw new Error(message);
          }

          return payload;
        }

        function qualifiedName(relation) {
          if (relation && typeof relation.qualified_name === "string") {
            return relation.qualified_name;
          }

          const schema = relation && typeof relation.schema_name === "string" ? relation.schema_name : "";
          const name = relation && typeof relation.relation_name === "string" ? relation.relation_name : "";
          return schema && name ? schema + "." + name : String(name || "");
        }

        function badgeForRelation(relation) {
          const status = relation && typeof relation.status === "string" ? relation.status : "";
          const label = relation && typeof relation.status_label === "string" ? relation.status_label : "OK";

          if (status === "OK") {
            return { className: "badge ok", text: label };
          }

          if (status === "RLS_NO_POLICY") {
            return { className: "badge warn", text: label };
          }

          if (status === "NO_SELECT_GRANT") {
            return { className: "badge danger", text: label };
          }

          return { className: "badge", text: label };
        }

        function getSchemas(relations) {
          const schemas = new Set();
          for (const relation of relations || []) {
            if (relation && typeof relation.schema_name === "string") {
              schemas.add(relation.schema_name);
            }
          }
          return Array.from(schemas).sort((a, b) => a.localeCompare(b));
        }

        function renderSchemaFilter(selectEl) {
          const schemas = getSchemas(state.relations);
          const prev = String(selectEl.value || "__all__");
          selectEl.innerHTML = "";

          const all = document.createElement("option");
          all.value = "__all__";
          all.textContent = "All schemas";
          selectEl.appendChild(all);

          for (const schema of schemas) {
            const opt = document.createElement("option");
            opt.value = schema;
            opt.textContent = schema;
            selectEl.appendChild(opt);
          }

          if (schemas.includes(prev)) {
            selectEl.value = prev;
          } else {
            selectEl.value = "__all__";
          }
        }

        function renderRelations(listEl, schemaValue, searchValue) {
          listEl.innerHTML = "";

          if (!Array.isArray(state.relations) || state.relations.length === 0) {
            listEl.textContent = "No tables/views loaded yet. Test a connection first.";
            return;
          }

          const schemaFilter = String(schemaValue || "__all__");
          const searchFilter = String(searchValue || "").trim().toLowerCase();

          const filtered = state.relations.filter((relation) => {
            const schema = relation && typeof relation.schema_name === "string" ? relation.schema_name : "";
            const name = qualifiedName(relation).toLowerCase();

            if (schemaFilter !== "__all__" && schema !== schemaFilter) {
              return false;
            }

            if (searchFilter && !name.includes(searchFilter)) {
              return false;
            }

            return true;
          });

          for (const relation of filtered) {
            const qn = qualifiedName(relation);
            const qnLower = qn.toLowerCase();
            const row = document.createElement("label");
            row.className = "table-item";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = state.selected.has(qnLower);
            checkbox.addEventListener("change", () => {
              if (checkbox.checked) {
                state.selected.add(qnLower);
              } else {
                state.selected.delete(qnLower);
              }
            });

            const text = document.createElement("span");
            text.textContent = qn;

            const badges = document.createElement("div");
            badges.className = "badges";

            const typeBadge = document.createElement("span");
            typeBadge.className = "badge";
            const type = relation && typeof relation.relation_type === "string" ? relation.relation_type : "RELATION";
            typeBadge.textContent = type;
            badges.appendChild(typeBadge);

            const statusBadge = document.createElement("span");
            const badge = badgeForRelation(relation);
            statusBadge.className = badge.className;
            statusBadge.textContent = badge.text;
            badges.appendChild(statusBadge);

            if (relation && relation.has_rls) {
              const rls = document.createElement("span");
              rls.className = relation.force_rls ? "badge warn" : "badge";
              rls.textContent = relation.force_rls ? "RLS forced" : "RLS enabled";
              badges.appendChild(rls);
            }

            row.appendChild(checkbox);
            row.appendChild(text);
            row.appendChild(badges);
            listEl.appendChild(row);
          }
        }

        function renderAllRelationLists() {
          renderRelations(elements.tableList, elements.schemaFilter.value, elements.searchFilter.value);
          renderRelations(elements.editTableList, elements.editSchemaFilter.value, elements.editSearchFilter.value);
        }

        function setConnectionStatus(context) {
          if (!context || !context.connected) {
            elements.status.textContent = "No active runtime connection.";
            elements.editEmpty.classList.remove("panel-hidden");
            elements.editContent.classList.add("panel-hidden");
            return;
          }

          const source = typeof context.source === "string" ? context.source : "runtime";
          const provider = typeof context.provider === "string" ? context.provider : "postgres";
          const db = context.database || context.name || "unknown";
          const tableCount = Array.isArray(context.allowed_relations) ? context.allowed_relations.length : 0;
          const businessId =
            context &&
            context.catalog &&
            typeof context.catalog.business_id === "string" &&
            context.catalog.business_id.length > 0
              ? context.catalog.business_id
              : "";
          elements.status.textContent =
            "Connected: " +
            db +
            " | provider: " +
            provider +
            " | source: " +
            source +
            " | allowlisted: " +
            tableCount +
            (businessId ? " | business_id: " + businessId : "");

          elements.editEmpty.classList.add("panel-hidden");
          elements.editContent.classList.remove("panel-hidden");
          elements.editConnectionId.textContent = String(context.connection_id || "-");
          elements.editProvider.textContent = provider;
          elements.editDatabase.textContent = String(db || "-");
          elements.editConnectedAt.textContent = context.connected_at ? new Date(context.connected_at).toLocaleString() : "-";
          elements.editConnectionString.textContent = maskConnectionString(elements.connectionString.value);
        }

        function showGovernanceSummary(validation, catalog) {
          if (!validation || !Array.isArray(validation.tables) || !catalog || !Array.isArray(catalog.tables)) {
            elements.governanceSummary.classList.add("panel-hidden");
            return;
          }

          let validatedTables = 0;
          let totalTables = validation.tables.length;
          let validatedColumns = 0;
          let totalColumns = 0;
          for (const table of validation.tables) {
            if (table && table.accessible) {
              validatedTables += 1;
            }
            if (table && Array.isArray(table.columns)) {
              totalColumns += table.columns.length;
              for (const column of table.columns) {
                if (column && column.accessible) {
                  validatedColumns += 1;
                }
              }
            }
          }

          let catalogTables = catalog.tables.length;
          let catalogColumns = 0;
          for (const table of catalog.tables) {
            if (table && Array.isArray(table.columns)) {
              catalogColumns += table.columns.length;
            }
          }

          const tableDone = Math.min(validatedTables, catalogTables);
          const tableAll = Math.max(totalTables, catalogTables);
          const columnDone = Math.min(validatedColumns, catalogColumns);
          const columnAll = Math.max(totalColumns, catalogColumns);
          const businessId = typeof catalog.business_id === "string" ? catalog.business_id : "pending";

          elements.governanceSummary.textContent =
            tableDone +
            "/" +
            tableAll +
            " tables and " +
            columnDone +
            "/" +
            columnAll +
            " columns validated and catalogued automatically. business_id: " +
            businessId;
          elements.governanceSummary.classList.remove("panel-hidden");
        }

        function renderTestNotes(result) {
          elements.testNotes.innerHTML = "";

          if (!result) {
            elements.metaBlock.style.display = "none";
            return;
          }

          const warnings = Array.isArray(result.warnings) ? result.warnings : [];
          const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
          const permissionsMissing = Boolean(result.permissions_missing);

          const chunks = [];

          if (permissionsMissing) {
            chunks.push(
              '<div class="callout"><strong>Permissions missing.</strong> You can connect, but table discovery or SELECT privileges appear blocked for this role. Use the Fix-it script to create a read-only reader and grant SELECT on your allowlist.</div>'
            );
          } else if ((state.relations || []).some((r) => r && r.status && r.status !== "OK")) {
            chunks.push(
              '<div class="callout"><strong>Protection detected (good).</strong> Some relations have missing SELECT grants and/or RLS without a visible policy for this role. Use the Fix-it script to generate a safe reader role for your allowlist.</div>'
            );
          }

          if (warnings.length > 0) {
            chunks.push('<div class="callout"><strong>Warnings</strong><br />' + warnings.map((w) => escapeHtml(w)).join("<br />") + "</div>");
          }

          if (recommendations.length > 0) {
            chunks.push('<div class="callout"><strong>Recommendations</strong><br />' + recommendations.map((w) => escapeHtml(w)).join("<br />") + "</div>");
          }

          elements.testNotes.innerHTML = chunks.join("");
        }

        async function loadContext() {
          let context;
          try {
            context = await request("/api/db/context", "GET");
          } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to load context";
            elements.status.textContent = "API unreachable: " + msg;
            elements.tableList.innerHTML = '<div class="callout"><strong>Cannot reach the API server.</strong> Make sure the API is running (pnpm --filter api dev) before using the wizard.</div>';
            showError(msg, "Connection context failed");
            return;
          }

          state.context = context;
          state.testResult = null;
          state.wizard.source_tested = false;
          state.wizard.source_connected = false;
          state.wizard.governance_saved = false;
          setConnectionStatus(context);

          const tables = await request("/api/db/tables", "GET").catch(() => null);
          const relations = tables && Array.isArray(tables.relations) ? tables.relations : [];
          state.relations = relations;
          state.selected = new Set(Array.isArray(context.allowed_relations) ? context.allowed_relations.map((v) => String(v).toLowerCase()) : []);
          if (context && typeof context.provider === "string") {
            elements.provider.value = context.provider;
          }

          renderSchemaFilter(elements.schemaFilter);
          renderSchemaFilter(elements.editSchemaFilter);
          renderAllRelationLists();
          renderTestNotes(null);

          if (context && context.connected) {
            setMode("edit");
          } else {
            setMode("connect");
          }
        }

        function openFixModal() {
          openModal(elements.fixModal);
        }

        function closeFixModal() {
          closeModal(elements.fixModal);
        }

        elements.closeFixModalBtn.addEventListener("click", () => closeFixModal());
        elements.fixModal.addEventListener("click", (event) => {
          if (event.target === elements.fixModal) {
            closeFixModal();
          }
        });

        elements.closeErrorModalBtn.addEventListener("click", () => closeModal(elements.errorModal));
        elements.errorModal.addEventListener("click", (event) => {
          if (event.target === elements.errorModal) {
            closeModal(elements.errorModal);
          }
        });

        elements.modeEditBtn.addEventListener("click", () => setMode("edit"));
        elements.modeConnectBtn.addEventListener("click", () => {
          if (state.mode !== "connect") {
            resetConnectWizardState();
          }
          setMode("connect");
        });

        elements.schemaFilter.addEventListener("change", () => renderAllRelationLists());
        elements.searchFilter.addEventListener("input", () => renderAllRelationLists());
        elements.editSchemaFilter.addEventListener("change", () => renderAllRelationLists());
        elements.editSearchFilter.addEventListener("input", () => renderAllRelationLists());

        elements.testBtn.addEventListener("click", async () => {
          try {
            const connectionString = String(elements.connectionString.value || "").trim();
            if (!connectionString) {
              throw new Error("Connection string is required.");
            }
            const provider = String(elements.provider.value || "postgres").trim().toLowerCase();

            const tlsCaPem = String(elements.tlsCaPem.value || "").trim();
            const body = {
              connection_string: connectionString,
              provider
            };
            if (tlsCaPem) {
              body.tls_ca_pem = tlsCaPem;
            }

            const result = await request("/api/db/test", "POST", body);

            state.testResult = result;
            state.wizard.source_tested = true;
            state.relations = Array.isArray(result.relations) ? result.relations : [];
            const recommended = Array.isArray(result.recommended_allowlist) ? result.recommended_allowlist : [];
            state.selected = new Set(recommended.map((entry) => String(entry).toLowerCase()));

            if (result && result.metadata) {
              elements.metaBlock.style.display = "grid";
              elements.metaUser.textContent = String(result.metadata.current_user || "");
              elements.metaDb.textContent = String(result.metadata.current_database || "");
              elements.metaVersion.textContent = String(result.metadata.version || "");
            } else {
              elements.metaBlock.style.display = "none";
            }

            elements.editConnectionString.textContent = maskConnectionString(connectionString);
            renderSchemaFilter(elements.schemaFilter);
            renderSchemaFilter(elements.editSchemaFilter);
            renderAllRelationLists();
            renderTestNotes(result);
            setWizardStep("source");
            setMode("connect");
            showOutput(result);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            showOutput(message);
            showError(message, "Test connection failed");
          }
        });

        elements.connectSourceBtn.addEventListener("click", async () => {
          try {
            if (!state.wizard.source_tested || !state.testResult) {
              throw new Error("Run Step A test connection first.");
            }

            const connectionString = String(elements.connectionString.value || "").trim();
            if (!connectionString) {
              throw new Error("Connection string is required.");
            }
            const provider = String(elements.provider.value || "postgres").trim().toLowerCase();

            if (state.selected.size === 0) {
              const recommended =
                state.testResult && Array.isArray(state.testResult.recommended_allowlist)
                  ? state.testResult.recommended_allowlist
                  : [];
              if (recommended.length > 0) {
                state.selected = new Set(recommended.map((entry) => String(entry).toLowerCase()));
              }
            }
            if (state.selected.size === 0) {
              const ok = (state.relations || [])
                .filter((relation) => relation && relation.status === "OK")
                .map((relation) => qualifiedName(relation).toLowerCase())
                .filter((v) => v.length > 0);
              if (ok.length > 0) {
                state.selected = new Set(ok);
              }
            }
            if (state.selected.size === 0) {
              throw new Error("Select at least one table/view before connecting.");
            }

            const tlsCaPem = String(elements.tlsCaPem.value || "").trim();
            const body = {
              name: String(elements.name.value || "").trim() || undefined,
              connection_string: connectionString,
              provider,
              allowed_relations: Array.from(state.selected)
            };
            if (tlsCaPem) {
              body.tls_ca_pem = tlsCaPem;
            }

            const context = await request("/api/db/connect", "POST", body);
            state.context = context;
            state.wizard.source_connected = true;
            state.wizard.governance_saved = false;
            setConnectionStatus(context);

            const tables = await request("/api/db/tables", "GET").catch(() => null);
            state.relations = tables && Array.isArray(tables.relations) ? tables.relations : state.relations;
            state.selected = new Set(
              Array.isArray(context.allowed_relations)
                ? context.allowed_relations.map((v) => String(v).toLowerCase())
                : []
            );
            elements.editConnectionString.textContent = maskConnectionString(connectionString);
            renderSchemaFilter(elements.schemaFilter);
            renderSchemaFilter(elements.editSchemaFilter);
            renderAllRelationLists();
            setMode("connect");
            setWizardStep("governance");
            showOutput({
              message: "Source connected. Step B governance is now unlocked.",
              connection_id: context.connection_id || null
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            showOutput(message);
            showError(message, "Connect source failed");
          }
        });

        elements.selectRecommendedBtn.addEventListener("click", () => {
          const recommended = state.testResult && Array.isArray(state.testResult.recommended_allowlist) ? state.testResult.recommended_allowlist : [];
          state.selected = new Set(recommended.map((entry) => String(entry).toLowerCase()));
          renderAllRelationLists();
        });

        elements.selectOkBtn.addEventListener("click", () => {
          const ok = (state.relations || [])
            .filter((relation) => relation && relation.status === "OK")
            .map((relation) => qualifiedName(relation).toLowerCase())
            .filter((v) => v.length > 0);
          state.selected = new Set(ok);
          renderAllRelationLists();
        });

        elements.selectNoneBtn.addEventListener("click", () => {
          state.selected = new Set();
          renderAllRelationLists();
        });

        elements.saveAllowlistBtn.addEventListener("click", async () => {
          try {
            if (!state.wizard.source_connected || !state.context || !state.context.connected) {
              throw new Error("Complete Step A and connect the source before Step B.");
            }

            if (state.selected.size === 0) {
              throw new Error("Select at least one table/view for your allowlist.");
            }

            const context = await request("/api/db/allowlist", "POST", {
              allowed_relations: Array.from(state.selected)
            });
            state.context = context;
            setConnectionStatus(context);
            const tables = await request("/api/db/tables", "GET").catch(() => null);
            state.relations = tables && Array.isArray(tables.relations) ? tables.relations : state.relations;
            state.selected = new Set(Array.isArray(context.allowed_relations) ? context.allowed_relations.map((v) => String(v).toLowerCase()) : []);
            renderSchemaFilter(elements.schemaFilter);
            renderSchemaFilter(elements.editSchemaFilter);
            renderAllRelationLists();

            const validation = await request("/api/db/validate", "POST", {});
            state.lastValidation = validation;
            renderValidation(validation, elements.validationContainer);
            renderValidation(validation, elements.editValidationContainer);

            const catalog = await request("/api/db/catalogue", "POST", {});
            state.lastCatalog = catalog;
            showGovernanceSummary(validation, catalog);

            if (!validation.ok) {
              showError("Governance saved, but some tables/columns failed validation. Open Fix-it script and re-test.", "Validation warning");
            }

            showOutput({
              message: "Governance saved and auto-catalog completed.",
              validation_summary: validation.summary,
              cataloged_at: catalog ? catalog.cataloged_at : null,
              business_id: catalog ? catalog.business_id : null
            });

            state.wizard.governance_saved = true;
            setMode("connect");
            setWizardStep("activate");
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            showOutput(message);
            showError(message, "Governance step failed");
          }
        });

        elements.editSelectAllBtn.addEventListener("click", () => {
          const schemaValue = String(elements.editSchemaFilter.value || "__all__");
          const searchValue = String(elements.editSearchFilter.value || "").trim().toLowerCase();
          for (const relation of state.relations || []) {
            const schema = relation && typeof relation.schema_name === "string" ? relation.schema_name : "";
            const name = qualifiedName(relation).toLowerCase();
            if (schemaValue !== "__all__" && schema !== schemaValue) {
              continue;
            }
            if (searchValue && !name.includes(searchValue)) {
              continue;
            }
            state.selected.add(name);
          }
          renderAllRelationLists();
        });

        elements.editSelectNoneBtn.addEventListener("click", () => {
          state.selected = new Set();
          renderAllRelationLists();
        });

        elements.editSaveAllowlistBtn.addEventListener("click", async () => {
          try {
            if (state.selected.size === 0) {
              throw new Error("At least one relation is required. To remove everything, disconnect this source.");
            }

            const context = await request("/api/db/allowlist", "POST", {
              allowed_relations: Array.from(state.selected)
            });

            state.context = context;
            setConnectionStatus(context);
            const validation = await request("/api/db/validate", "POST", {});
            state.lastValidation = validation;
            renderValidation(validation, elements.editValidationContainer);
            renderValidation(validation, elements.validationContainer);
            if (!validation.ok) {
              showError("Allowlist was updated with validation warnings.", "Validation warning");
            }
            showOutput(context);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            showOutput(message);
            showError(message, "Allowlist update failed");
          }
        });

        elements.editDisconnectBtn.addEventListener("click", async () => {
          try {
            await request("/api/db/disconnect", "POST");
            elements.governanceSummary.classList.add("panel-hidden");
            elements.validationContainer.innerHTML = "";
            elements.editValidationContainer.innerHTML = "";
            await loadContext();
            showOutput("Disconnected.");
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            showOutput(message);
            showError(message, "Disconnect failed");
          }
        });

        elements.runBtn.addEventListener("click", async () => {
          try {
            const sql = String(elements.sql.value || "").trim();
            if (!sql) {
              throw new Error("SQL is required.");
            }

            const limitValue = Number.parseInt(String(elements.queryLimit.value || "200"), 10);
            const result = await request("/api/db/query", "POST", {
              sql,
              limit: Number.isNaN(limitValue) ? 200 : limitValue
            });

            showOutput(result);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            showOutput(message);
            showError(message, "Safe query failed");
          }
        });

        elements.refreshLogsBtn.addEventListener("click", async () => {
          try {
            const logs = await request("/api/db/query-logs", "GET");
            showOutput(logs);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            showOutput(message);
            showError(message, "Audit log load failed");
          }
        });

        elements.submitConnectionBtn.addEventListener("click", async () => {
          try {
            if (!state.context || !state.context.connected) {
              throw new Error("No active connected source to submit.");
            }
            await loadContext();
            setMode("edit");
            showOutput("Connection submitted. Source is now active for chat and reports.");
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            showError(message, "Submit failed");
          }
        });

        elements.openFixScriptBtn.addEventListener("click", async () => {
          try {
            if (state.selected.size === 0) {
              throw new Error("Select at least one allowlisted relation first.");
            }

            elements.fixStatus.textContent = "";
            elements.fixScript.value = "Generating script...";
            openFixModal();

            const response = await request("/api/db/fix-script", "POST", {
              allowlisted_relations: Array.from(state.selected)
            });

            elements.fixScript.value = response && typeof response.script === "string" ? response.script : "";
          } catch (error) {
            elements.fixScript.value = "";
            elements.fixStatus.textContent = error instanceof Error ? error.message : "Unknown error";
            showError(elements.fixStatus.textContent, "Fix-it script failed");
          }
        });

        elements.copyFixScriptBtn.addEventListener("click", async () => {
          try {
            const text = String(elements.fixScript.value || "").trim();
            if (!text) {
              throw new Error("Script is empty.");
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(text);
              elements.fixStatus.textContent = "Copied to clipboard.";
              return;
            }

            elements.fixScript.focus();
            elements.fixScript.select();
            document.execCommand("copy");
            elements.fixStatus.textContent = "Copied to clipboard.";
          } catch (error) {
            elements.fixStatus.textContent = error instanceof Error ? error.message : "Copy failed";
          }
        });

        elements.ranFixScriptBtn.addEventListener("click", async () => {
          try {
            const connectionString = String(elements.connectionString.value || "").trim();
            if (!connectionString) {
              throw new Error("Re-enter the connection string (we don't store it in the browser).");
            }
            const provider = String(elements.provider.value || "postgres").trim().toLowerCase();

            const tlsCaPem = String(elements.tlsCaPem.value || "").trim();
            elements.fixStatus.textContent = "Re-testing...";
            const body = {
              connection_string: connectionString,
              provider
            };
            if (tlsCaPem) {
              body.tls_ca_pem = tlsCaPem;
            }
            const result = await request("/api/db/test", "POST", body);

            state.testResult = result;
            state.wizard.source_tested = true;
            state.relations = Array.isArray(result.relations) ? result.relations : [];

            if (result && result.metadata) {
              elements.metaBlock.style.display = "grid";
              elements.metaUser.textContent = String(result.metadata.current_user || "");
              elements.metaDb.textContent = String(result.metadata.current_database || "");
              elements.metaVersion.textContent = String(result.metadata.version || "");
            } else {
              elements.metaBlock.style.display = "none";
            }

            elements.editConnectionString.textContent = maskConnectionString(connectionString);
            renderSchemaFilter(elements.schemaFilter);
            renderSchemaFilter(elements.editSchemaFilter);
            renderAllRelationLists();
            renderTestNotes(result);

            elements.fixStatus.textContent = "Re-test complete. You can now save governance and continue.";
          } catch (error) {
            elements.fixStatus.textContent = error instanceof Error ? error.message : "Re-test failed";
          }
        });

        loadContext().catch(() => {});
      })();
    </script>
  </body>
</html>`;
}
