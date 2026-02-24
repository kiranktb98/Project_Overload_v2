export function renderGlobalConfigPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Overload | Global Config</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

      :root {
        --ink: #e9f1ff;
        --ink-soft: #6f86b4;
        --line: #14386f;
        --line-soft: #20509d;
        --glow: rgba(85, 72, 255, 0.45);
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
        width: 22px;
        text-align: center;
        color: #6f8ac1;
        font-family: "JetBrains Mono", monospace;
        font-size: 0.7rem;
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

      .content {
        border: 1px solid var(--line);
        border-left: none;
        background: linear-gradient(180deg, rgba(4, 11, 33, 0.98), rgba(2, 8, 26, 0.99));
        box-shadow: var(--shadow);
        padding: 16px 20px 20px;
        overflow-y: auto;
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
        font-size: 1.08rem;
      }

      h2 {
        margin: 0 0 8px;
        font-size: 0.92rem;
      }

      .sub {
        margin: 5px 0 0;
        color: var(--ink-soft);
        font-size: 0.84rem;
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

      .section {
        border: 1px solid #1f3f82;
        border-radius: 14px;
        background: linear-gradient(160deg, rgba(8, 22, 56, 0.96), rgba(6, 18, 46, 0.96));
        padding: 14px;
        margin-bottom: 16px;
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
        border: 1px solid #2f4d95;
        padding: 12px;
        resize: vertical;
        background: rgba(9, 24, 58, 0.94);
        color: #edf3ff;
        font-family: "JetBrains Mono", monospace;
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
        border: 1px solid rgba(128, 144, 255, 0.48);
        border-radius: 12px;
        padding: 10px 14px;
        color: #fff;
        cursor: pointer;
        background: linear-gradient(135deg, #4f3eff, #5f4dff 56%, #6c5cff);
        font-family: "Space Grotesk", sans-serif;
        font-weight: 700;
        box-shadow: 0 10px 22px var(--glow);
        font-size: 0.84rem;
      }

      .btn-secondary {
        border: 1px solid #2f4d95;
        border-radius: 12px;
        padding: 8px 12px;
        color: #cfddff;
        cursor: pointer;
        background: rgba(15, 33, 79, 0.92);
        font-family: "Space Grotesk", sans-serif;
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
        font-family: "Space Grotesk", sans-serif;
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
        font-family: "JetBrains Mono", monospace;
        font-size: 0.75rem;
        color: #8eb3ff;
      }

      .metric-type {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.68rem;
        padding: 3px 8px;
        border-radius: 6px;
        border: 1px solid #29498e;
        background: rgba(10, 29, 70, 0.88);
        color: var(--ink-soft);
      }

      .metric-cols {
        font-family: "JetBrains Mono", monospace;
        font-size: 0.72rem;
        color: #8eb3ff;
      }

      .empty-state {
        padding: 20px;
        text-align: center;
        color: var(--ink-soft);
        font-size: 0.84rem;
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
        border: 1px solid #2f4d95;
        padding: 8px 10px;
        background: rgba(9, 24, 58, 0.94);
        color: #edf3ff;
        font-family: "JetBrains Mono", monospace;
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

      @media (max-width: 1080px) {
        .layout { grid-template-columns: 1fr; }
        .platform-panel { display: none; }
        .content { border-left: 1px solid var(--line); }
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
            <a class="platform-link" href="/"><span class="link-icon">[]</span>Chat Explorer</a>
            <a class="platform-link" href="/usage"><span class="link-icon">=</span>Usage Metrics</a>
          </nav>
          <div class="platform-section">Infrastructure</div>
          <nav class="platform-nav">
            <a class="platform-link" href="/connect"><span class="link-icon">DB</span>Data Sources</a>
            <a class="platform-link active" href="/config"><span class="link-icon">CFG</span>Global Config</a>
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
              <h1>Global Config</h1>
              <p class="sub">Business context and metric definitions used across chat planning and report generation.</p>
            </div>
            <span class="badge">Workspace Config</span>
          </div>

          <!-- Business Context Section -->
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
            <p class="section-hint">Define how key business metrics should be calculated. These definitions are passed to all query agents to ensure consistent, accurate analysis.</p>

            <table class="metric-table" id="metric-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Display Name</th>
                  <th>Definition</th>
                  <th>Filters</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="metric-tbody">
                <tr><td colspan="5" class="empty-state">No metric definitions yet. Click "+ Add Metric" to create one.</td></tr>
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
                <label for="mf-def">Definition (how to calculate this metric)</label>
                <input type="text" id="mf-def" placeholder="e.g. SUM(order_amount) for all completed orders" />
              </div>
              <div class="form-group" style="margin-bottom:10px">
                <label for="mf-filters">Filters (auto-applied when this metric is used)</label>
                <input type="text" id="mf-filters" placeholder="e.g. status = 'completed' AND refund_amount > 0" />
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
      (() => {
        /* ── Business Context ── */
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

        /* ── Metric Definitions ── */
        let metrics = [];
        let editingIndex = -1;

        const metricsTbody = document.getElementById("metric-tbody");
        const metricsStatus = document.getElementById("metrics-status");
        const addBtn = document.getElementById("add-metric-btn");
        const saveMetricsBtn = document.getElementById("save-metrics");
        const form = document.getElementById("metric-form");
        const mfKey = document.getElementById("mf-key");
        const mfName = document.getElementById("mf-name");
        const mfDef = document.getElementById("mf-def");
        const mfFilters = document.getElementById("mf-filters");
        const mfSave = document.getElementById("mf-save");
        const mfCancel = document.getElementById("mf-cancel");

        function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

        function renderMetrics() {
          if (metrics.length === 0) {
            metricsTbody.innerHTML = '<tr><td colspan="5" class="empty-state">No metric definitions yet. Click "+ Add Metric" to create one.</td></tr>';
            return;
          }
          metricsTbody.innerHTML = metrics.map(function(m, i) {
            var filters = m.filters || "-";
            return '<tr>'
              + '<td class="metric-key">' + esc(m.metric_key) + '</td>'
              + '<td>' + esc(m.display_name) + '</td>'
              + '<td>' + esc(m.definition) + '</td>'
              + '<td class="metric-cols">' + esc(filters) + '</td>'
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

        function openAddForm() {
          editingIndex = -1;
          mfKey.value = "";
          mfName.value = "";
          mfDef.value = "";
          mfFilters.value = "";
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
          mfFilters.value = m.filters || "";
          form.classList.add("visible");
          mfKey.focus();
        }

        function closeForm() {
          form.classList.remove("visible");
          editingIndex = -1;
        }

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
            definition: def,
            filters: mfFilters.value.trim()
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
            var res = await fetch("/api/config/global");
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
            var res = await fetch("/api/config/global", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ metric_definitions: metrics })
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
        loadMetrics();
      })();
    </script>
  </body>
</html>`;
}
