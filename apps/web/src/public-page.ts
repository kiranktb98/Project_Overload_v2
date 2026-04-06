import { readFileSync } from "node:fs";
import { renderClaritectFaviconLinks } from "./brand";

const PITCH_HTML_RAW = readFileSync(
  new URL("../public/pitch.html", import.meta.url),
  "utf8"
);
const PRIVACY_POLICY_HTML_RAW = readFileSync(
  new URL("../public/privacy-policy.html", import.meta.url),
  "utf8"
);
const TERMS_OF_SERVICE_HTML_RAW = readFileSync(
  new URL("../public/terms-of-service.html", import.meta.url),
  "utf8"
);

const MOJIBAKE_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["â€”", "—"],
  ["â€“", "–"],
  ["â†’", "→"],
  ["â†", "←"],
  ["âœ“", "✓"],
  ["â€™", "’"],
  ["â€˜", "‘"],
  ["â€œ", "“"],
  ["â€", "”"],
  ["â€¦", "…"],
  ["Â©", "©"],
  ["Ã—", "×"],
  ["Â", ""]
];

const PUBLIC_ROUTE_REWRITES: ReadonlyArray<readonly [string, string]> = [
  ["/pitch.html", "/"],
  ["/privacy-policy.html", "/privacy-policy"],
  ["/terms-of-service.html", "/terms-of-service"],
  ["/blog.html", "/blog"]
];

function normalizePublicHtml(raw: string): string {
  let html = raw;
  for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
    html = html.replaceAll(from, to);
  }

  for (const [from, to] of PUBLIC_ROUTE_REWRITES) {
    html = html.replaceAll(from, to);
  }

  if (!html.includes('rel="icon"')) {
    html = html.replace("</title>", `</title>\n  ${renderClaritectFaviconLinks()}`);
  }

  return html;
}

