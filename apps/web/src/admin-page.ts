import { renderClaritectLogoImage } from "./brand";

function renderAdminShell(input: {
  title: string;
  active: "dashboard" | "customers" | "users" | "connections" | "reports" | "schedules" | "billing";
  page_title: string;
  page_subtitle: string;
  endpoint: string;
}): string {
  const navLink = (href: string, label: string, active: boolean) =>
    `<a class="nav-link${active ? " active" : ""}" href="${href}">${label}</a>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title}</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");
      :root {
        --ink: #F5F3FF;
        --ink-soft: #D7CFE6;
        --ink-muted: #9D90BC;
        --line: rgba(107,92,138,.28);
        --panel: rgba(24,18,39,.92);
        --panel-2: rgba(31,21,49,.94);
        --accent: #6C3AED;
        --accent-2: #EC4899;
        --accent-3: #EC4899;
        --shadow: 0 24px 60px rgba(1,8,28,.44);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 14% 10%, rgba(108,58,237,.22), transparent 24%),
          radial-gradient(circle at 88% 8%, rgba(236,72,153,.15), transparent 26%),
          linear-gradient(180deg, #0F0B1A 0%, #130F20 44%, #161122 100%);
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: linear-gradient(to right, rgba(107,92,138,.08) 1px, transparent 1px);
        background-size: 60px 60px;
        mask-image: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.86), transparent 92%);
      }
      .page { padding: 14px; }
      .layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 28px); gap: 14px; }
      .platform-panel,.content-shell { border: 1px solid var(--line); border-radius: 28px; box-shadow: var(--shadow); overflow: hidden; }
      .platform-panel {
        position: relative;
        background: linear-gradient(180deg, rgba(20, 15, 34, 0.98), rgba(17, 12, 28, 0.98));
        padding: 16px 15px 14px;
        display: flex;
        flex-direction: column;
      }
      .platform-brand {
        display: flex; align-items: center; gap: 10px; padding: 8px 6px 14px; margin-bottom: 10px;
        border-bottom: 1px solid rgba(107,92,138,.24);
      }
      .platform-brand-badge {
        width: 56px; height: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .platform-brand-badge img {
        width: 100%; height: 100%; display: block; object-fit: contain;
        filter: drop-shadow(0 8px 20px rgba(118, 93, 255, 0.22));
      }
      .platform-brand strong { display: block; font-size: .78rem; letter-spacing: .09em; text-transform: uppercase; }
      .platform-brand span { display: block; margin-top: 2px; font-family: Inter, "Sohne", "Suisse Intl", sans-serif; font-size: .62rem; letter-spacing: .24em; text-transform: uppercase; color: var(--ink-muted); }
      .platform-section { margin: 16px 8px 8px; font-size: .58rem; letter-spacing: .24em; text-transform: uppercase; color: var(--ink-muted); }
      .platform-nav { display: flex; flex-direction: column; gap: 6px; }
      .nav-link {
        display: flex; align-items: center; gap: 8px; padding: 11px 12px; border-radius: 14px; color: #E1DAF4; text-decoration: none;
        border: 1px solid rgba(107,92,138,.14); font-size: .84rem; font-weight: 600;
      }
      .nav-link.active { background: rgba(108,58,237,.92); border-color: rgba(245,243,255,.22); color: #f3f8ff; }
      .platform-footer { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
      .platform-user,.platform-support {
        display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid rgba(107,92,138,.22);
        border-radius: 16px; padding: 11px 12px; background: rgba(31, 21, 49, 0.82);
      }
      .platform-user-avatar {
        width: 28px; height: 28px; border-radius: 11px; display: grid; place-items: center;
        border: 1px solid rgba(108, 58, 237, 0.34); color: #E1DAF4; background: rgba(46, 28, 76, 0.92);
      }
      .logout-btn {
        border: 1px solid rgba(107,92,138,.28); border-radius: 12px; background: rgba(34, 25, 56, 0.94);
        color: #F5F3FF; padding: 7px 10px; font-family: Inter, "Sohne", "Suisse Intl", sans-serif; font-size: .64rem; cursor: pointer;
      }
      .content-shell { background: linear-gradient(180deg, rgba(20,15,34,.98), rgba(17,12,28,.99)); padding: 22px; }
      .head { display: flex; align-items: start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
      .eyebrow { display: inline-block; margin-bottom: 8px; font-size: .62rem; text-transform: uppercase; letter-spacing: .22em; color: #EC4899; }
      h1 { margin: 0; font-size: 1.42rem; }
      .sub { margin: 8px 0 0; color: var(--ink-soft); line-height: 1.7; }
      .badge { padding: 7px 10px; border-radius: 999px; font-family: Inter, "Sohne", "Suisse Intl", sans-serif; font-size: .68rem; border: 1px solid rgba(107,92,138,.24); background: rgba(39, 28, 63, 0.94); color: #F5F3FF; }
      .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
      .card, .table-wrap { border: 1px solid rgba(107,92,138,.18); border-radius: 22px; background: var(--panel); padding: 16px; }
      .card small { display: block; color: var(--ink-muted); text-transform: uppercase; letter-spacing: .16em; font-size: .64rem; margin-bottom: 10px; }
      .card strong { font-size: 1.2rem; }
      .table-wrap { overflow: auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid rgba(107,92,138,.16); vertical-align: top; }
      th { color: var(--ink-muted); text-transform: uppercase; letter-spacing: .14em; font-size: .62rem; }
      td { color: var(--ink-soft); font-size: .84rem; line-height: 1.5; }
      code { font-family: Inter, "Sohne", "Suisse Intl", sans-serif; color: #F5F3FF; }
      @media (max-width: 1080px) { .layout { grid-template-columns: 1fr; } .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 640px) { .cards { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="layout">
        <aside class="platform-panel">
          <div class="platform-brand"><div class="platform-brand-badge">${renderClaritectLogoImage("platform-brand-logo")}</div><div><strong>Claritect</strong><span>Admin console</span></div></div>
          <div class="platform-section">Backoffice</div>
          <nav class="platform-nav">
            ${navLink("/admin", "Dashboard", input.active === "dashboard")}
            ${navLink("/admin/customers", "Customers", input.active === "customers")}
            ${navLink("/admin/users", "Users", input.active === "users")}
            ${navLink("/admin/connections", "Connections", input.active === "connections")}
            ${navLink("/admin/reports", "Reports", input.active === "reports")}
            ${navLink("/admin/schedules", "Schedules", input.active === "schedules")}
            ${navLink("/admin/billing", "Billing", input.active === "billing")}
          </nav>
          <div class="platform-footer">
            <div class="platform-user"><div class="platform-user-avatar">@</div><div><small>Claritect</small><strong>Admin Session</strong></div></div>
            <div class="platform-support"><span>Need customer access?</span><form method="POST" action="/admin/auth/logout"><button class="logout-btn" type="submit">Sign out</button></form></div>
          </div>
        </aside>
        <main class="content-shell">
          <div class="head">
            <div><span class="eyebrow">Claritect operations</span><h1>${input.page_title}</h1><p class="sub">${input.page_subtitle}</p></div>
            <span class="badge" id="page-badge">Loading</span>
          </div>
          <section class="cards" id="summary-cards"></section>
          <section class="table-wrap">
            <table>
              <thead id="admin-thead"></thead>
              <tbody id="admin-tbody"><tr><td>Loading…</td></tr></tbody>
            </table>
          </section>
        </main>
      </div>
    </div>
    <script>
      (() => {
        const endpoint = ${JSON.stringify(input.endpoint)};
        const active = ${JSON.stringify(input.active)};
        const cardsEl = document.getElementById("summary-cards");
        const headEl = document.getElementById("admin-thead");
        const bodyEl = document.getElementById("admin-tbody");
        const badgeEl = document.getElementById("page-badge");

        function esc(value) {
          return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\"/g, "&quot;").replace(/'/g, "&#39;");
        }

        function renderOverview(payload) {
          const overview = payload.overview || {};
          const balance = payload.openrouter_balance || {};
          cardsEl.innerHTML = [
            ["Customers", overview.customers ?? 0],
            ["Active users", overview.active_users ?? 0],
            ["Connections", overview.connections ?? 0],
            ["OpenRouter credits", balance.remaining_credits == null ? "Unavailable" : balance.remaining_credits]
          ].map((entry) => '<article class="card"><small>' + esc(entry[0]) + '</small><strong>' + esc(entry[1]) + '</strong></article>').join("");
          headEl.innerHTML = "<tr><th>Metric</th><th>Value</th></tr>";
          bodyEl.innerHTML = Object.entries(overview).map((entry) => "<tr><td>" + esc(entry[0]) + "</td><td>" + esc(entry[1]) + "</td></tr>").join("");
          badgeEl.textContent = "Live";
        }

        function renderItems(items) {
          cardsEl.innerHTML = '<article class="card"><small>Records</small><strong>' + esc(items.length) + '</strong></article>';
          if (!items.length) {
            headEl.innerHTML = "<tr><th>State</th></tr>";
            bodyEl.innerHTML = "<tr><td>No records yet.</td></tr>";
            badgeEl.textContent = "Empty";
            return;
          }
          const keys = Object.keys(items[0]).slice(0, 8);
          headEl.innerHTML = "<tr>" + keys.map((key) => "<th>" + esc(key.replace(/_/g, " ")) + "</th>").join("") + "</tr>";
          bodyEl.innerHTML = items.map((item) => "<tr>" + keys.map((key) => "<td>" + esc(typeof item[key] === "object" ? JSON.stringify(item[key]) : item[key]) + "</td>").join("") + "</tr>").join("");
          badgeEl.textContent = items.length + " rows";
        }

        fetch(endpoint)
          .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
          .then(({ ok, payload }) => {
            if (!ok) {
              throw new Error(payload && payload.message ? payload.message : "Unable to load admin data.");
            }
            if (active === "dashboard") {
              renderOverview(payload || {});
              return;
            }
            renderItems(Array.isArray(payload.items) ? payload.items : []);
          })
          .catch((error) => {
            cardsEl.innerHTML = "";
            headEl.innerHTML = "<tr><th>Status</th></tr>";
            bodyEl.innerHTML = "<tr><td>" + esc(error && error.message ? error.message : "Unable to load admin data.") + "</td></tr>";
            badgeEl.textContent = "Error";
          });
      })();
    </script>
  </body>
</html>`;
}

