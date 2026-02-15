export function renderConnectionPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Overload | Database Connector</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap");

      :root {
        --ink: #102a43;
        --ink-soft: #486581;
        --line: rgba(16, 42, 67, 0.16);
        --surface: rgba(255, 255, 255, 0.94);
        --bg-start: #f0f9ff;
        --bg-end: #e6fffa;
        --accent: #0ea5e9;
        --accent-2: #14b8a6;
        --warn: #f59e0b;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Sora", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 15% 15%, rgba(14, 165, 233, 0.2), transparent 30%),
          radial-gradient(circle at 80% 0%, rgba(20, 184, 166, 0.2), transparent 30%),
          linear-gradient(155deg, var(--bg-start), var(--bg-end));
      }

      .page {
        width: min(1180px, 100% - 28px);
        margin: 18px auto 28px;
        display: grid;
        grid-template-columns: 1.1fr 1fr;
        gap: 16px;
      }

      .card {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--surface);
        box-shadow: 0 18px 40px rgba(16, 42, 67, 0.14);
        padding: 16px;
      }

      .top {
        grid-column: 1 / -1;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .top h1 {
        margin: 0;
        font-size: 1.1rem;
      }

      .top a {
        text-decoration: none;
        color: #075985;
        border: 1px solid rgba(7, 89, 133, 0.25);
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 0.8rem;
      }

      label {
        display: block;
        font-size: 0.8rem;
        color: var(--ink-soft);
        margin-bottom: 6px;
      }

      input,
      textarea,
      button,
      select {
        font-family: "IBM Plex Mono", monospace;
      }

      input,
      textarea {
        width: 100%;
        border-radius: 12px;
        border: 1px solid var(--line);
        padding: 11px 12px;
        background: rgba(255, 255, 255, 0.95);
        color: var(--ink);
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
        border: none;
        border-radius: 10px;
        padding: 10px 14px;
        cursor: pointer;
        font-size: 0.78rem;
      }

      .primary {
        background: linear-gradient(130deg, var(--accent), var(--accent-2));
        color: #06202e;
      }

      .secondary {
        background: rgba(14, 165, 233, 0.12);
        color: #0f3f64;
        border: 1px solid rgba(14, 165, 233, 0.3);
      }

      .warn {
        background: rgba(245, 158, 11, 0.16);
        color: #5a3b03;
        border: 1px solid rgba(245, 158, 11, 0.4);
      }

      .muted {
        color: var(--ink-soft);
        font-size: 0.78rem;
      }

      .status {
        font-size: 0.78rem;
        color: var(--ink-soft);
        margin-bottom: 8px;
      }

      .table-list {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px;
        max-height: 360px;
        overflow: auto;
        background: rgba(255, 255, 255, 0.92);
      }

      .table-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
        font-size: 0.78rem;
      }

      .output {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px;
        max-height: 360px;
        overflow: auto;
        background: #0b1f30;
        color: #d7ecff;
        font-family: "IBM Plex Mono", monospace;
        font-size: 0.74rem;
        white-space: pre-wrap;
      }

      @media (max-width: 980px) {
        .page {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header class="card top">
        <h1>Database Connector + Safe Query Module</h1>
        <a href="/">Open Chat Interface</a>
      </header>

      <section class="card">
        <div class="status" id="connection-status">No active runtime connection.</div>

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

        <div>
          <label for="connection-string">Postgres Connection String</label>
          <input id="connection-string" type="password" placeholder="postgresql://user:pass@host:5432/db?sslmode=require" />
        </div>

        <div class="actions">
          <button class="secondary" id="test-connection">Test Connection</button>
          <button class="primary" id="connect-connection">Connect + Save Allowlist</button>
          <button class="warn" id="disconnect-connection">Disconnect</button>
        </div>

        <p class="muted">Select allowlisted tables below before connecting for governed query execution.</p>
        <div class="actions">
          <button class="secondary" id="select-all">Select All</button>
          <button class="secondary" id="select-none">Select None</button>
          <button class="secondary" id="save-allowlist">Update Allowlist</button>
        </div>
        <div class="table-list" id="table-list"></div>
      </section>

      <section class="card">
        <label for="safe-sql">Run Safe Query (SELECT only)</label>
        <textarea id="safe-sql">SELECT * FROM analytics.sales LIMIT 50</textarea>
        <div class="actions">
          <button class="primary" id="run-query">Run Query</button>
        </div>
        <p class="muted">Queries are validated for SELECT-only and allowlisted tables/schemas, with enforced LIMIT.</p>
        <div class="output" id="query-output"></div>
      </section>
    </div>

    <script>
      (() => {
        const elements = {
          status: document.getElementById("connection-status"),
          name: document.getElementById("connection-name"),
          connectionString: document.getElementById("connection-string"),
          queryLimit: document.getElementById("query-limit"),
          tableList: document.getElementById("table-list"),
          sql: document.getElementById("safe-sql"),
          output: document.getElementById("query-output"),
          testBtn: document.getElementById("test-connection"),
          connectBtn: document.getElementById("connect-connection"),
          disconnectBtn: document.getElementById("disconnect-connection"),
          runBtn: document.getElementById("run-query"),
          selectAllBtn: document.getElementById("select-all"),
          selectNoneBtn: document.getElementById("select-none"),
          saveAllowlistBtn: document.getElementById("save-allowlist")
        };

        const state = {
          tables: [],
          selected: new Set()
        };

        function renderTables() {
          elements.tableList.innerHTML = "";

          if (!Array.isArray(state.tables) || state.tables.length === 0) {
            elements.tableList.textContent = "No tables loaded yet. Test a connection first.";
            return;
          }

          for (const table of state.tables) {
            const row = document.createElement("label");
            row.className = "table-item";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = state.selected.has(table);
            checkbox.addEventListener("change", () => {
              if (checkbox.checked) {
                state.selected.add(table);
              } else {
                state.selected.delete(table);
              }
            });

            const text = document.createElement("span");
            text.textContent = table;

            row.appendChild(checkbox);
            row.appendChild(text);
            elements.tableList.appendChild(row);
          }
        }

        function showOutput(value) {
          elements.output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
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

        function setConnectionStatus(context) {
          if (!context || !context.connected) {
            elements.status.textContent = "No active runtime connection.";
            return;
          }

          const source = typeof context.source === "string" ? context.source : "runtime";
          const db = context.database || context.name || "unknown";
          const tableCount = Array.isArray(context.allowed_relations) ? context.allowed_relations.length : 0;
          elements.status.textContent = "Connected: " + db + " | source: " + source + " | allowlisted tables: " + tableCount;
        }

        async function loadContext() {
          const context = await request("/api/db/context", "GET");
          setConnectionStatus(context);

          if (Array.isArray(context.available_relations)) {
            state.tables = context.available_relations;
          } else {
            state.tables = [];
          }

          state.selected = new Set(Array.isArray(context.allowed_relations) ? context.allowed_relations : []);
          renderTables();
        }

        elements.testBtn.addEventListener("click", async () => {
          try {
            const connectionString = String(elements.connectionString.value || "").trim();
            if (!connectionString) {
              throw new Error("Connection string is required.");
            }

            const result = await request("/api/db/test", "POST", {
              connection_string: connectionString
            });

            state.tables = Array.isArray(result.available_relations) ? result.available_relations : [];
            state.selected = new Set(state.tables);
            renderTables();
            showOutput(result);
          } catch (error) {
            showOutput(error instanceof Error ? error.message : "Unknown error");
          }
        });

        elements.connectBtn.addEventListener("click", async () => {
          try {
            const connectionString = String(elements.connectionString.value || "").trim();
            if (!connectionString) {
              throw new Error("Connection string is required.");
            }

            const context = await request("/api/db/connect", "POST", {
              name: String(elements.name.value || "").trim() || undefined,
              connection_string: connectionString,
              allowed_relations: Array.from(state.selected)
            });

            setConnectionStatus(context);
            state.tables = Array.isArray(context.available_relations) ? context.available_relations : state.tables;
            state.selected = new Set(Array.isArray(context.allowed_relations) ? context.allowed_relations : []);
            renderTables();
            showOutput(context);
          } catch (error) {
            showOutput(error instanceof Error ? error.message : "Unknown error");
          }
        });

        elements.disconnectBtn.addEventListener("click", async () => {
          try {
            await request("/api/db/disconnect", "POST");
            await loadContext();
            showOutput("Disconnected.");
          } catch (error) {
            showOutput(error instanceof Error ? error.message : "Unknown error");
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
            showOutput(error instanceof Error ? error.message : "Unknown error");
          }
        });

        elements.selectAllBtn.addEventListener("click", () => {
          state.selected = new Set(state.tables);
          renderTables();
        });

        elements.selectNoneBtn.addEventListener("click", () => {
          state.selected = new Set();
          renderTables();
        });

        elements.saveAllowlistBtn.addEventListener("click", async () => {
          try {
            if (state.selected.size === 0) {
              throw new Error("Select at least one table for allowlist.");
            }

            const context = await request("/api/db/allowlist", "POST", {
              allowed_relations: Array.from(state.selected)
            });

            setConnectionStatus(context);
            state.selected = new Set(Array.isArray(context.allowed_relations) ? context.allowed_relations : []);
            renderTables();
            showOutput(context);
          } catch (error) {
            showOutput(error instanceof Error ? error.message : "Unknown error");
          }
        });

        loadContext().catch((error) => {
          showOutput(error instanceof Error ? error.message : "Failed to load context");
        });
      })();
    </script>
  </body>
</html>`;
}
