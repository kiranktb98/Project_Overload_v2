// ─────────────────────────────────────────────────────────────────────────────
// Help Chat Widget
// Floating button + slide-out panel injected into every post-login page.
// Calls POST /api/help/chat  { message, history } → { reply }
// ─────────────────────────────────────────────────────────────────────────────

export const HELP_WIDGET_STYLES = `
  /* ── Help widget ── */
  #help-fab {
    position: fixed;
    bottom: 28px;
    right: 28px;
    z-index: 9000;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6c3aed, #8b5cf6);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 18px rgba(108, 58, 237, 0.45);
    transition: transform 0.18s, box-shadow 0.18s;
    color: #fff;
  }
  #help-fab:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(108, 58, 237, 0.55); }
  #help-fab svg { width: 26px; height: 26px; }

  #help-panel {
    position: fixed;
    bottom: 0;
    right: 0;
    width: 380px;
    height: 100dvh;
    z-index: 8999;
    display: flex;
    flex-direction: column;
    background: #0d1a32;
    border-left: 1px solid rgba(140, 173, 255, 0.18);
    box-shadow: -8px 0 40px rgba(0, 0, 0, 0.4);
    transform: translateX(100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  }
  #help-panel.open { transform: translateX(0); }

  .help-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid rgba(140, 173, 255, 0.14);
    flex-shrink: 0;
    background: rgba(10, 20, 45, 0.98);
  }
  .help-header-info { display: flex; align-items: center; gap: 10px; }
  .help-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, #6c3aed, #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0;
  }
  .help-header strong { display: block; font-size: 13px; color: #e8eefc; }
  .help-header span { font-size: 11px; color: #73e2a7; }
  .help-close-btn {
    background: none; border: none; cursor: pointer; color: #94a8cb;
    padding: 4px; border-radius: 6px; display: flex;
    transition: color 0.15s, background 0.15s;
  }
  .help-close-btn:hover { color: #e8eefc; background: rgba(255,255,255,0.07); }
  .help-close-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; }

  .help-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-behavior: smooth;
  }

  .help-bubble {
    max-width: 92%;
    padding: 10px 13px;
    border-radius: 14px;
    font-size: 13.5px;
    line-height: 1.55;
    word-break: break-word;
  }
  .help-bubble.user {
    background: linear-gradient(135deg, rgba(108, 58, 237, 0.82), rgba(139, 92, 246, 0.75));
    color: #f0ecff;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
  }
  .help-bubble.assistant {
    background: rgba(16, 36, 70, 0.9);
    border: 1px solid rgba(140, 173, 255, 0.16);
    color: #d6e4ff;
    align-self: flex-start;
    border-bottom-left-radius: 4px;
  }
  .help-bubble.assistant p { margin: 0 0 7px; color: inherit; font-size: inherit; }
  .help-bubble.assistant p:last-child { margin-bottom: 0; }
  .help-bubble.assistant code {
    background: rgba(4, 13, 33, 0.65);
    border: 1px solid rgba(120, 180, 255, 0.2);
    border-radius: 5px;
    padding: 1px 5px;
    font-size: 12px;
    font-family: Consolas, monospace;
    color: #c8d8ff;
  }
  .help-bubble.assistant ul, .help-bubble.assistant ol {
    margin: 6px 0 0 16px; padding: 0; color: #b8ccee; font-size: 13px;
  }
  .help-bubble.assistant li { margin-bottom: 4px; }
  .help-bubble.assistant strong { color: #e8eefc; }

  .help-typing {
    display: flex; align-items: center; gap: 4px;
    padding: 10px 13px;
    background: rgba(16, 36, 70, 0.9);
    border: 1px solid rgba(140, 173, 255, 0.16);
    border-radius: 14px; border-bottom-left-radius: 4px;
    align-self: flex-start;
  }
  .help-typing span {
    width: 6px; height: 6px; border-radius: 50%;
    background: #6d7dff;
    animation: helpBounce 1.2s infinite ease-in-out;
  }
  .help-typing span:nth-child(2) { animation-delay: 0.2s; }
  .help-typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes helpBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-5px); opacity: 1; }
  }

  .help-welcome {
    text-align: center; padding: 20px 12px 8px;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
  }
  .help-welcome-icon {
    width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(135deg, #6c3aed, #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
  }
  .help-welcome strong { color: #e8eefc; font-size: 15px; display: block; }
  .help-welcome p { color: #94a8cb; font-size: 13px; margin: 0; line-height: 1.5; }

  .help-suggestions {
    display: flex; flex-direction: column; gap: 7px;
    padding: 0 2px;
  }
  .help-suggestion {
    background: rgba(16, 36, 70, 0.7);
    border: 1px solid rgba(140, 173, 255, 0.18);
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 12.5px;
    color: #b8ccee;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
  }
  .help-suggestion:hover { background: rgba(108, 58, 237, 0.22); border-color: rgba(108, 58, 237, 0.4); color: #e0e8ff; }

  .help-input-area {
    padding: 12px 14px;
    border-top: 1px solid rgba(140, 173, 255, 0.12);
    flex-shrink: 0;
    background: rgba(9, 17, 34, 0.98);
  }
  .help-input-row { display: flex; gap: 8px; align-items: flex-end; }
  #help-input {
    flex: 1;
    background: rgba(16, 36, 70, 0.7);
    border: 1px solid rgba(140, 173, 255, 0.22);
    border-radius: 10px;
    color: #e8eefc;
    font-size: 13.5px;
    padding: 9px 12px;
    resize: none;
    min-height: 40px;
    max-height: 120px;
    font-family: inherit;
    line-height: 1.45;
    outline: none;
    transition: border-color 0.15s;
  }
  #help-input:focus { border-color: rgba(108, 58, 237, 0.6); }
  #help-input::placeholder { color: #4a6080; }
  #help-send {
    width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
    background: linear-gradient(135deg, #6c3aed, #8b5cf6);
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: opacity 0.15s, transform 0.15s;
  }
  #help-send:hover { opacity: 0.88; transform: scale(1.05); }
  #help-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  #help-send svg { width: 16px; height: 16px; stroke: #fff; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

  /* Light mode overrides */
  [data-theme="light"] #help-panel { background: #f5f3ff; border-left-color: rgba(107, 92, 138, 0.2); }
  [data-theme="light"] .help-header { background: #ede9ff; border-bottom-color: rgba(107, 92, 138, 0.18); }
  [data-theme="light"] .help-bubble.assistant { background: #ede9ff; border-color: rgba(107, 92, 138, 0.22); color: #1A1533; }
  [data-theme="light"] .help-bubble.assistant p, [data-theme="light"] .help-bubble.assistant li { color: #2D1F56; }
  [data-theme="light"] .help-bubble.assistant strong { color: #1A1533; }
  [data-theme="light"] .help-bubble.assistant code { background: rgba(107,92,138,0.1); color: #3b0764; border-color: rgba(107,92,138,0.25); }
  [data-theme="light"] .help-suggestion { background: #ede9ff; border-color: rgba(107,92,138,0.22); color: #2D1F56; }
  [data-theme="light"] .help-suggestion:hover { background: rgba(108,58,237,0.12); }
  [data-theme="light"] #help-input { background: #fff; border-color: rgba(107,92,138,0.3); color: #1A1533; }
  [data-theme="light"] #help-input::placeholder { color: #9b92b8; }
  [data-theme="light"] .help-input-area { background: #ede9ff; border-top-color: rgba(107,92,138,0.18); }
  [data-theme="light"] .help-typing { background: #ede9ff; border-color: rgba(107,92,138,0.22); }
  [data-theme="light"] .help-welcome p { color: #5a4d7a; }
  [data-theme="light"] #help-fab { box-shadow: 0 4px 18px rgba(108,58,237,0.3); }
`;

