import { renderClaritectLogoImage } from "./brand";

export function renderGlobalConfigPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect | Global config</title>
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
        background: rgba(12, 29, 72, 0.9);
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
        padding: 16px 20px 20px;
        overflow-y: auto;
        overflow-x: hidden;
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

      h2 {
        margin: 0 0 8px;
        font-size: 0.92rem;
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
        border: 1px solid #29498e;
        background: rgba(10, 29, 70, 0.88);
      }

      .section {
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 18px;
        background: linear-gradient(160deg, rgba(8, 22, 56, 0.86), rgba(6, 18, 46, 0.9));
        padding: 14px;
        margin-bottom: 16px;
        box-shadow: var(--shadow-soft);
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .section-hint {
        font-size: 0.76rem;
        color: var(--ink-soft);
        margin-bottom: 10px;
      }

      label {
        display: block;
        font-size: 0.75rem;
        color: var(--ink-soft);
        margin-bottom: 8px;
      }

      textarea, input[type="text"] {
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(108, 58, 237, 0.34);
        padding: 12px;
        resize: vertical;
        background: rgba(9, 24, 58, 0.94);
        color: #edf3ff;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.8rem;
      }

      textarea { min-height: 180px; }

      textarea:focus, input[type="text"]:focus {
        outline: none;
        border-color: #5d7eff;
        box-shadow: 0 0 0 4px rgba(90, 112, 236, 0.2);
      }

      .actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
      }

      .btn-primary {
        border: 1px solid rgba(107, 92, 138, 0.32);
        border-radius: 12px;
        padding: 10px 14px;
        color: #F5F3FF;
        cursor: pointer;
        background: #6C3AED;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-weight: 700;
        box-shadow: 0 10px 22px var(--glow);
        font-size: 0.84rem;
      }

      .btn-secondary {
        border: 1px solid rgba(108, 58, 237, 0.34);
        border-radius: 12px;
        padding: 8px 12px;
        color: #F5F3FF;
        cursor: pointer;
        background: rgba(15, 33, 79, 0.92);
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-weight: 600;
        font-size: 0.78rem;
      }

      .btn-danger {
        border: 1px solid #6b2f2f;
        border-radius: 10px;
        padding: 6px 10px;
        color: #ffa0a0;
        cursor: pointer;
        background: rgba(80, 20, 20, 0.8);
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-weight: 600;
        font-size: 0.72rem;
      }

      .btn-secondary:hover { border-color: #5d7eff; }
      .btn-danger:hover { border-color: #ff5555; background: rgba(100, 20, 20, 0.9); }

      .status {
        margin-top: 10px;
        font-size: 0.78rem;
        color: var(--ink-soft);
      }

      /* Metric Definitions Table */
      .metric-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 10px;
      }

      .metric-table th {
        text-align: left;
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--ink-soft);
        padding: 8px 10px;
        border-bottom: 1px solid #1f3f82;
      }

      .metric-table td {
        padding: 8px 10px;
        font-size: 0.82rem;
        border-bottom: 1px solid rgba(31, 63, 130, 0.4);
        vertical-align: top;
      }

      .metric-table tr:hover td {
        background: rgba(24, 49, 112, 0.25);
      }

      .metric-key {
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.75rem;
        color: #8eb3ff;
      }

      .metric-cols {
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.72rem;
        color: #8eb3ff;
      }

      .empty-state {
        padding: 20px;
        text-align: center;
        color: var(--ink-soft);
        font-size: 0.84rem;
      }

      /* Status Badges */
      .status-badge {
        display: inline-block;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.64rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .status-resolved {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #34d399;
      }

      .status-unresolved {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #f87171;
      }

      .status-pending {
        background: rgba(251, 191, 36, 0.15);
        border: 1px solid rgba(251, 191, 36, 0.4);
        color: #fbbf24;
      }

      /* Filter display in table */
      .filter-info {
        font-size: 0.76rem;
        line-height: 1.4;
      }

      .filter-col {
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.72rem;
        color: #8eb3ff;
      }

      .filter-vals {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 3px;
      }

      .filter-val-tag {
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.66rem;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(90, 112, 236, 0.15);
        border: 1px solid rgba(90, 112, 236, 0.3);
        color: #a5b4fc;
      }

      /* Add Metric Form */
      .metric-form {
        display: none;
        border: 1px solid #2a4d99;
        border-radius: 12px;
        padding: 14px;
        margin-top: 10px;
        background: rgba(6, 16, 42, 0.95);
      }

      .metric-form.visible { display: block; }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 10px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .form-group label {
        font-size: 0.68rem;
        margin-bottom: 2px;
      }

      .form-group input, .form-group select {
        border-radius: 10px;
        border: 1px solid rgba(108, 58, 237, 0.34);
        padding: 8px 10px;
        background: rgba(9, 24, 58, 0.94);
        color: #edf3ff;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.78rem;
      }

      .form-group input:focus, .form-group select:focus {
        outline: none;
        border-color: #5d7eff;
      }

      .form-group select {
        appearance: auto;
      }

      .form-actions {
        display: flex;
        gap: 8px;
        margin-top: 6px;
      }

      /* Column autocomplete */
      .col-input-wrap {
        position: relative;
      }

      .col-dropdown {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 180px;
        overflow-y: auto;
        background: rgba(6, 16, 42, 0.98);
        border: 1px solid rgba(108, 58, 237, 0.34);
        border-top: none;
        border-radius: 0 0 10px 10px;
        z-index: 10;
      }

      .col-dropdown.open { display: block; }

      .col-option {
        padding: 6px 10px;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.74rem;
        color: #a5b4fc;
        cursor: pointer;
      }

      .col-option:hover {
        background: rgba(90, 112, 236, 0.2);
      }

      .col-option .col-table {
        color: var(--ink-soft);
        font-size: 0.66rem;
      }

      /* Value pills */
      .value-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
        min-height: 28px;
      }

      .value-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 8px;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.72rem;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid rgba(108, 58, 237, 0.34);
        background: rgba(9, 24, 58, 0.94);
        color: #90a7d8;
      }

      .value-pill:hover {
        border-color: #5d7eff;
      }

      .value-pill.selected {
        background: rgba(90, 112, 236, 0.25);
        border-color: #6d7fff;
        color: #c7d2fe;
      }

      .value-pills-empty {
        font-size: 0.72rem;
        color: var(--ink-soft);
        padding: 6px 0;
      }

      @media (max-width: 1080px) {
        .page { padding: 0; }
        .layout { grid-template-columns: 1fr; gap: 0; min-height: 100vh; }
        .platform-panel { display: none; }
        .content { border-left: 1px solid var(--line); border-radius: 0; }
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
      [data-theme="light"] .section {
        background: linear-gradient(160deg, rgba(244, 241, 255, 0.86), rgba(240, 236, 255, 0.90));
        border-color: rgba(107, 92, 138, 0.18);
      }
      [data-theme="light"] textarea, [data-theme="light"] input[type="text"] {
        background: rgba(248, 246, 255, 0.88);
        color: #1A1533;
        border-color: rgba(107, 92, 138, 0.28);
      }
      [data-theme="light"] .badge { background: rgba(255, 255, 255, 0.88); color: #3D2E6B; border-color: rgba(107, 92, 138, 0.22); }
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
            <a class="platform-link" href="/usage"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></span>Usage &amp; AI</a>
          </nav>
          <div class="platform-section">Infrastructure</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/connect"><span class="link-icon"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></span>Data Sources</a>
            <a class="platform-link" href="/scheduled"><span class="link-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h3"/><path d="M8 18h6"/></svg></span>Scheduled Reports</a>
            <a class="platform-link active" href="/config"><span class="link-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>Global Config</a>
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
              <span class="eyebrow">Control Surface</span>
              <h1>Global Config</h1>
              <p class="sub">Business context and metric definitions used across chat planning and report generation.</p>
            </div>
            <span class="badge">Workspace Config</span>
          </div>

          <section class="section">
            <label for="business-context">Business Context</label>
            <textarea id="business-context" placeholder="Describe what this business does, key revenue model, and core operational constraints."></textarea>
            <div class="actions">
              <button class="btn-primary" id="save-context" type="button">Save Business Context</button>
            </div>
            <div class="status" id="context-status">Loading current config...</div>
          </section>

          <!-- Metric Definitions Section -->
          <section class="section">
            <div class="section-header">
              <h2>Metric Definitions</h2>
              <button class="btn-secondary" id="add-metric-btn" type="button">+ Add Metric</button>
            </div>
            <p class="section-hint">Define how key business metrics should be calculated. These definitions are saved to your profile and used by AI agents when relevant.</p>

            <table class="metric-table" id="metric-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Display Name</th>
                  <th>Definition</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="metric-tbody">
                <tr><td colspan="4" class="empty-state">No metric definitions yet. Click "+ Add Metric" to create one.</td></tr>
              </tbody>
            </table>

            <!-- Add/Edit Metric Form -->
            <div class="metric-form" id="metric-form">
              <div class="form-row">
                <div class="form-group">
                  <label for="mf-key">Metric Key</label>
                  <input type="text" id="mf-key" placeholder="e.g. total_revenue" />
                </div>
                <div class="form-group">
                  <label for="mf-name">Display Name</label>
                  <input type="text" id="mf-name" placeholder="e.g. Total Revenue" />
                </div>
              </div>
              <div class="form-group" style="margin-bottom:10px">
                <label for="mf-def">Definition (plain English - how to calculate this metric)</label>
                <input type="text" id="mf-def" placeholder="e.g. Refunded Revenue / Total Revenue" />
              </div>
              <div class="form-actions">
                <button class="btn-primary" id="mf-save" type="button">Save Metric</button>
                <button class="btn-secondary" id="mf-cancel" type="button">Cancel</button>
              </div>
            </div>

            <div class="actions" style="margin-top:12px">
              <button class="btn-primary" id="save-metrics" type="button">Save Metric Definitions</button>
            </div>
            <div class="status" id="metrics-status"></div>
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
        /* Business Context */
        const ctxTextarea = document.getElementById("business-context");
        const ctxStatus = document.getElementById("context-status");
        const ctxSaveBtn = document.getElementById("save-context");

        async function loadBusinessContext() {
          try {
            const res = await fetch("/api/db/context");
            const data = await res.json();
            if (!res.ok) {
              ctxStatus.textContent = "No active data source yet. Connect a source in Data Sources first.";
              return;
            }
            ctxTextarea.value = typeof data.business_context === "string" ? data.business_context : "";
            ctxStatus.textContent = "Loaded.";
          } catch {
            ctxStatus.textContent = "Failed to load business context.";
          }
        }

        async function saveBusinessContext() {
          ctxStatus.textContent = "Saving...";
          try {
            const res = await fetch("/api/db/business-context", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ business_context: String(ctxTextarea.value || "") })
            });
            const data = await res.json();
            ctxStatus.textContent = res.ok ? "Saved." : (data.message || "Failed to save.");
          } catch {
            ctxStatus.textContent = "Failed to save.";
          }
        }

        ctxSaveBtn.addEventListener("click", () => saveBusinessContext());

        /* ── Catalog Data ── */
        var catalogColumns = [];  // { qualified: "schema.table.column", table: "schema.table", column: "column_name", distinct_values: [...] }

        async function loadCatalog() {
          try {
            var res = await fetch("/connections/catalog");
            var data = await res.json();
            if (!res.ok || !Array.isArray(data.tables)) return;
            catalogColumns = [];
            data.tables.forEach(function(table) {
              var qn = table.qualified_name || table.schema_name + "." + table.table_name;
              var lowCardMap = {};
              (table.low_cardinality_columns || []).forEach(function(lc) {
                lowCardMap[lc.column_name] = lc.distinct_values || [];
              });
              (table.columns || []).forEach(function(col) {
                var colName = col.column_name || col.name;
                catalogColumns.push({
                  qualified: qn + "." + colName,
                  table: qn,
                  column: colName,
                  distinct_values: lowCardMap[colName] || []
                });
              });
            });
          } catch {
            // Catalog not available — autocomplete will be empty
          }
        }

        /* ── Metric Definitions ── */
        var metrics = [];
        var editingIndex = -1;
        var selectedFilterValues = [];

        const metricsTbody = document.getElementById("metric-tbody");
        const metricsStatus = document.getElementById("metrics-status");
        const addBtn = document.getElementById("add-metric-btn");
        const saveMetricsBtn = document.getElementById("save-metrics");
        const form = document.getElementById("metric-form");
        const mfKey = document.getElementById("mf-key");
        const mfName = document.getElementById("mf-name");
        const mfDef = document.getElementById("mf-def");
        const mfSave = document.getElementById("mf-save");
        const mfCancel = document.getElementById("mf-cancel");

        function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

        function renderMetrics() {
          if (metrics.length === 0) {
            metricsTbody.innerHTML = '<tr><td colspan="4" class="empty-state">No metric definitions yet. Click "+ Add Metric" to create one.</td></tr>';
            return;
          }
          metricsTbody.innerHTML = metrics.map(function(m, i) {
            return '<tr>'
              + '<td class="metric-key">' + esc(m.metric_key) + '</td>'
              + '<td>' + esc(m.display_name) + '</td>'
              + '<td>' + esc(m.definition) + '</td>'
              + '<td><button class="btn-secondary" data-edit="' + i + '">Edit</button> <button class="btn-danger" data-del="' + i + '">Del</button></td>'
              + '</tr>';
          }).join("");
        }

        metricsTbody.addEventListener("click", function(e) {
          var btn = e.target.closest("[data-edit]");
          if (btn) { openEditForm(parseInt(btn.dataset.edit, 10)); return; }
          var del = e.target.closest("[data-del]");
          if (del) { metrics.splice(parseInt(del.dataset.del, 10), 1); renderMetrics(); return; }
        });

        /* ── Form Open/Close ── */
        function openAddForm() {
          editingIndex = -1;
          mfKey.value = "";
          mfName.value = "";
          mfDef.value = "";
          form.classList.add("visible");
          mfKey.focus();
        }

        function openEditForm(idx) {
          var m = metrics[idx];
          if (!m) return;
          editingIndex = idx;
          mfKey.value = m.metric_key;
          mfName.value = m.display_name;
          mfDef.value = m.definition;
          form.classList.add("visible");
          mfKey.focus();
        }

        function closeForm() {
          form.classList.remove("visible");
          editingIndex = -1;
        }

        /* ── Save Form ── */
        function saveFormMetric() {
          var key = mfKey.value.trim();
          var name = mfName.value.trim();
          var def = mfDef.value.trim();
          if (!key || !name || !def) {
            metricsStatus.textContent = "Metric key, display name, and definition are required.";
            return;
          }

          var entry = {
            metric_key: key,
            display_name: name,
            definition: def
          };
          if (editingIndex >= 0) {
            metrics[editingIndex] = entry;
          } else {
            metrics.push(entry);
          }
          renderMetrics();
          closeForm();
          metricsStatus.textContent = "Metric added locally. Click \\"Save Metric Definitions\\" to persist.";
        }

        addBtn.addEventListener("click", openAddForm);
        mfSave.addEventListener("click", saveFormMetric);
        mfCancel.addEventListener("click", closeForm);

        async function loadMetrics() {
          try {
            var res = await fetch("/api/config/user-settings");
            var data = await res.json();
            if (res.ok && Array.isArray(data.metric_definitions)) {
              metrics = data.metric_definitions;
              renderMetrics();
              metricsStatus.textContent = metrics.length > 0 ? metrics.length + " metric(s) loaded." : "";
            }
          } catch {
            metricsStatus.textContent = "Failed to load metric definitions.";
          }
        }

        async function saveMetrics() {
          metricsStatus.textContent = "Saving...";
          try {
            var res = await fetch("/api/config/user-settings", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                metric_definitions: metrics,
                business_context: String(ctxTextarea.value || "")
              })
            });
            var data = await res.json();
            metricsStatus.textContent = res.ok ? "Saved " + metrics.length + " metric definition(s)." : (data.message || "Failed to save.");
          } catch {
            metricsStatus.textContent = "Failed to save metric definitions.";
          }
        }

        saveMetricsBtn.addEventListener("click", () => saveMetrics());

        /* ── Init ── */
        loadBusinessContext();
        loadCatalog().then(function() { loadMetrics(); });
      })();
    </script>
  </body>
</html>`;
}
