export function renderConnectionPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Overload | Database Connection Wizard</title>
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
        --danger: #ef4444;
        --ok: #22c55e;
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

      .danger {
        background: rgba(239, 68, 68, 0.12);
        color: #7f1d1d;
        border: 1px solid rgba(239, 68, 68, 0.4);
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

      .kvs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 10px;
      }

      .kv {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px 12px;
        background: rgba(255, 255, 255, 0.92);
        min-height: 56px;
      }

      .kv .k {
        display: block;
        font-size: 0.72rem;
        color: var(--ink-soft);
        margin-bottom: 6px;
      }

      .kv .v {
        font-family: "IBM Plex Mono", monospace;
        font-size: 0.74rem;
        color: var(--ink);
        word-break: break-word;
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

      .badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-left: auto;
      }

      .badge {
        font-size: 0.68rem;
        border-radius: 999px;
        padding: 3px 8px;
        border: 1px solid var(--line);
        background: rgba(16, 42, 67, 0.06);
        color: var(--ink-soft);
        white-space: nowrap;
      }

      .badge.ok {
        background: rgba(34, 197, 94, 0.14);
        border-color: rgba(34, 197, 94, 0.3);
        color: #14532d;
      }

      .badge.warn {
        background: rgba(245, 158, 11, 0.14);
        border-color: rgba(245, 158, 11, 0.35);
        color: #5a3b03;
      }

      .badge.danger {
        background: rgba(239, 68, 68, 0.12);
        border-color: rgba(239, 68, 68, 0.35);
        color: #7f1d1d;
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

      .validation-panel {
        margin-top: 12px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.92);
        overflow: hidden;
      }

      .validation-summary {
        padding: 10px 14px;
        font-size: 0.82rem;
        font-weight: 600;
        border-bottom: 1px solid var(--line);
      }

      .validation-summary.all-ok {
        background: rgba(34, 197, 94, 0.1);
        color: #166534;
      }

      .validation-summary.has-errors {
        background: rgba(239, 68, 68, 0.1);
        color: #991b1b;
      }

      .val-table {
        padding: 8px 14px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        font-size: 0.78rem;
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

      .val-icon-ok { color: #22c55e; }
      .val-icon-fail { color: #ef4444; }

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
        color: #991b1b;
      }

      .val-spinner {
        text-align: center;
        padding: 12px;
        color: var(--ink-soft);
        font-size: 0.82rem;
        font-style: italic;
      }

      .callout {
        border-radius: 14px;
        border: 1px solid rgba(245, 158, 11, 0.35);
        background: rgba(245, 158, 11, 0.12);
        padding: 10px 12px;
        font-size: 0.78rem;
        color: #5a3b03;
        margin-top: 10px;
      }

      .callout strong {
        color: #4b2c00;
      }

      .modal {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(15, 23, 42, 0.45);
        z-index: 50;
      }

      .modal.open {
        display: flex;
      }

      .modal-card {
        width: min(920px, 100%);
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 20px 60px rgba(2, 6, 23, 0.28);
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
        background: #0b1f30;
        color: #d7ecff;
      }

      @media (max-width: 980px) {
        .page {
          grid-template-columns: 1fr;
        }

        .kvs {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header class="card top">
        <h1>1-Click Database Connection Wizard</h1>
        <a href="/">Open Chat Interface</a>
      </header>

      <section class="card">
        <div class="status" id="connection-status">No active runtime connection.</div>

        <h2>STEP A - Paste &amp; Test</h2>

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

        <div style="margin-top: 10px;">
          <label for="business-context">Business Context (optional)</label>
          <textarea id="business-context" style="min-height: 80px;" placeholder="E.g. We're a B2B SaaS company selling project management tools. Our main revenue comes from monthly subscriptions. We track sales by region, plan tier, and customer segment."></textarea>
          <p class="muted">Describe what your business does so the chat assistant can suggest relevant reports and understand your data better.</p>
        </div>

        <div class="actions">
          <button class="secondary" id="test-connection">Test Connection</button>
          <button class="primary" id="connect-connection">Connect</button>
          <button class="warn" id="disconnect-connection">Disconnect</button>
        </div>

        <div class="kvs" id="test-metadata" style="display:none;">
          <div class="kv"><span class="k">current_user</span><span class="v" id="meta-user"></span></div>
          <div class="kv"><span class="k">current_database</span><span class="v" id="meta-db"></span></div>
          <div class="kv" style="grid-column: 1 / -1;"><span class="k">version</span><span class="v" id="meta-version"></span></div>
        </div>

        <div id="test-notes"></div>

        <h2 style="margin-top: 16px;">STEP B - Pick Allowlist</h2>
        <p class="muted">Only allowlisted relations can be referenced by safe queries. Recommended default: views in analytics/reporting (if present), else public relations.</p>
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
          <button class="secondary" id="save-allowlist">Save allowlist</button>
          <button class="secondary" id="save-business-context">Save business context</button>
          <button class="secondary" id="run-catalogue">Catalogue & index</button>
          <button class="danger" id="open-fix-script">Fix-it script</button>
        </div>
        <div class="table-list" id="table-list"></div>
        <div id="validation-container"></div>
      </section>

      <section class="card">
        <h2>Query Runner (Safe Query)</h2>
        <p class="muted"><strong>Read-only enforced</strong> and <strong>SELECT-only enforced</strong>. Exactly one statement (no semicolons). Allowlist enforced. LIMIT enforced.</p>
        <label for="safe-sql">SQL</label>
        <textarea id="safe-sql">SELECT * FROM public.sales LIMIT 50</textarea>
        <div class="actions">
          <button class="primary" id="run-query">Run Query</button>
          <button class="secondary" id="refresh-logs">Refresh audit logs</button>
        </div>
        <div class="output" id="query-output"></div>
      </section>
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

    <script>
      (() => {
        const elements = {
          status: document.getElementById("connection-status"),
          name: document.getElementById("connection-name"),
          connectionString: document.getElementById("connection-string"),
          tlsCaPem: document.getElementById("tls-ca-pem"),
          queryLimit: document.getElementById("query-limit"),
          schemaFilter: document.getElementById("schema-filter"),
          searchFilter: document.getElementById("search-filter"),
          tableList: document.getElementById("table-list"),
          sql: document.getElementById("safe-sql"),
          output: document.getElementById("query-output"),
          testBtn: document.getElementById("test-connection"),
          connectBtn: document.getElementById("connect-connection"),
          disconnectBtn: document.getElementById("disconnect-connection"),
          runBtn: document.getElementById("run-query"),
          refreshLogsBtn: document.getElementById("refresh-logs"),
          selectRecommendedBtn: document.getElementById("select-recommended"),
          selectOkBtn: document.getElementById("select-ok"),
          selectNoneBtn: document.getElementById("select-none"),
          saveAllowlistBtn: document.getElementById("save-allowlist"),
          runCatalogueBtn: document.getElementById("run-catalogue"),
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
          businessContext: document.getElementById("business-context"),
          saveBusinessContextBtn: document.getElementById("save-business-context"),
          validationContainer: document.getElementById("validation-container")
        };

        const state = {
          relations: [],
          selected: new Set(),
          testResult: null
        };

        function showOutput(value) {
          elements.output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        }

        function renderValidation(result) {
          const container = elements.validationContainer;
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
          container.innerHTML = html;

          // Toggle column details on table header click
          container.addEventListener("click", function(e) {
            const target = e.target.closest("[data-toggle]");
            if (!target) return;
            const colsEl = document.getElementById(target.dataset.toggle);
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

        function renderSchemaFilter() {
          const schemas = getSchemas(state.relations);
          const prev = String(elements.schemaFilter.value || "__all__");
          elements.schemaFilter.innerHTML = "";

          const all = document.createElement("option");
          all.value = "__all__";
          all.textContent = "All schemas";
          elements.schemaFilter.appendChild(all);

          for (const schema of schemas) {
            const opt = document.createElement("option");
            opt.value = schema;
            opt.textContent = schema;
            elements.schemaFilter.appendChild(opt);
          }

          if (schemas.includes(prev)) {
            elements.schemaFilter.value = prev;
          } else {
            elements.schemaFilter.value = "__all__";
          }
        }

        function renderRelations() {
          elements.tableList.innerHTML = "";

          if (!Array.isArray(state.relations) || state.relations.length === 0) {
            elements.tableList.textContent = "No tables/views loaded yet. Test a connection first.";
            return;
          }

          const schemaValue = String(elements.schemaFilter.value || "__all__");
          const searchValue = String(elements.searchFilter.value || "").trim().toLowerCase();

          const filtered = state.relations.filter((relation) => {
            const schema = relation && typeof relation.schema_name === "string" ? relation.schema_name : "";
            const name = qualifiedName(relation).toLowerCase();

            if (schemaValue !== "__all__" && schema !== schemaValue) {
              return false;
            }

            if (searchValue && !name.includes(searchValue)) {
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
            elements.tableList.appendChild(row);
          }
        }

        function setConnectionStatus(context) {
          if (!context || !context.connected) {
            elements.status.textContent = "No active runtime connection.";
            return;
          }

          const source = typeof context.source === "string" ? context.source : "runtime";
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
            " | source: " +
            source +
            " | allowlisted: " +
            tableCount +
            (businessId ? " | business_id: " + businessId : "");
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
            return;
          }

          state.testResult = null;
          setConnectionStatus(context);

          const tables = await request("/api/db/tables", "GET").catch(() => null);
          const relations = tables && Array.isArray(tables.relations) ? tables.relations : [];
          state.relations = relations;
          state.selected = new Set(Array.isArray(context.allowed_relations) ? context.allowed_relations.map((v) => String(v).toLowerCase()) : []);

          renderSchemaFilter();
          renderRelations();
          renderTestNotes(null);
        }

        function openFixModal() {
          elements.fixModal.classList.add("open");
          elements.fixModal.setAttribute("aria-hidden", "false");
        }

        function closeFixModal() {
          elements.fixModal.classList.remove("open");
          elements.fixModal.setAttribute("aria-hidden", "true");
        }

        elements.closeFixModalBtn.addEventListener("click", () => closeFixModal());
        elements.fixModal.addEventListener("click", (event) => {
          if (event.target === elements.fixModal) {
            closeFixModal();
          }
        });

        elements.schemaFilter.addEventListener("change", () => renderRelations());
        elements.searchFilter.addEventListener("input", () => renderRelations());

        elements.testBtn.addEventListener("click", async () => {
          try {
            const connectionString = String(elements.connectionString.value || "").trim();
            if (!connectionString) {
              throw new Error("Connection string is required.");
            }

            const tlsCaPem = String(elements.tlsCaPem.value || "").trim();
            const body = {
              connection_string: connectionString
            };
            if (tlsCaPem) {
              body.tls_ca_pem = tlsCaPem;
            }

            const result = await request("/api/db/test", "POST", body);

            state.testResult = result;
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

            renderSchemaFilter();
            renderRelations();
            renderTestNotes(result);
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

            if (state.selected.size === 0) {
              throw new Error("Select at least one table/view for your allowlist.");
            }

            const tlsCaPem = String(elements.tlsCaPem.value || "").trim();
            const businessContext = String(elements.businessContext.value || "").trim();
            const body = {
              name: String(elements.name.value || "").trim() || undefined,
              connection_string: connectionString,
              allowed_relations: Array.from(state.selected)
            };
            if (tlsCaPem) {
              body.tls_ca_pem = tlsCaPem;
            }
            if (businessContext) {
              body.business_context = businessContext;
            }

            const context = await request("/api/db/connect", "POST", body);

            setConnectionStatus(context);
            const tables = await request("/api/db/tables", "GET").catch(() => null);
            state.relations = tables && Array.isArray(tables.relations) ? tables.relations : state.relations;
            state.selected = new Set(Array.isArray(context.allowed_relations) ? context.allowed_relations.map((v) => String(v).toLowerCase()) : []);

            renderSchemaFilter();
            renderRelations();
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

        elements.refreshLogsBtn.addEventListener("click", async () => {
          try {
            const logs = await request("/api/db/query-logs", "GET");
            showOutput(logs);
          } catch (error) {
            showOutput(error instanceof Error ? error.message : "Unknown error");
          }
        });

        elements.selectRecommendedBtn.addEventListener("click", () => {
          const recommended = state.testResult && Array.isArray(state.testResult.recommended_allowlist) ? state.testResult.recommended_allowlist : [];
          state.selected = new Set(recommended.map((entry) => String(entry).toLowerCase()));
          renderRelations();
        });

        elements.selectOkBtn.addEventListener("click", () => {
          const ok = (state.relations || [])
            .filter((relation) => relation && relation.status === "OK")
            .map((relation) => qualifiedName(relation).toLowerCase())
            .filter((v) => v.length > 0);
          state.selected = new Set(ok);
          renderRelations();
        });

        elements.selectNoneBtn.addEventListener("click", () => {
          state.selected = new Set();
          renderRelations();
        });

        elements.saveAllowlistBtn.addEventListener("click", async () => {
          try {
            if (state.selected.size === 0) {
              throw new Error("Select at least one table/view for allowlist.");
            }

            const context = await request("/api/db/allowlist", "POST", {
              allowed_relations: Array.from(state.selected)
            });

            setConnectionStatus(context);
            state.selected = new Set(Array.isArray(context.allowed_relations) ? context.allowed_relations.map((v) => String(v).toLowerCase()) : []);
            renderRelations();
            showOutput(context);

            // Auto-validate after save
            elements.validationContainer.innerHTML = '<div class="val-spinner">Validating access to all tables and columns...</div>';
            try {
              const validation = await request("/api/db/validate", "POST", {});
              renderValidation(validation);
            } catch (valError) {
              elements.validationContainer.innerHTML = '<div class="callout"><strong>Validation failed:</strong> ' + escapeHtml(valError instanceof Error ? valError.message : "Unknown error") + '</div>';
            }
          } catch (error) {
            showOutput(error instanceof Error ? error.message : "Unknown error");
          }
        });

        elements.saveBusinessContextBtn.addEventListener("click", async () => {
          try {
            const text = String(elements.businessContext.value || "").trim();
            await request("/api/db/business-context", "POST", { business_context: text });
            showOutput(text ? "Business context saved." : "Business context cleared.");
          } catch (error) {
            showOutput(error instanceof Error ? error.message : "Unknown error");
          }
        });

        elements.runCatalogueBtn.addEventListener("click", async () => {
          try {
            const catalog = await request("/api/db/catalogue", "POST", {});
            const tableCount = Array.isArray(catalog && catalog.tables) ? catalog.tables.length : 0;
            const businessId =
              catalog && typeof catalog.business_id === "string" ? catalog.business_id : "unknown";
            showOutput({
              message: "Catalogue agent completed.",
              business_id: businessId,
              indexed_tables: tableCount,
              cataloged_at: catalog ? catalog.cataloged_at : null,
              catalog
            });
            await loadContext();
          } catch (error) {
            showOutput(error instanceof Error ? error.message : "Unknown error");
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

            const tlsCaPem = String(elements.tlsCaPem.value || "").trim();
            elements.fixStatus.textContent = "Re-testing...";
            const body = {
              connection_string: connectionString
            };
            if (tlsCaPem) {
              body.tls_ca_pem = tlsCaPem;
            }
            const result = await request("/api/db/test", "POST", body);

            state.testResult = result;
            state.relations = Array.isArray(result.relations) ? result.relations : [];

            if (result && result.metadata) {
              elements.metaBlock.style.display = "grid";
              elements.metaUser.textContent = String(result.metadata.current_user || "");
              elements.metaDb.textContent = String(result.metadata.current_database || "");
              elements.metaVersion.textContent = String(result.metadata.version || "");
            } else {
              elements.metaBlock.style.display = "none";
            }

            renderSchemaFilter();
            renderRelations();
            renderTestNotes(result);

            elements.fixStatus.textContent = "Re-test complete. You can now Connect and run queries.";
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