export function renderAdminDashboardPage(): string {
  return renderAdminShell({
    title: "Claritect | Admin dashboard",
    active: "dashboard",
    page_title: "Operational dashboard",
    page_subtitle: "Customer, run, schedule, connection, and OpenRouter balance visibility in one place.",
    endpoint: "/api/admin/overview"
  });
}

export function renderAdminCustomersPage(): string {
  return renderAdminShell({
    title: "Claritect | Customers",
    active: "customers",
    page_title: "Customer accounts",
    page_subtitle: "Track tenants, plan tiers, ownership, and entitlement posture.",
    endpoint: "/api/admin/customers"
  });
}

export function renderAdminUsersPage(): string {
  return renderAdminShell({
    title: "Claritect | Users",
    active: "users",
    page_title: "Platform users",
    page_subtitle: "Review customer and admin users, roles, and most recent logins.",
    endpoint: "/api/admin/users"
  });
}

export function renderAdminConnectionsPage(): string {
  return renderAdminShell({
    title: "Claritect | Connections",
    active: "connections",
    page_title: "Connected sources",
    page_subtitle: "Inspect provider mix, allowlist footprint, and recent connection state.",
    endpoint: "/api/admin/connections"
  });
}

export function renderAdminReportsPage(): string {
  return renderAdminShell({
    title: "Claritect | Reports",
    active: "reports",
    page_title: "Report contracts and runs",
    page_subtitle: "Monitor live reporting inventory, lifecycle state, and latest outcomes.",
    endpoint: "/api/admin/reports"
  });
}

