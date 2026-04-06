import { renderClaritectFaviconLinks } from "./brand";

function renderPublicLayout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${renderClaritectFaviconLinks()}
    <style>
      :root {
        color-scheme: dark;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #0f0b1a;
        color: #f5f3ff;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
      }

      main {
        width: min(100%, 420px);
        display: grid;
        gap: 16px;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      h1 {
        margin: 0;
        font-size: 40px;
        line-height: 1.05;
        font-weight: 600;
        letter-spacing: -0.03em;
      }

      form {
        display: grid;
        gap: 12px;
      }

      label {
        display: grid;
        gap: 6px;
        font-size: 14px;
        color: #d7cff8;
      }

      input {
        width: 100%;
        border: 1px solid #6b5c8a;
        border-radius: 12px;
        background: #171126;
        color: #f5f3ff;
        padding: 12px 14px;
        font: inherit;
      }

      button {
        border: 0;
        border-radius: 12px;
        background: #6c3aed;
        color: #f5f3ff;
        padding: 12px 16px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      a.button-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        border-radius: 12px;
        background: #6c3aed;
        color: #f5f3ff;
        padding: 12px 16px;
        font: inherit;
        font-weight: 600;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

export function renderHomePage(): string {
  return renderPublicLayout(
    "Claritect | Home page",
    `<h1>Home page</h1>
    <div class="actions">
      <a class="button-link" href="/signup">Sign up</a>
      <a class="button-link" href="/login">Login</a>
    </div>`
  );
}

export function renderPricingPage(): string {
  return renderPublicLayout("Claritect | Pricing page", "<h1>Pricing page</h1>");
}

export function renderSignupPage(): string {
  return renderPublicLayout(
    "Claritect | Sign up form",
    `<h1>Sign up form</h1>
    <form method="get" action="/signup">
      <label>
        Name
        <input name="name" type="text" />
      </label>
      <label>
        Email
        <input name="email" type="email" />
      </label>
      <label>
        Company
        <input name="company" type="text" />
      </label>
      <button type="submit">Submit</button>
    </form>`
  );
}