function renderBlogHomePage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect Blog | AI Reporting, SQL, and Decision Intelligence</title>
    <meta
      name="description"
      content="Claritect's blog covers AI business analysts, automated reporting, natural language SQL, scheduled executive reports, and practical decision intelligence for growing teams."
    />
    ${renderClaritectFaviconLinks()}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        color-scheme: dark;
        --bg: #0f0b1a;
        --bg-2: #151024;
        --panel: rgba(24, 18, 39, 0.92);
        --panel-2: rgba(31, 21, 49, 0.78);
        --line: rgba(107, 92, 138, 0.26);
        --line-strong: rgba(107, 92, 138, 0.4);
        --ink: #f5f3ff;
        --ink-soft: #d7cfe6;
        --ink-muted: #9d90bc;
        --purple: #6c3aed;
        --pink: #ec4899;
        --glow: linear-gradient(135deg, #6c3aed 0%, #ec4899 100%);
        --shadow: 0 30px 70px rgba(10, 6, 20, 0.54);
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, "Sohne", "Suisse Intl", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 12% 12%, rgba(108, 58, 237, 0.18), transparent 22%),
          radial-gradient(circle at 86% 12%, rgba(236, 72, 153, 0.14), transparent 26%),
          linear-gradient(180deg, #0f0b1a 0%, #120d20 48%, #171126 100%);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(107, 92, 138, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(107, 92, 138, 0.06) 1px, transparent 1px);
        background-size: 60px 60px;
        mask-image: radial-gradient(circle at 50% 42%, rgba(0, 0, 0, 0.88), transparent 92%);
      }

      .wrap {
        position: relative;
        z-index: 1;
        max-width: 1180px;
        margin: 0 auto;
        padding: 0 28px;
      }

      nav {
        position: sticky;
        top: 0;
        z-index: 50;
        border-bottom: 1px solid var(--line);
        background: rgba(15, 11, 26, 0.86);
        backdrop-filter: blur(22px) saturate(1.2);
      }

      .nav-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        min-height: 68px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        color: var(--ink);
        text-decoration: none;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .brand-mark {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: rgba(31, 21, 49, 0.82);
        border: 1px solid rgba(107, 92, 138, 0.32);
        box-shadow: 0 12px 26px rgba(108, 58, 237, 0.16);
      }

      .brand-mark svg {
        width: 22px;
        height: 22px;
      }

      .nav-links {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .nav-links a {
        color: var(--ink-muted);
        text-decoration: none;
        font-size: 0.84rem;
        font-weight: 600;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid transparent;
        transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
      }

      .nav-links a:hover {
        color: var(--ink);
        border-color: var(--line);
        background: rgba(31, 21, 49, 0.65);
      }

      .hero {
        padding: 88px 0 44px;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(320px, 420px);
        gap: 26px;
        align-items: stretch;
      }

      .hero-card,
      .side-card,
      .section-card,
      .post-card {
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(20, 15, 34, 0.96), rgba(17, 12, 28, 0.96));
        box-shadow: var(--shadow);
      }

      .hero-card {
        border-radius: 32px;
        padding: 34px;
      }

      .side-card {
        border-radius: 28px;
        padding: 26px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 18px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(107, 92, 138, 0.32);
        background: rgba(31, 21, 49, 0.82);
        color: var(--ink-soft);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .eyebrow::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--pink);
        box-shadow: 0 0 0 6px rgba(236, 72, 153, 0.16);
      }

      h1 {
        margin: 0 0 18px;
        font-size: clamp(2.7rem, 5vw, 4.3rem);
        line-height: 0.96;
        letter-spacing: -0.05em;
      }

      .hero-copy {
        margin: 0;
        max-width: 62ch;
        color: var(--ink-soft);
        font-size: 1rem;
        line-height: 1.8;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 26px;
      }

      .btn-primary,
      .btn-secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 14px;
        text-decoration: none;
        font-weight: 700;
      }

      .btn-primary {
        color: white;
        background: var(--glow);
        box-shadow: 0 16px 30px rgba(108, 58, 237, 0.24);
      }

      .btn-secondary {
        color: var(--ink);
        border: 1px solid var(--line-strong);
        background: rgba(31, 21, 49, 0.72);
      }

      .side-card h2 {
        margin: 0 0 10px;
        font-size: 1.2rem;
      }

      .side-card p {
        margin: 0;
        color: var(--ink-soft);
        line-height: 1.75;
      }

      .side-list {
        display: grid;
        gap: 12px;
        margin-top: 20px;
      }

      .side-item {
        padding: 14px 14px 14px 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(31, 21, 49, 0.64);
      }

      .side-item strong {
        display: block;
        margin-bottom: 6px;
        font-size: 0.95rem;
      }

      .side-item span {
        color: var(--ink-soft);
        font-size: 0.84rem;
        line-height: 1.6;
      }

      .section {
        padding: 24px 0 90px;
      }

      .section-head {
        display: grid;
        gap: 12px;
        margin-bottom: 26px;
      }

      .section-head h2 {
        margin: 0;
        font-size: clamp(1.7rem, 3vw, 2.4rem);
        letter-spacing: -0.04em;
      }

      .section-head p {
        margin: 0;
        max-width: 72ch;
        color: var(--ink-soft);
        line-height: 1.8;
      }

      .section-card {
        border-radius: 28px;
        padding: 28px;
      }

      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .pill {
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(31, 21, 49, 0.72);
        color: var(--ink-soft);
        font-size: 0.82rem;
        font-weight: 600;
      }

      .grid {
        display: grid;
        gap: 18px;
      }

      .post-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }

      .post-card {
        border-radius: 24px;
        padding: 22px;
      }

      .post-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
        color: var(--ink-muted);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .post-meta span:last-child {
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(107, 92, 138, 0.32);
        background: rgba(31, 21, 49, 0.78);
      }

      .post-card h3 {
        margin: 0 0 10px;
        font-size: 1.12rem;
        letter-spacing: -0.03em;
      }

      .post-card p {
        margin: 0 0 14px;
        color: var(--ink-soft);
        font-size: 0.92rem;
        line-height: 1.72;
      }

      .post-card ul {
        margin: 0;
        padding: 0 0 0 18px;
        color: var(--ink-soft);
      }

      .post-card li {
        margin-bottom: 8px;
        line-height: 1.65;
      }

      .footer {
        border-top: 1px solid var(--line);
        padding: 26px 0 40px;
      }

      .footer-inner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }

      .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }

      .footer-links a,
      .footer-copy {
        color: var(--ink-muted);
        text-decoration: none;
        font-size: 0.82rem;
      }

      .footer-links a:hover {
        color: var(--ink);
      }

      @media (max-width: 980px) {
        .hero-grid,
        .post-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .wrap {
          padding: 0 18px;
        }

        nav {
          position: static;
        }

        .nav-inner,
        .footer-inner {
          align-items: flex-start;
          flex-direction: column;
        }

        .hero {
          padding-top: 54px;
        }

        .hero-card,
        .side-card,
        .section-card,
        .post-card {
          padding-left: 18px;
          padding-right: 18px;
        }
      }
    </style>
  </head>
  <body>
    <nav>
      <div class="wrap nav-inner">
        <a class="brand" href="/">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none">
              <circle cx="21" cy="32" r="6.5" fill="url(#blog-core)"/>
              <path d="M14 27.5H30.5" stroke="#F5F3FF" stroke-width="3.2" stroke-linecap="round"/>
              <path d="M10.5 32H30.5" stroke="#F5F3FF" stroke-width="3.2" stroke-linecap="round"/>
              <path d="M13 36.5H30.5" stroke="#F5F3FF" stroke-width="3.2" stroke-linecap="round"/>
              <path d="M33 25.5H49.5V38.5H33" stroke="#F5F3FF" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M39.5 21.5H47.5" stroke="#EC4899" stroke-width="2.4" stroke-linecap="round"/>
              <defs>
                <radialGradient id="blog-core" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(21 32) rotate(49.4) scale(10.8)">
                  <stop stop-color="#FFB7D7"/>
                  <stop offset="1" stop-color="#6C3AED"/>
                </radialGradient>
              </defs>
            </svg>
          </span>
          <span>Claritect Blog</span>
        </a>
        <div class="nav-links">
          <a href="/">Home</a>
          <a href="/signup">Sign up</a>
          <a href="/login">Login</a>
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms-of-service">Terms</a>
        </div>
      </div>
    </nav>

    <section class="hero">
      <div class="wrap hero-grid">
        <div class="hero-card">
          <span class="eyebrow">Editorial engine</span>
          <h1>Content for the exact problems Claritect solves.</h1>
          <p class="hero-copy">
            This is the public home for Claritect articles on AI business analysts, automated reporting,
            natural language SQL, scheduled executive reports, and decision intelligence for finance,
            ops, and growth teams. We’re using this page as the base that future articles will branch from.
          </p>
          <div class="hero-actions">
            <a class="btn-primary" href="/signup">Request early access</a>
            <a class="btn-secondary" href="/">View product home</a>
          </div>
        </div>

        <aside class="side-card">
          <h2>SEO themes we’re leaning into</h2>
          <p>
            Each article cluster is designed around high-intent searches from operators, founders, and
            analysts who need answers faster than traditional BI workflows can provide.
          </p>
          <div class="side-list">
            <div class="side-item">
              <strong>AI business analyst</strong>
              <span>Position Claritect as the practical replacement for repetitive analyst requests.</span>
            </div>
            <div class="side-item">
              <strong>Automated reporting</strong>
              <span>Own weekly, monthly, and board-ready reporting workflows with governed outputs.</span>
            </div>
            <div class="side-item">
              <strong>Natural language SQL</strong>
              <span>Capture teams looking for plain-English access to production data without unsafe tooling.</span>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <section class="section">
      <div class="wrap grid">
        <div class="section-head">
          <span class="eyebrow">Keyword clusters</span>
          <h2>Core search intent we want Claritect to own</h2>
          <p>
            The page itself is written to be indexable, but it also acts as a launchpad for future articles.
            These clusters let us publish consistently without drifting away from the product’s actual strengths.
          </p>
        </div>

        <div class="section-card">
          <div class="pill-row">
            <span class="pill">AI business analyst</span>
            <span class="pill">Automated business reporting</span>
            <span class="pill">Natural language analytics</span>
            <span class="pill">AI SQL reporting</span>
            <span class="pill">Scheduled executive reports</span>
            <span class="pill">ChatGPT for data teams</span>
            <span class="pill">AI analyst vs human analysts</span>
            <span class="pill">Decision intelligence platform</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="eyebrow">Publishing roadmap</span>
          <h2>Foundational posts ready to publish next</h2>
          <p>
            These are intentionally practical and search-led. Each one reinforces how Claritect fits into real
            business workflows instead of reading like generic AI hype.
          </p>
        </div>

        <div class="post-grid">
          <article class="post-card">
            <div class="post-meta"><span>AI analyst</span><span>Publishing soon</span></div>
            <h3>What an AI business analyst should actually do for a 50-person company</h3>
            <p>Frame the job-to-be-done around recurring reporting, operational clarity, and executive follow-through.</p>
            <ul>
              <li>What teams really need from an AI analyst</li>
              <li>Where dashboards stop helping</li>
              <li>Why governed reporting matters</li>
            </ul>
          </article>

          <article class="post-card">
            <div class="post-meta"><span>Reporting</span><span>Publishing soon</span></div>
            <h3>How to automate weekly business reports without losing trust in the numbers</h3>
            <p>Speak directly to founders, ops leaders, and finance teams who are tired of manual reporting loops.</p>
            <ul>
              <li>Scheduled reports with timezone-aware delivery</li>
              <li>Read-only query safety</li>
              <li>Executive-ready outputs, not raw dashboards</li>
            </ul>
          </article>

          <article class="post-card">
            <div class="post-meta"><span>SQL</span><span>Publishing soon</span></div>
            <h3>Natural language SQL tools: what to look for before connecting real company data</h3>
            <p>Target high-intent searches around plain-English SQL while clearly differentiating Claritect’s guardrails.</p>
            <ul>
              <li>SELECT-only governance</li>
              <li>Evidence caps and business-safe summaries</li>
              <li>Why ad hoc chat alone is not enough</li>
            </ul>
          </article>

          <article class="post-card">
            <div class="post-meta"><span>Comparison</span><span>Publishing soon</span></div>
            <h3>Claritect vs self-serve AI tools vs analysts for recurring business questions</h3>
            <p>Use the exact comparison model from the pricing narrative and turn it into a durable search asset.</p>
            <ul>
              <li>Hours saved</li>
              <li>Money saved</li>
              <li>Repeatability and follow-up quality</li>
            </ul>
          </article>

          <article class="post-card">
            <div class="post-meta"><span>Ops</span><span>Publishing soon</span></div>
            <h3>Why operations teams need more than dashboards when questions change every week</h3>
            <p>Double down on the gap between static BI and conversational, repeatable reporting workflows.</p>
            <ul>
              <li>From KPI monitoring to decision support</li>
              <li>Follow-up analysis in one thread</li>
              <li>Faster incident and performance reviews</li>
            </ul>
          </article>

          <article class="post-card">
            <div class="post-meta"><span>Leadership</span><span>Publishing soon</span></div>
            <h3>Board-ready reporting without building a bigger data team</h3>
            <p>Speak to leaders who need investor and board communication to feel tighter without hiring ahead of demand.</p>
            <ul>
              <li>Business-case outputs</li>
              <li>Cleaner narrative sections and deltas</li>
              <li>How smaller teams stay decision-ready</li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="wrap footer-inner">
        <div class="footer-links">
          <a href="/">Home</a>
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms-of-service">Terms of Service</a>
          <a href="/login">Customer Login</a>
        </div>
        <span class="footer-copy">© 2026 Claritect. Built for governed decision intelligence.</span>
      </div>
    </footer>
  </body>
