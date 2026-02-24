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
        --ink: #e9f1ff;
        --ink-soft: #6f86b4;
        --panel: #050f2d;
        --panel-2: #07143a;
        --panel-3: #0a1f50;
        --line: #14386f;
        --line-soft: #20509d;
        --accent: #5444ff;
        --accent-2: #6958ff;
        --accent-3: #3b88ff;
        --glow: rgba(85, 72, 255, 0.45);
        --shadow: 0 18px 48px rgba(1, 8, 32, 0.44);
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
          radial-gradient(circle at -8% 22%, rgba(80, 110, 255, 0.15), transparent 26%),
          radial-gradient(circle at 104% -8%, rgba(98, 80, 255, 0.12), transparent 24%),
          linear-gradient(180deg, #02071b 0%, #030b27 50%, #030d2e 100%);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: linear-gradient(
          to right,
          rgba(108, 138, 214, 0.05) 1px,
          transparent 1px
        );
        background-size: 60px 60px;
        mask-image: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.86), transparent 92%);
      }

      .page {
        width: 100%;
        margin: 0;
      }

      .layout {
        display: grid;
        grid-template-columns: 198px 248px 1fr;
        gap: 0;
        min-height: 100vh;
      }

      .platform-panel {
        border: 1px solid var(--line);
        border-right: 1px solid #112f62;
        border-radius: 0;
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

      .history-panel {
        border: 1px solid var(--line);
        border-left: none;
        border-right: 1px solid #123065;
        border-radius: 0;
        background: linear-gradient(180deg, rgba(6, 18, 49, 0.98), rgba(5, 14, 37, 0.98));
        box-shadow: var(--shadow);
        backdrop-filter: blur(16px);
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px 12px 11px;
      }

      .history-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 7px 10px 12px;
        margin-bottom: 2px;
        border-radius: 12px;
        border-bottom: 1px solid #1a3a75;
      }

      .history-title strong {
        font-size: 0.92rem;
        letter-spacing: 0.02em;
      }

      .new-chat-btn {
        appearance: none;
        border: 1px solid #2f4f9d;
        border-radius: 999px;
        width: 25px;
        height: 25px;
        font-size: 0.92rem;
        line-height: 1;
        cursor: pointer;
        color: #d7e6ff;
        background: linear-gradient(135deg, #0f2f7f, #1d4aa8);
      }

      .new-chat-btn:disabled {
        opacity: 0.6;
        cursor: wait;
      }

      .history-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow-y: auto;
        padding-right: 2px;
      }

      .history-list::-webkit-scrollbar {
        width: 8px;
      }

      .history-list::-webkit-scrollbar-thumb {
        background: #1c3f85;
        border-radius: 999px;
      }

      .history-empty {
        border: 1px dashed #2d4d93;
        border-radius: 12px;
        padding: 12px;
        color: var(--ink-soft);
        font-size: 0.74rem;
        background: rgba(10, 23, 57, 0.56);
      }

      .history-item {
        width: 100%;
        text-align: left;
        padding: 10px 11px;
        border-radius: 12px;
        border: 1px solid #1f3b77;
        background: rgba(9, 22, 57, 0.78);
        color: inherit;
        cursor: pointer;
        transition: border-color 130ms ease, transform 130ms ease, background 130ms ease;
      }

      .history-item.active {
        border-color: #4f6cff;
        background: linear-gradient(135deg, rgba(39, 58, 140, 0.82), rgba(18, 36, 94, 0.94));
        box-shadow: inset 0 0 0 1px rgba(113, 126, 255, 0.2);
      }

      .history-item:hover {
        transform: translateY(-1px);
        border-color: #3156ab;
      }

      .history-item-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .history-item h3 {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 600;
      }

      .history-item time {
        font-family: "JetBrains Mono", monospace;
        color: var(--ink-soft);
        font-size: 0.65rem;
      }

      .history-item p {
        margin: 6px 0 0;
        color: var(--ink-soft);
        font-size: 0.71rem;
      }

      .chat-shell {
        border: 1px solid var(--line);
        border-left: none;
        border-radius: 0;
        background: linear-gradient(180deg, rgba(4, 11, 33, 0.98), rgba(2, 8, 26, 0.99));
        box-shadow: var(--shadow);
        backdrop-filter: blur(16px);
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: 100vh;
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
        padding: 11px 18px;
        border-bottom: 1px solid #173b77;
        background: linear-gradient(180deg, rgba(8, 19, 48, 0.98), rgba(7, 18, 44, 0.97));
      }

      .chat-head-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chat-head-mark {
        width: 28px;
        height: 28px;
        border-radius: 10px;
        border: 1px solid #3552a9;
        background: linear-gradient(135deg, #4f3eff, #6557ff);
        display: grid;
        place-items: center;
        font-weight: 700;
        color: #fff;
        box-shadow: 0 8px 20px rgba(86, 74, 255, 0.34);
      }

      .chat-head-copy strong {
        display: block;
        font-size: 0.96rem;
        letter-spacing: 0.01em;
      }

      .chat-subtitle {
        display: block;
        margin-top: 1px;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.6rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #7085b6;
      }

      .chat-head-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .head-icon {
        width: 30px;
        height: 30px;
        border-radius: 9px;
        border: 1px solid #2b4d98;
        background: rgba(16, 35, 83, 0.88);
        color: #afc3f3;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.72rem;
        cursor: default;
      }

      .status {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.62rem;
        color: var(--ink-soft);
        padding: 6px 10px 5px;
        border-radius: 999px;
        border: 1px solid #29498e;
        background: rgba(10, 29, 70, 0.88);
      }

      .messages {
        padding: 16px 22px 14px;
        overflow-y: auto;
        max-height: calc(100vh - 178px);
        background: linear-gradient(180deg, rgba(3, 10, 29, 0.98), rgba(2, 8, 24, 0.99));
      }

      .messages::-webkit-scrollbar {
        width: 9px;
      }

      .messages::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: #1c3d7d;
      }

      .bubble {
        width: fit-content;
        max-width: min(86%, 960px);
        margin-bottom: 13px;
        padding: 12px 15px;
        border-radius: 16px;
        line-height: 1.6;
        word-break: break-word;
        font-size: 0.91rem;
      }

      .bubble.user {
        margin-left: auto;
        color: #f7fbff;
        background: linear-gradient(135deg, #4e40ff 0%, #5f4eff 55%, #6e5dff 100%);
        border: 1px solid rgba(133, 120, 255, 0.44);
        box-shadow: 0 12px 24px rgba(84, 73, 255, 0.34);
        white-space: pre-wrap;
      }

      .bubble.assistant {
        background: linear-gradient(160deg, rgba(8, 22, 56, 0.96), rgba(6, 18, 46, 0.96));
        border: 1px solid #1f3f82;
        box-shadow: 0 9px 22px rgba(1, 8, 26, 0.34);
      }

      .bubble.assistant a {
        color: #80aefc;
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
        background: rgba(106, 129, 209, 0.2);
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
        background: var(--accent-2);
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
        border: 1px solid #243d84;
        border-radius: 22px;
        overflow: hidden;
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
        background: rgba(82, 134, 225, 0.12);
        border: 1px solid rgba(93, 143, 232, 0.22);
        font-size: 0.8rem;
      }

      .query-log-toggle {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-top: 10px;
        padding: 4px 10px;
        background: rgba(36, 61, 132, 0.28);
        border: 1px solid rgba(93, 143, 232, 0.25);
        border-radius: 6px;
        color: #8aacdf;
        font-size: 0.75rem;
        cursor: pointer;
        user-select: none;
      }
      .query-log-toggle:hover { background: rgba(36, 61, 132, 0.45); color: #aec6f0; }

      .query-log {
        margin-top: 8px;
        display: none;
        flex-direction: column;
        gap: 10px;
      }
      .query-log.open { display: flex; }

      .query-card {
        background: rgba(5, 15, 42, 0.85);
        border: 1px solid rgba(36, 61, 132, 0.5);
        border-radius: 10px;
        padding: 12px 14px;
        font-size: 0.78rem;
      }

      .query-card-title {
        font-weight: 600;
        color: #aec6f0;
        margin-bottom: 4px;
      }

      .query-card-purpose {
        color: #6b90c4;
        font-size: 0.74rem;
        margin-bottom: 8px;
      }

      .query-card-meta {
        display: flex;
        gap: 14px;
        color: #7a9fc7;
        font-size: 0.72rem;
        margin-bottom: 8px;
      }

      .query-card pre.qc-sql {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(36, 61, 132, 0.35);
        border-radius: 6px;
        padding: 8px 10px;
        overflow-x: auto;
        font-size: 0.71rem;
        color: #b0cce8;
        white-space: pre;
        margin: 0 0 8px;
      }

      .coverage-dots {
        display: flex;
        gap: 2px;
        flex-wrap: wrap;
        align-items: center;
      }

      .coverage-dot {
        width: 9px;
        height: 9px;
        border-radius: 2px;
      }

      .qc-sample-rows {
        margin-top: 10px;
      }

      .qc-sample-rows-label {
        color: #5580a8;
        font-size: 0.7rem;
        margin-bottom: 4px;
      }

      .qc-sample-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.69rem;
        overflow-x: auto;
        display: block;
        white-space: nowrap;
      }

      .qc-sample-table th {
        background: rgba(36, 61, 132, 0.35);
        color: #7aaee8;
        padding: 3px 8px;
        text-align: left;
        border-bottom: 1px solid rgba(36, 61, 132, 0.4);
        font-weight: 500;
      }

      .qc-sample-table td {
        color: #9fbdd8;
        padding: 2px 8px;
        border-bottom: 1px solid rgba(36, 61, 132, 0.15);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .qc-sample-table tr:last-child td {
        border-bottom: none;
      }

      .composer {
        border-top: 1px solid #173b77;
        padding: 11px 14px 13px;
        background: linear-gradient(180deg, rgba(6, 17, 44, 0.99), rgba(5, 14, 36, 0.99));
      }

      .queries-bar-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid rgba(93, 143, 232, 0.22);
        background: rgba(11, 27, 63, 0.7);
        color: #6b90c4;
        border-radius: 7px;
        padding: 4px 11px;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.67rem;
        cursor: pointer;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .queries-bar-btn:hover {
        background: rgba(36, 61, 132, 0.5);
        color: #c0d8f8;
        border-color: rgba(93, 143, 232, 0.5);
      }
      .queries-bar-btn.has-queries {
        color: #8aacdf;
        border-color: rgba(93, 143, 232, 0.35);
      }

      .queries-modal-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(2, 8, 23, 0.82);
        z-index: 200;
      }

      .queries-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 201;
        flex-direction: column;
        pointer-events: none;
        align-items: center;
        justify-content: center;
      }
      .queries-modal.open {
        display: flex;
      }

      .queries-modal-panel {
        pointer-events: all;
        background: linear-gradient(160deg, #050f2c 0%, #030a1f 100%);
        border: 1px solid rgba(36, 61, 132, 0.6);
        border-radius: 16px;
        width: min(1100px, 96vw);
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(0,0,0,0.6);
      }

      .queries-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 1px solid rgba(36, 61, 132, 0.4);
        flex-shrink: 0;
      }

      .queries-modal-title {
        font-size: 0.85rem;
        font-weight: 600;
        color: #aec6f0;
        font-family: "JetBrains Mono", monospace;
      }

      .queries-modal-close {
        background: none;
        border: none;
        color: #5580a8;
        font-size: 1.1rem;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        line-height: 1;
      }
      .queries-modal-close:hover { color: #aec6f0; background: rgba(36,61,132,0.3); }

      .queries-modal-body {
        overflow-y: auto;
        overflow-x: auto;
        padding: 0;
      }

      /* Queries table */
      .queries-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.76rem;
      }

      .queries-table thead th {
        background: rgba(22, 44, 100, 0.6);
        color: #7aaee8;
        font-size: 0.67rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 9px 14px;
        border-bottom: 1px solid rgba(36, 61, 132, 0.5);
        text-align: left;
        white-space: nowrap;
        position: sticky;
        top: 0;
      }

      .queries-table tbody td {
        padding: 11px 14px;
        vertical-align: top;
        border-bottom: 1px solid rgba(36, 61, 132, 0.18);
        color: #9fbdd8;
      }

      .queries-table tbody tr:last-child td { border-bottom: none; }

      .queries-table .qt-id {
        width: 36px;
        min-width: 36px;
        color: #5580a8;
        font-weight: 700;
        text-align: center;
        font-size: 0.75rem;
      }

      .queries-table .qt-why { min-width: 200px; max-width: 300px; }

      .qt-question {
        color: #aec6f0;
        font-weight: 600;
        margin-bottom: 4px;
        line-height: 1.4;
      }

      .qt-purpose {
        color: #6b90c4;
        font-size: 0.71rem;
        line-height: 1.4;
      }

      .queries-table .qt-sql { min-width: 280px; max-width: 380px; }

      .qt-sql-code {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(36, 61, 132, 0.35);
        border-radius: 6px;
        padding: 7px 10px;
        overflow-x: auto;
        font-size: 0.68rem;
        color: #b0cce8;
        white-space: pre;
        margin: 0;
        max-height: 130px;
      }

      .queries-table .qt-output { min-width: 220px; }

      .qt-run-group td {
        background: rgba(36, 61, 132, 0.15);
        padding: 6px 14px;
        border-bottom: 1px solid rgba(36, 61, 132, 0.3) !important;
      }

      .qt-run-label {
        font-size: 0.66rem;
        font-weight: 700;
        color: #5580a8;
        text-transform: uppercase;
        letter-spacing: 0.07em;
      }

      .composer form {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 9px;
      }

      .composer textarea {
        width: 100%;
        border-radius: 16px;
        border: 1px solid #2f4d95;
        padding: 14px 16px 13px;
        min-height: 54px;
        background: rgba(9, 24, 58, 0.94);
        font-family: "JetBrains Mono", monospace;
        font-size: 0.8rem;
        color: #edf3ff;
        resize: none;
        line-height: 1.5;
      }

      .composer textarea:focus {
        outline: none;
        border-color: #5d7eff;
        box-shadow: 0 0 0 4px rgba(90, 112, 236, 0.2);
      }

      .composer button {
        border: 1px solid rgba(128, 144, 255, 0.48);
        border-radius: 15px;
        width: 64px;
        min-height: 54px;
        cursor: pointer;
        color: #ffffff;
        background: linear-gradient(135deg, #4f3eff, #5f4dff 56%, #6c5cff);
        font-family: "Space Grotesk", sans-serif;
        font-weight: 700;
        letter-spacing: 0;
        box-shadow: 0 10px 22px var(--glow);
        transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
      }

      .composer button:hover {
        transform: translateY(-1px);
        filter: saturate(1.06);
        box-shadow: 0 15px 26px rgba(71, 95, 229, 0.38);
      }

      .composer button:disabled {
        cursor: wait;
        opacity: 0.68;
      }

      .decision-panel {
        margin-bottom: 10px;
        border: 1px solid #29498f;
        background: rgba(8, 23, 58, 0.9);
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
        border: 1px solid rgba(127, 143, 255, 0.48);
        border-radius: 999px;
        background: linear-gradient(135deg, #4c40ff, #5f54ff);
        color: #ffffff;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.73rem;
        padding: 7px 12px;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(84, 73, 255, 0.3);
        transition: transform 120ms ease, filter 120ms ease;
      }

      .decision-btn:hover {
        transform: translateY(-1px);
        filter: saturate(1.06);
      }

      @media (max-width: 1200px) {
        .page {
          width: 100%;
          margin: 0;
        }

        .layout {
          grid-template-columns: 1fr;
        }

        .platform-panel {
          display: none;
        }

        .history-panel {
          display: none;
        }

        .chat-shell {
          border-left: 1px solid var(--line);
          border-radius: 0;
        }
      }

      @media (max-width: 900px) {
        .chat-shell {
          min-height: 100vh;
          border-radius: 0;
        }

        .messages {
          padding: 14px;
          max-height: calc(100vh - 154px);
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

        .composer button {
          width: 100%;
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
            <a class="platform-link active" href="/"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>Chat Explorer</a>
            <a class="platform-link" href="/usage"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></span>Usage Metrics</a>
          </nav>
          <div class="platform-section">Infrastructure</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/connect"><span class="link-icon"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></span>Data Sources</a>
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
        <aside class="history-panel">
          <div class="history-title">
            <strong>Chat History</strong>
            <button id="new-chat-button" class="new-chat-btn" type="button" aria-label="Start new chat">+</button>
          </div>
          <div class="history-list" id="history-list">
            <div class="history-empty">No chats yet. Start a new chat.</div>
          </div>
        </aside>
        <main class="chat-shell">
          <header class="chat-head">
            <div class="chat-head-left">
              <div class="chat-head-mark">*</div>
              <div class="chat-head-copy">
                <strong id="chat-session-title">New Chat</strong>
              </div>
            </div>
            <div class="chat-head-right">
              <button id="queries-bar-btn" class="queries-bar-btn" type="button">Queries</button>
              <span class="status" id="status" style="display:none"></span>
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
          <div class="queries-modal-backdrop" id="queries-modal-backdrop"></div>
          <div class="queries-modal" id="queries-modal">
            <div class="queries-modal-panel">
              <div class="queries-modal-header">
                <span class="queries-modal-title" id="queries-modal-title">Queries run in this chat</span>
                <button class="queries-modal-close" id="queries-modal-close" type="button">&#x2715;</button>
              </div>
              <div class="queries-modal-body" id="queries-modal-body"></div>
            </div>
          </div>
        </main>
      </div>
    </div>

    <script>
      (() => {
        const CHAT_STORAGE_KEY = "project_overload_chat_sessions_v1";
        const MAX_STORED_CHATS = 30;
        const UI_CONTROL_MESSAGE_PATTERN = /^__ui_[a-z0-9_]+__$/i;
        const INITIAL_ASSISTANT_MESSAGE =
          "Hey! Tell me what report you'd like to build - **who's the audience** and **what metric matters most**? I'll handle the rest.";

        const stateRef = { value: null };
        const chatsRef = { value: [] };
        const activeChatIdRef = { value: null };
        const messagesEl = document.getElementById("messages");
        const statusEl = document.getElementById("status");
        const inputEl = document.getElementById("composer-input");
        const sendButtonEl = document.getElementById("composer-send");
        const formEl = document.getElementById("composer-form");
        const decisionPanelEl = document.getElementById("decision-panel");
        const queriesBarBtnEl = document.getElementById("queries-bar-btn");
        const queriesModalEl = document.getElementById("queries-modal");
        const queriesModalBackdropEl = document.getElementById("queries-modal-backdrop");
        const queriesModalBodyEl = document.getElementById("queries-modal-body");
        const queriesModalTitleEl = document.getElementById("queries-modal-title");
        const historyListEl = document.getElementById("history-list");
        const newChatButtonEl = document.getElementById("new-chat-button");
        const chatSessionTitleEl = document.getElementById("chat-session-title");
        const runtimeStatusRef = { mode: "checking provider", busy: false };
        const composerStateRef = { busy: false, locked: false };
        const decisionRef = { value: null };
        const serverSyncRef = { timer: null, inFlight: false, queued: false };
        let activeRunPollId = null;   // prevents duplicate polling loops for async runs
        const defaultInputPlaceholder =
          "Describe the report you want, e.g. weekly refund analysis by product category";

        function nowIso() {
          return new Date().toISOString();
        }

        function createChatId() {
          if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return "chat_" + crypto.randomUUID();
          }
          return "chat_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
        }

        function cloneJson(value) {
          if (value === null || value === undefined) {
            return null;
          }
          try {
            return JSON.parse(JSON.stringify(value));
          } catch {
            return null;
          }
        }

        function truncate(value, maxLength) {
          const text = String(value || "").trim();
          if (text.length <= maxLength) {
            return text;
          }
          return text.slice(0, maxLength - 3).trimEnd() + "...";
        }

        function sanitizeTitle(value) {
          const cleaned = String(value || "")
            .replace(/[\\r\\n]+/g, " ")
            .replace(/^["'\`]+/, "")
            .replace(/["'\`]+$/, "")
            .replace(/\\s+/g, " ")
            .trim();
          if (!cleaned) {
            return "New Chat";
          }
          return truncate(cleaned, 64);
        }

        function formatRelativeTime(iso) {
          const ts = Date.parse(String(iso || ""));
          if (!Number.isFinite(ts)) {
            return "just now";
          }
          const diffMs = Date.now() - ts;
          if (diffMs < 60_000) {
            return "just now";
          }
          if (diffMs < 3_600_000) {
            return Math.round(diffMs / 60_000) + "m ago";
          }
          if (diffMs < 86_400_000) {
            return Math.round(diffMs / 3_600_000) + "h ago";
          }
          return Math.round(diffMs / 86_400_000) + "d ago";
        }

        function createEmptyChatSession() {
          const createdAt = nowIso();
          return {
            id: createChatId(),
            title: "New Chat",
            title_auto: true,
            naming_in_progress: false,
            created_at: createdAt,
            updated_at: createdAt,
            state: null,
            user_messages: [],
            db_bootstrapped: false,
            messages: [
              {
                role: "assistant",
                text: INITIAL_ASSISTANT_MESSAGE,
                download_url: null,
                exec_brief_html: null,
                at: createdAt
              }
            ]
          };
        }

        function normalizeStoredMessage(raw) {
          if (!raw || (raw.role !== "user" && raw.role !== "assistant")) {
            return null;
          }
          const text = typeof raw.text === "string" ? raw.text : typeof raw.content === "string" ? raw.content : "";
          const trimmed = text.trim();
          if (!trimmed) {
            return null;
          }
          return {
            role: raw.role,
            text: trimmed,
            download_url: typeof raw.download_url === "string" ? raw.download_url : null,
            exec_brief_html: typeof raw.exec_brief_html === "string" ? raw.exec_brief_html : null,
            prepared_payloads: Array.isArray(raw.prepared_payloads) ? raw.prepared_payloads : null,
            at: typeof raw.at === "string" ? raw.at : nowIso()
          };
        }

        function normalizeStoredChat(raw) {
          if (!raw || typeof raw !== "object" || typeof raw.id !== "string") {
            return null;
          }

          const messagesRaw = Array.isArray(raw.messages) ? raw.messages : [];
          const messages = messagesRaw
            .map((entry) => normalizeStoredMessage(entry))
            .filter((entry) => entry !== null);

          if (messages.length === 0) {
            messages.push({
              role: "assistant",
              text: INITIAL_ASSISTANT_MESSAGE,
              download_url: null,
              exec_brief_html: null,
              at: nowIso()
            });
          }

          const userMessages = Array.isArray(raw.user_messages)
            ? raw.user_messages
                .map((entry) => String(entry || "").trim())
                .filter((entry) => entry.length > 0)
                .slice(0, 12)
            : [];

          // Strip pending_run_id on load — async runs don't survive page reloads.
          // Any stored run ID would trigger an infinite polling loop if the server
          // restarted and the run is no longer found (returns 502 → stale lock).
          const rawState = raw.state === undefined ? null : cloneJson(raw.state);
          if (rawState && rawState.pending_run_id) {
            rawState.pending_run_id = null;
          }

          return {
            id: raw.id,
            title: sanitizeTitle(raw.title),
            title_auto: raw.title_auto !== false,
            naming_in_progress: false,
            created_at: typeof raw.created_at === "string" ? raw.created_at : nowIso(),
            updated_at: typeof raw.updated_at === "string" ? raw.updated_at : nowIso(),
            state: rawState,
            user_messages: userMessages,
            db_bootstrapped: typeof raw.db_bootstrapped === "boolean" ? raw.db_bootstrapped : true,
            messages
          };
        }

        function loadChatsFromStorage() {
          try {
            const raw = localStorage.getItem(CHAT_STORAGE_KEY);
            if (!raw) {
              return [];
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
              return [];
            }
            return parsed
              .map((entry) => normalizeStoredChat(entry))
              .filter((entry) => entry !== null)
              .slice(0, MAX_STORED_CHATS);
          } catch {
            return [];
          }
        }

        function saveChatsToStorage(skipServerSync) {
          try {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatsRef.value.slice(0, MAX_STORED_CHATS)));
          } catch {
            // best effort only
          }
          if (skipServerSync !== true) {
            scheduleServerSync();
          }
        }

        async function loadChatsFromServer() {
          try {
            const response = await fetch("/api/chat/sessions", { method: "GET" });
            if (!response.ok) {
              return [];
            }
            let payload;
            try { payload = JSON.parse(await response.text()); } catch { return []; }
            const sessions = Array.isArray(payload && payload.sessions) ? payload.sessions : [];
            return sessions
              .map((entry) => normalizeStoredChat(entry))
              .filter((entry) => entry !== null)
              .slice(0, MAX_STORED_CHATS);
          } catch {
            return [];
          }
        }

        function scheduleServerSync() {
          if (serverSyncRef.timer) {
            clearTimeout(serverSyncRef.timer);
          }
          serverSyncRef.timer = setTimeout(() => {
            serverSyncRef.timer = null;
            void syncChatsToServer();
          }, 400);
        }

        async function syncChatsToServer() {
          if (serverSyncRef.inFlight) {
            serverSyncRef.queued = true;
            return;
          }

          serverSyncRef.inFlight = true;
          serverSyncRef.queued = false;

          try {
            const sessions = chatsRef.value.slice(0, MAX_STORED_CHATS);
            for (const session of sessions) {
              const response = await fetch("/api/chat/sessions/" + encodeURIComponent(session.id), {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ session })
              });
              if (!response.ok) {
                break;
              }
            }
          } catch {
            // best effort only
          } finally {
            serverSyncRef.inFlight = false;
            if (serverSyncRef.queued) {
              serverSyncRef.queued = false;
              void syncChatsToServer();
            }
          }
        }

        function touchChat(chat) {
          chat.updated_at = nowIso();
        }

        function getChatById(chatId) {
          return chatsRef.value.find((entry) => entry.id === chatId) || null;
        }

        function getActiveChat() {
          return getChatById(activeChatIdRef.value);
        }

        function renderSessionTitle() {
          const active = getActiveChat();
          chatSessionTitleEl.textContent = active ? active.title : "Project Overload";
        }

        function setActiveChatState(nextState) {
          const active = getActiveChat();
          if (!active) {
            return;
          }
          active.state = cloneJson(nextState);
          touchChat(active);
          saveChatsToStorage();
          renderHistoryList();
        }

        function renderHistoryList() {
          historyListEl.innerHTML = "";
          if (chatsRef.value.length === 0) {
            const empty = document.createElement("div");
            empty.className = "history-empty";
            empty.textContent = "No chats yet. Start a new chat.";
            historyListEl.appendChild(empty);
            return;
          }

          const sorted = [...chatsRef.value].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
          for (const chat of sorted) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "history-item" + (chat.id === activeChatIdRef.value ? " active" : "");
            button.disabled = runtimeStatusRef.busy;
            button.addEventListener("click", () => {
              if (runtimeStatusRef.busy) {
                return;
              }
              activateChat(chat.id);
            });

            const titleWrap = document.createElement("div");
            titleWrap.className = "history-item-head";

            const heading = document.createElement("h3");
            heading.textContent = chat.title;
            titleWrap.appendChild(heading);

            const time = document.createElement("time");
            time.textContent = chat.naming_in_progress ? "naming..." : formatRelativeTime(chat.updated_at);
            titleWrap.appendChild(time);

            const snippet = document.createElement("p");
            const lastMessage = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text : "";
            snippet.textContent = truncate(lastMessage, 66) || "New chat";

            button.appendChild(titleWrap);
            button.appendChild(snippet);
            historyListEl.appendChild(button);
          }
        }

        /* â”€â”€ Thinking indicator â”€â”€ */
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

        /* â”€â”€ Markdown renderer â”€â”€ */
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

            // Blank line â†’ paragraph break
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

        /* â”€â”€ Status â”€â”€ */
        function setBusy(isBusy) {
          runtimeStatusRef.busy = isBusy;
          composerStateRef.busy = isBusy;
          syncComposerAvailability();
          renderHistoryList();
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
          // No decision buttons while an async run is in flight
          if (state.pending_run_id) {
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

          if (state.schedule_pending === true && state.pending_schedule) {
            const freq = state.pending_schedule.frequency || "recurring";
            const tz = state.pending_schedule.timezone || "UTC";
            const kpiCount = Array.isArray(state.pending_schedule.kpi_watchlist)
              ? state.pending_schedule.kpi_watchlist.length
              : 0;
            const kpiNote = kpiCount > 0 ? " + " + kpiCount + " KPI alert" + (kpiCount === 1 ? "" : "s") : "";
            return {
              kind: "schedule-llm",
              title: "Schedule " + freq + " runs in " + tz + kpiNote + "?",
              lockPlaceholder: "Confirm or adjust the schedule.",
              options: [
                { label: "Yes, schedule this", command: "__ui_confirm_llm_schedule__" },
                { label: "Adjust schedule", command: "__ui_adjust_llm_schedule__" }
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
          newChatButtonEl.disabled = composerStateRef.busy;
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
                forceWhenLocked: true,
                trackForNaming: false
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
          // Start polling if there is a pending async run and we aren't already polling it.
          if (state && state.pending_run_id && activeRunPollId !== state.pending_run_id) {
            startRunPolling(state.pending_run_id);
          }
        }

        function buildRunCompleteMessage(execBrief, runId) {
          if (!execBrief) { return "Report executed. Run ID: " + runId + "."; }
          const lines = ["Report executed. Run ID: " + runId + "."];
          if (Array.isArray(execBrief.what_changed) && execBrief.what_changed.length > 0) {
            lines.push("\\n**What changed:** " + execBrief.what_changed.slice(0, 3).join(" · "));
          }
          if (Array.isArray(execBrief.so_what) && execBrief.so_what.length > 0) {
            lines.push("**So what:** " + execBrief.so_what.slice(0, 2).join(" · "));
          }
          if (Array.isArray(execBrief.what_to_do) && execBrief.what_to_do.length > 0) {
            lines.push("**Actions:** " + execBrief.what_to_do.slice(0, 2).join(" · "));
          }
          lines.push("\\nBefore PDF, choose one path: ask follow-up refinement questions (max 2), generate PDF now, or start a new conversation.");
          return lines.join("\\n");
        }

        function startRunPolling(runId) {
          activeRunPollId = runId;
          setBusy(true);
          composerStateRef.locked = true;
          syncComposerAvailability();
          showThinking("running");

          const POLL_INTERVAL_MS = 3000;
          const POLL_TIMEOUT_MS = 900000;   // 15 min hard ceiling
          const startedAt = Date.now();

          function abortPoll(reason) {
            if (activeRunPollId !== runId) { return; }
            activeRunPollId = null;
            if (stateRef.value) {
              stateRef.value = Object.assign({}, stateRef.value, { pending_run_id: null });
            }
            setActiveChatState(stateRef.value);
            appendMessage("assistant", reason, null, null, { trackForNaming: false });
            hideThinking();
            setBusy(false);
            composerStateRef.locked = false;
            syncComposerAvailability();
            refreshDecisionFromState(stateRef.value);
          }

          function poll() {
            if (activeRunPollId !== runId) { return; }   // cancelled (e.g. chat switched)

            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
              abortPoll("Report generation timed out. Please try running again.");
              return;
            }

            fetch("/api/run-status/" + encodeURIComponent(runId))
              .then(function(r) {
                var ok = r.ok;
                return r.text().then(function(t) { return { ok: ok, text: t }; });
              })
              .then(function(result) {
                if (activeRunPollId !== runId) { return; }
                if (!result.ok) {
                  // HTTP error (502/404): run not found or server unavailable — fail gracefully
                  abortPoll("Report run could not be found — it may have expired or the server was restarted. Please try running again.");
                  return;
                }
                var s;
                try { s = JSON.parse(result.text); } catch { setTimeout(poll, POLL_INTERVAL_MS); return; }

                if (s && s.status === "succeeded") {
                  activeRunPollId = null;
                  stateRef.value = Object.assign({}, stateRef.value, {
                    pending_run_id: null,
                    last_run_id: runId,
                    awaiting_post_run_refinement: true,
                    awaiting_pdf_confirmation: false,
                    refinement_active: false,
                    refinement_questions_remaining: 2,
                    pdf_download_url: s.pdf_path ? "/api/runs/" + runId + "/pdf" : null,
                    prepared_payloads: Array.isArray(s.prepared_payloads) ? s.prepared_payloads : []
                  });
                  setActiveChatState(stateRef.value);
                  refreshDecisionFromState(stateRef.value);
                  var msg = buildRunCompleteMessage(s.exec_brief, runId);
                  appendMessage("assistant", msg,
                    s.pdf_path ? "/api/runs/" + runId + "/pdf" : null,
                    s.exec_brief_html || null,
                    { trackForNaming: false,
                      prepared_payloads: Array.isArray(s.prepared_payloads) ? s.prepared_payloads : [] }
                  );
                  hideThinking();
                  setBusy(false);
                  composerStateRef.locked = false;
                  syncComposerAvailability();
                  updateQueriesBtn();
                  try { inputEl.focus(); } catch {}

                } else if (s && s.status === "failed") {
                  activeRunPollId = null;
                  stateRef.value = Object.assign({}, stateRef.value, { pending_run_id: null });
                  setActiveChatState(stateRef.value);
                  appendMessage("assistant",
                    "Report generation failed: " + (s.error || "Unknown error") + ". Please try running again.",
                    null, null, { trackForNaming: false }
                  );
                  hideThinking();
                  setBusy(false);
                  composerStateRef.locked = false;
                  syncComposerAvailability();
                  refreshDecisionFromState(stateRef.value);

                } else if (s && (s.status === "pending" || s.status === "running")) {
                  // still in progress — keep polling
                  setTimeout(poll, POLL_INTERVAL_MS);

                } else {
                  // unexpected/missing status — fail gracefully to unblock UI
                  abortPoll("Report run returned an unexpected status. Please try running again.");
                }
              })
              .catch(function() { setTimeout(poll, POLL_INTERVAL_MS); });   // network error — retry
          }

          setTimeout(poll, POLL_INTERVAL_MS);   // first poll after 3s
        }

        /* â”€â”€ Messages â”€â”€ */
                function renderMessageBubble(entry) {
          hideThinking();

          const bubble = document.createElement("div");
          bubble.className = "bubble " + entry.role;

          const content = document.createElement("div");
          if (entry.role === "assistant") {
            content.innerHTML = renderMarkdown(entry.text);
          } else {
            content.textContent = entry.text;
          }
          bubble.appendChild(content);

          if (entry.role === "assistant" && typeof entry.exec_brief_html === "string" && entry.exec_brief_html.length > 0) {
            const briefContainer = document.createElement("div");
            briefContainer.className = "exec-brief-embed";
            const frame = document.createElement("iframe");
            frame.setAttribute("srcdoc", entry.exec_brief_html);
            frame.setAttribute("sandbox", "allow-same-origin");
            frame.style.cssText = "display:block;width:100%;border:none;min-height:200px;height:500px;";
            frame.addEventListener("load", function () {
              try {
                const h = frame.contentDocument?.documentElement?.scrollHeight;
                if (h && h > 50) {
                  frame.style.height = Math.min(h + 24, 620) + "px";
                }
              } catch {}
            });
            briefContainer.appendChild(frame);
            bubble.appendChild(briefContainer);
          }

          if (entry.role === "assistant" && Array.isArray(entry.prepared_payloads) && entry.prepared_payloads.length > 0) {
            const toggleBtn = document.createElement("button");
            toggleBtn.className = "query-log-toggle";
            toggleBtn.textContent = "\u25BA View data queries (" + entry.prepared_payloads.length + ")";
            const queryLog = document.createElement("div");
            queryLog.className = "query-log";
            for (const payload of entry.prepared_payloads) {
              queryLog.appendChild(buildQueryCard(payload));
            }
            toggleBtn.addEventListener("click", function () {
              const open = queryLog.classList.toggle("open");
              toggleBtn.textContent = open
                ? "\u25BC Hide data queries (" + entry.prepared_payloads.length + ")"
                : "\u25BA View data queries (" + entry.prepared_payloads.length + ")";
            });
            bubble.appendChild(toggleBtn);
            bubble.appendChild(queryLog);
          }

          if (entry.role === "assistant" && typeof entry.download_url === "string" && entry.download_url.length > 0) {
            const link = document.createElement("a");
            link.href = entry.download_url;
            link.textContent = "Download PDF";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            bubble.appendChild(document.createElement("br"));
            bubble.appendChild(link);
          }

          messagesEl.appendChild(bubble);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function renderMessagesForActiveChat() {
          hideThinking();
          messagesEl.innerHTML = "";
          const active = getActiveChat();
          if (!active) {
            updateQueriesBtn();
            return;
          }
          for (const entry of active.messages) {
            renderMessageBubble(entry);
          }
          messagesEl.scrollTop = messagesEl.scrollHeight;
          updateQueriesBtn();
        }

        function collectPreparedPayloads(chat) {
          if (!chat) { return []; }
          var fromMessages = chat.messages.filter(function (m) { return Array.isArray(m.prepared_payloads) && m.prepared_payloads.length > 0; });
          if (fromMessages.length > 0) { return fromMessages; }
          // Fallback: messages don't carry payloads (old chats) but chat state does
          if (chat.state && Array.isArray(chat.state.prepared_payloads) && chat.state.prepared_payloads.length > 0) {
            return [{ prepared_payloads: chat.state.prepared_payloads }];
          }
          return [];
        }

        function collectSingleQueries(chat) {
          if (!chat || !chat.state || !Array.isArray(chat.state.single_query_log)) { return []; }
          return chat.state.single_query_log;
        }

        function updateQueriesBtn() {
          if (!queriesBarBtnEl) { return; }
          const chat = getActiveChat();
          const runs = collectPreparedPayloads(chat);
          const singleQueries = collectSingleQueries(chat);
          const totalQuestions = runs.reduce(function (sum, m) { return sum + m.prepared_payloads.length; }, 0) + singleQueries.length;
          if (totalQuestions === 0) {
            queriesBarBtnEl.textContent = "Queries";
            queriesBarBtnEl.classList.remove("has-queries");
          } else {
            queriesBarBtnEl.textContent = "\u25BA " + totalQuestions + " " + (totalQuestions === 1 ? "query" : "queries");
            queriesBarBtnEl.classList.add("has-queries");
          }
        }

        function openQueriesModal() {
          if (!queriesModalBodyEl) { return; }
          queriesModalBodyEl.innerHTML = "";
          const chat = getActiveChat();
          const runs = collectPreparedPayloads(chat);
          const singleQueries = collectSingleQueries(chat);
          const prepQ = runs.reduce(function (sum, m) { return sum + m.prepared_payloads.length; }, 0);
          const totalQ = prepQ + singleQueries.length;
          if (queriesModalTitleEl) {
            queriesModalTitleEl.textContent = "Queries" + (totalQ > 0 ? " \u00B7 " + totalQ + " total" : "");
          }

          if (totalQ === 0) {
            const empty = document.createElement("div");
            empty.style.cssText = "padding:36px 18px;color:#5580a8;font-size:0.78rem;text-align:center;";
            empty.textContent = "No queries have been run in this chat yet.";
            queriesModalBodyEl.appendChild(empty);
            queriesModalEl.classList.add("open");
            queriesModalBackdropEl.style.display = "block";
            return;
          }

          // --- Single queries section ---
          if (singleQueries.length > 0) {
            const sectionLabel = document.createElement("div");
            sectionLabel.style.cssText = "padding:10px 14px 4px;font-size:0.72rem;font-weight:600;color:#7caad0;text-transform:uppercase;letter-spacing:0.04em;";
            sectionLabel.textContent = "Single Queries (" + singleQueries.length + ")";
            queriesModalBodyEl.appendChild(sectionLabel);

            const sTable = document.createElement("table");
            sTable.className = "queries-table";
            const sThead = document.createElement("thead");
            const sHr = document.createElement("tr");
            ["#", "Question", "SQL Query", "Rows / Time"].forEach(function (h) {
              const th = document.createElement("th");
              th.textContent = h;
              sHr.appendChild(th);
            });
            sThead.appendChild(sHr);
            sTable.appendChild(sThead);
            const sTbody = document.createElement("tbody");
            for (var si = 0; si < singleQueries.length; si++) {
              var sq = singleQueries[si];
              const row = document.createElement("tr");

              const tdId = document.createElement("td");
              tdId.className = "qt-id";
              tdId.textContent = String(si + 1);
              row.appendChild(tdId);

              const tdQ = document.createElement("td");
              tdQ.className = "qt-why";
              const qDiv = document.createElement("div");
              qDiv.className = "qt-question";
              qDiv.textContent = sq.question || "";
              tdQ.appendChild(qDiv);
              const idDiv = document.createElement("div");
              idDiv.className = "qt-purpose";
              idDiv.textContent = "ID: " + (sq.query_id || "");
              tdQ.appendChild(idDiv);
              row.appendChild(tdQ);

              const tdSql = document.createElement("td");
              tdSql.className = "qt-sql";
              if (sq.governed_sql) {
                const pre = document.createElement("pre");
                pre.className = "qt-sql-code";
                pre.textContent = sq.governed_sql.trim();
                tdSql.appendChild(pre);
              } else {
                tdSql.style.color = "#4a6080";
                tdSql.textContent = "\u2014";
              }
              row.appendChild(tdSql);

              const tdMeta = document.createElement("td");
              tdMeta.className = "qt-output";
              tdMeta.textContent = (sq.row_count != null ? sq.row_count + " rows" : "") + (sq.elapsed_ms != null ? " \u00B7 " + sq.elapsed_ms + "ms" : "");
              row.appendChild(tdMeta);

              sTbody.appendChild(row);
            }
            sTable.appendChild(sTbody);
            queriesModalBodyEl.appendChild(sTable);
          }

          // --- Data prep queries section ---
          if (prepQ > 0) {
            if (singleQueries.length > 0) {
              const sectionLabel = document.createElement("div");
              sectionLabel.style.cssText = "padding:14px 14px 4px;font-size:0.72rem;font-weight:600;color:#7caad0;text-transform:uppercase;letter-spacing:0.04em;";
              sectionLabel.textContent = "Data Preparation Queries (" + prepQ + ")";
              queriesModalBodyEl.appendChild(sectionLabel);
            }

            const table = document.createElement("table");
            table.className = "queries-table";

            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");
            ["#", "Question / Why it ran", "SQL Query", "Sample Output"].forEach(function (h) {
              const th = document.createElement("th");
              th.textContent = h;
              headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement("tbody");
            var globalIdx = 1;

            for (var ri = 0; ri < runs.length; ri++) {
              var entry = runs[ri];
              if (runs.length > 1) {
                const groupRow = document.createElement("tr");
                groupRow.className = "qt-run-group";
                const groupTd = document.createElement("td");
                groupTd.colSpan = 4;
                groupTd.className = "qt-run-label";
                groupTd.textContent = "Run " + (ri + 1) + " \u00B7 " + entry.prepared_payloads.length + " " + (entry.prepared_payloads.length === 1 ? "query" : "queries");
                groupRow.appendChild(groupTd);
                tbody.appendChild(groupRow);
              }
              for (var qi = 0; qi < entry.prepared_payloads.length; qi++) {
                var p = entry.prepared_payloads[qi];
                const row = document.createElement("tr");

                // # column
                const tdId = document.createElement("td");
                tdId.className = "qt-id";
                tdId.textContent = String(globalIdx++);
                row.appendChild(tdId);

                // Question / Why it ran
                const tdWhy = document.createElement("td");
                tdWhy.className = "qt-why";
                const qTitle = document.createElement("div");
                qTitle.className = "qt-question";
                qTitle.textContent = p.question || "";
                tdWhy.appendChild(qTitle);
                if (p.purpose) {
                  const qPurpose = document.createElement("div");
                  qPurpose.className = "qt-purpose";
                  qPurpose.textContent = p.purpose;
                  tdWhy.appendChild(qPurpose);
                }
                row.appendChild(tdWhy);

                // SQL Query
                const tdSql = document.createElement("td");
                tdSql.className = "qt-sql";
                const sqls = p.preparation_sqls || [];
                if (sqls.length > 0) {
                  const pre = document.createElement("pre");
                  pre.className = "qt-sql-code";
                  pre.textContent = sqls[0].trim();
                  tdSql.appendChild(pre);
                } else {
                  tdSql.style.color = "#4a6080";
                  tdSql.textContent = "\u2014";
                }
                row.appendChild(tdSql);

                // Sample Output
                const tdOutput = document.createElement("td");
                tdOutput.className = "qt-output";
                const sampleRows = p.sample_rows || [];
                if (sampleRows.length > 0) {
                  const cols = Object.keys(sampleRows[0]);
                  const miniTable = document.createElement("table");
                  miniTable.className = "qc-sample-table";
                  const mThead = document.createElement("thead");
                  const mHr = document.createElement("tr");
                  cols.forEach(function (col) {
                    const th = document.createElement("th");
                    th.textContent = col;
                    mHr.appendChild(th);
                  });
                  mThead.appendChild(mHr);
                  miniTable.appendChild(mThead);
                  const mTbody = document.createElement("tbody");
                  sampleRows.forEach(function (rowData) {
                    const tr = document.createElement("tr");
                    cols.forEach(function (col) {
                      const td = document.createElement("td");
                      const val = rowData[col];
                      td.textContent = val == null ? "" : String(val);
                      tr.appendChild(td);
                    });
                    mTbody.appendChild(tr);
                  });
                  miniTable.appendChild(mTbody);
                  tdOutput.appendChild(miniTable);
                } else {
                  tdOutput.style.color = "#4a6080";
                  tdOutput.textContent = "\u2014";
                }
                row.appendChild(tdOutput);

                tbody.appendChild(row);
              }
            }

            table.appendChild(tbody);
            queriesModalBodyEl.appendChild(table);
          }

          queriesModalEl.classList.add("open");
          queriesModalBackdropEl.style.display = "block";
        }

        function closeQueriesModal() {
          if (queriesModalEl) { queriesModalEl.classList.remove("open"); }
          if (queriesModalBackdropEl) { queriesModalBackdropEl.style.display = "none"; }
        }

        function buildQueryCard(payload) {
          const card = document.createElement("div");
          card.className = "query-card";

          const title = document.createElement("div");
          title.className = "query-card-title";
          const label = payload.question_number != null ? "Q" + payload.question_number + ". " : "";
          title.textContent = label + (payload.question || "");
          card.appendChild(title);

          if (payload.purpose) {
            const purpose = document.createElement("div");
            purpose.className = "query-card-purpose";
            purpose.textContent = payload.purpose;
            card.appendChild(purpose);
          }

          const meta = document.createElement("div");
          meta.className = "query-card-meta";
          meta.innerHTML = "<span>Raw rows: <strong>" + (payload.row_count_before_reduction ?? "?") + "</strong></span><span>Prepared: <strong>" + (payload.prepared_row_count ?? "?") + "</strong></span>";
          if (payload.warnings && payload.warnings.length > 0) {
            const warn = document.createElement("span");
            warn.style.color = "#f59e0b";
            warn.textContent = "\u26A0 " + payload.warnings[0];
            meta.appendChild(warn);
          }
          card.appendChild(meta);

          const sqls = payload.preparation_sqls || [];
          for (const sql of sqls.slice(0, 3)) {
            const pre = document.createElement("pre");
            pre.className = "qc-sql";
            pre.textContent = sql.trim();
            card.appendChild(pre);
          }

          const monthlyRows = payload.validation?.monthly_row_counts || [];
          if (monthlyRows.length > 0) {
            const dotsLabel = document.createElement("div");
            dotsLabel.style.cssText = "color:#5580a8;font-size:0.7rem;margin-bottom:3px;";
            dotsLabel.textContent = "Monthly coverage:";
            card.appendChild(dotsLabel);
            const dots = document.createElement("div");
            dots.className = "coverage-dots";
            for (const m of monthlyRows) {
              const dot = document.createElement("div");
              dot.className = "coverage-dot";
              dot.style.background = m.row_count > 0 ? "#16a34a" : "#dc2626";
              dot.title = m.month + ": " + m.row_count + " rows";
              dots.appendChild(dot);
            }
            card.appendChild(dots);
          }

          const sampleRows = payload.sample_rows || [];
          if (sampleRows.length > 0) {
            const cols = Object.keys(sampleRows[0]);
            const sampleSection = document.createElement("div");
            sampleSection.className = "qc-sample-rows";
            const sampleLabel = document.createElement("div");
            sampleLabel.className = "qc-sample-rows-label";
            sampleLabel.textContent = "Sample output (" + sampleRows.length + " row" + (sampleRows.length !== 1 ? "s" : "") + "):";
            sampleSection.appendChild(sampleLabel);
            const table = document.createElement("table");
            table.className = "qc-sample-table";
            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");
            for (const col of cols) {
              const th = document.createElement("th");
              th.textContent = col;
              headerRow.appendChild(th);
            }
            thead.appendChild(headerRow);
            table.appendChild(thead);
            const tbody = document.createElement("tbody");
            for (const row of sampleRows) {
              const tr = document.createElement("tr");
              for (const col of cols) {
                const td = document.createElement("td");
                const val = row[col];
                td.textContent = val == null ? "" : String(val);
                tr.appendChild(td);
              }
              tbody.appendChild(tr);
            }
            table.appendChild(tbody);
            sampleSection.appendChild(table);
            card.appendChild(sampleSection);
          }

          return card;
        }

        function appendMessage(role, text, downloadUrl, execBriefHtml, options) {
          const opts = options || {};
          const targetChatId = opts.chatId || activeChatIdRef.value;
          const target = getChatById(targetChatId);
          if (!target) {
            return;
          }

          const messageEntry = {
            role,
            text: String(text || ""),
            download_url: typeof downloadUrl === "string" && downloadUrl.length > 0 ? downloadUrl : null,
            exec_brief_html: typeof execBriefHtml === "string" && execBriefHtml.length > 0 ? execBriefHtml : null,
            prepared_payloads: Array.isArray(opts.prepared_payloads) ? opts.prepared_payloads : null,
            at: nowIso()
          };

          target.messages.push(messageEntry);
          if (target.messages.length > 160) {
            target.messages = target.messages.slice(-160);
          }

          if (
            role === "user" &&
            opts.trackForNaming !== false &&
            !UI_CONTROL_MESSAGE_PATTERN.test(String(opts.rawUserMessage || text || "").trim())
          ) {
            const rawUserMessage = String(opts.rawUserMessage || text || "").trim();
            if (rawUserMessage.length > 0) {
              target.user_messages.push(rawUserMessage);
              if (target.user_messages.length > 8) {
                target.user_messages = target.user_messages.slice(-8);
              }
              void maybeNameChat(target.id);
            }
          }

          touchChat(target);
          saveChatsToStorage();
          renderHistoryList();
          if (target.id === activeChatIdRef.value) {
            renderSessionTitle();
            renderMessageBubble(messageEntry);
            updateQueriesBtn();
          }
        }

        /* â”€â”€ Submit â”€â”€ */
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

          appendMessage("user", displayMessage, null, null, {
            trackForNaming: opts.trackForNaming !== false,
            rawUserMessage: value
          });
          setBusy(true);
          const isRunConfirm = /^(confirm|yes|go ahead|proceed|looks good|lgtm|run it|do it|execute|approved|ok|okay|sure|start)\\b/i.test(value);
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

            let payload;
            try {
              payload = JSON.parse(await response.text());
            } catch {
              appendMessage("assistant", "Server error — please try again in a moment.", null, null, { trackForNaming: false });
              return;
            }
            if (!response.ok) {
              const errorText = payload && typeof payload.message === "string" ? payload.message : "Chat request failed";
              appendMessage("assistant", "Error: " + errorText);
              return;
            }

            stateRef.value = payload.state;
            setActiveChatState(payload.state);
            refreshDecisionFromState(stateRef.value);
            appendMessage("assistant", payload.assistant_message, payload.pdf_download_url, payload.exec_brief_html, {
              trackForNaming: false,
              prepared_payloads: Array.isArray(payload.prepared_payloads) ? payload.prepared_payloads : (payload.state && Array.isArray(payload.state.prepared_payloads) ? payload.state.prepared_payloads : null)
            });
          } catch (error) {
            const errorText = error instanceof Error ? error.message : "Unknown error";
            appendMessage("assistant", "Network error: " + errorText, null, null, {
              trackForNaming: false
            });
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
            let payload;
            try { payload = JSON.parse(await response.text()); } catch { runtimeStatusRef.mode = "provider unavailable"; renderStatus(); return; }
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

        /* â”€â”€ DB context bootstrap â”€â”€ */
        function createStateFromDbContext(payload) {
          const allowedRelations = Array.isArray(payload.allowed_relations) ? payload.allowed_relations : [];
          const allowedSchemas = Array.isArray(payload.allowed_schemas) ? payload.allowed_schemas : [];
          const defaultRelation = allowedRelations.length > 0 ? allowedRelations[0] : null;

          return {
            draft: {
              name: "",
              audience: "Executive",
              timezone: "UTC",
              schedule_cron: null,
              sql_template: defaultRelation ? "SELECT * FROM " + defaultRelation : "SELECT 1",
              metric_ids: [],
              dimension_ids: [],
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
        }

        async function bootstrapDbContextForChat(chatId) {
          const chat = getChatById(chatId);
          if (!chat || chat.db_bootstrapped) {
            return;
          }

          try {
            const response = await fetch("/api/db/context", { method: "GET" });
            let payload;
            try { payload = JSON.parse(await response.text()); } catch { return; }
            if (response.ok && payload && payload.connected === true) {
              chat.state = createStateFromDbContext(payload);
              if (chat.messages.length <= 1) {
                appendMessage(
                  "assistant",
                  "I see you have a database connected with **" + payload.allowed_relations.length + " table" + (payload.allowed_relations.length === 1 ? "" : "s") + "** available. Tell me what you'd like to analyze and I'll get started!",
                  null,
                  null,
                  { chatId: chat.id, trackForNaming: false }
                );
              }
            }
          } catch {
            // Ignore optional context bootstrap failures.
          } finally {
            chat.db_bootstrapped = true;
            touchChat(chat);
            saveChatsToStorage();
            if (chat.id === activeChatIdRef.value) {
              stateRef.value = cloneJson(chat.state);
              refreshDecisionFromState(stateRef.value);
              renderSessionTitle();
            }
            renderHistoryList();
          }
        }

        async function maybeNameChat(chatId) {
          const chat = getChatById(chatId);
          if (!chat || chat.naming_in_progress || chat.title_auto !== true) {
            return;
          }

          const messages = chat.user_messages
            .map((entry) => String(entry || "").trim())
            .filter((entry) => entry.length > 0)
            .slice(0, 2);
          if (messages.length < 2) {
            return;
          }

          chat.naming_in_progress = true;
          saveChatsToStorage();
          renderHistoryList();

          try {
            const response = await fetch("/api/chat/name", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ messages })
            });
            let payload;
            try { payload = JSON.parse(await response.text()); } catch { return; }
            if (!response.ok || !payload || typeof payload.title !== "string") {
              return;
            }
            const target = getChatById(chatId);
            if (!target || target.title_auto !== true) {
              return;
            }
            target.title = sanitizeTitle(payload.title);
            target.title_auto = false;
            touchChat(target);
          } catch {
            // keep fallback title
          } finally {
            const target = getChatById(chatId);
            if (target) {
              target.naming_in_progress = false;
              saveChatsToStorage();
              renderHistoryList();
              if (target.id === activeChatIdRef.value) {
                renderSessionTitle();
              }
            }
          }
        }

        function activateChat(chatId) {
          const target = getChatById(chatId);
          if (!target) {
            return;
          }
          activeChatIdRef.value = chatId;
          stateRef.value = cloneJson(target.state);
          renderSessionTitle();
          renderHistoryList();
          renderMessagesForActiveChat();
          refreshDecisionFromState(stateRef.value);
          void bootstrapDbContextForChat(chatId);
        }

        function createNewChatAndActivate() {
          const session = createEmptyChatSession();
          chatsRef.value.unshift(session);
          if (chatsRef.value.length > MAX_STORED_CHATS) {
            chatsRef.value = chatsRef.value.slice(0, MAX_STORED_CHATS);
          }
          activeChatIdRef.value = session.id;
          saveChatsToStorage();
          activateChat(session.id);
        }

        function initializeSessions() {
          const stored = loadChatsFromStorage();
          if (stored.length === 0) {
            const session = createEmptyChatSession();
            chatsRef.value = [session];
            activeChatIdRef.value = session.id;
            saveChatsToStorage();
          } else {
            chatsRef.value = stored;
            activeChatIdRef.value = stored[0].id;
          }
          activateChat(activeChatIdRef.value);
        }

        async function hydrateSessionsFromServer() {
          const remote = await loadChatsFromServer();
          if (remote.length === 0) {
            if (chatsRef.value.length > 0) {
              void syncChatsToServer();
            }
            return;
          }

          chatsRef.value = remote;
          activeChatIdRef.value = remote[0].id;
          saveChatsToStorage(true);
          activateChat(activeChatIdRef.value);
        }

        /* -- Queries modal wiring -- */
        if (queriesBarBtnEl) {
          queriesBarBtnEl.addEventListener("click", openQueriesModal);
        }
        if (queriesModalBackdropEl) {
          queriesModalBackdropEl.addEventListener("click", closeQueriesModal);
        }
        var queriesModalCloseEl = document.getElementById("queries-modal-close");
        if (queriesModalCloseEl) {
          queriesModalCloseEl.addEventListener("click", closeQueriesModal);
        }
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape") { closeQueriesModal(); }
        });

        /* â”€â”€ Init â”€â”€ */
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

        newChatButtonEl.addEventListener("click", () => {
          if (runtimeStatusRef.busy) {
            return;
          }
          createNewChatAndActivate();
          if (!composerStateRef.locked) {
            inputEl.focus();
          }
        });

        initializeSessions();
        void hydrateSessionsFromServer();
        refreshDecisionFromState(stateRef.value);
        renderStatus();
        loadRuntimeStatus();
        if (!composerStateRef.locked) {
          inputEl.focus();
        }
      })();
    </script>
  </body>
</html>`;
}