export function renderHelpWidget(): string {
  return `
  <!-- Help Chat Widget -->
  <button id="help-fab" type="button" aria-label="Open help chat" title="Ask Claritect Assistant">
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <!-- head -->
      <rect x="4" y="8" width="16" height="11" rx="3"/>
      <!-- antenna -->
      <line x1="12" y1="8" x2="12" y2="4"/>
      <circle cx="12" cy="3.5" r="1" fill="#fff" stroke="none"/>
      <!-- eyes -->
      <circle cx="9" cy="13" r="1.2" fill="#fff" stroke="none"/>
      <circle cx="15" cy="13" r="1.2" fill="#fff" stroke="none"/>
      <!-- mouth -->
      <path d="M9 16.5 Q12 18 15 16.5" stroke="#fff" fill="none"/>
      <!-- ears -->
      <line x1="4" y1="12" x2="2" y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
    </svg>
  </button>

  <div id="help-panel" role="dialog" aria-label="Claritect Assistant">
    <div class="help-header">
      <div class="help-header-info">
        <div class="help-avatar">✦</div>
        <div>
          <strong>Claritect Assistant</strong>
          <span>● Online</span>
        </div>
      </div>
      <button class="help-close-btn" id="help-close" type="button" aria-label="Close help">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="help-messages" id="help-messages">
      <div class="help-welcome">
        <div class="help-welcome-icon">✦</div>
        <strong>Hi, I'm your Claritect assistant</strong>
        <p>Ask me anything about connecting your database, SSL settings, governance, or using the chat explorer.</p>
      </div>
      <div class="help-suggestions" id="help-suggestions">
        <button class="help-suggestion" type="button">How do I connect my Postgres database?</button>
        <button class="help-suggestion" type="button">What SSL mode should I use?</button>
        <button class="help-suggestion" type="button">What does the governance step do?</button>
        <button class="help-suggestion" type="button">I'm getting an SSL certificate error</button>
        <button class="help-suggestion" type="button">How do I start querying my data?</button>
      </div>
    </div>

    <div class="help-input-area">
      <div class="help-input-row">
        <textarea id="help-input" placeholder="Ask anything…" rows="1" aria-label="Message"></textarea>
        <button id="help-send" type="button" aria-label="Send" disabled>
          <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  </div>

  <script>
  (function() {
    var fab = document.getElementById("help-fab");
    var panel = document.getElementById("help-panel");
    var closeBtn = document.getElementById("help-close");
    var messagesEl = document.getElementById("help-messages");
    var inputEl = document.getElementById("help-input");
    var sendBtn = document.getElementById("help-send");
    var suggestionsEl = document.getElementById("help-suggestions");

    var history = [];
    var sessionId = null;
    var busy = false;

    function openPanel() {
      panel.classList.add("open");
      fab.style.display = "none";
      inputEl.focus();
    }
    function closePanel() {
      panel.classList.remove("open");
      fab.style.display = "";
    }

    fab.addEventListener("click", openPanel);
    closeBtn.addEventListener("click", closePanel);

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && panel.classList.contains("open")) closePanel();
    });

    // Suggestion clicks
    if (suggestionsEl) {
      suggestionsEl.querySelectorAll(".help-suggestion").forEach(function(btn) {
        btn.addEventListener("click", function() {
          send(btn.textContent.trim());
        });
      });
    }

    // Auto-resize textarea
    inputEl.addEventListener("input", function() {
      sendBtn.disabled = inputEl.value.trim().length === 0 || busy;
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    });

    inputEl.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!busy && inputEl.value.trim()) send(inputEl.value.trim());
      }
    });

    sendBtn.addEventListener("click", function() {
      if (!busy && inputEl.value.trim()) send(inputEl.value.trim());
    });

    function addBubble(role, text) {
      // Remove suggestions on first real message
      if (suggestionsEl && suggestionsEl.parentNode) {
        suggestionsEl.remove();
      }
      var el = document.createElement("div");
      el.className = "help-bubble " + role;
      if (role === "assistant") {
        el.innerHTML = formatMarkdown(text);
      } else {
        el.textContent = text;
      }
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return el;
    }

    function showTyping() {
      var el = document.createElement("div");
      el.className = "help-typing";
      el.id = "help-typing-indicator";
      el.innerHTML = "<span></span><span></span><span></span>";
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function removeTyping() {
      var el = document.getElementById("help-typing-indicator");
      if (el) el.remove();
    }

    function setBusy(val) {
      busy = val;
      sendBtn.disabled = val || inputEl.value.trim().length === 0;
      inputEl.disabled = val;
    }

    function send(message) {
      if (busy) return;
      addBubble("user", message);
      inputEl.value = "";
      inputEl.style.height = "auto";
      sendBtn.disabled = true;
      setBusy(true);
      showTyping();

      // Keep last 8 exchanges (16 messages) to control costs
      var historyToSend = history.slice(-16);

      fetch("/api/help/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.assign({ message: message, history: historyToSend }, sessionId ? { session_id: sessionId } : {}))
      })
        .then(function(r) {
          if (r.status === 401) { return Promise.reject("auth"); }
          return r.json().then(function(data) {
            if (!r.ok) { return Promise.reject(data.reply || r.status); }
            return data;
          });
        })
        .then(function(data) {
          removeTyping();
          var reply = data.reply || "Sorry, something went wrong.";
          if (data.session_id) sessionId = data.session_id;
          addBubble("assistant", reply);
          history.push({ role: "user", content: message });
          history.push({ role: "assistant", content: reply });
        })
        .catch(function(err) {
          removeTyping();
          console.error("[help-chat] error:", err);
          if (err === "auth") {
            addBubble("assistant", "Your session has expired. Please refresh the page and log in again.");
          } else if (typeof err === "string" && err.length > 0 && err.length < 300) {
            addBubble("assistant", err);
          } else {
            addBubble("assistant", "Sorry, I couldn't connect right now. Try refreshing or check the guides at /connect/guide.");
          }
        })
        .finally(function() {
          setBusy(false);
        });
    }

    // Lightweight markdown renderer (all regex built at runtime to avoid template-literal escape issues)
    var rBold = new RegExp("\\*\\*(.+?)\\*\\*", "g");
    var rCode = new RegExp("\\x60([^\\x60]+)\\x60", "g");
    var rBullet = new RegExp("^[-\\u2022]\\s+(.+)$", "gm");
    var rNL2 = new RegExp("\\n\\n+", "g");
    var rNL1 = new RegExp("\\n", "g");
    function formatMarkdown(text) {
      var safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      safe = safe.replace(rBold, "<strong>$1</strong>");
      safe = safe.replace(rCode, "<code>$1</code>");
      safe = safe.replace(rBullet, "<li>$1</li>");
      safe = safe.replace(rNL2, "</p><p>");
      safe = safe.replace(rNL1, "<br>");
      return "<p>" + safe + "</p>";
    }
  })();
  </script>
`;
}