</html>`;
}

export function renderHomePage(): string {
  return normalizePublicHtml(PITCH_HTML_RAW);
}

export function renderPitchPage(): string {
  return renderHomePage();
}

export function renderPricingPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect | Pricing page</title>
    ${renderClaritectFaviconLinks()}
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
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
        width: min(100%, 540px);
        display: grid;
        gap: 16px;
        padding: 28px;
        border: 1px solid rgba(107, 92, 138, 0.28);
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(20, 15, 34, 0.96), rgba(17, 12, 28, 0.96));
      }
      h1 {
        margin: 0;
        font-size: 42px;
        line-height: 1.04;
        letter-spacing: -0.04em;
      }
      p {
        margin: 0;
        color: #d7cff8;
        line-height: 1.75;
      }
      a {
        width: fit-content;
        border-radius: 12px;
        background: #6c3aed;
        color: #f5f3ff;
        padding: 12px 16px;
        font-weight: 600;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Pricing page</h1>
      <p>We’re keeping pricing lightweight in the product deployment for now. The core sales story is on the home page, and detailed comparisons can live here next.</p>
      <a href="/">Back to home</a>
    </main>
  </body>
</html>`;
}

export function renderPrivacyPolicyPage(): string {
  return normalizePublicHtml(PRIVACY_POLICY_HTML_RAW);
}

export function renderTermsOfServicePage(): string {
  return normalizePublicHtml(TERMS_OF_SERVICE_HTML_RAW);
}

export function renderBlogPage(): string {
  return renderBlogHomePage();
}

export function renderSignupPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect | Sign up form</title>
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
    </style>
  </head>
  <body>
    <main>
      <h1>Sign up form</h1>
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
      </form>
    </main>
  </body>
</html>`;
}