export function renderAdminSchedulesPage(): string {
  return renderAdminShell({
    title: "Claritect | Schedules",
    active: "schedules",
    page_title: "Scheduled report fleet",
    page_subtitle: "See active and paused schedules across tenants, cadences, and timezones.",
    endpoint: "/api/admin/schedules"
  });
}

export function renderAdminBillingPage(): string {
  return renderAdminShell({
    title: "Claritect | Billing",
    active: "billing",
    page_title: "Billing and entitlements",
    page_subtitle: "Keep package, renewal, and usage entitlements visible for every customer.",
    endpoint: "/api/admin/billing"
  });
}

export function renderAdminLoginPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect | Admin login</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap");
      :root { --ink:#F5F3FF; --ink-soft:#D7CFE6; --line:rgba(146,183,255,.14); }
      * { box-sizing: border-box; }
      body { margin:0; min-height:100vh; font-family: Inter, "Sohne", "Suisse Intl", sans-serif; color:var(--ink); background:linear-gradient(180deg,#0F0B1A 0%,#130F20 52%,#161122 100%); display:grid; place-items:center; padding:20px; }
      .card { width:min(460px,100%); border:1px solid var(--line); border-radius:28px; padding:24px; background:linear-gradient(180deg, rgba(20, 15, 34, 0.98), rgba(17, 12, 28, 0.98)); }
      .login-brand { width:72px; height:30px; margin-bottom:14px; }
      .login-brand img { width:100%; height:100%; display:block; object-fit:contain; filter:drop-shadow(0 10px 22px rgba(118,93,255,.24)); }
      .eyebrow { display:inline-block; margin-bottom:10px; color:#EC4899; font-size:.66rem; text-transform:uppercase; letter-spacing:.24em; }
      h1 { margin:0; font-size:1.7rem; }
      p { color:var(--ink-soft); line-height:1.7; }
      label { display:block; margin:14px 0 8px; color:var(--ink-soft); font-size:.75rem; text-transform:uppercase; letter-spacing:.12em; }
      input { width:100%; min-height:48px; border-radius:16px; border:1px solid rgba(146,183,255,.16); background:rgba(9,21,50,.88); color:var(--ink); padding:0 14px; }
      button { width:100%; min-height:48px; margin-top:18px; border-radius:16px; border:1px solid rgba(165,198,255,.3); background:rgba(108,58,237,.94); color:#F5F3FF; font-weight:800; cursor:pointer; }
      .meta { margin-top:14px; font-family: Inter, "Sohne", "Suisse Intl", sans-serif; font-size:.72rem; color:#B9ACD7; }
      .error { color:#ffb5b5; min-height:1.3rem; margin-top:10px; }
    </style>
  </head>
  <body>
    <form class="card" id="admin-login-form">
      <div class="login-brand">${renderClaritectLogoImage("admin-login-logo")}</div>
      <span class="eyebrow">Claritect operations</span>
      <h1>Admin login</h1>
      <p>Use the dedicated Claritect admin login here. Customer sessions stay separate from this console.</p>
      <label for="username">Username</label>
      <input id="username" name="username" autocomplete="username" required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <div class="error" id="error"></div>
      <button type="submit">Open admin console</button>
      <div class="meta">Demo admin: claritect_admin / test123</div>
    </form>
    <script>
      document.getElementById("admin-login-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const errorEl = document.getElementById("error");
        const body = {
          username: form.username.value,
          password: form.password.value
        };
        const response = await fetch("/admin/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          errorEl.textContent = payload && payload.message ? payload.message : "Invalid admin credentials.";
          return;
        }
        window.location.href = "/admin";
      });
    </script>
  </body>
</html>`;
}
