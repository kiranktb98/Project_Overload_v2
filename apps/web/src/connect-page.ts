import { renderClaritectFaviconLinks, renderClaritectLogoImage } from "./brand";

export function renderConnectionPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect | Data source setup</title>
    ${renderClaritectFaviconLinks()}
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");

      :root {
        --ink: #F5F3FF;
        --ink-soft: #D7CFE6;
        --ink-muted: #9D90BC;
        --line: rgba(107, 92, 138, 0.28);
        --line-soft: rgba(236, 72, 153, 0.24);
        --surface: rgba(20, 15, 34, 0.94);
        --surface-strong: rgba(31, 21, 49, 0.98);
        --primary: #6C3AED;
        --primary-2: #EC4899;
        --primary-3: #EC4899;
        --warn: #f59f0b;
        --danger: #ef4444;
        --ok: #22c55e;
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

      .workspace {
        padding: 0;
        overflow-y: auto;
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

      .card {
        border: 1px solid var(--line);
        border-radius: 22px;
        background:
          linear-gradient(180deg, rgba(8, 21, 54, 0.96), rgba(7, 18, 43, 0.94)),
          radial-gradient(circle at 100% 0%, rgba(102, 167, 255, 0.08), transparent 24%);
        box-shadow: var(--shadow);
        padding: 18px;
        margin-bottom: 14px;
      }

      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
      }

      .eyebrow {
        display: inline-block;
        margin-bottom: 8px;
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: var(--primary-3);
      }

      .top-copy {
        max-width: 760px;
      }

      .top-sub {
        margin: 10px 0 0;
        color: var(--ink-soft);
        font-size: 0.88rem;
        line-height: 1.55;
      }

      .top-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }

      .top-pill {
        border: 1px solid rgba(131, 170, 241, 0.18);
        border-radius: 999px;
        padding: 7px 11px;
        font-size: 0.68rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #d3e7ff;
        background: rgba(14, 29, 71, 0.78);
      }

      .step-track {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 12px;
      }

      .step-track.panel-hidden {
        display: none;
      }

      .step-pill {
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 16px;
        padding: 11px 12px;
        background: rgba(8, 23, 58, 0.74);
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
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
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
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
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

      .mode-status {
        margin-top: 12px;
        color: var(--ink-soft);
        font-size: 0.75rem;
      }

      .mode-btn {
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 16px;
        padding: 14px;
        text-align: left;
        background: rgba(24, 18, 39, 0.78);
        color: #c8d9ff;
        cursor: pointer;
        box-shadow: var(--shadow-soft);
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
        border-color: rgba(245, 243, 255, 0.22);
        background: rgba(108, 58, 237, 0.92);
        color: #ffffff;
      }

      .mode-btn.active small {
        color: rgba(235, 244, 255, 0.92);
      }

      .flow-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px 16px;
      }

      .flow-toolbar-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .flow-kicker {
        display: inline-block;
        margin-bottom: 4px;
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--primary-3);
      }

      .flow-title {
        display: block;
        font-size: 0.94rem;
        color: #f3f8ff;
      }

      .flow-sub {
        color: var(--ink-soft);
        font-size: 0.74rem;
      }

      .source-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 14px;
      }

      .source-option {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 18px;
        padding: 18px;
        text-align: left;
        background: rgba(24, 18, 39, 0.88);
        color: #d7e5ff;
        box-shadow: var(--shadow-soft);
      }

      .source-option::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(circle at 0% 0%, rgba(122, 179, 255, 0.12), transparent 30%);
      }

      .source-option.selected {
        border-color: rgba(245, 243, 255, 0.22);
        background: rgba(108, 58, 237, 0.92);
        color: #ffffff;
      }

      .source-option strong {
        display: block;
        margin: 8px 0 6px;
        font-size: 0.95rem;
      }

      .source-option span {
        display: block;
        color: var(--ink-soft);
        font-size: 0.78rem;
        line-height: 1.55;
      }

      .source-option.selected span {
        color: rgba(240, 246, 255, 0.96);
      }

      .source-option-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .source-option-badge {
        border-radius: 999px;
        border: 1px solid rgba(107, 92, 138, 0.28);
        background: rgba(31, 21, 49, 0.78);
        padding: 6px 10px;
        font-size: 0.64rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #F5F3FF;
      }

      .source-option.selected .source-option-badge {
        background: rgba(255, 255, 255, 0.14);
        border-color: rgba(255, 255, 255, 0.18);
      }

      .source-details-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 12px;
      }

      .source-details-card {
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 18px;
        padding: 14px 16px;
        background: rgba(31, 21, 49, 0.76);
        margin-bottom: 10px;
      }

      .source-provider-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        border: 1px solid rgba(107, 92, 138, 0.28);
        background: rgba(31, 21, 49, 0.82);
        padding: 8px 12px;
        color: #F5F3FF;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .source-provider-label strong {
        font-size: 0.8rem;
        letter-spacing: 0;
        text-transform: none;
      }

      .source-provider-note {
        margin: 10px 0 0;
        color: var(--ink-soft);
        font-size: 0.78rem;
        line-height: 1.55;
      }

      .setup-mode-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 6px 0 10px;
        padding: 6px;
        border-radius: 16px;
        border: 1px solid rgba(107, 92, 138, 0.22);
        background: rgba(24, 18, 39, 0.74);
      }

      .setup-mode-toggle .secondary {
        min-width: 170px;
      }

      .setup-mode-toggle .secondary.active {
        border-color: rgba(245, 243, 255, 0.22);
        background: rgba(108, 58, 237, 0.92);
        color: #ffffff;
      }

      .builder-note {
        margin: 0 0 12px;
        color: var(--ink-soft);
        font-size: 0.75rem;
        line-height: 1.55;
      }

      .tls-guidance-kicker {
        margin: 0 0 6px;
        color: #d8e5ff;
        font-size: 0.77rem;
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      .tls-guidance-copy {
        margin: 0 0 10px;
        color: var(--ink-soft);
        font-size: 0.74rem;
        line-height: 1.55;
      }

      .guided-section-head {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 12px;
      }

      .guided-section-head strong {
        color: #f3f8ff;
        font-size: 0.9rem;
      }

      .guided-section-head span {
        color: var(--ink-soft);
        font-size: 0.74rem;
        line-height: 1.55;
      }

      .guided-fields {
        margin-bottom: 8px;
      }

      .builder-tip,
      .builder-hint-card {
        border: 1px solid rgba(107, 92, 138, 0.24);
        border-radius: 16px;
        background: rgba(24, 18, 39, 0.76);
        color: var(--ink-soft);
      }

      .builder-tip {
        padding: 12px 14px;
        font-size: 0.74rem;
        line-height: 1.55;
        margin-bottom: 10px;
      }

      .builder-hint-card {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        justify-content: center;
      }

      .builder-hint-card strong {
        color: #f3f8ff;
        font-size: 0.74rem;
      }

      .builder-hint-card span {
        font-size: 0.72rem;
        line-height: 1.5;
      }

      .wizard-count {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        border-radius: 999px;
        border: 1px solid rgba(107, 92, 138, 0.24);
        background: rgba(31, 21, 49, 0.76);
        padding: 8px 12px;
        color: #F5F3FF;
        font-size: 0.72rem;
      }

      .table-shell {
        border: 1px solid #2a4b91;
        border-radius: 16px;
        overflow: hidden;
        background: rgba(9, 25, 61, 0.92);
      }

      .connections-table {
        width: 100%;
        border-collapse: collapse;
      }

      .connections-table th,
      .connections-table td {
        padding: 12px 14px;
        text-align: left;
        font-size: 0.76rem;
        border-bottom: 1px solid rgba(107, 92, 138, 0.18);
      }

      .connections-table th {
        color: var(--ink-soft);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-size: 0.64rem;
      }

      .connections-table tbody tr {
        cursor: pointer;
      }

      .connections-table tbody tr:hover,
      .connections-table tbody tr.active {
        background: rgba(39, 71, 140, 0.28);
      }

      .connections-table-empty {
        color: var(--ink-soft);
      }

      .detail-title {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .detail-meta {
        margin-top: 6px;
        color: var(--ink-soft);
        font-size: 0.74rem;
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
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
      }

      input,
      textarea,
      select {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgba(126, 160, 227, 0.16);
        padding: 11px 12px;
        background: rgba(24, 18, 39, 0.92);
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

      .row.panel-hidden {
        display: none;
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
        border-radius: 14px;
        padding: 10px 14px;
        cursor: pointer;
        font-size: 0.76rem;
        border: 1px solid transparent;
        color: #F5F3FF;
        transition: transform 130ms ease, box-shadow 130ms ease, filter 130ms ease;
      }

      button:hover {
        transform: translateY(-1px);
        filter: saturate(1.03);
      }

      .primary {
        border: 1px solid rgba(143, 160, 255, 0.48);
        background: var(--primary);
        color: #ffffff;
        box-shadow: 0 14px 30px rgba(68, 95, 211, 0.3);
      }

      .secondary {
        background: rgba(10, 28, 68, 0.96);
        color: #F5F3FF;
        border: 1px solid rgba(108, 58, 237, 0.34);
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
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.72rem;
        color: #F5F3FF;
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
        border: 1px solid rgba(108, 58, 237, 0.34);
        border-radius: 12px;
        padding: 10px;
        max-height: 360px;
        overflow: auto;
        background: linear-gradient(165deg, #0d214f 0%, #123266 70%, #163f77 100%);
        color: #dceafe;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
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

      .catalog-modal-card {
        width: min(780px, 100%);
        overflow: hidden;
      }

      .catalog-hero {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 20px;
        padding: 22px;
        background:
          linear-gradient(180deg, rgba(20, 15, 34, 0.98), rgba(17, 12, 28, 0.98)),
          radial-gradient(circle at 100% 0%, rgba(108, 58, 237, 0.16), transparent 26%);
      }

      .catalog-hero::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(circle at 0% 0%, rgba(116, 183, 255, 0.16), transparent 28%);
      }

      .catalog-copy,
      .catalog-stats,
      .catalog-actions,
      .catalog-footnote {
        position: relative;
        z-index: 1;
      }

      .catalog-copy h2 {
        margin: 0;
        font-size: 1.04rem;
        color: #f3f8ff;
      }

      .catalog-copy p {
        margin: 10px 0 0;
        color: var(--ink-soft);
        font-size: 0.84rem;
        line-height: 1.65;
      }

      .catalog-spinner {
        width: 54px;
        height: 54px;
        border-radius: 999px;
        border: 2px solid rgba(128, 144, 255, 0.18);
        border-top-color: #EC4899;
        border-right-color: #EC4899;
        animation: spin 1.1s linear infinite;
        box-shadow: 0 0 34px rgba(102, 167, 255, 0.16);
      }

      .catalog-hero-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .catalog-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 18px;
      }

      .catalog-stat {
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 16px;
        padding: 14px;
        background: rgba(31, 21, 49, 0.78);
      }

      .catalog-stat small {
        display: block;
        margin-bottom: 8px;
        font-size: 0.62rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }

      .catalog-stat strong {
        display: block;
        font-size: 1.14rem;
        color: #f3f8ff;
      }

      .catalog-stat span {
        display: block;
        margin-top: 6px;
        color: var(--ink-soft);
        font-size: 0.74rem;
      }

      .catalog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 18px;
      }

      .catalog-footnote {
        margin-top: 14px;
        color: var(--ink-soft);
        font-size: 0.74rem;
        line-height: 1.55;
      }

      .hidden-select {
        display: none;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
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
        .page { padding: 0; }
        .layout { grid-template-columns: 1fr; }
        .platform-panel { display: none; }
        .workspace { padding: 12px; }
        .step-track { grid-template-columns: 1fr; }
        .source-grid,
        .catalog-stats {
          grid-template-columns: 1fr;
        }
        .flow-toolbar,
        .source-details-head,
        .detail-title,
        .catalog-hero-head {
          flex-direction: column;
          align-items: flex-start;
        }

        .kvs {
          grid-template-columns: 1fr;
        }

        .row {
          grid-template-columns: 1fr;
        }

        .connections-table {
          min-width: 720px;
        }
      }

      .ssl-cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 10px;
      }
      .ssl-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        border: 1px solid rgba(107, 92, 138, 0.24);
        border-radius: 14px;
        padding: 12px 13px;
        cursor: pointer;
        background: rgba(24, 18, 39, 0.78);
        transition: border-color 150ms ease, background 150ms ease;
        user-select: none;
      }
      .ssl-card:hover { border-color: rgba(107, 92, 138, 0.44); background: rgba(34, 25, 56, 0.88); }
      .ssl-card-active { border-color: rgba(108, 58, 237, 0.6); background: rgba(108, 58, 237, 0.14); }
      .ssl-card-warn.ssl-card-active { border-color: rgba(245, 159, 11, 0.48); background: rgba(245, 159, 11, 0.12); }
      .ssl-card-label { display: block; font-size: 0.82rem; font-weight: 700; color: #F5F3FF; margin-bottom: 2px; }
      .ssl-card-desc { display: block; font-size: 0.71rem; color: var(--ink-soft); line-height: 1.48; }
      .ca-toggle {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        cursor: pointer;
        font-size: 0.78rem;
        color: var(--ink-soft);
        padding: 10px 12px;
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 14px;
        background: rgba(24, 18, 39, 0.76);
        user-select: none;
      }
      .ca-toggle input[type="checkbox"] {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
        margin-top: 2px;
        cursor: pointer;
        accent-color: #6C3AED;
      }

      [data-theme="light"] {
        --ink: #1A1533;
        --ink-soft: #3D2E6B;
        --ink-muted: #6B5B9E;
        --line: rgba(107, 92, 138, 0.22);
        --surface: rgba(248, 246, 255, 0.96);
        --surface-strong: rgba(244, 241, 255, 0.98);
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
      [data-theme="light"] .card {
        background: linear-gradient(180deg, rgba(248, 246, 255, 0.98), rgba(244, 241, 255, 0.96));
        border-color: rgba(107, 92, 138, 0.18);
        color: #1A1533;
      }
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
      [data-theme="light"] .mode-btn {
        background: rgba(244, 241, 255, 0.82);
        color: #1A1533;
        border-color: rgba(107, 92, 138, 0.22);
      }
      [data-theme="light"] .mode-btn strong { color: #1A1533; }
      [data-theme="light"] .mode-btn small { color: #3D2E6B; }
      [data-theme="light"] .ssl-card { background: rgba(244, 241, 255, 0.78); border-color: rgba(107, 92, 138, 0.22); }
      [data-theme="light"] .ssl-card:hover { background: rgba(237, 232, 255, 0.88); }
      [data-theme="light"] .ssl-card-active { background: rgba(108, 58, 237, 0.10); border-color: rgba(108, 58, 237, 0.5); }
      [data-theme="light"] .ssl-card-label { color: #1A1533; }
      [data-theme="light"] .ca-toggle { background: rgba(244, 241, 255, 0.78); border-color: rgba(107, 92, 138, 0.18); color: #2D1F56; }
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
            <a class="platform-link active" href="/connect"><span class="link-icon"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></span>Data Sources</a>
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
        <main class="workspace">
          <section class="card" id="mode-panel">
            <h2 style="margin-top: 0;">Data Sources</h2>
            <div class="mode-grid">
              <button class="mode-btn" id="mode-edit" type="button">
                <strong>Edit connected databases</strong>
                <small>Open the connected-source table, inspect table and column coverage, update allowlists, or disconnect safely.</small>
              </button>
              <button class="mode-btn" id="mode-connect" type="button">
                <strong>Connect new database</strong>
                <small>Run a guided Source -> Governance -> Activate flow with connection testing and catalog indexing.</small>
              </button>
            </div>
            <div class="mode-status" id="connection-status">No active runtime connection.</div>
          </section>

          <section class="card flow-toolbar panel-hidden" id="flow-toolbar">
            <div class="flow-toolbar-left">
              <button class="secondary" id="flow-back" type="button">Go back</button>
              <div>
                <span class="flow-kicker" id="flow-kicker">Source</span>
                <strong class="flow-title" id="flow-title">Choose your source type</strong>
                <div class="flow-sub" id="flow-sub">Start by picking the database family you want to connect.</div>
              </div>
            </div>
            <div class="status" id="flow-status"></div>
          </section>

          <section class="step-track panel-hidden" id="step-track">
            <div class="step-pill active" id="step-pill-source"><span class="num">1</span><span>Source</span></div>
            <div class="step-pill" id="step-pill-governance"><span class="num">2</span><span>Governance</span></div>
            <div class="step-pill" id="step-pill-activate"><span class="num">3</span><span>Activate</span></div>
          </section>

          <section class="card panel-hidden" id="source-kind-panel">
            <h2 style="margin-top: 0;">Step A1 - Choose a database type</h2>
            <p class="muted">Pick the source family first. The next page will handle connection testing and source setup for that connector.</p>
            <p class="muted" style="margin-top: -2px;">
              Need examples and setup notes first?
              <a href="/connect/guide" target="_blank" rel="noreferrer">Open the database connection guide</a>
              &nbsp;·&nbsp;
              <a href="/connect/tls-guide" target="_blank" rel="noreferrer">SSL / TLS guide</a>.
            </p>
            <div class="source-grid" id="source-grid">
              <button class="source-option" data-provider="postgres" type="button">
                <strong>Postgres</strong>
                <span>Best for Postgres, Neon, and similar read replicas using a standard connection string.</span>
              </button>
              <button class="source-option" data-provider="mysql" type="button">
                <strong>MySQL</strong>
                <span>Use a MySQL-compatible connection string and follow the same governed onboarding flow.</span>
              </button>
              <button class="source-option" data-provider="snowflake" type="button">
                <strong>Snowflake</strong>
                <span>Use a Snowflake connection string with database, schema, and warehouse so we can validate governed access cleanly.</span>
              </button>
              <button class="source-option" data-provider="bigquery" type="button">
                <strong>BigQuery</strong>
                <span>Use a BigQuery project and dataset connection string so we can validate the dataset, catalog it, and activate safe queries.</span>
              </button>
              <button class="source-option" data-provider="powerbi_semantic" type="button">
                <strong>Power BI semantic</strong>
                <span>Connect a Power BI semantic model when your business logic depends on curated measures and dimensions instead of raw SQL tables.</span>
              </button>
            </div>
            <div class="actions" style="margin-top: 16px;">
              <button class="primary" id="source-kind-continue" type="button">Continue to connection details</button>
            </div>
          </section>

          <section class="card panel-hidden" id="source-details-panel">
            <div class="source-details-head">
              <div>
                <h2 style="margin-top: 0;" id="source-details-title">Step A2 - Set up your Postgres connection</h2>
                <p class="muted" id="source-details-sub">Fill in the Postgres connection details, validate access, and connect the source before you govern the allowlist.</p>
              </div>
              <button class="secondary" id="change-provider" type="button">Change source type</button>
            </div>

            <div class="source-details-card">
              <div class="source-provider-label">Selected source <strong id="selected-provider-name">Postgres</strong></div>
              <p class="source-provider-note" id="selected-provider-note">Use a Postgres-compatible connection string for a governed read-only connection.</p>
            </div>

            <div class="setup-mode-toggle" id="setup-mode-toggle">
              <button class="secondary active" id="setup-mode-guided" type="button">Guided setup</button>
              <button class="secondary" id="setup-mode-manual" type="button">Paste connection string</button>
            </div>
            <p class="builder-note" id="setup-mode-note">Guided setup builds the connection string for you, URL-encodes credentials safely, and lets you choose SSL behavior without editing the URI by hand.</p>

            <div class="hidden-select">
              <label for="connection-provider">Data Source</label>
              <select id="connection-provider">
                <option value="postgres">Postgres</option>
                <option value="mysql">MySQL</option>
                <option value="snowflake">Snowflake</option>
                <option value="bigquery">BigQuery</option>
                <option value="powerbi_semantic">Power BI semantic</option>
              </select>
            </div>

            <div class="row">
              <div>
                <label for="connection-name">Connection Name</label>
                <input id="connection-name" placeholder="Prod Analytics Replica" />
              </div>
              <div>
                <label for="query-limit">Safe Query Limit</label>
                <input id="query-limit" type="number" min="1" max="2000" value="200" />
              </div>
            </div>

            <section class="guided-fields" id="guided-connection-fields">
              <div class="guided-section-head">
                <strong id="guided-form-title">Postgres connection details</strong>
                <span id="guided-form-subtitle">Use the values from your Postgres, Supabase, or Neon connection screen. We will build the URI for you.</span>
              </div>
              <div class="builder-tip" id="guided-builder-tip">Use plain credentials here. We will URL-encode usernames and passwords for you before sending the connection to the API.</div>
              <p class="muted" id="guided-provider-quickstart" style="margin-top: 0;">For Supabase or any managed Postgres, copy Host, Port, Database, Username, and Password from the provider's connection details. You do not need a warehouse.</p>
              <p class="muted" id="guided-tls-quickstart" style="margin-top: -2px;">For cloud databases like Supabase, leave Custom CA empty and keep SSL mode on Automatic or Require TLS. Use Disable TLS only for localhost or private dev databases that do not support SSL.</p>

              <div class="row" id="guided-auth-row">
                <div id="guided-username-wrap">
                  <label id="guided-username-label" for="guided-username">Username</label>
                  <input id="guided-username" autocomplete="username" placeholder="reader" />
                </div>
                <div id="guided-password-wrap">
                  <label id="guided-password-label" for="guided-password">Password</label>
                  <input id="guided-password" type="password" autocomplete="current-password" placeholder="••••••••" />
                </div>
              </div>

              <div class="row">
                <div>
                  <label id="guided-host-label" for="guided-host">Host</label>
                  <input id="guided-host" placeholder="db.company.com" />
                </div>
                <div id="guided-port-wrap">
                  <label id="guided-port-label" for="guided-port">Port</label>
                  <input id="guided-port" inputmode="numeric" placeholder="5432" />
                </div>
              </div>

              <div class="row">
                <div>
                  <label id="guided-db-label" for="guided-db">Database</label>
                  <input id="guided-db" placeholder="analytics" />
                </div>
                <div id="guided-schema-wrap" class="panel-hidden">
                  <label id="guided-schema-label" for="guided-schema">Schema</label>
                  <input id="guided-schema" placeholder="public" />
                </div>
              </div>

              <div class="row panel-hidden" id="guided-snowflake-row">
                <div>
                  <label id="guided-warehouse-label" for="guided-warehouse">Warehouse</label>
                  <input id="guided-warehouse" placeholder="COMPUTE_WH" />
                </div>
              </div>

              <div id="guided-ssl-row">
                <label style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px;">
                  Connection security
                  <a href="/connect/tls-guide" target="_blank" rel="noreferrer" style="font-size: 0.75rem; font-weight: 400;">What do these mean?</a>
                </label>
                <div class="ssl-cards">
                  <label class="ssl-card ssl-card-active" data-ssl="automatic">
                    <input type="radio" name="ssl_mode_pick" value="automatic" checked hidden />
                    <span class="ssl-card-label">Auto</span>
                    <span class="ssl-card-desc">Try TLS first — works for Supabase, Neon, RDS, and most cloud databases</span>
                  </label>
                  <label class="ssl-card" data-ssl="require">
                    <input type="radio" name="ssl_mode_pick" value="require" hidden />
                    <span class="ssl-card-label">Require</span>
                    <span class="ssl-card-desc">Strictly require TLS — reject connection if the server does not support it</span>
                  </label>
                  <label class="ssl-card ssl-card-warn" data-ssl="disable">
                    <input type="radio" name="ssl_mode_pick" value="disable" hidden />
                    <span class="ssl-card-label">Off</span>
                    <span class="ssl-card-desc">Local or private dev databases only — not for production</span>
                  </label>
                </div>
                <input type="hidden" id="guided-ssl-mode" value="automatic" />
              </div>
            </section>

            <div id="manual-connection-fields" class="panel-hidden" style="margin-top: 10px;">
              <label for="connection-string">Connection String</label>
              <input id="connection-string" type="password" placeholder="postgresql://reader:password@db.example.com:5432/analytics?sslmode=require" />
              <p class="muted" id="connection-string-help">Credentials never run in the browser. This string is sent to the server, stored encrypted, and used for governed SELECT-only execution.</p>
            </div>

            <div class="panel-hidden" style="margin-top: 12px;" id="advanced-tls-section">
              <label class="ca-toggle" for="ca-cert-toggle">
                <input type="checkbox" id="ca-cert-toggle" />
                <span>
                  <strong id="advanced-tls-title">My database needs a custom CA certificate</strong>
                  <span id="advanced-tls-optional" style="font-weight: 400; color: var(--ink-muted); font-size: 0.72rem;"> — optional, most cloud databases don't need this</span>
                </span>
              </label>
              <div class="panel-hidden" id="ca-cert-fields" style="margin-top: 10px;">
                <p class="tls-guidance-copy">Only needed if your database team gave you a custom root CA, or your corporate network intercepts TLS. Leave empty for Supabase, Neon, RDS, PlanetScale, and most cloud databases.</p>
                <label for="tls-ca-pem">CA Certificate (PEM)</label>
                <textarea id="tls-ca-pem" placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"></textarea>
                <p class="muted" id="advanced-tls-help">Paste your org or database root CA certificate here. <a href="/connect/tls-guide" target="_blank" rel="noreferrer">See the full SSL / TLS guide</a>.</p>
              </div>
            </div>

            <div class="actions">
              <button class="secondary" id="test-connection" type="button">Test Postgres connection</button>
              <button class="primary" id="connect-source" type="button">Connect Postgres source</button>
            </div>

            <div class="kvs" id="test-metadata" style="display:none;">
              <div class="kv"><span class="k">current_user</span><span class="v" id="meta-user"></span></div>
              <div class="kv"><span class="k">current_database</span><span class="v" id="meta-db"></span></div>
              <div class="kv" style="grid-column: 1 / -1;"><span class="k">version</span><span class="v" id="meta-version"></span></div>
            </div>

            <div id="test-notes"></div>
          </section>

          <section class="card panel-hidden" id="governance-panel">
            <h2 style="margin-top: 0;">Step B - Governance</h2>
            <p class="muted">Choose which tables belong on the allowlist. Saving the allowlist will validate access, catalogue the source, and stage activation.</p>
            <div class="wizard-count" id="allowlist-count">0 tables selected for governance</div>
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
              <button class="secondary" id="select-recommended" type="button">Select recommended</button>
              <button class="secondary" id="select-ok" type="button">Select all OK</button>
              <button class="secondary" id="select-none" type="button">Select none</button>
              <button class="primary" id="save-allowlist" type="button">Save allowlist</button>
              <button class="danger" id="open-fix-script" type="button">Fix-it script</button>
            </div>
            <div class="table-list" id="table-list"></div>
            <div class="governance-summary panel-hidden" id="governance-summary"></div>
            <div id="validation-container"></div>
          </section>

          <section class="card panel-hidden" id="activate-panel">
            <h2 style="margin-top: 0;">Step C - Activate</h2>
            <p class="muted"><strong>Read-only enforced</strong> and <strong>SELECT-only enforced</strong>. Run a safe query, inspect the result, and then submit the connection for chat and report usage.</p>
            <label for="safe-sql">SQL</label>
            <textarea id="safe-sql" placeholder="A safe query will be suggested once the governed allowlist is ready."></textarea>
            <div class="actions">
              <button class="primary" id="run-query" type="button">Run safe query</button>
              <button class="secondary" id="refresh-logs" type="button">Refresh audit logs</button>
              <button class="primary" id="submit-connection" type="button">Submit connection</button>
            </div>
            <div class="output" id="query-output"></div>
          </section>

          <section class="card panel-hidden" id="edit-list-panel">
            <div class="detail-title">
              <div>
                <h2 style="margin-top: 0;">Connected Databases</h2>
                <p class="muted">Review the active governed source, including how many tables and catalogued columns are currently available.</p>
              </div>
            </div>
            <div class="table-shell">
              <table class="connections-table">
                <thead>
                  <tr>
                    <th>Database</th>
                    <th>Provider</th>
                    <th>Allowlist</th>
                    <th>Catalog</th>
                    <th>Connected</th>
                  </tr>
                </thead>
                <tbody id="connections-table-body">
                  <tr><td class="connections-table-empty" colspan="5">No connected databases yet.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="card panel-hidden" id="edit-panel">
            <div class="detail-title">
              <div>
                <h2 style="margin-top: 0;">Connection Details</h2>
                <div class="detail-meta" id="edit-selected-meta">Choose a connected source above to review its details.</div>
              </div>
            </div>
            <div id="edit-empty" class="callout"><strong>No source selected.</strong> Pick a connected database from the table above to edit its allowlist or disconnect it.</div>
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
                <button class="secondary" id="edit-select-all" type="button">Select all visible</button>
                <button class="secondary" id="edit-select-none" type="button">Select none</button>
                <button class="primary" id="edit-save-allowlist" type="button">Save allowlist changes</button>
                <button class="warn" id="edit-disconnect" type="button">Disconnect source</button>
              </div>
              <div class="table-list" id="edit-table-list"></div>
              <div id="edit-validation-container"></div>
            </div>
          </section>
        </main>
      </div>
    </div>

    <div class="modal" id="catalog-modal" aria-hidden="true">
      <div class="modal-card catalog-modal-card">
        <div class="catalog-hero">
          <div class="catalog-hero-head">
            <div class="catalog-copy">
              <h2 id="catalog-modal-title">Cataloging your governed source</h2>
              <p id="catalog-modal-message">We are validating the allowlist, indexing the selected tables, and preparing the source for activation.</p>
            </div>
            <div class="catalog-spinner" id="catalog-spinner"></div>
          </div>
          <div class="catalog-stats">
            <div class="catalog-stat">
              <small>Allowlist</small>
              <strong id="catalog-stat-allowlist">0</strong>
              <span>tables selected for governance</span>
            </div>
            <div class="catalog-stat">
              <small>Catalogued Tables</small>
              <strong id="catalog-stat-tables">0</strong>
              <span>tables indexed and ready</span>
            </div>
            <div class="catalog-stat">
              <small>Catalogued Columns</small>
              <strong id="catalog-stat-columns">0</strong>
              <span>columns profiled for the source</span>
            </div>
          </div>
          <div class="catalog-footnote" id="catalog-footnote">This step prepares the governed catalog used by the planner, analyst, and reports.</div>
          <div class="catalog-actions">
            <button class="secondary panel-hidden" id="catalog-close" type="button">Close</button>
            <button class="primary panel-hidden" id="catalog-continue" type="button">Continue to activate</button>
          </div>
        </div>
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
        const elements = {
          modePanel: document.getElementById("mode-panel"),
          status: document.getElementById("connection-status"),
          modeEditBtn: document.getElementById("mode-edit"),
          modeConnectBtn: document.getElementById("mode-connect"),
          flowToolbar: document.getElementById("flow-toolbar"),
          flowBackBtn: document.getElementById("flow-back"),
          flowKicker: document.getElementById("flow-kicker"),
          flowTitle: document.getElementById("flow-title"),
          flowSub: document.getElementById("flow-sub"),
          flowStatus: document.getElementById("flow-status"),
          stepTrack: document.getElementById("step-track"),
          sourceKindPanel: document.getElementById("source-kind-panel"),
          sourceKindContinueBtn: document.getElementById("source-kind-continue"),
          sourceOptions: Array.from(document.querySelectorAll("[data-provider]")),
          sourceDetailsPanel: document.getElementById("source-details-panel"),
          selectedProviderName: document.getElementById("selected-provider-name"),
          selectedProviderNote: document.getElementById("selected-provider-note"),
          sourceDetailsTitle: document.getElementById("source-details-title"),
          sourceDetailsSub: document.getElementById("source-details-sub"),
          setupModeGuidedBtn: document.getElementById("setup-mode-guided"),
          setupModeManualBtn: document.getElementById("setup-mode-manual"),
          setupModeNote: document.getElementById("setup-mode-note"),
          guidedFields: document.getElementById("guided-connection-fields"),
          manualConnectionFields: document.getElementById("manual-connection-fields"),
          guidedFormTitle: document.getElementById("guided-form-title"),
          guidedFormSubtitle: document.getElementById("guided-form-subtitle"),
          guidedBuilderTip: document.getElementById("guided-builder-tip"),
          guidedProviderQuickstart: document.getElementById("guided-provider-quickstart"),
          guidedTlsQuickstart: document.getElementById("guided-tls-quickstart"),
          guidedAuthRow: document.getElementById("guided-auth-row"),
          guidedUsername: document.getElementById("guided-username"),
          guidedPassword: document.getElementById("guided-password"),
          guidedHostLabel: document.getElementById("guided-host-label"),
          guidedHost: document.getElementById("guided-host"),
          guidedPortWrap: document.getElementById("guided-port-wrap"),
          guidedPort: document.getElementById("guided-port"),
          guidedDbLabel: document.getElementById("guided-db-label"),
          guidedDb: document.getElementById("guided-db"),
          guidedSchemaWrap: document.getElementById("guided-schema-wrap"),
          guidedSchema: document.getElementById("guided-schema"),
          guidedSnowflakeRow: document.getElementById("guided-snowflake-row"),
          guidedWarehouse: document.getElementById("guided-warehouse"),
          guidedSslRow: document.getElementById("guided-ssl-row"),
          guidedSslMode: document.getElementById("guided-ssl-mode"),
          advancedTlsSection: document.getElementById("advanced-tls-section"),
          advancedTlsTitle: document.getElementById("advanced-tls-title"),
          advancedTlsOptional: document.getElementById("advanced-tls-optional"),
          advancedTlsHelp: document.getElementById("advanced-tls-help"),
          changeProviderBtn: document.getElementById("change-provider"),
          editPanel: document.getElementById("edit-panel"),
          editListPanel: document.getElementById("edit-list-panel"),
          governancePanel: document.getElementById("governance-panel"),
          activatePanel: document.getElementById("activate-panel"),
          stepSource: document.getElementById("step-pill-source"),
          stepGovernance: document.getElementById("step-pill-governance"),
          stepActivate: document.getElementById("step-pill-activate"),
          connectionsTableBody: document.getElementById("connections-table-body"),
          editSelectedMeta: document.getElementById("edit-selected-meta"),
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
          allowlistCount: document.getElementById("allowlist-count"),
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
          catalogModal: document.getElementById("catalog-modal"),
          catalogModalTitle: document.getElementById("catalog-modal-title"),
          catalogModalMessage: document.getElementById("catalog-modal-message"),
          catalogSpinner: document.getElementById("catalog-spinner"),
          catalogStatAllowlist: document.getElementById("catalog-stat-allowlist"),
          catalogStatTables: document.getElementById("catalog-stat-tables"),
          catalogStatColumns: document.getElementById("catalog-stat-columns"),
          catalogFootnote: document.getElementById("catalog-footnote"),
          catalogCloseBtn: document.getElementById("catalog-close"),
          catalogContinueBtn: document.getElementById("catalog-continue"),
          errorModal: document.getElementById("error-modal"),
          errorTitle: document.getElementById("error-title"),
          errorMessage: document.getElementById("error-message"),
          closeErrorModalBtn: document.getElementById("close-error-modal")
        };

        const PROVIDER_CONFIG = {
          postgres: {
            label: "Postgres",
            note: "Use a Postgres-compatible connection string. This is also the best fit for Neon and similar read replicas.",
            placeholder: "postgresql://reader:password@db.example.com:5432/analytics?sslmode=require",
            help: "Credentials never run in the browser. This string is sent to the server, stored encrypted, and used for governed SELECT-only execution."
          },
          mysql: {
            label: "MySQL",
            note: "Use a MySQL-compatible connection string. The flow stays the same: test, govern, catalogue, then activate.",
            placeholder: "mysql://reader:password@db.example.com:3306/analytics?sslmode=require",
            help: "Use a MySQL-compatible connection string. The runtime will validate access before governance."
          },
          snowflake: {
            label: "Snowflake",
            note: "Use a Snowflake connection string with account, database, schema, and warehouse so we can test access and catalog the governed tables.",
            placeholder: "snowflake://reader:password@orgname-accountname/ANALYTICS_DB/PUBLIC?warehouse=COMPUTE_WH",
            help: "We will validate access first, then move into allowlist governance and safe-query activation."
          },
          bigquery: {
            label: "BigQuery",
            note: "Use a BigQuery project and dataset connection string so we can validate the dataset, catalogue it, and activate safe queries.",
            placeholder: "bigquery://my-project-123/analytics",
            help: "We will validate the dataset first, then move into allowlist governance and safe-query activation."
          },
          powerbi_semantic: {
            label: "Power BI semantic",
            note: "Use a Power BI semantic-model connection string when the governed source should follow measures, dimensions, and semantic relationships instead of raw SQL tables.",
            placeholder: "powerbi+semantic://workspace-id/model-id?workspace_name=Finance%20Workspace&model_name=Executive%20P%26L&entities=Sales,Customers&measures=Revenue,Margin&dimensions=Region,Month",
            help: "Power BI semantic connections are manual-only. They route into a separate backend planner/executor path and disable direct SQL safe-query access."
          }
        };

        const state = {
          mode: "chooser",
          connectStep: "source-kind",
          connectionEntryMode: "guided",
          selectedProvider: "postgres",
          selectedConnectionId: null,
          safeSqlTemplate: "",
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
          state.connectionEntryMode = "guided";
          state.connectStep = "source-kind";
          state.testResult = null;
          state.lastValidation = null;
          state.lastCatalog = null;
          state.safeSqlTemplate = "";
          elements.governanceSummary.classList.add("panel-hidden");
          elements.validationContainer.innerHTML = "";
          elements.metaBlock.style.display = "none";
          elements.testNotes.innerHTML = "";
          elements.flowStatus.textContent = "";
          elements.connectionString.value = "";
          elements.sql.value = "";
          state.selected = new Set();
          state.relations = [];
          renderSchemaFilter(elements.schemaFilter);
          renderSchemaFilter(elements.editSchemaFilter);
          renderAllRelationLists();
          updateAllowlistCount();
          setConnectionEntryMode("guided");
        }

        function getProviderConfig(provider) {
          return PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.postgres;
        }

        function setConnectionEntryMode(mode) {
          const provider = state.selectedProvider in PROVIDER_CONFIG ? state.selectedProvider : "postgres";
          const forceManual = provider === "powerbi_semantic";
          state.connectionEntryMode = mode === "manual" ? "manual" : "guided";
          if (forceManual) {
            state.connectionEntryMode = "manual";
          }
          const guided = state.connectionEntryMode === "guided";
          elements.setupModeGuidedBtn.classList.toggle("active", guided);
          elements.setupModeManualBtn.classList.toggle("active", !guided);
          elements.setupModeGuidedBtn.disabled = forceManual;
          elements.guidedFields.classList.toggle("panel-hidden", !guided);
          elements.manualConnectionFields.classList.toggle("panel-hidden", guided);
          const providerLabel = elements.selectedProviderName.textContent || "selected";
          elements.setupModeNote.textContent = forceManual
            ? providerLabel + " uses manual connection strings only so the backend can route into the semantic-model planner/executor path."
            : guided
            ? "Guided setup builds the " + providerLabel + " connection string for you, URL-encodes credentials safely, and only asks for the fields this database actually needs."
            : "If you already have a full " + providerLabel + " connection string from your database console or secret manager, paste it here exactly as provided.";
        }

        function updateGuidedProviderFields() {
          const provider = state.selectedProvider in PROVIDER_CONFIG ? state.selectedProvider : "postgres";
          const isPostgres = provider === "postgres";
          const isMySql = provider === "mysql";
          const isSnowflake = provider === "snowflake";
          const isBigQuery = provider === "bigquery";
          const isPowerBiSemantic = provider === "powerbi_semantic";

          elements.guidedAuthRow.classList.toggle("panel-hidden", isBigQuery || isPowerBiSemantic);
          elements.guidedPortWrap.classList.toggle("panel-hidden", !(isPostgres || isMySql));
          elements.guidedSchemaWrap.classList.toggle("panel-hidden", !isSnowflake);
          elements.guidedSnowflakeRow.classList.toggle("panel-hidden", !isSnowflake);
          elements.guidedSslRow.classList.toggle("panel-hidden", !(isPostgres || isMySql));
          elements.advancedTlsSection.classList.toggle("panel-hidden", !(isPostgres || isMySql));
          elements.guidedTlsQuickstart.classList.toggle("panel-hidden", !(isPostgres || isMySql));
          resetSslCards();

          if (isPostgres) {
            elements.sourceDetailsTitle.textContent = "Step A2 - Set up your Postgres connection";
            elements.sourceDetailsSub.textContent = "Fill in the Postgres connection details, validate access, and connect the source before you govern the allowlist.";
            elements.guidedFormTitle.textContent = "Postgres connection details";
            elements.guidedFormSubtitle.textContent = "Fill in your Postgres connection details below. We will build the URI for you.";
            elements.guidedHostLabel.textContent = "Host";
            elements.guidedHost.placeholder = "db.example.com";
            elements.guidedPort.placeholder = "5432";
            elements.guidedDbLabel.textContent = "Database";
            elements.guidedDb.placeholder = "analytics";
            elements.guidedBuilderTip.textContent = "Use plain credentials here. We will URL-encode usernames and passwords for you before sending the connection to the API.";
            elements.guidedProviderQuickstart.textContent = "Copy Host, Port, Database, Username, and Password from your connection details. There is no warehouse for Postgres.";
            elements.guidedTlsQuickstart.textContent = "Auto works for most cloud Postgres. Use Off only for localhost or private dev databases.";
            setAdvancedTlsHelp('Paste your org or database root CA certificate here. Only needed if you see TLS certificate errors.');
            elements.testBtn.textContent = "Test Postgres connection";
            elements.connectSourceBtn.textContent = "Connect Postgres source";
            elements.name.placeholder = "Prod Analytics Replica";
            elements.guidedUsername.placeholder = "reader";
            elements.guidedPassword.placeholder = "********";
            if (!getTrimmedValue(elements.guidedPort)) {
              elements.guidedPort.value = "5432";
            }
          } else if (isMySql) {
            elements.sourceDetailsTitle.textContent = "Step A2 - Set up your MySQL connection";
            elements.sourceDetailsSub.textContent = "Fill in the MySQL connection details, validate access, and connect the source before you govern the allowlist.";
            elements.guidedFormTitle.textContent = "MySQL connection details";
            elements.guidedFormSubtitle.textContent = "Use the values from your MySQL read-only connection screen. We will build the URI for you.";
            elements.guidedHostLabel.textContent = "Host";
            elements.guidedHost.placeholder = "mysql.company.com";
            elements.guidedPort.placeholder = "3306";
            elements.guidedDbLabel.textContent = "Database";
            elements.guidedDb.placeholder = "analytics";
            elements.guidedBuilderTip.textContent = "Guided setup will build a MySQL URI for you and keep special characters in credentials properly encoded.";
            elements.guidedProviderQuickstart.textContent = "Copy Host, Port, Database, Username, and Password from your MySQL read-only connection details.";
            elements.guidedTlsQuickstart.textContent = "Auto or Require works for managed MySQL (RDS, PlanetScale). Use Off only for local or private dev databases.";
            setAdvancedTlsHelp('Paste your org or database root CA certificate here. Only needed if you see TLS certificate errors.');
            elements.testBtn.textContent = "Test MySQL connection";
            elements.connectSourceBtn.textContent = "Connect MySQL source";
            elements.name.placeholder = "MySQL Reporting Replica";
            elements.guidedUsername.placeholder = "reader";
            elements.guidedPassword.placeholder = "********";
            if (!getTrimmedValue(elements.guidedPort)) {
              elements.guidedPort.value = "3306";
            }
          } else if (isSnowflake) {
            elements.sourceDetailsTitle.textContent = "Step A2 - Set up your Snowflake connection";
            elements.sourceDetailsSub.textContent = "Fill in the Snowflake account details, validate access, and connect the source before you govern the allowlist.";
            elements.guidedFormTitle.textContent = "Snowflake connection details";
            elements.guidedFormSubtitle.textContent = "Use your Snowflake account, database, schema, and warehouse. We will build the Snowflake connection string for you.";
            elements.guidedHostLabel.textContent = "Account";
            elements.guidedHost.placeholder = "orgname-accountname";
            elements.guidedDbLabel.textContent = "Database";
            elements.guidedDb.placeholder = "ANALYTICS_DB";
            elements.guidedSchema.placeholder = "PUBLIC";
            elements.guidedBuilderTip.textContent = "Enter your Snowflake username, password, account, database, schema, and warehouse. We will build the Snowflake connection string for you.";
            elements.guidedProviderQuickstart.textContent = "Warehouse is a Snowflake concept only. Get it from your Snowflake admin or from the worksheet/connection details your team uses, for example COMPUTE_WH.";
            elements.guidedTlsQuickstart.textContent = "Snowflake handles transport security itself in the connector. You do not need the Postgres/MySQL SSL mode dropdown here.";
            elements.testBtn.textContent = "Test Snowflake connection";
            elements.connectSourceBtn.textContent = "Connect Snowflake source";
            elements.name.placeholder = "Snowflake Analytics Reader";
            elements.guidedUsername.placeholder = "reader";
            elements.guidedPassword.placeholder = "********";
          } else if (isBigQuery) {
            elements.sourceDetailsTitle.textContent = "Step A2 - Set up your BigQuery connection";
            elements.sourceDetailsSub.textContent = "Fill in the BigQuery project details, validate access, and connect the source before you govern the allowlist.";
            elements.guidedFormTitle.textContent = "BigQuery connection details";
            elements.guidedFormSubtitle.textContent = "Use your project and dataset. If you need custom auth details, use the manual connection string mode.";
            elements.guidedHostLabel.textContent = "Project ID";
            elements.guidedHost.placeholder = "my-project-123";
            elements.guidedDbLabel.textContent = "Dataset";
            elements.guidedDb.placeholder = "analytics";
            elements.guidedBuilderTip.textContent = "Use your BigQuery project and dataset here. Guided mode keeps this simple. If you need credentials_json or other advanced auth options, switch to Paste connection string.";
            elements.guidedProviderQuickstart.textContent = "For BigQuery guided setup, only Project ID and Dataset are shown. If your server does not already have Application Default Credentials, use the manual connection string mode.";
            elements.guidedTlsQuickstart.textContent = "BigQuery does not use the Postgres/MySQL SSL mode dropdown or Advanced TLS section.";
            elements.testBtn.textContent = "Test BigQuery connection";
            elements.connectSourceBtn.textContent = "Connect BigQuery source";
            elements.name.placeholder = "BigQuery Marketing Dataset";
          } else {
            elements.sourceDetailsTitle.textContent = "Step A2 - Set up your Power BI semantic connection";
            elements.sourceDetailsSub.textContent = "Paste the semantic-model connection string, validate the model metadata, and connect it before you govern the semantic entities.";
            elements.guidedFormTitle.textContent = "Power BI semantic connection";
            elements.guidedFormSubtitle.textContent = "Semantic models are manual-only in this version. Paste the workspace/model URI and optional entities, measures, dimensions, and preview rows.";
            elements.guidedHostLabel.textContent = "Workspace";
            elements.guidedHost.placeholder = "workspace-id";
            elements.guidedDbLabel.textContent = "Model";
            elements.guidedDb.placeholder = "model-id";
            elements.guidedBuilderTip.textContent = "Use a powerbi+semantic:// connection string from your connector setup. This path routes into the backend semantic planner instead of SQL.";
            elements.guidedProviderQuickstart.textContent = "Example: powerbi+semantic://workspace-id/model-id?workspace_name=Finance&model_name=Exec%20P%26L&entities=Sales&measures=Revenue,Margin&dimensions=Region,Month";
            elements.guidedTlsQuickstart.textContent = "Power BI semantic connections do not use the SQL TLS controls on this screen.";
            elements.testBtn.textContent = "Test Power BI semantic connection";
            elements.connectSourceBtn.textContent = "Connect Power BI semantic source";
            elements.name.placeholder = "Power BI Executive Model";
          }
          setConnectionEntryMode(state.connectionEntryMode || "guided");
        }

        function getTrimmedValue(input) {
          return String((input && input.value) || "").trim();
        }

        function setAdvancedTlsHelp(copy) {
          elements.advancedTlsHelp.innerHTML =
            escapeHtml(copy) +
            ' Need help finding it? <a href="/connect/guide#tls-ca-corporate" target="_blank" rel="noreferrer">Open the TLS CA guide</a>.';
        }

        function resetSslCards() {
          document.querySelectorAll(".ssl-card").forEach(function(c) { c.classList.remove("ssl-card-active"); });
          const autoCard = document.querySelector(".ssl-card[data-ssl='automatic']");
          if (autoCard) autoCard.classList.add("ssl-card-active");
          if (elements.guidedSslMode) elements.guidedSslMode.value = "automatic";
          const caCertToggle = document.getElementById("ca-cert-toggle");
          const caCertFields = document.getElementById("ca-cert-fields");
          if (caCertToggle) caCertToggle.checked = false;
          if (caCertFields) caCertFields.classList.add("panel-hidden");
        }

        function buildGuidedConnectionString(provider) {
          if (provider === "bigquery") {
            const projectId = getTrimmedValue(elements.guidedHost);
            const dataset = getTrimmedValue(elements.guidedDb);
            if (!projectId || !dataset) {
              throw new Error("Project ID and dataset are required for BigQuery.");
            }
            const url = new URL("bigquery://" + projectId);
            url.pathname = "/" + dataset.replace(/^[/]+/, "");
            return url.toString();
          }

          const username = getTrimmedValue(elements.guidedUsername);
          const password = String((elements.guidedPassword && elements.guidedPassword.value) || "");
          const host = getTrimmedValue(elements.guidedHost);
          const database = getTrimmedValue(elements.guidedDb);

          if (!host || !database) {
            throw new Error("Host/account and database are required.");
          }
          if (!username || !password) {
            throw new Error("Username and password are required.");
          }

          if (provider === "snowflake") {
            const url = new URL("snowflake://placeholder");
            url.username = username;
            url.password = password;
            url.hostname = host;
            const schema = getTrimmedValue(elements.guidedSchema) || "PUBLIC";
            url.pathname = "/" + database.replace(/^[/]+/, "") + "/" + schema.replace(/^[/]+/, "");
            const warehouse = getTrimmedValue(elements.guidedWarehouse);
            if (warehouse) {
              url.searchParams.set("warehouse", warehouse);
            }
            if (!warehouse) {
              throw new Error("Warehouse is required for Snowflake.");
            }
            return url.toString();
          }

          const isMySql = provider === "mysql";
          const url = new URL((isMySql ? "mysql" : "postgresql") + "://placeholder");
          url.username = username;
          url.password = password;
          url.hostname = host;
          const port = getTrimmedValue(elements.guidedPort);
          if (port) {
            url.port = port;
          }
          url.pathname = "/" + database.replace(/^[/]+/, "");
          const sslMode = getTrimmedValue(elements.guidedSslMode);
          if (sslMode && sslMode !== "automatic") {
            url.searchParams.set("sslmode", sslMode);
          }
          return url.toString();
        }

        function resolveConnectionInput() {
          const provider = String(elements.provider.value || state.selectedProvider || "postgres").trim().toLowerCase();
          const connectionString =
            state.connectionEntryMode === "manual"
              ? getTrimmedValue(elements.connectionString)
              : buildGuidedConnectionString(provider);

          if (!connectionString) {
            throw new Error("Connection details are required.");
          }

          return {
            provider,
            connection_string: connectionString,
            tls_ca_pem: getTrimmedValue(elements.tlsCaPem)
          };
        }

        function enhanceConnectionError(message) {
          const provider = String(elements.provider.value || state.selectedProvider || "postgres").trim().toLowerCase();
          if (
            state.connectionEntryMode === "guided" &&
            (provider === "postgres" || provider === "mysql") &&
            /does not support ssl connections/i.test(message) &&
            getTrimmedValue(elements.guidedSslMode) !== "disable"
          ) {
            return message + " Switch SSL mode to Off (local/dev only) and retry.";
          }
          return message;
        }

        function updateProviderSelectionUi() {
          const provider = state.selectedProvider in PROVIDER_CONFIG ? state.selectedProvider : "postgres";
          state.selectedProvider = provider;
          elements.provider.value = provider;
          const config = getProviderConfig(provider);
          elements.selectedProviderName.textContent = config.label;
          elements.selectedProviderNote.textContent = config.note;
          elements.connectionString.placeholder = config.placeholder;
          const help = document.getElementById("connection-string-help");
          if (help) {
            help.textContent = config.help;
          }
          updateGuidedProviderFields();
          setConnectionEntryMode(state.connectionEntryMode || "guided");
          for (const option of elements.sourceOptions) {
            option.classList.toggle("selected", option.dataset.provider === provider);
          }
        }

        function updateAllowlistCount() {
          const count = state.selected instanceof Set ? state.selected.size : 0;
          elements.allowlistCount.textContent = count + " table" + (count === 1 ? "" : "s") + " selected for governance";
        }

        function buildSafeSqlTemplate() {
          const selectedRelations = Array.from(state.selected || []);
          const relation =
            selectedRelations.length > 0
              ? selectedRelations[0]
              : state.context && Array.isArray(state.context.allowed_relations) && state.context.allowed_relations.length > 0
                ? String(state.context.allowed_relations[0] || "").toLowerCase()
                : "";

          if (!relation) {
            return "";
          }

          return "SELECT COUNT(*) AS row_count FROM " + relation;
        }

        function syncSafeSqlTemplate(force) {
          const nextTemplate = buildSafeSqlTemplate();
          const currentValue = String(elements.sql.value || "").trim();
          const previousTemplate = String(state.safeSqlTemplate || "").trim();
          const shouldReplace =
            force ||
            currentValue.length === 0 ||
            currentValue === previousTemplate ||
            (currentValue.startsWith("SELECT * FROM public.") && currentValue.endsWith(" LIMIT 50"));

          state.safeSqlTemplate = nextTemplate;

          if (shouldReplace) {
            elements.sql.value = nextTemplate;
          }
        }

        function setConnectStep(step) {
          state.connectStep = step;
          elements.sourceKindPanel.classList.toggle("panel-hidden", step !== "source-kind");
          elements.sourceDetailsPanel.classList.toggle("panel-hidden", step !== "source-details");
          elements.governancePanel.classList.toggle("panel-hidden", step !== "governance");
          elements.activatePanel.classList.toggle("panel-hidden", step !== "activate");

          if (step === "governance") {
            setWizardStep("governance");
            elements.flowKicker.textContent = "Governance";
            elements.flowTitle.textContent = "Choose the tables that belong on the governed allowlist";
            elements.flowSub.textContent = "Save the allowlist to validate access, catalogue the source, and prepare activation.";
          } else if (step === "activate") {
            setWizardStep("activate");
            elements.flowKicker.textContent = "Activate";
            elements.flowTitle.textContent = "Run a safe query, review the output, and submit the source";
            elements.flowSub.textContent = "Activation is the final check before the source is available to chat and reports.";
          } else if (step === "source-details") {
            setWizardStep("source");
            elements.flowKicker.textContent = "Source";
            elements.flowTitle.textContent = "Test the connection string and connect the source";
            elements.flowSub.textContent = "Validate access first, then connect the source before you govern the allowlist.";
          } else {
            setWizardStep("source");
            elements.flowKicker.textContent = "Source";
            elements.flowTitle.textContent = "Choose your source type";
            elements.flowSub.textContent = "Start by picking the database family you want to connect.";
          }
        }

        function setMode(mode) {
          state.mode = mode === "edit" ? "edit" : mode === "connect" ? "connect" : "chooser";
          const chooserMode = state.mode === "chooser";
          const connectMode = state.mode === "connect";
          const editMode = state.mode === "edit";

          elements.modeEditBtn.classList.toggle("active", editMode);
          elements.modeConnectBtn.classList.toggle("active", connectMode);
          elements.modePanel.classList.toggle("panel-hidden", !chooserMode);
          elements.flowToolbar.classList.toggle("panel-hidden", chooserMode);
          elements.stepTrack.classList.toggle("panel-hidden", !connectMode);
          elements.editListPanel.classList.toggle("panel-hidden", !editMode);
          elements.editPanel.classList.toggle("panel-hidden", !editMode);

          if (connectMode) {
            setConnectStep(state.connectStep);
          } else {
            elements.sourceKindPanel.classList.add("panel-hidden");
            elements.sourceDetailsPanel.classList.add("panel-hidden");
            elements.governancePanel.classList.add("panel-hidden");
            elements.activatePanel.classList.add("panel-hidden");
          }

          if (editMode) {
            elements.flowKicker.textContent = "Edit";
            elements.flowTitle.textContent = "Review connected databases and manage allowlists";
            elements.flowSub.textContent = "Choose a connected source below to inspect its coverage, update the allowlist, or disconnect it.";
            elements.flowStatus.textContent = state.context && state.context.connected ? "1 active source" : "No active source";
          } else if (chooserMode) {
            elements.flowStatus.textContent = "";
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
          const headers = body === undefined ? {} : { "content-type": "application/json" };
          const response = await fetch(path, {
            method,
            headers,
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
              updateAllowlistCount();
              syncSafeSqlTemplate(false);
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
          updateAllowlistCount();
          syncSafeSqlTemplate(false);
        }

        function getCatalogStats(catalog) {
          const tables = catalog && Array.isArray(catalog.tables) ? catalog.tables.length : 0;
          const columns = catalog && Array.isArray(catalog.tables)
            ? catalog.tables.reduce((sum, table) => {
                return sum + (table && Array.isArray(table.columns) ? table.columns.length : 0);
              }, 0)
            : 0;
          return { tables, columns };
        }

        function renderConnectionsTable() {
          const body = elements.connectionsTableBody;
          body.innerHTML = "";

          if (!state.context || !state.context.connected) {
            body.innerHTML = '<tr><td class="connections-table-empty" colspan="5">No connected databases yet.</td></tr>';
            return;
          }

          const stats = getCatalogStats(state.context.catalog);
          const row = document.createElement("tr");
          const isSelected = state.selectedConnectionId && state.selectedConnectionId === state.context.connection_id;
          row.classList.toggle("active", Boolean(isSelected));
          row.innerHTML =
            "<td>" + escapeHtml(String(state.context.database || state.context.name || "Unknown")) + "</td>" +
            "<td>" + escapeHtml(String(state.context.provider || "postgres")) + "</td>" +
            "<td>" + escapeHtml(String(Array.isArray(state.context.allowed_relations) ? state.context.allowed_relations.length : 0)) + " tables</td>" +
            "<td>" + escapeHtml(String(stats.tables)) + " tables / " + escapeHtml(String(stats.columns)) + " columns</td>" +
            "<td>" + escapeHtml(state.context.connected_at ? new Date(state.context.connected_at).toLocaleString() : "-") + "</td>";
          row.addEventListener("click", () => {
            state.selectedConnectionId = state.context ? state.context.connection_id : null;
            populateEditDetails(state.context);
            renderConnectionsTable();
          });
          body.appendChild(row);
        }

        function populateEditDetails(context) {
          if (!context || !context.connected) {
            state.selectedConnectionId = null;
            elements.editSelectedMeta.textContent = "Choose a connected source above to review its details.";
            elements.editEmpty.classList.remove("panel-hidden");
            elements.editContent.classList.add("panel-hidden");
            return;
          }

          const stats = getCatalogStats(context.catalog);
          const provider = typeof context.provider === "string" ? context.provider : "postgres";
          const db = context.database || context.name || "unknown";
          elements.editSelectedMeta.textContent =
            provider +
            " | " +
            db +
            " | " +
            (Array.isArray(context.allowed_relations) ? context.allowed_relations.length : 0) +
            " allowlisted tables | " +
            stats.columns +
            " catalogued columns";
          elements.editEmpty.classList.add("panel-hidden");
          elements.editContent.classList.remove("panel-hidden");
          elements.editConnectionId.textContent = String(context.connection_id || "-");
          elements.editProvider.textContent = provider;
          elements.editDatabase.textContent = String(db || "-");
          elements.editConnectedAt.textContent = context.connected_at ? new Date(context.connected_at).toLocaleString() : "-";
          elements.editConnectionString.textContent = maskConnectionString(elements.connectionString.value);
        }

        function setConnectionStatus(context) {
          renderConnectionsTable();

          if (!context || !context.connected) {
            elements.status.textContent = "No active runtime connection. Choose connect to start a new source, or return later to edit one once it is active.";
            syncSafeSqlTemplate(true);
            if (state.mode === "edit") {
              populateEditDetails(null);
            }
            return;
          }

          const source = typeof context.source === "string" ? context.source : "runtime";
          const provider = typeof context.provider === "string" ? context.provider : "postgres";
          const db = context.database || context.name || "unknown";
          const tableCount = Array.isArray(context.allowed_relations) ? context.allowed_relations.length : 0;
          const stats = getCatalogStats(context.catalog);
          elements.status.textContent =
            "1 active source: " +
            db +
            " | provider: " +
            provider +
            " | source: " +
            source +
            " | allowlisted: " +
            tableCount +
            " | catalogued columns: " +
            stats.columns;

          if (state.mode === "edit" && state.selectedConnectionId) {
            populateEditDetails(context);
          }

          syncSafeSqlTemplate(false);
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

        function openCatalogModalPending() {
          elements.catalogModalTitle.textContent = "Cataloging your governed source";
          elements.catalogModalMessage.textContent = "We are validating the allowlist, indexing the selected tables, and preparing the source for activation.";
          elements.catalogSpinner.style.display = "";
          elements.catalogStatAllowlist.textContent = String(state.selected.size);
          elements.catalogStatTables.textContent = "0";
          elements.catalogStatColumns.textContent = "0";
          elements.catalogFootnote.textContent = "This step prepares the governed catalog used by the planner, analyst, and reports.";
          elements.catalogCloseBtn.classList.add("panel-hidden");
          elements.catalogContinueBtn.classList.add("panel-hidden");
          openModal(elements.catalogModal);
        }

        function completeCatalogModal(validation, catalog) {
          const stats = getCatalogStats(catalog);
          elements.catalogModalTitle.textContent = "Catalog ready for activation";
          elements.catalogModalMessage.textContent = validation && validation.summary
            ? String(validation.summary)
            : "The governed source has been validated and catalogued.";
          elements.catalogSpinner.style.display = "none";
          elements.catalogStatAllowlist.textContent = String(state.selected.size);
          elements.catalogStatTables.textContent = String(stats.tables);
          elements.catalogStatColumns.textContent = String(stats.columns);
          elements.catalogFootnote.textContent = catalog && typeof catalog.business_id === "string" && catalog.business_id
            ? "Business id: " + catalog.business_id + ". Continue when you are ready to run the safe activation query."
            : "Continue when you are ready to run the safe activation query.";
          elements.catalogCloseBtn.classList.remove("panel-hidden");
          elements.catalogContinueBtn.classList.remove("panel-hidden");
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
          state.selectedConnectionId = null;
          state.testResult = null;
          state.wizard.source_tested = false;
          state.wizard.source_connected = false;
          state.wizard.governance_saved = false;
          state.connectStep = "source-kind";
          setConnectionStatus(context);

          const tables = await request("/api/db/tables", "GET").catch(() => null);
          const relations = tables && Array.isArray(tables.relations) ? tables.relations : [];
          state.relations = relations;
          state.selected = new Set(Array.isArray(context.allowed_relations) ? context.allowed_relations.map((v) => String(v).toLowerCase()) : []);
          if (context && typeof context.provider === "string") {
            state.selectedProvider = context.provider;
          }

          updateProviderSelectionUi();
          renderSchemaFilter(elements.schemaFilter);
          renderSchemaFilter(elements.editSchemaFilter);
          renderAllRelationLists();
          renderTestNotes(null);
          setMode("chooser");
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

        elements.catalogCloseBtn.addEventListener("click", () => closeModal(elements.catalogModal));
        elements.catalogContinueBtn.addEventListener("click", () => {
          closeModal(elements.catalogModal);
          state.wizard.governance_saved = true;
          setMode("connect");
          setConnectStep("activate");
        });
        elements.catalogModal.addEventListener("click", (event) => {
          if (event.target === elements.catalogModal && !elements.catalogContinueBtn.classList.contains("panel-hidden")) {
            closeModal(elements.catalogModal);
          }
        });

        elements.modeEditBtn.addEventListener("click", () => {
          setMode("edit");
          populateEditDetails(null);
        });
        elements.modeConnectBtn.addEventListener("click", () => {
          resetConnectWizardState();
          updateProviderSelectionUi();
          setMode("connect");
          setConnectStep("source-kind");
        });

        elements.sourceOptions.forEach((option) => {
          option.addEventListener("click", () => {
            const provider = option.dataset.provider;
            if (!provider) {
              return;
            }
            state.selectedProvider = provider;
            updateProviderSelectionUi();
          });
        });

        elements.guidedHost.addEventListener("input", () => {
          const host = getTrimmedValue(elements.guidedHost).toLowerCase();
          const provider = String(elements.provider.value || state.selectedProvider || "postgres").trim().toLowerCase();
          if (provider === "postgres" && host.includes(".pooler.supabase.com")) {
            const currentPort = getTrimmedValue(elements.guidedPort);
            if (!currentPort || currentPort === "5432") {
              elements.guidedPort.value = "6543";
            }
          }
        });

        document.querySelectorAll(".ssl-card").forEach(function(card) {
          card.addEventListener("click", function() {
            const val = this.dataset.ssl;
            if (!val) return;
            document.querySelectorAll(".ssl-card").forEach(function(c) { c.classList.remove("ssl-card-active"); });
            this.classList.add("ssl-card-active");
            if (elements.guidedSslMode) elements.guidedSslMode.value = val;
            const radio = this.querySelector("input[type=radio]");
            if (radio) radio.checked = true;
          });
        });

        const caCertToggleEl = document.getElementById("ca-cert-toggle");
        const caCertFieldsEl = document.getElementById("ca-cert-fields");
        if (caCertToggleEl && caCertFieldsEl) {
          caCertToggleEl.addEventListener("change", function() {
            caCertFieldsEl.classList.toggle("panel-hidden", !this.checked);
          });
        }

        elements.sourceKindContinueBtn.addEventListener("click", () => {
          updateProviderSelectionUi();
          setMode("connect");
          setConnectStep("source-details");
        });

        elements.setupModeGuidedBtn.addEventListener("click", () => {
          setConnectionEntryMode("guided");
        });

        elements.setupModeManualBtn.addEventListener("click", () => {
          setConnectionEntryMode("manual");
        });

        elements.changeProviderBtn.addEventListener("click", () => {
          setConnectStep("source-kind");
        });

        elements.flowBackBtn.addEventListener("click", () => {
          if (state.mode === "edit") {
            state.selectedConnectionId = null;
            populateEditDetails(null);
            setMode("chooser");
            return;
          }

          if (state.mode !== "connect") {
            setMode("chooser");
            return;
          }

          if (state.connectStep === "activate") {
            setConnectStep("governance");
            return;
          }

          if (state.connectStep === "governance") {
            setConnectStep("source-details");
            return;
          }

          if (state.connectStep === "source-details") {
            setConnectStep("source-kind");
            return;
          }

          resetConnectWizardState();
          setMode("chooser");
        });

        elements.schemaFilter.addEventListener("change", () => renderAllRelationLists());
        elements.searchFilter.addEventListener("input", () => renderAllRelationLists());
        elements.editSchemaFilter.addEventListener("change", () => renderAllRelationLists());
        elements.editSearchFilter.addEventListener("input", () => renderAllRelationLists());

        elements.testBtn.addEventListener("click", async () => {
          try {
            const resolved = resolveConnectionInput();
            const body = {
              connection_string: resolved.connection_string,
              provider: resolved.provider
            };
            if (resolved.tls_ca_pem) {
              body.tls_ca_pem = resolved.tls_ca_pem;
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

            elements.editConnectionString.textContent = maskConnectionString(resolved.connection_string);
            renderSchemaFilter(elements.schemaFilter);
            renderSchemaFilter(elements.editSchemaFilter);
            renderAllRelationLists();
            renderTestNotes(result);
            elements.flowStatus.textContent = "Connection test complete";
            setMode("connect");
            setConnectStep("source-details");
            showOutput(result);
          } catch (error) {
            const message = enhanceConnectionError(error instanceof Error ? error.message : "Unknown error");
            showOutput(message);
            showError(message, "Test connection failed");
          }
        });

        elements.connectSourceBtn.addEventListener("click", async () => {
          try {
            if (!state.wizard.source_tested || !state.testResult) {
              throw new Error("Run Step A test connection first.");
            }

            const resolved = resolveConnectionInput();
            const body = {
              name: String(elements.name.value || "").trim() || undefined,
              connection_string: resolved.connection_string,
              provider: resolved.provider
            };
            if (resolved.tls_ca_pem) {
              body.tls_ca_pem = resolved.tls_ca_pem;
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
            elements.editConnectionString.textContent = maskConnectionString(resolved.connection_string);
            renderSchemaFilter(elements.schemaFilter);
            renderSchemaFilter(elements.editSchemaFilter);
            renderAllRelationLists();
            elements.flowStatus.textContent = "Source connected";
            setMode("connect");
            setConnectStep("governance");
            showOutput({
              message: "Source connected. Governance is now ready.",
              connection_id: context.connection_id || null
            });
          } catch (error) {
            const message = enhanceConnectionError(error instanceof Error ? error.message : "Unknown error");
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

            openCatalogModalPending();

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
            completeCatalogModal(validation, catalog);

            if (!validation.ok) {
              elements.catalogFootnote.textContent = "Some tables or columns still have validation warnings. You can continue to activate, but review the fix-it script before final rollout.";
            }

            showOutput({
              message: "Governance saved and auto-catalog completed.",
              validation_summary: validation.summary,
              cataloged_at: catalog ? catalog.cataloged_at : null,
              business_id: catalog ? catalog.business_id : null
            });
          } catch (error) {
            closeModal(elements.catalogModal);
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
            const resolved = resolveConnectionInput();
            elements.fixStatus.textContent = "Re-testing...";
            const body = {
              connection_string: resolved.connection_string,
              provider: resolved.provider
            };
            if (resolved.tls_ca_pem) {
              body.tls_ca_pem = resolved.tls_ca_pem;
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

            elements.editConnectionString.textContent = maskConnectionString(resolved.connection_string);
            renderSchemaFilter(elements.schemaFilter);
            renderSchemaFilter(elements.editSchemaFilter);
            renderAllRelationLists();
            renderTestNotes(result);

            elements.fixStatus.textContent = "Re-test complete. You can now save governance and continue.";
          } catch (error) {
            elements.fixStatus.textContent = enhanceConnectionError(error instanceof Error ? error.message : "Re-test failed");
          }
        });

        loadContext().catch(() => {});
      })();
    </script>
  </body>
</html>`;
}
