export function renderLoginPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project Overload | Login</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

      :root {
        --ink: #e8efff;
        --ink-soft: #9fb0d8;
        --line: rgba(109, 142, 214, 0.24);
        --surface: rgba(9, 22, 55, 0.9);
        --primary: #1a4db3;
        --primary-2: #2e65d2;
        --primary-3: #4c88f0;
        --shadow: 0 30px 70px rgba(2, 9, 28, 0.58);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: "Space Grotesk", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 8% 10%, rgba(67, 114, 207, 0.34), transparent 32%),
          radial-gradient(circle at 90% -8%, rgba(30, 82, 184, 0.36), transparent 34%),
          linear-gradient(150deg, #031029 0%, #05163a 46%, #071a44 100%);
      }

      .card {
        width: min(460px, calc(100% - 24px));
        border: 1px solid var(--line);
        border-radius: 20px;
        background: var(--surface);
        box-shadow: var(--shadow);
        padding: 22px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }

      .badge {
        width: 34px;
        height: 34px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #2b65d3, #5a8ef3);
        color: #fff;
      }

      h1 {
        margin: 0;
        font-size: 1.12rem;
      }

      p {
        margin: 0 0 14px;
        color: var(--ink-soft);
        font-size: 0.86rem;
      }

      label {
        display: block;
        font-size: 0.75rem;
        color: var(--ink-soft);
        margin: 10px 0 6px;
      }

      input {
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(111, 149, 220, 0.34);
        padding: 12px;
        background: rgba(8, 22, 53, 0.86);
        color: #edf3ff;
        font-family: "JetBrains Mono", monospace;
      }

      input:focus {
        outline: none;
        border-color: #75a6ff;
        box-shadow: 0 0 0 4px rgba(88, 143, 236, 0.2);
      }

      button {
        margin-top: 14px;
        width: 100%;
        border: 1px solid rgba(116, 157, 235, 0.34);
        border-radius: 12px;
        padding: 12px;
        color: #fff;
        cursor: pointer;
        font-family: "Space Grotesk", sans-serif;
        font-weight: 700;
        background: linear-gradient(135deg, var(--primary), var(--primary-2) 56%, var(--primary-3));
      }

      .status {
        min-height: 20px;
        margin-top: 10px;
        color: #fca5a5;
        font-size: 0.77rem;
      }

      .hint {
        margin-top: 8px;
        font-size: 0.73rem;
        color: var(--ink-soft);
        font-family: "JetBrains Mono", monospace;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="brand">
        <div class="badge">*</div>
        <h1>Project Overload Login</h1>
      </div>
      <p>Sign in to access Chat Explorer, Data Sources, Usage Metrics, and Global Config.</p>
      <form id="login-form">
        <label for="username">Username</label>
        <input id="username" name="username" autocomplete="username" required />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Sign In</button>
        <div class="status" id="status"></div>
      </form>
      <div class="hint">Demo credentials: user = <strong>test123</strong>, password = <strong>test123</strong></div>
    </main>

    <script>
      (() => {
        const form = document.getElementById("login-form");
        const statusEl = document.getElementById("status");
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          statusEl.textContent = "";
          const username = String(document.getElementById("username").value || "");
          const password = String(document.getElementById("password").value || "");

          const response = await fetch("/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password })
          });

          if (!response.ok) {
            statusEl.textContent = "Invalid credentials. Use test123 / test123.";
            return;
          }

          window.location.href = "/";
        });
      })();
    </script>
  </body>
</html>`;
}
