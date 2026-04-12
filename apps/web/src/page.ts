import { renderClaritectFaviconLinks, renderClaritectLogoImage } from "./brand";

export function renderChatPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect | Decision workspace</title>
    ${renderClaritectFaviconLinks()}
    <script>
      (function(){try{var t=localStorage.getItem("claritect_theme_v1");if(t==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})();
    </script>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");

      :root {
        --ink: #F5F3FF;
        --ink-soft: #D7CFE6;
        --ink-muted: #9D90BC;
        --panel: rgba(20, 15, 34, 0.92);
        --panel-2: rgba(26, 18, 42, 0.96);
        --panel-3: rgba(31, 21, 49, 0.94);
        --line: rgba(107, 92, 138, 0.28);
        --line-soft: rgba(236, 72, 153, 0.24);
        --accent: #6C3AED;
        --accent-2: #EC4899;
        --accent-3: #EC4899;
        --accent-soft: rgba(108, 58, 237, 0.16);
        --glow: rgba(236, 72, 153, 0.22);
        --shadow: 0 24px 60px rgba(10, 6, 20, 0.48);
        --shadow-soft: 0 12px 32px rgba(10, 6, 20, 0.32);
      }

      * {
        box-sizing: border-box;
      }

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
        z-index: 0;
        pointer-events: none;
        background-image: linear-gradient(
          to right,
          rgba(107, 92, 138, 0.08) 1px,
          transparent 1px
        );
        background-size: 60px 60px;
        mask-image: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.86), transparent 92%);
        opacity: 0.52;
      }

      body::after {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 18% 22%, rgba(108, 58, 237, 0.18), transparent 20%),
          radial-gradient(circle at 78% 16%, rgba(236, 72, 153, 0.18), transparent 24%);
        filter: none;
        opacity: 0.38;
      }

      .page {
        position: relative;
        z-index: 1;
        width: 100%;
        margin: 0;
        min-height: 100vh;
        height: 100vh;
        overflow: hidden;
        padding: 14px;
      }

      .layout {
        display: grid;
        grid-template-columns: 212px 272px 1fr;
        gap: 14px;
        height: calc(100vh - 28px);
        min-height: calc(100vh - 28px);
        transition: grid-template-columns 220ms ease, gap 220ms ease;
      }

      .layout.history-collapsed {
        grid-template-columns: 212px 72px 1fr;
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
        border: 1px solid rgba(107, 92, 138, 0.5);
        border-radius: 8px;
        background: rgba(34, 25, 56, 0.94);
        color: #F5F3FF;
        padding: 6px 12px;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.75rem;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }

      .logout-btn:hover {
        background: rgba(108, 58, 237, 0.2);
        border-color: rgba(108, 58, 237, 0.6);
      }

      .history-panel {
        position: relative;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(20, 15, 34, 0.98), rgba(17, 12, 28, 0.98));
        box-shadow: var(--shadow);
        backdrop-filter: none;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px 14px 12px;
        height: calc(100vh - 28px);
        min-height: 0;
        overflow: hidden;
        transition: width 220ms ease, padding 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
      }

      .history-panel::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 24%),
          radial-gradient(circle at 100% 0%, rgba(108, 58, 237, 0.16), transparent 28%);
      }

      .history-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 10px 10px 12px;
        margin-bottom: 2px;
        border-radius: 16px;
        border-bottom: 1px solid rgba(107, 92, 138, 0.22);
        position: relative;
        z-index: 1;
      }

      .history-title-copy {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .history-kicker {
        font-size: 0.58rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }

      .history-title strong {
        font-size: 1rem;
        letter-spacing: 0.02em;
      }

      .new-chat-btn {
        appearance: none;
        border: 1px solid rgba(125, 160, 232, 0.18);
        border-radius: 999px;
        width: 30px;
        height: 30px;
        font-size: 0.92rem;
        line-height: 1;
        cursor: pointer;
        color: #F5F3FF;
        background: rgba(28, 66, 150, 0.96);
        box-shadow: 0 10px 20px rgba(38, 78, 164, 0.2);
      }

      .history-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .history-toggle-btn {
        appearance: none;
        border: 1px solid rgba(125, 160, 232, 0.18);
        border-radius: 999px;
        width: 30px;
        height: 30px;
        font-size: 0.88rem;
        line-height: 1;
        cursor: pointer;
        color: #F5F3FF;
        background: rgba(12, 31, 78, 0.9);
        box-shadow: 0 10px 20px rgba(19, 36, 85, 0.18);
        transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
      }

      .history-toggle-btn:hover {
        transform: translateY(-1px);
        border-color: rgba(132, 183, 255, 0.3);
        background: rgba(20, 43, 98, 0.94);
      }

      .new-chat-btn:disabled {
        opacity: 0.6;
        cursor: wait;
      }

      .history-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow-y: scroll;
        padding-right: 2px;
        flex: 1;
        min-height: 0;
        scrollbar-gutter: stable;
        scrollbar-width: thin;
        scrollbar-color: rgba(108, 58, 237, 0.68) rgba(24, 18, 39, 0.88);
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .history-list::-webkit-scrollbar {
        width: 8px;
      }

      .history-list::-webkit-scrollbar-thumb {
        background: rgba(108, 58, 237, 0.72);
        border-radius: 999px;
      }

      .history-empty {
        border: 1px dashed rgba(107, 92, 138, 0.28);
        border-radius: 16px;
        padding: 14px;
        color: var(--ink-soft);
        font-size: 0.74rem;
        background: rgba(24, 18, 39, 0.46);
      }

      .history-item {
        width: 100%;
        text-align: left;
        padding: 12px 12px 11px;
        border-radius: 16px;
        border: 1px solid rgba(107, 92, 138, 0.18);
        background: rgba(31, 21, 49, 0.92);
        color: inherit;
        cursor: pointer;
        transition: border-color 130ms ease, transform 130ms ease, background 130ms ease, box-shadow 130ms ease;
        box-shadow: var(--shadow-soft);
      }

      .history-item.active {
        border-color: rgba(236, 72, 153, 0.24);
        background: rgba(108, 58, 237, 0.28);
        box-shadow:
          inset 0 0 0 1px rgba(245, 243, 255, 0.08),
          0 16px 30px rgba(108, 58, 237, 0.2);
      }

      .history-item:hover {
        transform: translateY(-1px);
        border-color: rgba(107, 92, 138, 0.26);
      }

      .history-item-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .history-item h3 {
        margin: 0;
        font-size: 0.84rem;
        font-weight: 600;
      }

      .history-item time {
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        color: var(--ink-muted);
        font-size: 0.65rem;
      }

      .history-item p {
        margin: 6px 0 0;
        color: var(--ink-soft);
        font-size: 0.72rem;
      }

      .layout.history-collapsed .history-panel {
        padding: 14px 10px 12px;
      }

      .layout.history-collapsed .history-title {
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        padding: 10px 4px 6px;
        border-bottom: none;
      }

      .layout.history-collapsed .history-title-copy {
        opacity: 0;
        transform: translateX(-8px);
        pointer-events: none;
        position: absolute;
      }

      .layout.history-collapsed .history-actions {
        flex-direction: column;
        gap: 10px;
        width: 100%;
      }

      .layout.history-collapsed .new-chat-btn,
      .layout.history-collapsed .history-toggle-btn {
        width: 36px;
        height: 36px;
      }

      .layout.history-collapsed .history-list {
        opacity: 0;
        transform: translateX(-10px);
        pointer-events: none;
      }

      .layout.history-collapsed .history-panel::after {
        content: "Chats";
        position: absolute;
        top: 98px;
        left: 50%;
        transform: translateX(-50%) rotate(180deg);
        writing-mode: vertical-rl;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.62rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #9D90BC;
      }

      .chat-shell {
        position: relative;
        border: 1px solid var(--line);
        border-radius: 32px;
        background:
          linear-gradient(180deg, rgba(5, 12, 34, 0.98), rgba(3, 10, 26, 0.99)),
          radial-gradient(circle at 80% 0%, rgba(113, 122, 255, 0.12), transparent 24%);
        box-shadow: var(--shadow);
        backdrop-filter: none;
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: calc(100vh - 28px);
        overflow: hidden;
        animation: shell-reveal 360ms ease;
      }

      .chat-shell::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 18%),
          radial-gradient(circle at 100% 0%, rgba(104, 167, 255, 0.12), transparent 26%);
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
        padding: 14px 20px;
        border-bottom: 1px solid rgba(126, 160, 227, 0.12);
        background: linear-gradient(180deg, rgba(8, 19, 48, 0.94), rgba(7, 18, 44, 0.88));
        position: relative;
        z-index: 1;
      }

      .chat-head-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chat-head-mark {
        width: 44px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .chat-head-mark img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        filter: drop-shadow(0 8px 18px rgba(118, 93, 255, 0.2));
      }

      .chat-head-copy strong {
        display: block;
        font-size: 1rem;
        letter-spacing: 0.01em;
      }

      .chat-subtitle {
        display: block;
        margin-top: 1px;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
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
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.72rem;
        cursor: default;
      }

      .status {
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.62rem;
        color: var(--ink-soft);
        padding: 6px 10px 5px;
        border-radius: 999px;
        border: 1px solid rgba(107, 92, 138, 0.28);
        background: rgba(39, 28, 63, 0.94);
      }

      .messages {
        padding: 18px 22px 16px;
        overflow-y: auto;
        min-height: 0;
        background:
          linear-gradient(180deg, rgba(3, 10, 29, 0.98), rgba(2, 8, 24, 0.99)),
          radial-gradient(circle at 100% 0%, rgba(91, 118, 255, 0.08), transparent 22%);
      }

        .messages.empty {
          display: grid;
          align-content: start;
        }

        .chat-empty-state {
          width: min(760px, 100%);
          padding: 18px 20px;
          border-radius: 22px;
          border: 1px solid rgba(118, 152, 226, 0.16);
          background:
            linear-gradient(180deg, rgba(31, 21, 49, 0.92), rgba(24, 18, 39, 0.94)),
            radial-gradient(circle at 0% 0%, rgba(112, 178, 255, 0.1), transparent 28%);
          box-shadow: var(--shadow-soft);
        }

        .chat-empty-state strong {
          display: block;
          font-size: 1rem;
          letter-spacing: -0.01em;
        }

        .chat-empty-state p {
          margin: 10px 0 0;
          color: var(--ink-soft);
          line-height: 1.6;
          font-size: 0.9rem;
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
        max-width: min(88%, 980px);
        margin-bottom: 13px;
        padding: 14px 16px;
        border-radius: 20px;
        line-height: 1.6;
        word-break: break-word;
        font-size: 0.91rem;
      }

      .bubble.user {
        margin-left: auto;
        color: #F5F3FF;
        background: #3f63d8;
        border: 1px solid rgba(153, 184, 255, 0.28);
        box-shadow:
          0 14px 30px rgba(36, 56, 128, 0.28),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);
        white-space: pre-wrap;
        text-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
      }

      .bubble.assistant {
        background: linear-gradient(160deg, rgba(31, 21, 49, 0.96), rgba(24, 18, 39, 0.96));
        border: 1px solid rgba(122, 156, 225, 0.14);
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
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.83em;
        background: rgba(106, 129, 209, 0.2);
        padding: 1px 6px;
        border-radius: 5px;
      }

      .bubble.assistant pre.md-code {
        margin: 8px 0 10px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(40, 69, 142, 0.55);
        background: rgba(4, 14, 38, 0.9);
        color: #b8cff1;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.8rem;
        line-height: 1.5;
        overflow-x: auto;
        white-space: pre;
      }

      .bubble.assistant pre.md-code code {
        background: transparent;
        padding: 0;
        border-radius: 0;
        font-size: 1em;
      }

      .bubble.assistant table.chat-md-table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0 10px;
        font-size: 0.79rem;
        display: block;
        overflow-x: auto;
        white-space: nowrap;
      }

      .bubble.assistant table.chat-md-table thead th {
        background: rgba(34, 61, 126, 0.45);
        color: #bfd7fb;
        padding: 6px 10px;
        border-bottom: 1px solid rgba(52, 84, 162, 0.7);
        text-align: left;
        font-weight: 600;
      }

      .bubble.assistant table.chat-md-table tbody td {
        color: #c7d9f2;
        padding: 5px 10px;
        border-bottom: 1px solid rgba(37, 63, 126, 0.35);
        max-width: 280px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .bubble.assistant table.chat-md-table tbody tr:last-child td {
        border-bottom: none;
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
        margin: 6px 0 10px 18px;
        padding-left: 0;
      }

      .bubble.assistant li {
        margin-bottom: 6px;
      }

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

      .exec-brief-actions {
        margin-top: 8px;
      }

      .exec-brief-actions,
      .schedule-footer-actions,
      .decision-actions {
        display: flex;
        flex-wrap: nowrap;
        gap: 10px;
        align-items: stretch;
      }

      .exec-brief-actions a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 1 1 0;
        padding: 5px 10px;
        border-radius: 10px;
        border: 1px solid rgba(93, 143, 232, 0.35);
        background: rgba(14, 27, 63, 0.65);
        color: #b9d2ff;
        font-size: 0.75rem;
        text-decoration: none;
        text-align: center;
        min-height: 40px;
        width: auto;
      }

      .exec-brief-actions a:hover {
        border-color: rgba(120, 171, 255, 0.65);
        color: #dce9ff;
        background: rgba(26, 51, 106, 0.7);
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
        border-top: 1px solid rgba(126, 160, 227, 0.1);
        padding: 16px 20px 20px;
        background:
          linear-gradient(180deg, rgba(6, 16, 43, 0.98), rgba(4, 12, 31, 0.99)),
          radial-gradient(circle at 100% 0%, rgba(94, 129, 255, 0.08), transparent 24%);
      }

      .queries-bar-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid rgba(93, 143, 232, 0.18);
        background: rgba(11, 27, 63, 0.54);
        color: #8dafdd;
        border-radius: 999px;
        padding: 6px 12px;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
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
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
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

      .schedule-modal-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(2, 8, 23, 0.82);
        z-index: 202;
      }

      .schedule-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 203;
        align-items: center;
        justify-content: center;
        padding: 22px;
      }

      .schedule-modal.open {
        display: flex;
      }

      .schedule-modal-panel {
        width: min(1160px, 96vw);
        max-height: 88vh;
        border-radius: 22px;
        border: 1px solid rgba(67, 110, 208, 0.45);
        background: linear-gradient(180deg, rgba(7, 19, 49, 0.98), rgba(4, 12, 31, 0.99));
        box-shadow: 0 32px 70px rgba(0, 0, 0, 0.55);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .schedule-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 20px 16px;
        border-bottom: 1px solid rgba(74, 110, 192, 0.24);
        background: linear-gradient(180deg, rgba(12, 29, 71, 0.8), rgba(8, 19, 49, 0.7));
      }

      .schedule-modal-title {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .schedule-modal-title strong {
        font-size: 1rem;
      }

      .schedule-modal-title span {
        color: var(--ink-soft);
        font-size: 0.82rem;
        line-height: 1.5;
      }

      .schedule-modal-close {
        border: 1px solid rgba(96, 129, 207, 0.24);
        border-radius: 12px;
        background: rgba(17, 37, 84, 0.88);
        color: #d6e5ff;
        width: 36px;
        height: 36px;
        cursor: pointer;
      }

      .schedule-modal-body {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
        gap: 16px;
        padding: 18px;
        overflow: auto;
      }

      .schedule-form-section,
      .schedule-preview-section {
        border: 1px solid rgba(85, 121, 203, 0.16);
        border-radius: 20px;
        background: rgba(8, 21, 52, 0.78);
        padding: 16px;
      }

      .schedule-form-section h3,
      .schedule-preview-section h3 {
        margin: 0 0 6px;
        font-size: 0.95rem;
      }

      .schedule-form-section p,
      .schedule-preview-section p {
        margin: 0 0 14px;
        color: var(--ink-soft);
        font-size: 0.82rem;
        line-height: 1.6;
      }

      .schedule-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 14px;
      }

      .schedule-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .schedule-field label {
        font-size: 0.68rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }

      .schedule-field input,
      .schedule-field select,
      .schedule-field textarea {
        width: 100%;
        border-radius: 14px;
        border: 1px solid rgba(88, 125, 210, 0.22);
        background: rgba(6, 16, 40, 0.94);
        color: var(--ink);
        padding: 11px 12px;
        font: inherit;
      }

      .schedule-field textarea {
        min-height: 94px;
        resize: vertical;
      }

      .schedule-questions {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .schedule-question-card,
      .schedule-preview-card {
        border-radius: 16px;
        border: 1px solid rgba(88, 125, 210, 0.16);
        background: rgba(4, 13, 34, 0.88);
        padding: 12px 13px;
      }

      .schedule-question-card strong,
      .schedule-preview-card strong {
        display: block;
        margin-bottom: 7px;
        font-size: 0.82rem;
      }

      .schedule-question-card small,
      .schedule-preview-card small {
        display: block;
        margin-bottom: 8px;
        color: var(--ink-soft);
        line-height: 1.55;
        font-size: 0.75rem;
      }

      .schedule-modal-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 18px;
        border-top: 1px solid rgba(74, 110, 192, 0.24);
        background: rgba(5, 13, 33, 0.92);
      }

      .schedule-footer-note {
        color: var(--ink-soft);
        font-size: 0.78rem;
      }

      .schedule-btn {
        border-radius: 14px;
        padding: 10px 14px;
        border: 1px solid rgba(88, 125, 210, 0.18);
        background: rgba(11, 28, 67, 0.82);
        color: var(--ink);
        cursor: pointer;
        font-weight: 700;
        width: auto;
        min-height: 46px;
        flex: 1 1 0;
      }

      .schedule-btn.primary {
        border-color: rgba(138, 184, 255, 0.34);
        background: rgba(79, 112, 255, 0.96);
      }

      .schedule-inline-hidden {
        display: none;
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
        gap: 12px;
        padding: 10px;
        border: 1px solid rgba(126, 160, 227, 0.14);
        border-radius: 22px;
        background: rgba(8, 19, 46, 0.78);
        box-shadow: var(--shadow-soft);
      }

      .composer textarea {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgba(126, 160, 227, 0.16);
        padding: 14px 15px 13px;
        min-height: 52px;
        background: rgba(24, 18, 39, 0.92);
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
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
        border: 1px solid rgba(149, 186, 255, 0.32);
        border-radius: 16px;
        width: 70px;
        min-height: 52px;
        cursor: pointer;
        color: #ffffff;
        background: #4f87ff;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-weight: 700;
        letter-spacing: 0;
        box-shadow: 0 14px 30px var(--glow);
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
        border: 1px solid rgba(126, 160, 227, 0.14);
        background: rgba(8, 23, 58, 0.74);
        border-radius: 18px;
        padding: 13px 14px;
        box-shadow: var(--shadow-soft);
      }

      .decision-panel.hidden {
        display: none;
      }

      .decision-title {
        font-size: 0.8rem;
        color: var(--ink-soft);
        margin-bottom: 9px;
      }

      .decision-btn {
        border: 1px solid rgba(127, 143, 255, 0.48);
        border-radius: 999px;
        background: #4c40ff;
        color: #ffffff;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.73rem;
        padding: 7px 12px;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(84, 73, 255, 0.3);
        transition: transform 120ms ease, filter 120ms ease;
        width: auto;
        min-height: 54px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        flex: 1 1 0;
      }

      .decision-btn:hover {
        transform: translateY(-1px);
        filter: saturate(1.06);
      }

      @media (max-width: 1200px) {
        .page {
          width: 100%;
          margin: 0;
          padding: 0;
        }

        .layout {
          grid-template-columns: 1fr;
          gap: 0;
          height: 100vh;
          min-height: 100vh;
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
          min-height: 100vh;
        }
      }

      @media (max-width: 900px) {
        .chat-shell {
          min-height: 100vh;
          border-radius: 0;
        }

        .messages {
          padding: 14px;
          min-height: 0;
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

        .exec-brief-actions,
        .schedule-footer-actions,
        .decision-actions {
          flex-direction: column;
        }
      }

      /* ── Theme toggle button ── */
      .theme-toggle-btn {
        display: flex;
        align-items: center;
        gap: 7px;
        width: 100%;
        padding: 9px 12px;
        border: 1px solid rgba(107, 92, 138, 0.22);
        border-radius: 12px;
        background: rgba(24, 18, 39, 0.84);
        color: var(--ink-soft);
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .theme-toggle-btn:hover {
        background: rgba(108, 58, 237, 0.14);
        border-color: rgba(108, 58, 237, 0.4);
        color: var(--ink);
      }
      .theme-toggle-icon {
        font-size: 0.88rem;
        flex-shrink: 0;
      }

      /* ─────────────────────────────────────────
         LIGHT MODE  [data-theme="light"]
         ───────────────────────────────────────── */
      [data-theme="light"] {
        --ink: #0F0B1A;
        --ink-soft: #4C475E;
        --ink-muted: #7A748F;
        --panel: rgba(239, 239, 250, 0.96);
        --panel-2: rgba(231, 229, 244, 0.98);
        --panel-3: rgba(237, 234, 248, 0.96);
        --line: #DDD9EB;
        --line-soft: rgba(219, 39, 119, 0.18);
        --accent: #7C3AED;
        --accent-2: #DB2777;
        --accent-3: #DB2777;
        --accent-soft: rgba(124, 58, 237, 0.10);
        --glow: rgba(219, 39, 119, 0.14);
        --shadow: 0 12px 36px rgba(15, 11, 26, 0.10);
        --shadow-soft: 0 6px 18px rgba(15, 11, 26, 0.07);
      }

      [data-theme="light"] body {
        color: #0F0B1A;
        background:
          radial-gradient(circle at 14% 10%, rgba(124, 58, 237, 0.07), transparent 24%),
          radial-gradient(circle at 88% 8%, rgba(219, 39, 119, 0.05), transparent 26%),
          #F6F5FB;
      }

      [data-theme="light"] body::before {
        background-image: linear-gradient(
          to right,
          rgba(124, 58, 237, 0.05) 1px,
          transparent 1px
        );
        mask-image: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.4), transparent 92%);
      }

      [data-theme="light"] body::after {
        background:
          radial-gradient(circle at 18% 22%, rgba(124, 58, 237, 0.06), transparent 20%),
          radial-gradient(circle at 78% 16%, rgba(219, 39, 119, 0.06), transparent 24%);
        opacity: 0.6;
      }

      /* Sidebar */
      [data-theme="light"] .platform-panel {
        background: linear-gradient(180deg, #EFEFFA, #E7E5F4);
        box-shadow: var(--shadow);
        border-color: #DDD9EB;
      }
      [data-theme="light"] .platform-panel::before {
        background:
          radial-gradient(circle at 20% 0%, rgba(124, 58, 237, 0.06), transparent 26%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.5), transparent 30%);
      }
      [data-theme="light"] .platform-brand {
        border-bottom-color: #DDD9EB;
      }
      [data-theme="light"] .platform-brand strong { color: #0F0B1A; }
      [data-theme="light"] .platform-brand span { color: #7A748F; }
      [data-theme="light"] .platform-section { color: #7A748F; }
      [data-theme="light"] .platform-link {
        color: #0F0B1A;
        border-color: rgba(124, 58, 237, 0.12);
        background: transparent;
      }
      [data-theme="light"] .platform-link .link-icon { color: #7A748F; }
      [data-theme="light"] .platform-link:hover {
        background: #EDEAF8;
        border-color: rgba(124, 58, 237, 0.22);
        color: #0F0B1A;
      }
      [data-theme="light"] .platform-link.active {
        background: #7C3AED;
        border-color: rgba(124, 58, 237, 0.5);
        color: #ffffff;
        box-shadow: 0 8px 20px rgba(124, 58, 237, 0.22);
      }
      [data-theme="light"] .platform-link.active .link-icon { color: #ffffff; }
      [data-theme="light"] .platform-user {
        background: rgba(255, 255, 255, 0.7);
        border-color: #DDD9EB;
      }
      [data-theme="light"] .platform-user small { color: #7A748F; }
      [data-theme="light"] .platform-user strong { color: #0F0B1A; }
      [data-theme="light"] .platform-user-avatar {
        background: #E4E0F5;
        border-color: rgba(124, 58, 237, 0.28);
        color: #4C475E;
      }
      [data-theme="light"] .platform-support {
        background: rgba(255, 255, 255, 0.6);
        border-color: #DDD9EB;
      }
      [data-theme="light"] .platform-support span { color: #4C475E; }
      [data-theme="light"] .logout-btn {
        background: #EDEAF8;
        border-color: #DDD9EB;
        color: #0F0B1A;
      }
      [data-theme="light"] .logout-btn:hover {
        background: #E4E0F5;
        border-color: rgba(124, 58, 237, 0.5);
      }
      [data-theme="light"] .theme-toggle-btn {
        background: rgba(255, 255, 255, 0.6);
        border-color: #DDD9EB;
        color: #4C475E;
      }
      [data-theme="light"] .theme-toggle-btn:hover {
        background: #EDEAF8;
        border-color: rgba(124, 58, 237, 0.3);
        color: #0F0B1A;
      }

      /* History panel */
      [data-theme="light"] .history-panel {
        background: linear-gradient(180deg, #EFEFFA, #E7E5F4);
        border-color: #DDD9EB;
        box-shadow: var(--shadow);
        backdrop-filter: none;
      }
      [data-theme="light"] .history-panel::before {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.4), transparent 24%),
          radial-gradient(circle at 100% 0%, rgba(124, 58, 237, 0.06), transparent 28%);
      }
      [data-theme="light"] .history-kicker { color: #7A748F; }
      [data-theme="light"] .history-title strong { color: #0F0B1A; }
      [data-theme="light"] .history-title { border-bottom-color: #DDD9EB; }
      [data-theme="light"] .history-toggle-btn,
      [data-theme="light"] .new-chat-btn {
        background: #7C3AED;
        border-color: rgba(124, 58, 237, 0.3);
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
      }
      [data-theme="light"] .history-toggle-btn:hover {
        background: #6d28d9;
        border-color: rgba(124, 58, 237, 0.5);
      }
      [data-theme="light"] .history-list {
        scrollbar-color: rgba(124, 58, 237, 0.4) #E7E5F4;
      }
      [data-theme="light"] .history-empty {
        background: rgba(255, 255, 255, 0.5);
        border-color: #DDD9EB;
        color: #7A748F;
      }
      [data-theme="light"] .history-item {
        background: rgba(255, 255, 255, 0.8);
        border-color: #DDD9EB;
        color: #0F0B1A;
        box-shadow: 0 2px 8px rgba(15, 11, 26, 0.06);
      }
      [data-theme="light"] .history-item.active {
        background: #E4E0F5;
        border-color: rgba(124, 58, 237, 0.36);
        box-shadow: 0 4px 14px rgba(124, 58, 237, 0.12);
      }
      [data-theme="light"] .history-item:hover { border-color: rgba(124, 58, 237, 0.22); }
      [data-theme="light"] .history-item h3 { color: #0F0B1A; }
      [data-theme="light"] .history-item time { color: #7A748F; }
      [data-theme="light"] .history-item p { color: #4C475E; }
      [data-theme="light"] .layout.history-collapsed .history-panel::after { color: #7A748F; }

      /* Chat shell */
      [data-theme="light"] .chat-shell {
        background: #F6F5FB;
        border-color: #DDD9EB;
        box-shadow: var(--shadow);
      }
      [data-theme="light"] .chat-shell::before {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.6), transparent 18%),
          radial-gradient(circle at 100% 0%, rgba(124, 58, 237, 0.04), transparent 26%);
      }
      [data-theme="light"] .chat-head {
        background: linear-gradient(180deg, #EFEFFA, #E9E7F6);
        border-bottom-color: #DDD9EB;
      }
      [data-theme="light"] .chat-head-copy strong { color: #0F0B1A; }
      [data-theme="light"] .chat-subtitle { color: #7A748F; }
      [data-theme="light"] .head-icon {
        background: #E4E0F5;
        border-color: #DDD9EB;
        color: #4C475E;
      }
      [data-theme="light"] .status {
        background: rgba(255, 255, 255, 0.7);
        border-color: #DDD9EB;
        color: #4C475E;
      }
      [data-theme="light"] .messages {
        background: #F6F5FB;
      }
      [data-theme="light"] .chat-empty-state {
        background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(239,239,250,0.9));
        border-color: #DDD9EB;
        box-shadow: var(--shadow-soft);
      }
      [data-theme="light"] .chat-empty-state strong { color: #0F0B1A; }
      [data-theme="light"] .chat-empty-state p { color: #4C475E; }

      /* Bubbles */
      [data-theme="light"] .bubble.user {
        background: #7C3AED;
        border-color: rgba(124, 58, 237, 0.3);
        color: #ffffff;
        box-shadow: 0 6px 18px rgba(124, 58, 237, 0.2);
        text-shadow: none;
      }
      [data-theme="light"] .bubble.assistant {
        background: rgba(255, 255, 255, 0.9);
        border-color: #DDD9EB;
        box-shadow: 0 4px 12px rgba(15, 11, 26, 0.06);
        color: #0F0B1A;
      }
      [data-theme="light"] .bubble.assistant a { color: #7C3AED; }
      [data-theme="light"] .bubble.assistant code {
        background: #E7E5F4;
        color: #4C475E;
      }
      [data-theme="light"] .bubble.assistant pre.md-code {
        background: #EFEFFA;
        border-color: #DDD9EB;
        color: #0F0B1A;
      }
      [data-theme="light"] .bubble.assistant table.chat-md-table thead th {
        background: #E7E5F4;
        color: #0F0B1A;
        border-bottom-color: #DDD9EB;
      }
      [data-theme="light"] .bubble.assistant table.chat-md-table tbody td {
        color: #4C475E;
        border-bottom-color: #EDEAF8;
      }
      [data-theme="light"] .thinking-bubble { color: #4C475E; }

      /* Composer */
      [data-theme="light"] .composer {
        background: linear-gradient(180deg, #EFEFFA, #E9E7F6);
        border-top-color: #DDD9EB;
      }
      [data-theme="light"] .composer form {
        background: rgba(255, 255, 255, 0.85);
        border-color: #DDD9EB;
        box-shadow: var(--shadow-soft);
      }
      [data-theme="light"] .composer textarea {
        background: #F6F5FB;
        border-color: #DDD9EB;
        color: #0F0B1A;
      }
      [data-theme="light"] .composer textarea:focus {
        border-color: #7C3AED;
        box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
      }
      [data-theme="light"] .composer button {
        background: linear-gradient(135deg, #7C3AED, #DB2777);
        border-color: rgba(124, 58, 237, 0.3);
        color: #ffffff;
        box-shadow: 0 6px 18px rgba(124, 58, 237, 0.22);
      }
      [data-theme="light"] .composer button:hover {
        box-shadow: 0 8px 22px rgba(124, 58, 237, 0.3);
      }
      [data-theme="light"] .queries-bar-btn {
        background: #EDEAF8;
        border-color: #DDD9EB;
        color: #4C475E;
      }
      [data-theme="light"] .queries-bar-btn:hover {
        background: #E4E0F5;
        color: #0F0B1A;
        border-color: rgba(124, 58, 237, 0.3);
      }

      /* Decision panel */
      [data-theme="light"] .decision-panel {
        background: rgba(255, 255, 255, 0.8);
        border-color: #DDD9EB;
      }
      [data-theme="light"] .decision-title { color: #4C475E; }
      [data-theme="light"] .decision-btn {
        background: linear-gradient(135deg, #7C3AED, #DB2777);
        border-color: rgba(124, 58, 237, 0.3);
        color: #ffffff;
      }

      /* Exec brief */
      [data-theme="light"] .exec-brief-embed {
        border-color: #DDD9EB;
      }
      [data-theme="light"] .exec-brief-embed h2 { color: #0F0B1A; }
      [data-theme="light"] .exec-brief-embed .confidence {
        background: #EDEAF8;
        border-color: #DDD9EB;
      }
      [data-theme="light"] .exec-brief-actions a {
        background: #EDEAF8;
        border-color: #DDD9EB;
        color: #4C475E;
      }
      [data-theme="light"] .exec-brief-actions a:hover {
        background: #E4E0F5;
        border-color: rgba(124, 58, 237, 0.35);
        color: #0F0B1A;
      }

      /* Query log */
      [data-theme="light"] .query-log-toggle {
        background: #EDEAF8;
        border-color: #DDD9EB;
        color: #7A748F;
      }
      [data-theme="light"] .query-log-toggle:hover { background: #E4E0F5; color: #4C475E; }
      [data-theme="light"] .query-card {
        background: rgba(255, 255, 255, 0.8);
        border-color: #DDD9EB;
      }
      [data-theme="light"] .query-card-title { color: #0F0B1A; }
      [data-theme="light"] .query-card-purpose { color: #7A748F; }
      [data-theme="light"] .query-card-meta { color: #7A748F; }
      [data-theme="light"] .query-card pre.qc-sql {
        background: #F6F5FB;
        border-color: #DDD9EB;
        color: #4C475E;
      }

      /* Queries modal */
      [data-theme="light"] .queries-modal-backdrop { background: rgba(15, 11, 26, 0.28); }
      [data-theme="light"] .queries-modal-panel {
        background: #F6F5FB;
        border-color: #DDD9EB;
        box-shadow: 0 24px 60px rgba(15, 11, 26, 0.12);
      }
      [data-theme="light"] .queries-modal-header { border-bottom-color: #DDD9EB; }
      [data-theme="light"] .queries-modal-title { color: #0F0B1A; }
      [data-theme="light"] .queries-modal-close { color: #7A748F; }
      [data-theme="light"] .queries-modal-close:hover { color: #0F0B1A; background: #EDEAF8; }
      [data-theme="light"] .queries-table thead th {
        background: #E7E5F4;
        color: #4C475E;
        border-bottom-color: #DDD9EB;
      }
      [data-theme="light"] .queries-table tbody td {
        color: #4C475E;
        border-bottom-color: #EDEAF8;
      }
      [data-theme="light"] .qt-question { color: #0F0B1A; }
      [data-theme="light"] .qt-purpose { color: #7A748F; }
      [data-theme="light"] .qt-sql-code {
        background: #EFEFFA;
        border-color: #DDD9EB;
        color: #4C475E;
      }
      [data-theme="light"] .qt-run-group td { background: #EDEAF8; border-bottom-color: #DDD9EB !important; }
      [data-theme="light"] .qt-run-label { color: #7A748F; }
      [data-theme="light"] .qc-sample-rows-label { color: #7A748F; }
      [data-theme="light"] .qc-sample-table th {
        background: #E7E5F4;
        color: #4C475E;
        border-bottom-color: #DDD9EB;
      }
      [data-theme="light"] .qc-sample-table td {
        color: #4C475E;
        border-bottom-color: #EDEAF8;
      }

      /* Schedule modal */
      [data-theme="light"] .schedule-modal-backdrop { background: rgba(15, 11, 26, 0.24); }
      [data-theme="light"] .schedule-modal-panel {
        background: #F6F5FB;
        border-color: #DDD9EB;
        box-shadow: 0 24px 60px rgba(15, 11, 26, 0.12);
      }
      [data-theme="light"] .schedule-modal-header {
        background: linear-gradient(180deg, #EFEFFA, #E9E7F6);
        border-bottom-color: #DDD9EB;
      }
      [data-theme="light"] .schedule-modal-title strong { color: #0F0B1A; }
      [data-theme="light"] .schedule-modal-title span { color: #4C475E; }
      [data-theme="light"] .schedule-modal-close {
        background: #EDEAF8;
        border-color: #DDD9EB;
        color: #0F0B1A;
      }
      [data-theme="light"] .schedule-form-section,
      [data-theme="light"] .schedule-preview-section {
        background: rgba(255, 255, 255, 0.7);
        border-color: #DDD9EB;
      }
      [data-theme="light"] .schedule-form-section h3,
      [data-theme="light"] .schedule-preview-section h3 { color: #0F0B1A; }
      [data-theme="light"] .schedule-form-section p,
      [data-theme="light"] .schedule-preview-section p { color: #4C475E; }
      [data-theme="light"] .schedule-field label { color: #7A748F; }
      [data-theme="light"] .schedule-field input,
      [data-theme="light"] .schedule-field select,
      [data-theme="light"] .schedule-field textarea {
        background: #F6F5FB;
        border-color: #DDD9EB;
        color: #0F0B1A;
      }
      [data-theme="light"] .schedule-question-card,
      [data-theme="light"] .schedule-preview-card {
        background: rgba(255, 255, 255, 0.7);
        border-color: #DDD9EB;
      }
      [data-theme="light"] .schedule-question-card strong,
      [data-theme="light"] .schedule-preview-card strong { color: #0F0B1A; }
      [data-theme="light"] .schedule-question-card small,
      [data-theme="light"] .schedule-preview-card small { color: #4C475E; }
      [data-theme="light"] .schedule-modal-footer {
        background: #EFEFFA;
        border-top-color: #DDD9EB;
      }
      [data-theme="light"] .schedule-footer-note { color: #4C475E; }
      [data-theme="light"] .schedule-btn {
        background: #EDEAF8;
        border-color: #DDD9EB;
        color: #0F0B1A;
      }
      [data-theme="light"] .schedule-btn.primary {
        background: linear-gradient(135deg, #7C3AED, #DB2777);
        border-color: rgba(124, 58, 237, 0.3);
        color: #ffffff;
      }

      /* Mobile light */
      @media (max-width: 1200px) {
        [data-theme="light"] .chat-shell {
          border-left-color: #DDD9EB;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="layout" id="workspace-layout">
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
            <a class="platform-link active" href="/app"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>Chat Explorer</a>
            <a class="platform-link" href="/usage"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></span>Usage &amp; AI</a>
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
            <button id="theme-toggle-btn" class="theme-toggle-btn" type="button">
              <span class="theme-toggle-icon" id="theme-toggle-icon">☀️</span>
              <span id="theme-toggle-label">Light mode</span>
            </button>
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
            <div class="history-title-copy">
              <span class="history-kicker">Live Memory</span>
              <strong>Chat History</strong>
            </div>
            <div class="history-actions">
              <button id="history-toggle-button" class="history-toggle-btn" type="button" aria-label="Collapse chat history">◀</button>
              <button id="new-chat-button" class="new-chat-btn" type="button" aria-label="Start new chat">+</button>
            </div>
          </div>
          <div class="history-list" id="history-list">
            <div class="history-empty">No chats yet. Start a new chat.</div>
          </div>
        </aside>
        <main class="chat-shell">
          <header class="chat-head">
            <div class="chat-head-left">
              <div class="chat-head-mark">${renderClaritectLogoImage("chat-head-logo", "Claritect")}</div>
              <div class="chat-head-copy">
                <strong id="chat-session-title">New Chat</strong>
                <span class="chat-subtitle">Decision intelligence workspace</span>
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
          <div class="schedule-modal-backdrop" id="schedule-modal-backdrop"></div>
          <div class="schedule-modal" id="schedule-modal">
            <div class="schedule-modal-panel">
              <div class="schedule-modal-header">
                <div class="schedule-modal-title">
                  <strong>Schedule this report</strong>
                  <span id="schedule-modal-subtitle">Capture cadence, rolling-window behavior, and any rerun notes before we save the schedule.</span>
                </div>
                <button class="schedule-modal-close" id="schedule-modal-close" type="button">&#x2715;</button>
              </div>
              <div class="schedule-modal-body">
                <section class="schedule-form-section">
                  <h3>Schedule setup</h3>
                  <p>Tell us how often this report should run and how each scoped question should move forward over time.</p>
                  <div class="schedule-grid">
                    <div class="schedule-field">
                      <label for="schedule-frequency">Frequency</label>
                      <select id="schedule-frequency">
                        <option value="weekly">Weekly</option>
                        <option value="monthly" selected>Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                    <div class="schedule-field">
                      <label for="schedule-timezone">Timezone</label>
                      <input id="schedule-timezone" type="text" value="UTC" />
                    </div>
                    <div class="schedule-field" id="schedule-weekday-field">
                      <label for="schedule-weekday">Weekday</label>
                      <select id="schedule-weekday">
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5" selected>Friday</option>
                        <option value="6">Saturday</option>
                        <option value="0">Sunday</option>
                      </select>
                    </div>
                    <div class="schedule-field schedule-inline-hidden" id="schedule-monthday-field">
                      <label for="schedule-monthday">Day of month</label>
                      <input id="schedule-monthday" type="number" min="1" max="31" value="1" />
                    </div>
                    <div class="schedule-field">
                      <label for="schedule-hour">Local hour</label>
                      <input id="schedule-hour" type="number" min="0" max="23" value="9" />
                    </div>
                    <div class="schedule-field">
                      <label for="schedule-minute">Local minute</label>
                      <input id="schedule-minute" type="number" min="0" max="59" value="0" />
                    </div>
                  </div>
                  <div class="schedule-field">
                    <label for="schedule-windowing">How should the time windows change on each run?</label>
                    <textarea id="schedule-windowing">Roll each scoped time window forward to the latest complete reporting period on every scheduled run.</textarea>
                  </div>
                  <div class="schedule-field" style="margin-top:14px;">
                    <label for="schedule-additional">Any other changes you want me to know?</label>
                    <textarea id="schedule-additional" placeholder="Optional notes for reruns, audience nuances, or delivery caveats."></textarea>
                  </div>
                  <div class="schedule-field" style="margin-top:14px;">
                    <label>Per-question rerun behavior</label>
                    <div id="schedule-question-list" class="schedule-questions"></div>
                  </div>
                </section>
                <aside class="schedule-preview-section">
                  <h3>Saved understanding</h3>
                  <p>This is the exact plan that will be stored with the schedule and used on future reruns.</p>
                  <div id="schedule-preview-content"></div>
                </aside>
              </div>
              <div class="schedule-modal-footer">
                <div class="schedule-footer-note" id="schedule-footer-note">We'll save the cadence, question-level rerun logic, query templates, and the current HTML template snapshot.</div>
                <div class="schedule-footer-actions">
                  <button class="schedule-btn" id="schedule-cancel" type="button">Cancel</button>
                  <button class="schedule-btn primary" id="schedule-save" type="button">Save schedule</button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>

    <script>
      (() => {
        const CHAT_STORAGE_KEY = "project_overload_chat_sessions_v1";
        const MAX_STORED_CHATS = 30;
        const HISTORY_COLLAPSED_KEY = "project_overload_chat_history_collapsed_v1";
        const THEME_STORAGE_KEY = "claritect_theme_v1";
        const UI_CONTROL_MESSAGE_PATTERN = /^__ui_[a-z0-9_]+__$/i;

        // ── Theme toggle ──
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
        }

        const savedTheme = (() => {
          try { return localStorage.getItem(THEME_STORAGE_KEY) || "dark"; } catch { return "dark"; }
        })();
        applyTheme(savedTheme);

        if (themeToggleBtnEl) {
          themeToggleBtnEl.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
            const next = current === "light" ? "dark" : "light";
            applyTheme(next);
            try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
          });
        }
          const stateRef = { value: null };
        const chatsRef = { value: [] };
        const activeChatIdRef = { value: null };
        const historyCollapsedRef = { value: false };
        const layoutEl = document.getElementById("workspace-layout");
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
        const scheduleModalEl = document.getElementById("schedule-modal");
        const scheduleModalBackdropEl = document.getElementById("schedule-modal-backdrop");
        const scheduleModalSubtitleEl = document.getElementById("schedule-modal-subtitle");
        const scheduleQuestionListEl = document.getElementById("schedule-question-list");
        const schedulePreviewContentEl = document.getElementById("schedule-preview-content");
        const scheduleFooterNoteEl = document.getElementById("schedule-footer-note");
        const scheduleFrequencyEl = document.getElementById("schedule-frequency");
        const scheduleTimezoneEl = document.getElementById("schedule-timezone");
        const scheduleWeekdayFieldEl = document.getElementById("schedule-weekday-field");
        const scheduleWeekdayEl = document.getElementById("schedule-weekday");
        const scheduleMonthdayFieldEl = document.getElementById("schedule-monthday-field");
        const scheduleMonthdayEl = document.getElementById("schedule-monthday");
        const scheduleHourEl = document.getElementById("schedule-hour");
        const scheduleMinuteEl = document.getElementById("schedule-minute");
        const scheduleWindowingEl = document.getElementById("schedule-windowing");
        const scheduleAdditionalEl = document.getElementById("schedule-additional");
        const scheduleSaveEl = document.getElementById("schedule-save");
        const scheduleCancelEl = document.getElementById("schedule-cancel");
        const historyListEl = document.getElementById("history-list");
        const historyToggleButtonEl = document.getElementById("history-toggle-button");
        const newChatButtonEl = document.getElementById("new-chat-button");
        const chatSessionTitleEl = document.getElementById("chat-session-title");
        const runtimeStatusRef = { mode: "checking provider", busy: false };
        const composerStateRef = { busy: false, locked: false };
        const decisionRef = { value: null };
        const serverSyncRef = { timer: null, inFlight: false, queued: false };
        const scheduleModalStateRef = { runId: null, contractId: null, reportTitle: null, questions: [] };
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

        function loadHistoryCollapsedPreference() {
          try {
            historyCollapsedRef.value = localStorage.getItem(HISTORY_COLLAPSED_KEY) === "1";
          } catch {
            historyCollapsedRef.value = false;
          }
        }

        function saveHistoryCollapsedPreference() {
          try {
            localStorage.setItem(HISTORY_COLLAPSED_KEY, historyCollapsedRef.value ? "1" : "0");
          } catch {
            // ignore storage write failures
          }
        }

        function applyHistoryCollapsedState() {
          if (layoutEl) {
            layoutEl.classList.toggle("history-collapsed", historyCollapsedRef.value);
          }
          if (historyToggleButtonEl) {
            historyToggleButtonEl.textContent = historyCollapsedRef.value ? "▶" : "◀";
            historyToggleButtonEl.setAttribute(
              "aria-label",
              historyCollapsedRef.value ? "Expand chat history" : "Collapse chat history"
            );
            historyToggleButtonEl.setAttribute("title", historyCollapsedRef.value ? "Expand chat history" : "Collapse chat history");
          }
        }

        function toggleHistoryCollapsed() {
          historyCollapsedRef.value = !historyCollapsedRef.value;
          applyHistoryCollapsedState();
          saveHistoryCollapsedPreference();
        }

        function escapeHtml(value) {
          return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
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

        function parseTimestampMs(value) {
          const raw = String(value || "").trim();
          if (!raw) {
            return NaN;
          }
          const direct = Date.parse(raw);
          if (Number.isFinite(direct)) {
            return direct;
          }

          const normalized = raw
            .replace(" ", "T")
            .replace(/([+-]\\d{2})$/, "$1:00")
            .replace(/Z\\+00:00$/, "Z");
          const fallback = Date.parse(normalized);
          return Number.isFinite(fallback) ? fallback : NaN;
        }

        function normalizeTimestamp(value, fallbackIso) {
          const ts = parseTimestampMs(value);
          if (Number.isFinite(ts)) {
            return new Date(ts).toISOString();
          }
          return fallbackIso;
        }

        function latestMessageTimestamp(messages) {
          if (!Array.isArray(messages) || messages.length === 0) {
            return null;
          }
          let latestTs = NaN;
          for (const entry of messages) {
            const ts = parseTimestampMs(entry && entry.at);
            if (Number.isFinite(ts) && (!Number.isFinite(latestTs) || ts > latestTs)) {
              latestTs = ts;
            }
          }
          return Number.isFinite(latestTs) ? new Date(latestTs).toISOString() : null;
        }

        function resolveChatUpdatedAt(rawUpdatedAt, messages, createdAt) {
          const messageTimestamp = latestMessageTimestamp(messages);
          if (messageTimestamp) {
            return messageTimestamp;
          }
          return normalizeTimestamp(rawUpdatedAt, normalizeTimestamp(createdAt, nowIso()));
        }

        function getChatDisplayTimestamp(chat) {
          if (!chat || typeof chat !== "object") {
            return nowIso();
          }
          return (
            latestMessageTimestamp(chat.messages) ||
            normalizeTimestamp(chat.updated_at, normalizeTimestamp(chat.created_at, nowIso()))
          );
        }

        function getChatFreshnessMs(chat) {
          return parseTimestampMs(getChatDisplayTimestamp(chat));
        }

        function chooseFresherSession(left, right) {
          if (!left) {
            return right || null;
          }
          if (!right) {
            return left;
          }

          const leftTs = getChatFreshnessMs(left);
          const rightTs = getChatFreshnessMs(right);
          if (Number.isFinite(leftTs) && Number.isFinite(rightTs)) {
            return leftTs >= rightTs ? left : right;
          }
          if (Number.isFinite(leftTs)) {
            return left;
          }
          if (Number.isFinite(rightTs)) {
            return right;
          }
          return left;
        }

        function replaceSession(session) {
          if (!session || typeof session.id !== "string") {
            return;
          }
          const index = chatsRef.value.findIndex((entry) => entry.id === session.id);
          if (index === -1) {
            chatsRef.value.push(session);
            return;
          }
          chatsRef.value[index] = chooseFresherSession(session, chatsRef.value[index]);
        }

        function replaceSessionAuthoritative(session) {
          if (!session || typeof session.id !== "string") {
            return;
          }
          const index = chatsRef.value.findIndex((entry) => entry.id === session.id);
          if (index === -1) {
            chatsRef.value.push(session);
            return;
          }
          chatsRef.value[index] = session;
        }

        function formatRelativeTime(iso) {
          const ts = parseTimestampMs(iso);
          if (!Number.isFinite(ts)) {
            return "just now";
          }
          const diffMs = Math.max(0, Date.now() - ts);
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
              messages: []
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
            at: normalizeTimestamp(raw.at, nowIso())
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

          const normalized = {
            id: raw.id,
            title: sanitizeTitle(raw.title),
            title_auto: raw.title_auto !== false,
            naming_in_progress: false,
            created_at: normalizeTimestamp(raw.created_at, nowIso()),
            updated_at: resolveChatUpdatedAt(raw.updated_at, messages, raw.created_at),
            state: rawState,
            user_messages: userMessages,
            db_bootstrapped: typeof raw.db_bootstrapped === "boolean" ? raw.db_bootstrapped : true,
            messages
          };
          if (normalized.state) {
            normalized.state.session_title = normalized.title === "New Chat" ? null : normalized.title;
          }
          return normalized;
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
            let appliedRemoteState = false;
            for (const session of sessions) {
              const response = await fetch("/api/chat/sessions/" + encodeURIComponent(session.id), {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ session })
              });
              if (!response.ok) {
                break;
              }
              let payload;
              try { payload = JSON.parse(await response.text()); } catch { payload = null; }
              const normalized = payload && payload.session ? normalizeStoredChat(payload.session) : null;
              if (normalized) {
                replaceSessionAuthoritative(normalized);
                appliedRemoteState = true;
              }
            }
            if (appliedRemoteState) {
              saveChatsToStorage(true);
              renderHistoryList();
              if (activeChatIdRef.value) {
                renderSessionTitle();
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

        function syncChatTitleToState(chat) {
          if (!chat || !chat.state || typeof chat.state !== "object") {
            return;
          }
          const sanitizedTitle = sanitizeTitle(chat.title);
          chat.state.session_title = sanitizedTitle === "New Chat" ? null : sanitizedTitle;
        }

        function getChatById(chatId) {
          return chatsRef.value.find((entry) => entry.id === chatId) || null;
        }

        function getActiveChat() {
          return getChatById(activeChatIdRef.value);
        }

        function renderSessionTitle() {
          const active = getActiveChat();
          chatSessionTitleEl.textContent = active ? active.title : "Claritect";
        }

        function setChatState(chatId, nextState) {
          const chat = getChatById(chatId);
          if (!chat) {
            return;
          }
          chat.state = cloneJson(nextState);
          syncChatTitleToState(chat);
          touchChat(chat);
          saveChatsToStorage();
          renderHistoryList();
          if (chat.id === activeChatIdRef.value) {
            stateRef.value = cloneJson(chat.state);
            refreshDecisionFromState(stateRef.value);
            renderSessionTitle();
          }
        }

        function setActiveChatState(nextState) {
          setChatState(activeChatIdRef.value, nextState);
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

          const sorted = [...chatsRef.value].sort((a, b) => getChatFreshnessMs(b) - getChatFreshnessMs(a));
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
            time.textContent = chat.naming_in_progress ? "naming..." : formatRelativeTime(getChatDisplayTimestamp(chat));
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

        function playNotificationPing() {
          try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
          } catch (e) { /* audio not available */ }
        }

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
        function prettifyAssistantText(rawText) {
          if (typeof rawText !== "string") {
            return "";
          }

          let text = rawText.replace(/\\r\\n?/g, "\\n").trim();
          if (text.length === 0) {
            return "";
          }

          const tripleBacktick = String.fromCharCode(96, 96, 96);
          if (text.indexOf(tripleBacktick) !== -1) {
            return text;
          }

          // Normalize packed bullets into line-separated bullets.
          text = text
            .replace(/\\s+•\\s+/g, "\\n• ")
            .replace(/\\s+-\\s+(?=[A-ZQ]\\w)/g, "\\n- ");

          const newlineCount = (text.match(/\\n/g) || []).length;
          const looksDense = newlineCount < 4 && text.length > 240;
          if (looksDense) {
            // Break long single blobs into readable sections.
            text = text
              .replace(/\\s+(Q\\d+\\s*[—:-])/g, "\\n\\n$1")
              .replace(
                /\\s+(One thing worth flagging|Important note|Note:|Assumption:|Recommendation:|Coverage:|Data source:)/gi,
                "\\n\\n$1"
              )
              .replace(/([.!?])\\s+(?=[A-Z][a-z])/g, "$1\\n");
          }

          return text.replace(/\\n{3,}/g, "\\n\\n");
        }

        function renderMarkdown(text) {
          const readableText = prettifyAssistantText(text);

          // Escape HTML entities to prevent XSS
          const esc = readableText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          const lines = esc.split("\\n");
          const out = [];
          let inList = false;
          let listTag = "";
          const fence = String.fromCharCode(96, 96, 96);

          function splitTableCells(line) {
            if (typeof line !== "string" || line.indexOf("|") === -1) {
              return null;
            }
            let normalized = line.trim();
            if (normalized.length === 0) {
              return null;
            }
            if (normalized.startsWith("|")) {
              normalized = normalized.slice(1);
            }
            if (normalized.endsWith("|")) {
              normalized = normalized.slice(0, -1);
            }
            const cells = normalized.split("|").map((cell) => cell.trim());
            return cells.length > 0 ? cells : null;
          }

          function isTableSeparator(line) {
            const cells = splitTableCells(line);
            if (!cells || cells.length === 0) {
              return false;
            }
            return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\\s+/g, "")));
          }

          function closeList() {
            if (inList) {
              out.push("</" + listTag + ">");
              inList = false;
              listTag = "";
            }
          }

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Fenced code blocks
            if (line.trim().startsWith(fence)) {
              closeList();
              const codeLines = [];
              i += 1;
              while (i < lines.length && !lines[i].trim().startsWith(fence)) {
                codeLines.push(lines[i]);
                i += 1;
              }
              out.push('<pre class="md-code"><code>' + codeLines.join("\\n") + "</code></pre>");
              continue;
            }

            // Markdown tables
            const headerCells = splitTableCells(line);
            if (headerCells && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
              closeList();
              const rows = [];
              i += 2;
              while (i < lines.length) {
                const rowLine = lines[i];
                if (rowLine.trim().length === 0 || rowLine.indexOf("|") === -1) {
                  i -= 1;
                  break;
                }
                if (isTableSeparator(rowLine)) {
                  i += 1;
                  continue;
                }
                const rowCells = splitTableCells(rowLine);
                if (!rowCells || rowCells.length === 0) {
                  i -= 1;
                  break;
                }
                rows.push(rowCells);
                i += 1;
              }

              const columnCount = Math.max(
                headerCells.length,
                rows.reduce((max, row) => Math.max(max, row.length), 0)
              );
              const normalizedHeaders = Array.from({ length: columnCount }, (_, index) => headerCells[index] ?? "");
              const thead =
                "<thead><tr>" +
                normalizedHeaders.map((cell) => "<th>" + inlineFormat(cell) + "</th>").join("") +
                "</tr></thead>";
              const tbodyRows = rows
                .map((rowCells) => {
                  const normalized = Array.from({ length: columnCount }, (_, index) => rowCells[index] ?? "");
                  return "<tr>" + normalized.map((cell) => "<td>" + inlineFormat(cell) + "</td>").join("") + "</tr>";
                })
                .join("");
              out.push('<table class="chat-md-table">' + thead + "<tbody>" + tbodyRows + "</tbody></table>");
              continue;
            }

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

          if (
            state.post_run_actions_pending === true ||
            state.report_clarification_active === true ||
            state.business_case_active === true
          ) {
            const options = [
              { label: "Ask clarifications on the report", command: "__ui_report_clarifications__" },
              { label: "Ask for business case analysis", command: "__ui_business_case_analysis__" }
            ];
            if (state.scheduled_report_view !== true) {
              options.push({ label: "Schedule this report", command: "__ui_schedule_report_modal__" });
            }
            return {
              kind: "post-run",
              title: "Analysis is complete.",
              lockPlaceholder: "Ask questions on the report or start business case analysis.",
              options
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

	          const lastAssistantMessage =
	            Array.isArray(state.conversation_history)
	              ? [...state.conversation_history]
	                  .reverse()
	                  .find(function (turn) {
	                    return turn && turn.role === "assistant" && typeof turn.content === "string";
	                  })?.content || ""
	              : "";
	          const lastAssistantLower = String(lastAssistantMessage).toLowerCase();
	          const hasScopeQuestions =
	            Array.isArray(state.scope_questions) && state.scope_questions.length > 0;
	          const hasUnansweredScopeItems =
	            hasScopeQuestions &&
	            state.scope_questions.some(function (entry) {
	              return !entry || typeof entry.answer !== "string" || entry.answer.trim().length === 0;
	            });
	          const hasPendingScopeInputs =
	            Array.isArray(state.pending_inputs) && state.pending_inputs.length > 0;
	          const hasScopeLockSignal =
	            lastAssistantLower.includes("scope is locked") ||
	            /\bready to (?:move to|kick off) data prep(?:aration)?\b/.test(lastAssistantLower) ||
	            /\bready to prepare data\b/.test(lastAssistantLower);
	          const hasPendingScopeCue = [
	            "pending clarifications",
	            "still pending",
	            "need clarification",
	            "clarification needed",
	            "clarification status",
	            "reply with only the pending answers",
	            "i still need clarification",
	            "before data preparation, please confirm",
	            "proposed default (not applied)",
	            "does that work",
	            "any tweaks"
	          ].some(function (cue) {
	            return lastAssistantLower.includes(cue);
	          });
	          const hasPrepBlockerCue =
	            /\bno data to analyze\b|\bthere'?s no data\b|\bappears to be empty\b|\bno tables are scoped\b|\bcannot run yet\b|\bcheck that data is being loaded\b|\bdoes not exist\b|\bnot accessible\b/.test(lastAssistantLower);

	          if (
	            hasScopeLockSignal &&
	            hasScopeQuestions &&
	            !hasPrepBlockerCue &&
	            !hasPendingScopeCue &&
	            !hasUnansweredScopeItems &&
	            !hasPendingScopeInputs &&
	            state.scope_clarification_pending !== true &&
	            state.prep_complete !== true &&
	            !state.pending_run_id
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

	          if (state.scope_clarification_pending === true && state.scope_finalized !== true) {
	            return null;
	          }

          if (state.prep_pending === true) {
            if (
              state.scope_finalized !== true ||
              state.scope_clarification_pending === true ||
              hasUnansweredScopeItems ||
              hasPendingScopeInputs
            ) {
              return null;
            }
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
            if (
              state.scope_finalized !== true ||
              state.scope_clarification_pending === true ||
              hasUnansweredScopeItems ||
              hasPendingScopeInputs
            ) {
              return null;
            }
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
            state.scope_finalized === true &&
            state.prep_complete !== true &&
            state.prep_pending !== true &&
            state.scope_clarification_pending !== true &&
            !hasUnansweredScopeItems &&
            !hasPendingScopeInputs
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
            state.scope_clarification_pending !== true &&
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
          newChatButtonEl.disabled = Boolean(activeRunPollId);
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
              if (option.command === "__ui_schedule_report_modal__") {
                void openScheduleModal();
                return;
              }
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
                    (decisionRef.value.kind === "post-run" ||
                      decisionRef.value.kind === "refinement" ||
                      decisionRef.value.kind === "prep" ||
                      decisionRef.value.kind === "analysis")))
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

                function buildRunCompleteMessage(runId, elapsedMs) {
          const safeElapsed = Number.isFinite(elapsedMs) && elapsedMs >= 0 ? Math.round(elapsedMs) : null;
          if (safeElapsed === null) {
            return "HTML report is ready. Run ID: " + runId + ".";
          }
          return "HTML report is ready. Elapsed: " + safeElapsed + "ms.";
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
                try {
                  s = JSON.parse(result.text);
                } catch {
                  var trimmedText = String(result.text || "").trim();
                  if (/^<!doctype html/i.test(trimmedText) || /^<html/i.test(trimmedText)) {
                    abortPoll("Final analysis response was invalid. Please run analysis again.");
                    return;
                  }
                  setTimeout(poll, POLL_INTERVAL_MS);
                  return;
                }

                if (s && s.status === "succeeded") {
                  activeRunPollId = null;
                  stateRef.value = Object.assign({}, stateRef.value, {
                    pending_run_id: null,
                    last_run_id: runId,
                    last_exec_brief: s.exec_brief || null,
                    post_run_actions_pending: true,
                    report_clarification_active: false,
                    business_case_active: false,
                    business_case_candidates: [],
                    business_case_selected_candidate_id: null,
                    business_case_assumption_notes: [],
                    business_case_pending_clarification: null,
                    awaiting_post_run_refinement: false,
                    awaiting_pdf_confirmation: false,
                    refinement_active: false,
                    refinement_questions_remaining: 0,
                    pdf_download_url: s.pdf_path ? "/api/runs/" + runId + "/pdf" : null,
                    prepared_payloads: Array.isArray(s.prepared_payloads) ? s.prepared_payloads : []
                  });
                  setActiveChatState(stateRef.value);
                  refreshDecisionFromState(stateRef.value);
                  var msg = buildRunCompleteMessage(runId, Date.now() - startedAt);
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
                  try { playNotificationPing(); } catch {}
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
              .catch(function(error) {
                var message = error && error.message ? String(error.message) : "";
                if (/unexpected token|doctype|not valid json|non-json/i.test(message)) {
                  abortPoll("Final analysis response was invalid. Please run analysis again.");
                  return;
                }
                setTimeout(poll, POLL_INTERVAL_MS);
              });   // network error -> retry
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
            frame.style.cssText = "display:block;width:100%;border:none;min-height:320px;height:720px;";
            frame.addEventListener("load", function () {
              try {
                const h = frame.contentDocument?.documentElement?.scrollHeight;
                if (h && h > 50) {
                  frame.style.height = Math.min(h + 24, 1200) + "px";
                }
              } catch {}
            });
            briefContainer.appendChild(frame);
            bubble.appendChild(briefContainer);

            const runIdFromPdf = typeof entry.download_url === "string"
              ? ((entry.download_url.match(/\\/api\\/runs\\/([^/]+)\\/pdf/i) || [])[1] || null)
              : null;
            const htmlUrl = runIdFromPdf ? ("/api/runs/" + encodeURIComponent(runIdFromPdf) + "/html") : null;

            const actions = document.createElement("div");
            actions.className = "exec-brief-actions";
            if (htmlUrl) {
              const openLink = document.createElement("a");
              openLink.href = htmlUrl;
              openLink.textContent = "Open report in new tab";
              openLink.target = "_blank";
              openLink.rel = "noopener noreferrer";
              actions.appendChild(openLink);
            }
            if (typeof entry.download_url === "string" && entry.download_url.length > 0) {
              const pdfLink = document.createElement("a");
              pdfLink.href = entry.download_url;
              pdfLink.textContent = "Download PDF";
              pdfLink.target = "_blank";
              pdfLink.rel = "noopener noreferrer";
              actions.appendChild(pdfLink);
            }
            if (actions.childElementCount > 0) {
              bubble.appendChild(actions);
            }
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
            const hasEmbeddedHtml = typeof entry.exec_brief_html === "string" && entry.exec_brief_html.length > 0;
            if (!hasEmbeddedHtml) {
              const link = document.createElement("a");
              link.href = entry.download_url;
              link.textContent = "Download PDF";
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              bubble.appendChild(document.createElement("br"));
              bubble.appendChild(link);
            }
          }

          messagesEl.appendChild(bubble);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function renderMessagesForActiveChat() {
          hideThinking();
          messagesEl.innerHTML = "";
          const active = getActiveChat();
          if (!active) {
            messagesEl.classList.add("empty");
            updateQueriesBtn();
            return;
          }
          if (!Array.isArray(active.messages) || active.messages.length === 0) {
            messagesEl.classList.add("empty");
            const emptyState = document.createElement("div");
            emptyState.className = "chat-empty-state";
            emptyState.innerHTML =
              "<strong>Tell me what report you want to build.</strong>" +
              "<p>Start with the business question, metric, or decision you care about. If a governed source is already connected, I’ll pick up from there.</p>";
            messagesEl.appendChild(emptyState);
            updateQueriesBtn();
            return;
          }
          messagesEl.classList.remove("empty");
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

        function canEditPreparedQueries(chat) {
          return Boolean(
            chat &&
            chat.state &&
            chat.state.prep_complete === true &&
            !chat.state.pending_run_id &&
            !chat.state.last_run_id
          );
        }

        async function copyTextToClipboard(text) {
          const value = String(text || "");
          try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
              await navigator.clipboard.writeText(value);
              return true;
            }
          } catch (_error) {
            // fall back below
          }
          const helper = document.createElement("textarea");
          helper.value = value;
          helper.setAttribute("readonly", "readonly");
          helper.style.position = "fixed";
          helper.style.opacity = "0";
          document.body.appendChild(helper);
          helper.select();
          var copied = false;
          try {
            copied = document.execCommand("copy");
          } catch (_error) {
            copied = false;
          }
          document.body.removeChild(helper);
          return copied;
        }

        function updatePreparedQueryOverride(questionId, questionNumber, sql) {
          const chat = getActiveChat();
          if (!chat || !chat.state) { return false; }
          const normalizedSql = String(sql || "").trim();
          if (!normalizedSql) { return false; }

          if (!Array.isArray(chat.state.prepared_query_overrides)) {
            chat.state.prepared_query_overrides = [];
          }
          if (Array.isArray(chat.state.prepared_payloads)) {
            chat.state.prepared_payloads = chat.state.prepared_payloads.map(function (payload) {
              if (payload && payload.question_id === questionId) {
                return {
                  ...payload,
                  preparation_sqls: [normalizedSql]
                };
              }
              if (
                payload &&
                typeof questionNumber === "number" &&
                payload.question_number === questionNumber
              ) {
                return {
                  ...payload,
                  preparation_sqls: [normalizedSql]
                };
              }
              return payload;
            });
          }

          chat.state.prepared_query_overrides = chat.state.prepared_query_overrides.filter(function (entry) {
            if (questionId && entry.question_id === questionId) { return false; }
            if (typeof questionNumber === "number" && entry.question_number === questionNumber) { return false; }
            return true;
          });
          chat.state.prepared_query_overrides.push({
            question_id: questionId || null,
            question_number: typeof questionNumber === "number" ? questionNumber : null,
            sql: normalizedSql
          });

          chat.messages = chat.messages.map(function (message) {
            if (!Array.isArray(message.prepared_payloads)) {
              return message;
            }
            return {
              ...message,
              prepared_payloads: message.prepared_payloads.map(function (payload) {
                if (payload && payload.question_id === questionId) {
                  return {
                    ...payload,
                    preparation_sqls: [normalizedSql]
                  };
                }
                if (
                  payload &&
                  typeof questionNumber === "number" &&
                  payload.question_number === questionNumber
                ) {
                  return {
                    ...payload,
                    preparation_sqls: [normalizedSql]
                  };
                }
                return payload;
              })
            };
          });

          touchChat(chat);
          saveChatsToStorage();
          renderHistoryList();
          renderActiveChat();
          return true;
        }

        function openQueriesModal() {
          if (!queriesModalBodyEl) { return; }
          queriesModalBodyEl.innerHTML = "";
          const chat = getActiveChat();
          const runs = collectPreparedPayloads(chat);
          const singleQueries = collectSingleQueries(chat);
          const allowPreparedQueryEdits = canEditPreparedQueries(chat);
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
            ["#", "Question", "SQL Query", "Sample Output"].forEach(function (h) {
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
              const metaDiv = document.createElement("div");
              metaDiv.className = "qt-purpose";
              metaDiv.textContent = (sq.row_count != null ? sq.row_count + " rows" : "") + (sq.elapsed_ms != null ? " \u00B7 " + sq.elapsed_ms + "ms" : "");
              tdQ.appendChild(metaDiv);
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

              const tdOutput = document.createElement("td");
              tdOutput.className = "qt-output";
              const sampleRows = sq.sample_rows || [];
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
                sampleRows.slice(0, 10).forEach(function (rowData) {
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
                  const actions = document.createElement("div");
                  actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;";

                  const copyBtn = document.createElement("button");
                  copyBtn.type = "button";
                  copyBtn.textContent = "Copy query";
                  copyBtn.style.cssText = "padding:7px 10px;border-radius:10px;border:1px solid rgba(107, 92, 138, 0.28);background:rgba(34, 25, 56, 0.94);color:#F5F3FF;font:600 0.74rem/1 Inter, 'S�hne', 'Suisse Intl', sans-serif;cursor:pointer;";
                  copyBtn.addEventListener("click", async function () {
                    const copied = await copyTextToClipboard(sqls[0].trim());
                    copyBtn.textContent = copied ? "Copied" : "Copy failed";
                    window.setTimeout(function () {
                      copyBtn.textContent = "Copy query";
                    }, 1200);
                  });
                  actions.appendChild(copyBtn);

                  if (allowPreparedQueryEdits) {
                    const editBtn = document.createElement("button");
                    editBtn.type = "button";
                    editBtn.textContent = "Edit query";
                    editBtn.style.cssText = "padding:7px 10px;border-radius:10px;border:1px solid rgba(236, 72, 153, 0.24);background:rgba(108, 58, 237, 0.18);color:#F5F3FF;font:600 0.74rem/1 Inter, 'S�hne', 'Suisse Intl', sans-serif;cursor:pointer;";
                    actions.appendChild(editBtn);

                    const editorWrap = document.createElement("div");
                    editorWrap.style.cssText = "display:none;margin-top:10px;";
                    const editor = document.createElement("textarea");
                    editor.value = sqls[0].trim();
                    editor.style.cssText = "width:100%;min-height:140px;padding:12px 13px;border-radius:14px;border:1px solid rgba(107, 92, 138, 0.24);background:rgba(18, 13, 31, 0.96);color:#F5F3FF;font:0.8rem/1.55 Inter, 'Sohne', 'Suisse Intl', sans-serif;resize:vertical;";
                    editorWrap.appendChild(editor);

                    const editorActions = document.createElement("div");
                    editorActions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;";

                    const saveBtn = document.createElement("button");
                    saveBtn.type = "button";
                    saveBtn.textContent = "Save query";
                    saveBtn.style.cssText = "padding:8px 12px;border-radius:10px;border:0;background:#6C3AED;color:#F5F3FF;font:700 0.76rem/1 Inter, 'S�hne', 'Suisse Intl', sans-serif;cursor:pointer;";
                    saveBtn.addEventListener("click", function () {
                      const updated = String(editor.value || "").trim();
                      if (!updated) {
                        return;
                      }
                      const saved = updatePreparedQueryOverride(p.question_id, p.question_number, updated);
                      if (!saved) {
                        return;
                      }
                      openQueriesModal();
                    });
                    editorActions.appendChild(saveBtn);

                    const cancelBtn = document.createElement("button");
                    cancelBtn.type = "button";
                    cancelBtn.textContent = "Cancel";
                    cancelBtn.style.cssText = "padding:8px 12px;border-radius:10px;border:1px solid rgba(107, 92, 138, 0.28);background:rgba(34, 25, 56, 0.94);color:#F5F3FF;font:600 0.76rem/1 'Mona Sans',sans-serif;cursor:pointer;";
                    cancelBtn.addEventListener("click", function () {
                      editorWrap.style.display = "none";
                      editBtn.style.display = "";
                    });
                    editorActions.appendChild(cancelBtn);

                    editorWrap.appendChild(editorActions);
                    tdSql.appendChild(actions);
                    tdSql.appendChild(editorWrap);

                    editBtn.addEventListener("click", function () {
                      editorWrap.style.display = "block";
                      editBtn.style.display = "none";
                    });
                  } else {
                    tdSql.appendChild(actions);
                  }
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

        function formatScheduleFrequencyLabel(value) {
          if (value === "weekly") return "Weekly";
          if (value === "monthly") return "Monthly";
          if (value === "quarterly") return "Quarterly";
          return "Scheduled";
        }

        function formatScheduleWeekday(value) {
          const numeric = Number(value);
          const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          return Number.isInteger(numeric) && numeric >= 0 && numeric < labels.length ? labels[numeric] : "Not set";
        }

        function toggleScheduleDayFields() {
          if (!scheduleFrequencyEl || !scheduleWeekdayFieldEl || !scheduleMonthdayFieldEl) {
            return;
          }
          const frequency = scheduleFrequencyEl.value;
          const showWeekday = frequency === "weekly";
          const showMonthday = frequency === "monthly" || frequency === "quarterly";
          scheduleWeekdayFieldEl.classList.toggle("schedule-inline-hidden", !showWeekday);
          scheduleMonthdayFieldEl.classList.toggle("schedule-inline-hidden", !showMonthday);
        }

        function getScheduleQuestionPlan() {
          const questions = Array.isArray(scheduleModalStateRef.questions) ? scheduleModalStateRef.questions : [];
          return questions.map(function (entry) {
            const input = document.getElementById("schedule-question-" + entry.question_number);
            const nextRunBehavior =
              input && typeof input.value === "string" && input.value.trim().length > 0
                ? input.value.trim()
                : entry.suggested_next_run_behavior;
            return {
              question_number: entry.question_number,
              question_text: entry.question_text,
              current_scope_summary: entry.current_scope_summary,
              next_run_behavior: nextRunBehavior
            };
          });
        }

        function renderSchedulePreview() {
          if (!schedulePreviewContentEl || !scheduleFooterNoteEl) {
            return;
          }
          const runId = scheduleModalStateRef.runId;
          if (!runId) {
            schedulePreviewContentEl.innerHTML = "";
            return;
          }
          const frequency = scheduleFrequencyEl ? scheduleFrequencyEl.value : "monthly";
          const timezone = scheduleTimezoneEl && scheduleTimezoneEl.value.trim().length > 0 ? scheduleTimezoneEl.value.trim() : "UTC";
          const hour = scheduleHourEl ? Math.max(0, Math.min(23, Number(scheduleHourEl.value) || 0)) : 0;
          const minute = scheduleMinuteEl ? Math.max(0, Math.min(59, Number(scheduleMinuteEl.value) || 0)) : 0;
          const questionPlan = getScheduleQuestionPlan();
          const cadenceBits = [formatScheduleFrequencyLabel(frequency), "at " + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0") + " local time"];
          if (frequency === "weekly") {
            cadenceBits.push("on " + formatScheduleWeekday(scheduleWeekdayEl ? scheduleWeekdayEl.value : ""));
          } else if (frequency === "monthly" || frequency === "quarterly") {
            cadenceBits.push("on day " + String(scheduleMonthdayEl ? scheduleMonthdayEl.value : "1"));
          }
          schedulePreviewContentEl.innerHTML =
            '<div class="schedule-preview-card">' +
              "<strong>" + escapeHtml(scheduleModalStateRef.reportTitle || "Scheduled report") + "</strong>" +
              "<small>" + escapeHtml(cadenceBits.join(" ")) + " in " + escapeHtml(timezone) + "</small>" +
            "</div>" +
            '<div class="schedule-preview-card">' +
              "<strong>Windowing</strong>" +
              "<small>" + escapeHtml((scheduleWindowingEl && scheduleWindowingEl.value.trim()) || "Roll forward to the latest complete reporting period on each run.") + "</small>" +
            "</div>" +
            questionPlan.map(function (entry) {
              return (
                '<div class="schedule-preview-card">' +
                  "<strong>Q" + escapeHtml(entry.question_number) + ": " + escapeHtml(entry.question_text) + "</strong>" +
                  "<small>Current scope: " + escapeHtml(entry.current_scope_summary) + "</small>" +
                  '<small style="margin-top:8px;display:block;">Next run: ' + escapeHtml(entry.next_run_behavior) + "</small>" +
                "</div>"
              );
            }).join("");
          scheduleFooterNoteEl.textContent =
            "We will save the cadence, question rerun plan, query templates, and the current HTML template snapshot for this report.";
        }

        function renderScheduleQuestionList() {
          if (!scheduleQuestionListEl) {
            return;
          }
          scheduleQuestionListEl.innerHTML = "";
          const questions = Array.isArray(scheduleModalStateRef.questions) ? scheduleModalStateRef.questions : [];
          for (const entry of questions) {
            const card = document.createElement("div");
            card.className = "schedule-question-card";
            const heading = document.createElement("strong");
            heading.textContent = "Q" + entry.question_number + ": " + entry.question_text;
            card.appendChild(heading);
            const scope = document.createElement("small");
            scope.textContent = "Current scope: " + entry.current_scope_summary;
            card.appendChild(scope);
            const label = document.createElement("label");
            label.textContent = "How should this question run next time?";
            label.style.display = "block";
            label.style.marginTop = "10px";
            label.style.marginBottom = "6px";
            label.style.color = "var(--ink-soft)";
            label.style.fontSize = "0.74rem";
            card.appendChild(label);
            const input = document.createElement("textarea");
            input.id = "schedule-question-" + entry.question_number;
            input.value = entry.suggested_next_run_behavior;
            input.rows = 3;
            input.style.width = "100%";
            input.addEventListener("input", renderSchedulePreview);
            card.appendChild(input);
            scheduleQuestionListEl.appendChild(card);
          }
        }

        function closeScheduleModal() {
          if (scheduleModalEl) {
            scheduleModalEl.classList.remove("open");
          }
          if (scheduleModalBackdropEl) {
            scheduleModalBackdropEl.style.display = "none";
          }
        }

        function buildScheduleSavedMessage(understanding) {
          const questions = Array.isArray(understanding && understanding.questions) ? understanding.questions : [];
          const lines = [
            "Scheduled report saved.",
            "",
            "Cadence: " + formatScheduleFrequencyLabel((understanding && understanding.frequency) || "monthly"),
            "Run time: " + (((understanding && understanding.local_run_time) || "-") + " in " + (((understanding && understanding.timezone) || "UTC")))
          ];
          if (questions.length > 0) {
            lines.push("");
            lines.push("Saved question plan:");
            for (const entry of questions) {
              lines.push(
                "- Q" + entry.question_number + ": " + entry.question_text
              );
              lines.push(
                "  Next run: " + entry.next_run_behavior
              );
            }
          }
          lines.push("");
          lines.push("You can now manage this report from Scheduled Reports in the sidebar.");
          return lines.join("\\n");
        }

        async function openScheduleModal() {
          if (!stateRef.value || !stateRef.value.last_run_id) {
            appendMessage("assistant", "No completed report is available to schedule yet.", null, null, { trackForNaming: false });
            return;
          }
          if (!scheduleModalEl || !scheduleModalBackdropEl || !scheduleFooterNoteEl || !scheduleQuestionListEl) {
            return;
          }
          scheduleFooterNoteEl.textContent = "Loading schedule draft...";
          scheduleQuestionListEl.innerHTML = '<div class="schedule-preview-card"><small>Loading the saved scope and rerun questions...</small></div>';
          schedulePreviewContentEl.innerHTML = "";
          scheduleModalSubtitleEl.textContent = "Capture cadence, rolling-window behavior, and any rerun notes before we save the schedule.";
          scheduleModalEl.classList.add("open");
          scheduleModalBackdropEl.style.display = "block";
          try {
            const response = await fetch("/api/runs/" + encodeURIComponent(stateRef.value.last_run_id) + "/schedule-draft");
            const payload = await response.json();
            if (!response.ok) {
              throw new Error(payload && payload.message ? payload.message : "Unable to load schedule draft.");
            }
            const questions = Array.isArray(payload.questions) ? payload.questions : [];
            scheduleModalStateRef.runId = payload.run_id || stateRef.value.last_run_id;
            scheduleModalStateRef.contractId = payload.contract_id || stateRef.value.contract_id || null;
            scheduleModalStateRef.reportTitle = payload.report_title || "Scheduled report";
            scheduleModalStateRef.questions = questions.map(function (entry) {
              return {
                question_number: entry.question_number,
                question_id: entry.question_id || null,
                question_text: entry.question_text,
                current_scope_summary: entry.current_scope_summary,
                suggested_next_run_behavior: entry.suggested_next_run_behavior
              };
            });
            if (scheduleFrequencyEl) {
              scheduleFrequencyEl.value = (payload.defaults && payload.defaults.frequency) || "monthly";
            }
            if (scheduleTimezoneEl) {
              scheduleTimezoneEl.value = payload.timezone || (payload.defaults && payload.defaults.timezone) || "UTC";
            }
            if (scheduleHourEl) {
              scheduleHourEl.value = String((payload.defaults && (payload.defaults.hour_local ?? payload.defaults.hour_utc)) ?? 9);
            }
            if (scheduleMinuteEl) {
              scheduleMinuteEl.value = String((payload.defaults && (payload.defaults.minute_local ?? payload.defaults.minute_utc)) ?? 0);
            }
            if (scheduleWeekdayEl) {
              scheduleWeekdayEl.value = "1";
            }
            if (scheduleMonthdayEl) {
              scheduleMonthdayEl.value = "1";
            }
            if (scheduleWindowingEl && (!scheduleWindowingEl.value || /Roll each scoped time window forward/i.test(scheduleWindowingEl.value))) {
              scheduleWindowingEl.value = "Roll each scoped time window forward to the latest complete reporting period on every scheduled run.";
            }
            if (scheduleAdditionalEl) {
              scheduleAdditionalEl.value = "";
            }
            scheduleModalSubtitleEl.textContent =
              "Save how " + (scheduleModalStateRef.reportTitle || "this report") + " should rerun over time. We will keep the question set fixed unless you explicitly rescope it later.";
            toggleScheduleDayFields();
            renderScheduleQuestionList();
            renderSchedulePreview();
            if (scheduleFrequencyEl) {
              scheduleFrequencyEl.focus();
            }
          } catch (error) {
            scheduleFooterNoteEl.textContent = error instanceof Error ? error.message : "Unable to load schedule draft.";
          }
        }

        async function saveScheduleProfile() {
          if (!scheduleModalStateRef.runId || !scheduleSaveEl || !scheduleFooterNoteEl) {
            return;
          }
          const frequency = scheduleFrequencyEl ? scheduleFrequencyEl.value : "monthly";
          const timezone = scheduleTimezoneEl && scheduleTimezoneEl.value.trim().length > 0 ? scheduleTimezoneEl.value.trim() : "UTC";
          const questionPlan = getScheduleQuestionPlan();
          const missing = questionPlan.find(function (entry) {
            return !entry.next_run_behavior || entry.next_run_behavior.trim().length === 0;
          });
          if (missing) {
            scheduleFooterNoteEl.textContent = "Please confirm how Q" + missing.question_number + " should rerun before saving.";
            return;
          }
          const payload = {
            frequency,
            timezone,
            hour_local: scheduleHourEl ? Math.max(0, Math.min(23, Number(scheduleHourEl.value) || 0)) : 0,
            minute_local: scheduleMinuteEl ? Math.max(0, Math.min(59, Number(scheduleMinuteEl.value) || 0)) : 0,
            windowing_instructions:
              scheduleWindowingEl && scheduleWindowingEl.value.trim().length > 0
                ? scheduleWindowingEl.value.trim()
                : "Roll each scoped time window forward to the latest complete reporting period on every scheduled run.",
            additional_instructions:
              scheduleAdditionalEl && scheduleAdditionalEl.value.trim().length > 0
                ? scheduleAdditionalEl.value.trim()
                : "",
            question_execution_plan: questionPlan.map(function (entry) {
              return {
                question_number: entry.question_number,
                next_run_behavior: entry.next_run_behavior
              };
            })
          };
          if (frequency === "weekly") {
            payload.day_of_week = scheduleWeekdayEl ? Number(scheduleWeekdayEl.value) : 1;
          }
          if (frequency === "monthly" || frequency === "quarterly") {
            payload.day_of_month = scheduleMonthdayEl ? Number(scheduleMonthdayEl.value) : 1;
          }

          scheduleSaveEl.disabled = true;
          scheduleFooterNoteEl.textContent = "Saving schedule...";
          try {
            const response = await fetch("/api/runs/" + encodeURIComponent(scheduleModalStateRef.runId) + "/schedule-profile", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) {
              throw new Error(result && result.message ? result.message : "Unable to save schedule.");
            }
            closeScheduleModal();
            appendMessage(
              "assistant",
              buildScheduleSavedMessage(result.understanding || result.profile || {}),
              null,
              null,
              { trackForNaming: false }
            );
          } catch (error) {
            scheduleFooterNoteEl.textContent = error instanceof Error ? error.message : "Unable to save schedule.";
          } finally {
            scheduleSaveEl.disabled = false;
          }
        }

        async function bootstrapScheduledRunFromUrl() {
          const params = new URLSearchParams(window.location.search);
          const runId = params.get("scheduled_run_id");
          if (!runId) {
            return;
          }

          try {
            const existing = chatsRef.value.find(function (entry) {
              return entry && entry.state && entry.state.last_run_id === runId && entry.state.scheduled_report_view === true;
            });
            if (existing) {
              activateChat(existing.id);
              window.history.replaceState({}, "", "/app");
              return;
            }

            const response = await fetch("/api/run-status/" + encodeURIComponent(runId), { method: "GET" });
            const payload = await response.json();
            if (!response.ok || !payload || payload.status !== "succeeded") {
              throw new Error(payload && payload.message ? payload.message : "Unable to load scheduled run.");
            }

            const createdAt = nowIso();
            const session = createEmptyChatSession();
            const baseState = createStateFromDbContext({ allowed_relations: [], allowed_schemas: [] });
            session.title = sanitizeTitle("Scheduled report");
            session.title_auto = false;
            session.db_bootstrapped = true;
            session.created_at = createdAt;
            session.updated_at = createdAt;
            session.state = Object.assign({}, baseState, {
              last_run_id: runId,
              last_exec_brief: payload.exec_brief || null,
              prepared_payloads: Array.isArray(payload.prepared_payloads) ? payload.prepared_payloads : [],
              post_run_actions_pending: true,
              scheduled_report_view: true,
              report_clarification_active: false,
              business_case_active: false,
              business_case_candidates: [],
              business_case_selected_candidate_id: null,
              business_case_assumption_notes: [],
              business_case_pending_clarification: null
            });
            syncChatTitleToState(session);
            session.messages = [
              {
                role: "assistant",
                text: "Scheduled report loaded. You can ask clarifications on the report or run a business case from this report.",
                download_url: payload.pdf_path ? "/api/runs/" + runId + "/pdf" : null,
                exec_brief_html: typeof payload.exec_brief_html === "string" ? payload.exec_brief_html : null,
                prepared_payloads: Array.isArray(payload.prepared_payloads) ? payload.prepared_payloads : null,
                at: createdAt
              }
            ];
            chatsRef.value.unshift(session);
            if (chatsRef.value.length > MAX_STORED_CHATS) {
              chatsRef.value = chatsRef.value.slice(0, MAX_STORED_CHATS);
            }
            saveChatsToStorage();
            activateChat(session.id);
          } catch (error) {
            appendMessage("assistant", error instanceof Error ? error.message : "Unable to load scheduled run.", null, null, { trackForNaming: false });
          } finally {
            window.history.replaceState({}, "", "/app");
          }
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

          if (payload.warnings && payload.warnings.length > 0) {
            const meta = document.createElement("div");
            meta.className = "query-card-meta";
            const warn = document.createElement("span");
            warn.style.color = "#f59e0b";
            warn.textContent = "\u26A0 " + payload.warnings[0];
            meta.appendChild(warn);
            card.appendChild(meta);
          }

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

          const targetChatId = opts.chatId || activeChatIdRef.value;
          const targetChat = getChatById(targetChatId);
          if (!targetChat) {
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
            chatId: targetChatId,
            trackForNaming: opts.trackForNaming !== false,
            rawUserMessage: value
          });
          syncChatTitleToState(targetChat);
          const requestStateSnapshot = cloneJson(targetChat.state);
          setBusy(true);
          const isRunConfirm = /^(confirm|yes|go ahead|proceed|looks good|lgtm|run it|do it|execute|approved|ok|okay|sure|start)\\b/i.test(value);
          showThinking(isRunConfirm ? "planning" : "chatting");
          const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
          const timeoutId = setTimeout(function () {
            if (controller) {
              controller.abort();
            }
          }, 14 * 60 * 1000);

          try {
            const response = await fetch("/api/chat", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                message: value,
                chat_session_id: targetChatId,
                state: requestStateSnapshot
              }),
              signal: controller ? controller.signal : undefined
            });

            let payload;
            try {
              const rawResponse = await response.text();
              payload = rawResponse.trim().length > 0 ? JSON.parse(rawResponse) : {};
            } catch {
              appendMessage("assistant", "Server error — please try again in a moment.", null, null, {
                chatId: targetChatId,
                trackForNaming: false
              });
              return;
            }
            if (!response.ok) {
              const errorText = payload && typeof payload.message === "string" ? payload.message : "Chat request failed";
              appendMessage("assistant", "Error: " + errorText, null, null, {
                chatId: targetChatId,
                trackForNaming: false
              });
              return;
            }

            setChatState(targetChatId, payload.state);
            const assistantMessage =
              typeof payload.assistant_message === "string" && payload.assistant_message.trim().length > 0
                ? payload.assistant_message.trim()
                : "I got your question, but the assistant returned an empty response. Please try once more.";
            appendMessage("assistant", assistantMessage, payload.pdf_download_url, payload.exec_brief_html, {
              chatId: targetChatId,
              trackForNaming: false,
              prepared_payloads: Array.isArray(payload.prepared_payloads) ? payload.prepared_payloads : (payload.state && Array.isArray(payload.state.prepared_payloads) ? payload.state.prepared_payloads : null)
            });
          } catch (error) {
            if (error && error.name === "AbortError") {
              appendMessage(
                "assistant",
                "This request took longer than expected. On larger prep or analysis steps, please wait a few minutes and try again.",
                null,
                null,
                { chatId: targetChatId, trackForNaming: false }
              );
              return;
            }
            const errorText = error instanceof Error ? error.message : "Unknown error";
            if (/unexpected token|doctype|not valid json|non-json/i.test(errorText)) {
              appendMessage(
                "assistant",
                "Final analysis response was invalid. Please retry the same action once.",
                null,
                null,
                { chatId: targetChatId, trackForNaming: false }
              );
              return;
            }
            appendMessage("assistant", "Network error: " + errorText, null, null, {
              chatId: targetChatId,
              trackForNaming: false
            });
          } finally {
            clearTimeout(timeoutId);
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
            session_title: null,
            contract_id: null,
            last_run_id: null,
            last_query_id: null,
            last_exec_brief: null,
            conversation_history: [],
            prep_pending: false,
            prep_complete: false,
            scope_pending: false,
            scope_finalized: false,
            metric_definitions: [],
            pending_metric_confirmations: [],
            pending_metric_resume_message: null,
            pending_metric_resume_mode: null,
            scope_clarification_pending: false,
            scope_business_context: null,
            scope_source_prompt: null,
            scope_questions: [],
            pending_query_sql: null,
            pending_query_limit: null,
            pending_single_query_request: null,
            last_single_query_snapshot: null,
            planner_summary: null,
            preparation_summary: null,
            prepared_payloads: [],
            prepared_query_overrides: [],
            post_run_actions_pending: false,
            scheduled_report_view: false,
            report_clarification_active: false,
            business_case_active: false,
            business_case_candidates: [],
            business_case_selected_candidate_id: null,
            business_case_assumption_notes: [],
            business_case_pending_clarification: null,
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
              syncChatTitleToState(chat);
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

            // Seed persisted user settings (metric definitions + business context)
            try {
              const settingsRes = await fetch("/api/config/user-settings", { method: "GET" });
              if (settingsRes.ok) {
                let settings;
                try { settings = JSON.parse(await settingsRes.text()); } catch { settings = null; }
                if (settings && chat.state) {
                  const defs = Array.isArray(settings.metric_definitions) ? settings.metric_definitions : [];
                  if (defs.length > 0) {
                    chat.state.metric_definitions = defs.map(function(m) {
                      return {
                        metric_key: m.metric_key || "",
                        display_name: m.display_name || "",
                        definition: m.definition || ""
                      };
                    });
                  }
                  if (typeof settings.business_context === "string" && settings.business_context.trim().length > 0) {
                    chat.state.scope_business_context = settings.business_context;
                  }
                }
              }
            } catch {
              // User settings fetch is optional
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
            syncChatTitleToState(target);
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

          const local = chatsRef.value.slice();
          const mergedById = new Map();

          for (const session of remote) {
            mergedById.set(session.id, session);
          }
          for (const session of local) {
            mergedById.set(session.id, chooseFresherSession(session, mergedById.get(session.id)));
          }

          const merged = Array.from(mergedById.values())
            .sort((a, b) => getChatFreshnessMs(b) - getChatFreshnessMs(a))
            .slice(0, MAX_STORED_CHATS);

          chatsRef.value = merged;
          if (!getChatById(activeChatIdRef.value)) {
            activeChatIdRef.value = merged[0].id;
          }
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
        if (scheduleModalBackdropEl) {
          scheduleModalBackdropEl.addEventListener("click", closeScheduleModal);
        }
        var scheduleModalCloseEl = document.getElementById("schedule-modal-close");
        if (scheduleModalCloseEl) {
          scheduleModalCloseEl.addEventListener("click", closeScheduleModal);
        }
        if (scheduleCancelEl) {
          scheduleCancelEl.addEventListener("click", closeScheduleModal);
        }
        if (scheduleSaveEl) {
          scheduleSaveEl.addEventListener("click", function () {
            void saveScheduleProfile();
          });
        }
        [
          scheduleFrequencyEl,
          scheduleTimezoneEl,
          scheduleWeekdayEl,
          scheduleMonthdayEl,
          scheduleHourEl,
          scheduleMinuteEl,
          scheduleWindowingEl,
          scheduleAdditionalEl
        ].forEach(function (element) {
          if (!element) {
            return;
          }
          element.addEventListener("input", function () {
            toggleScheduleDayFields();
            renderSchedulePreview();
          });
          element.addEventListener("change", function () {
            toggleScheduleDayFields();
            renderSchedulePreview();
          });
        });
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape") {
            closeQueriesModal();
            closeScheduleModal();
          }
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

        if (newChatButtonEl) {
          newChatButtonEl.addEventListener("click", () => {
            if (activeRunPollId) {
              return;
            }
            createNewChatAndActivate();
            if (!composerStateRef.locked) {
              inputEl.focus();
            }
          });
        }

        if (historyToggleButtonEl) {
          historyToggleButtonEl.addEventListener("click", function () {
            toggleHistoryCollapsed();
          });
        }

        loadHistoryCollapsedPreference();
        applyHistoryCollapsedState();
        initializeSessions();
        void hydrateSessionsFromServer()
          .catch(function () {
            return null;
          })
          .finally(function () {
            void bootstrapScheduledRunFromUrl();
          });
        refreshDecisionFromState(stateRef.value);

        // Refresh history list timestamps every 30 seconds so "just now" ages properly
        setInterval(function () {
          renderHistoryList();
        }, 30_000);
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


