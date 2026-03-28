import { renderClaritectLogoImage } from "./brand";

type LogoutVariant = "customer" | "admin";

function renderLogoutShell(input: {
  title: string;
  eyebrow: string;
  heading: string;
  body: string;
  primary_href: string;
  primary_label: string;
  secondary_href: string;
  secondary_label: string;
  accent_note: string;
  variant: LogoutVariant;
}): string {
  const loginSurfaceLabel =
    input.variant === "admin" ? "Admin access" : "Customer workspace";

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
        --line: rgba(107, 92, 138, 0.28);
        --line-soft: rgba(236, 72, 153, 0.22);
        --surface: rgba(20, 15, 34, 0.96);
        --surface-2: rgba(26, 18, 42, 0.94);
        --panel: rgba(28, 21, 45, 0.82);
        --primary: #6C3AED;
        --primary-soft: rgba(102, 167, 255, 0.16);
        --shadow: 0 30px 70px rgba(10, 6, 20, 0.58);
        --shadow-soft: 0 18px 40px rgba(10, 6, 20, 0.34);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 16% 12%, rgba(108, 58, 237, 0.22), transparent 24%),
          radial-gradient(circle at 86% 10%, rgba(236, 72, 153, 0.15), transparent 24%),
          radial-gradient(circle at 50% 100%, rgba(108, 58, 237, 0.12), transparent 34%),
          linear-gradient(180deg, #0F0B1A 0%, #130F20 44%, #161122 100%);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: linear-gradient(to right, rgba(107, 92, 138, 0.08) 1px, transparent 1px);
        background-size: 60px 60px;
        mask-image: radial-gradient(circle at 50% 45%, rgba(0, 0, 0, 0.86), transparent 92%);
      }

      body::after {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 18% 22%, rgba(108, 58, 237, 0.18), transparent 20%),
          radial-gradient(circle at 78% 16%, rgba(236, 72, 153, 0.18), transparent 24%);
        filter: blur(34px);
        opacity: 0.9;
      }

      .page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }

      .card {
        position: relative;
        width: min(720px, 100%);
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 32px;
        background:
          linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%),
          radial-gradient(circle at 100% 0%, rgba(113, 122, 255, 0.1), transparent 24%);
        box-shadow: var(--shadow);
      }

      .card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 14% 0%, rgba(108, 58, 237, 0.18), transparent 26%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 32%);
      }

      .inner {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 22px;
        padding: 28px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 14px;
        padding-bottom: 18px;
        border-bottom: 1px solid rgba(107, 92, 138, 0.24);
      }

      .brand-badge {
        width: 60px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .brand-badge img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        filter: drop-shadow(0 10px 24px rgba(118, 93, 255, 0.22));
      }

      .brand-copy strong {
        display: block;
        font-size: 0.92rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .brand-copy span {
        display: block;
        margin-top: 4px;
        color: var(--ink-muted);
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        font-size: 0.66rem;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: fit-content;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(107, 92, 138, 0.24);
        background: rgba(31, 21, 49, 0.78);
        color: #D7CFE6;
        font-size: 0.72rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .eyebrow::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #EC4899;
        box-shadow: 0 0 0 6px rgba(236, 72, 153, 0.18);
      }

      h1 {
        margin: 0;
        font-size: clamp(2.2rem, 5vw, 3.4rem);
        line-height: 0.98;
        letter-spacing: -0.05em;
        max-width: 12ch;
      }

      .body {
        margin: 0;
        max-width: 58ch;
        color: var(--ink-soft);
        font-size: 1rem;
        line-height: 1.7;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .cta,
      .secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 50px;
        padding: 0 18px;
        border-radius: 16px;
        font-weight: 700;
        text-decoration: none;
        transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
      }

      .cta {
        background: #6C3AED;
        color: #F5F3FF;
        border: 1px solid rgba(107, 92, 138, 0.32);
        box-shadow: 0 18px 30px rgba(52, 93, 182, 0.28);
      }

      .secondary {
        color: #d9e8ff;
        border: 1px solid rgba(107, 92, 138, 0.28);
        background: rgba(31, 21, 49, 0.82);
      }

      .cta:hover,
      .secondary:hover {
        transform: translateY(-1px);
      }

      .note {
        display: grid;
        gap: 10px;
        padding: 18px 18px 16px;
        border-radius: 22px;
        border: 1px solid var(--line-soft);
        background: linear-gradient(160deg, rgba(31, 21, 49, 0.78), rgba(24, 18, 39, 0.9));
        box-shadow: var(--shadow-soft);
      }

      .note small {
        display: block;
        color: var(--ink-muted);
        font-size: 0.66rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .note strong {
        display: block;
        font-size: 1rem;
      }

      .note span {
        color: var(--ink-soft);
        line-height: 1.65;
        font-size: 0.92rem;
      }

      @media (max-width: 640px) {
        .page { padding: 16px; }
        .inner { padding: 22px; }
        .actions { flex-direction: column; }
        .cta, .secondary { width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="card">
        <div class="inner">
          <div class="brand">
            <div class="brand-badge">${renderClaritectLogoImage("claritect-brand-mark")}</div>
            <div class="brand-copy">
              <strong>Claritect</strong>
              <span>${loginSurfaceLabel}</span>
            </div>
          </div>

          <span class="eyebrow">${input.eyebrow}</span>
          <div>
            <h1>${input.heading}</h1>
            <p class="body">${input.body}</p>
          </div>

          <div class="actions">
            <a class="cta" href="${input.primary_href}">${input.primary_label}</a>
            <a class="secondary" href="${input.secondary_href}">${input.secondary_label}</a>
          </div>

          <div class="note">
            <small>Session update</small>
            <strong>${input.accent_note}</strong>
            <span>Your cookies for this surface have been cleared. You can sign back in whenever you’re ready.</span>
          </div>
        </div>
      </section>
    </div>
  </body>
</html>`;
}

export function renderCustomerLoggedOutPage(): string {
  return renderLogoutShell({
    title: "Claritect | Signed out",
    eyebrow: "Signed out",
    heading: "You’re safely signed out.",
    body: "Your Claritect workspace session is closed. If you’re switching accounts or wrapping up for now, you’re in a clean state.",
    primary_href: "/login",
    primary_label: "Sign in again",
    secondary_href: "/",
    secondary_label: "Back to home",
    accent_note: "Customer workspace access ended",
    variant: "customer"
  });
}

export function renderAdminLoggedOutPage(): string {
  return renderLogoutShell({
    title: "Claritect | Admin signed out",
    eyebrow: "Admin signed out",
    heading: "Admin session closed.",
    body: "Your Claritect admin session has been ended cleanly. You can return to the admin console when you’re ready, or head back to the public site.",
    primary_href: "/admin/login",
    primary_label: "Return to admin login",
    secondary_href: "/",
    secondary_label: "Back to home",
    accent_note: "Admin console access ended",
    variant: "admin"
  });
}
