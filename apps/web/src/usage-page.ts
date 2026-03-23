export function renderUsageMetricsPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Overload | Usage Metrics</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Mona+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap");

      :root {
        --ink: #edf4ff;
        --ink-soft: #8ca2cb;
        --ink-muted: #6076a1;
        --line: rgba(104, 137, 206, 0.18);
        --line-soft: rgba(116, 156, 238, 0.34);
        --glow: rgba(108, 111, 255, 0.36);
        --shadow: 0 24px 60px rgba(1, 8, 28, 0.44);
        --shadow-soft: 0 12px 32px rgba(3, 9, 27, 0.26);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Mona Sans", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 14% 10%, rgba(110, 165, 255, 0.17), transparent 24%),
          radial-gradient(circle at 88% 8%, rgba(104, 92, 255, 0.15), transparent 26%),
          radial-gradient(circle at 50% 100%, rgba(59, 132, 255, 0.1), transparent 30%),
          linear-gradient(180deg, #020714 0%, #06112e 44%, #061533 100%);
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

      body::after {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 18% 22%, rgba(115, 191, 255, 0.12), transparent 20%),
          radial-gradient(circle at 78% 16%, rgba(120, 102, 255, 0.16), transparent 24%);
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
        min-height: calc(100vh - 28px);
        gap: 14px;
      }

      .platform-panel {
        position: relative;
        border: 1px solid var(--line);
        border-radius: 28px;
        background:
          linear-gradient(180deg, rgba(10, 22, 55, 0.98), rgba(5, 14, 36, 0.98)),
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
          radial-gradient(circle at 20% 0%, rgba(118, 171, 255, 0.14), transparent 26%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 30%);
      }

      .platform-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 6px 14px;
        margin-bottom: 10px;
        border-bottom: 1px solid rgba(130, 162, 231, 0.14);
        position: relative;
        z-index: 1;
      }

      .platform-brand-badge {
        width: 42px;
        height: 42px;
        border-radius: 15px;
        display: grid;
        place-items: center;
        font-weight: 800;
        color: #f3f8ff;
        background: linear-gradient(145deg, #66a7ff, #6c6cff 56%, #7fd0ff);
        box-shadow: 0 14px 32px rgba(76, 122, 255, 0.34);
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
        font-family: "JetBrains Mono", monospace;
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
        color: #9eb3d9;
        text-decoration: none;
        border: 1px solid rgba(117, 148, 214, 0.06);
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
        transform: translateX(2px);
        background: rgba(33, 62, 129, 0.36);
        border-color: rgba(112, 152, 244, 0.26);
      }

      .platform-link.active {
        background: linear-gradient(135deg, rgba(72, 99, 255, 0.9), rgba(89, 92, 255, 0.92) 54%, rgba(109, 208, 255, 0.82));
        border-color: rgba(151, 191, 255, 0.4);
        color: #f3f8ff;
        box-shadow: 0 14px 28px rgba(67, 93, 222, 0.28);
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
        border: 1px solid rgba(111, 147, 220, 0.14);
        border-radius: 16px;
        padding: 11px 12px;
        background: rgba(10, 24, 58, 0.76);
      }

      .platform-user-avatar {
        width: 28px;
        height: 28px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        border: 1px solid #2f4d95;
        color: #9cb3e3;
        background: rgba(12, 29, 72, 0.9);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
        border: 1px solid rgba(111, 147, 220, 0.14);
        border-radius: 16px;
        padding: 9px 11px 9px 12px;
        background: rgba(7, 18, 45, 0.82);
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
        border: 1px solid rgba(122, 155, 226, 0.22);
        border-radius: 12px;
        background: rgba(16, 36, 84, 0.9);
        color: #cfddff;
        padding: 7px 10px;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.64rem;
        cursor: pointer;
      }

      .content {
        border: 1px solid var(--line);
        border-radius: 32px;
        background:
          linear-gradient(180deg, rgba(5, 12, 34, 0.98), rgba(3, 10, 26, 0.99)),
          radial-gradient(circle at 100% 0%, rgba(113, 122, 255, 0.12), transparent 24%);
        box-shadow: var(--shadow);
        padding: 20px 22px 22px;
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
        color: #7fd0ff;
      }

      .badge {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.62rem;
        color: var(--ink-soft);
        padding: 6px 10px 5px;
        border-radius: 999px;
        border: 1px solid #29498e;
        background: rgba(10, 29, 70, 0.88);
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(4, minmax(120px, 1fr));
        gap: 10px;
        margin-bottom: 14px;
      }

      .card {
        border: 1px solid rgba(120, 151, 221, 0.14);
        border-radius: 18px;
        background: linear-gradient(160deg, rgba(8, 22, 56, 0.86), rgba(6, 18, 46, 0.9));
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
        font-family: "JetBrains Mono", monospace;
        font-size: 1rem;
      }

      .table-wrap {
        border: 1px solid rgba(120, 151, 221, 0.14);
        border-radius: 18px;
        background: rgba(8, 22, 56, 0.68);
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
        border-bottom: 1px solid rgba(105, 140, 212, 0.15);
      }

      th {
        color: var(--ink-soft);
        font-family: "JetBrains Mono", monospace;
      }

      @media (max-width: 1080px) {
        .page { padding: 0; }
        .layout { grid-template-columns: 1fr; gap: 0; min-height: 100vh; }
        .platform-panel { display: none; }
        .content { border-left: 1px solid var(--line); border-radius: 0; }
        .cards { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
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
              <span>Decision cockpit</span>
            </div>
          </div>
          <div class="platform-section">Core Platform</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>Chat Explorer</a>
            <a class="platform-link active" href="/usage"><span class="link-icon"><svg viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></span>Usage Metrics</a>
          </nav>
          <div class="platform-section">Infrastructure</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/connect"><span class="link-icon"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></span>Data Sources</a>
            <a class="platform-link" href="/scheduled"><span class="link-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h3"/><path d="M8 18h6"/></svg></span>Scheduled Reports</a>
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

        <main class="content">
          <div class="content-head">
            <div>
              <span class="eyebrow">Operations</span>
              <h1>Usage Metrics</h1>
              <p class="sub">Operational metrics for query execution through the governed data plane.</p>
            </div>
            <span class="badge">Live Metrics</span>
          </div>

          <section class="cards">
            <article class="card"><small>Total Queries</small><strong id="m-total">0</strong></article>
            <article class="card"><small>Success Rate</small><strong id="m-success">0%</strong></article>
            <article class="card"><small>Avg Rows</small><strong id="m-rows">0</strong></article>
            <article class="card"><small>Avg Latency</small><strong id="m-latency">0ms</strong></article>
          </section>

          <section class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Query ID</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody id="usage-rows">
                <tr><td colspan="5">Loading usage metrics...</td></tr>
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </div>

    <script>
      (() => {
        function toNumber(value) {
          const n = Number(value);
          return Number.isFinite(n) ? n : 0;
        }

        function fmtTs(value) {
          const d = new Date(String(value || ""));
          return Number.isFinite(d.getTime()) ? d.toLocaleString() : "-";
        }

        async function load() {
          const tbody = document.getElementById("usage-rows");
          const response = await fetch("/api/db/query-logs");
          const payload = await response.json();
          if (!response.ok || !payload || !Array.isArray(payload.logs)) {
            tbody.innerHTML = "<tr><td colspan=\\"5\\">Unable to load metrics.</td></tr>";
            return;
          }

          const logs = payload.logs.slice().reverse();
          const total = logs.length;
          const ok = logs.filter((entry) => String(entry.status || "") === "ok").length;
          const avgRows = total === 0 ? 0 : logs.reduce((sum, entry) => sum + toNumber(entry.row_count), 0) / total;
          const avgLatency = total === 0 ? 0 : logs.reduce((sum, entry) => sum + toNumber(entry.execution_ms), 0) / total;

          document.getElementById("m-total").textContent = String(total);
          document.getElementById("m-success").textContent = (total === 0 ? 0 : Math.round((ok / total) * 100)) + "%";
          document.getElementById("m-rows").textContent = Math.round(avgRows).toLocaleString();
          document.getElementById("m-latency").textContent = Math.round(avgLatency) + "ms";

          if (total === 0) {
            tbody.innerHTML = "<tr><td colspan=\\"5\\">No queries executed yet.</td></tr>";
            return;
          }

          tbody.innerHTML = logs.slice(0, 120).map((entry) => {
            const id = String(entry.id || "-");
            const status = String(entry.status || "-");
            const rows = toNumber(entry.row_count).toLocaleString();
            const latency = Math.round(toNumber(entry.execution_ms)) + "ms";
            return "<tr>" +
              "<td>" + fmtTs(entry.timestamp) + "</td>" +
              "<td><code>" + id + "</code></td>" +
              "<td>" + status + "</td>" +
              "<td>" + rows + "</td>" +
              "<td>" + latency + "</td>" +
              "</tr>";
          }).join("");
        }

        load().catch(() => {
          const tbody = document.getElementById("usage-rows");
          tbody.innerHTML = "<tr><td colspan=\\"5\\">Unable to load metrics.</td></tr>";
        });
      })();
    </script>
  </body>
</html>`;
}
