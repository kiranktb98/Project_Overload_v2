import { renderClaritectLogoImage } from "./brand";
import {
  audienceTiles,
  benchmarkSavings,
  comparisonCards,
  marketingHero,
  marketingNavItems,
  narrativeSlides,
  outcomeBullets,
  pricingPlans,
  publicFooterText,
  shiftLayers,
  solutionStages
} from "./marketing-content";
import { getMarketingAssetPath } from "./marketing-build";

function renderMarketingLayout(input: {
  title: string;
  active: "home" | "pricing";
  pageScript: string;
  pageStyle: string;
  mainClassName: string;
  fallback: string;
}): string {
  const navLink = (href: string, label: string, active: boolean) =>
    `<a class="mk-pill-link${active ? " active" : ""}" href="${href}">${label}</a>`;

  const navLinks = marketingNavItems
    .map((item) => navLink(item.href, item.label, input.active === "home" ? item.href === "/" : item.href === "/pricing"))
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${input.pageStyle}" />
  </head>
  <body class="claritect-marketing">
    <div class="mk-page">
      <div class="mk-shell">
        <header class="mk-nav">
          <a class="mk-brand" href="/">
            <span class="mk-brand-mark">${renderClaritectLogoImage("mk-brand-logo")}</span>
            <span class="mk-brand-copy">
              <strong>Claritect</strong>
              <span>Decision intelligence</span>
            </span>
          </a>
          <nav class="mk-nav-links">${navLinks}</nav>
          <div class="mk-nav-actions">
            <a class="mk-pill-link" href="/login">Customer Login</a>
            <a class="mk-pill-link" href="/admin/login">Admin</a>
            <a class="mk-nav-cta" href="mailto:hello@claritect.ai?subject=Book%20a%20Claritect%20Live%20Pilot">Book a Live Pilot</a>
          </div>
        </header>
        <main class="mk-main">
          <div id="marketing-root" class="${input.mainClassName}">${input.fallback}</div>
        </main>
        <footer class="mk-footer">
          <span>${publicFooterText}</span>
          <span><a href="/pricing">Pricing</a> · <a href="/login">Customer Login</a> · <a href="/admin/login">Admin</a></span>
        </footer>
      </div>
    </div>
    <script type="module" src="${input.pageScript}"></script>
  </body>
</html>`;
}

function renderHomeFallback(): string {
  return `
    <div class="mk-home-root">
      <section class="mk-section mk-hero-section">
        <div class="mk-section-inner mk-hero-center">
          <div class="mk-hero-panel mk-hero-panel--centered">
            <span class="mk-eyebrow">${marketingHero.eyebrow}</span>
            <h1 class="mk-headline">${marketingHero.headline}</h1>
            <p class="mk-subline">${marketingHero.subline}</p>
            <div class="mk-proof-strip">${marketingHero.proof}</div>
            <div class="mk-hero-actions">
              <a class="mk-button" href="${marketingHero.primaryCta.href}">${marketingHero.primaryCta.label}</a>
              <a class="mk-button-ghost" href="${marketingHero.secondaryCta.href}">${marketingHero.secondaryCta.label}</a>
              <a class="mk-button-link" href="${marketingHero.tertiaryCta.href}">${marketingHero.tertiaryCta.label}</a>
            </div>
          </div>
        </div>
      </section>
      <section class="mk-section">
        <div class="mk-section-inner">
          <div class="mk-grid-4">
            ${narrativeSlides
              .map(
                (slide) => `
                  <article class="mk-card">
                    <small>${slide.eyebrow}</small>
                    <h3>${slide.title}</h3>
                    <p>${slide.body}</p>
                  </article>`
              )
              .join("")}
          </div>
        </div>
      </section>
      <section class="mk-section mk-approach-section">
        <div class="mk-section-inner">
          <div class="mk-section-head">
            <h2 class="mk-section-title">The insight you need. Whenever you need it.</h2>
            <p class="mk-section-copy">Like having a data analyst and a consulting team on call — Claritect turns your questions into governed, actionable answers.</p>
          </div>
          <div class="mk-approach-flow">
            <article class="mk-approach-card">
              <div class="mk-phase-num">01</div>
              <h3>The insight gap</h3>
              <p class="mk-approach-lead">Great data — turning it into answers takes time and context.</p>
              <div class="mk-approach-icon mk-icon-repeat" aria-hidden="true"><span></span><span></span><span></span></div>
            </article>
            <div class="mk-approach-arrow" aria-hidden="true"></div>
            <article class="mk-approach-card mk-approach-card--accent">
              <div class="mk-phase-num">02</div>
              <h3>Data to intelligence</h3>
              <p class="mk-approach-lead">Not just charts — answers with actions.</p>
              <div class="mk-approach-icon mk-icon-ladder" aria-hidden="true">
                ${shiftLayers.map((layer) => `<span>${layer.label}</span>`).join("")}
              </div>
            </article>
            <div class="mk-approach-arrow" aria-hidden="true"></div>
            <article class="mk-approach-card">
              <div class="mk-phase-num">03</div>
              <h3>From questions to action</h3>
              <p class="mk-approach-lead">Quick checks, deep dives, or scheduled updates — your call.</p>
              <div class="mk-approach-icon mk-icon-steps" aria-hidden="true">
                ${solutionStages.map((stage) => `<span>${stage.title.split(" ")[0]}</span>`).join("")}
              </div>
            </article>
          </div>
        </div>
      </section>
      <section class="mk-section">
        <div class="mk-section-inner">
          <div class="mk-section-head">
            <h2 class="mk-section-title">Every team has questions. Claritect has answers.</h2>
          </div>
          <div class="mk-grid-4">
            ${audienceTiles
              .map(
                (tile) => `
                  <article class="mk-card mk-audience-card">
                    <small>${tile.role}</small>
                    <div class="mk-audience-question">${tile.question}</div>
                  </article>`
              )
              .join("")}
          </div>
        </div>
      </section>
      <section class="mk-section">
        <div class="mk-section-inner">
          <div class="mk-content-panel mk-final-cta">
            <h2 class="mk-section-title">Your data analyst and consultant — on demand.</h2>
            <ul>
              ${outcomeBullets.map((bullet) => `<li>${bullet}</li>`).join("")}
            </ul>
          </div>
        </div>
      </section>
    </div>`;
}

function renderPricingFallback(): string {
  return `
    <div class="mk-pricing-root">
      <section class="mk-pricing-hero">
        <div class="mk-pricing-hero-copy">
          <h1>Consultant-grade insight at a fraction of the cost.</h1>
          <p class="mk-subline">Pick a plan. Connect your data. Get your first governed answer the same day — no setup fees, no long-term lock-in.</p>
        </div>
        <div class="mk-pricing-hero-art"></div>
      </section>
      <section class="mk-pricing-grid">
        ${pricingPlans
          .map(
            (plan) => `
              <article class="mk-card mk-pricing-plan${plan.featured ? " featured" : ""}">
                <small>${plan.name}</small>
                <h3>${plan.name}</h3>
                <div class="mk-price-row"><strong>${plan.price}</strong><span>${plan.cadence}</span></div>
                <p>${plan.summary}</p>
                <ul>${plan.features.map((feature) => `<li>${feature}</li>`).join("")}</ul>
              </article>`
          )
          .join("")}
      </section>
      <section class="mk-compare-section">
        <div class="mk-section-head">
          <h2 class="mk-section-title">How Claritect compares</h2>
        </div>
        <div class="mk-compare-grid">
          ${comparisonCards
            .map(
              (card) => `
                <article class="mk-compare-card${card.featured ? " featured" : ""}">
                  <div class="mk-compare-header">
                    <h3>${card.name}</h3>
                    <div class="mk-compare-cost"><strong>${card.cost}</strong><span>${card.costNote}</span></div>
                    <div class="mk-compare-time">
                      <span class="mk-compare-time-label">Time to answer</span>
                      <span>${card.time}</span>
                    </div>
                  </div>
                  <ul class="mk-compare-traits">
                    ${card.traits.map((trait) => `<li class="mk-trait mk-trait--${trait.status}"><span class="mk-trait-icon" aria-hidden="true"></span><span>${trait.label}</span></li>`).join("")}
                  </ul>
                </article>`
            )
            .join("")}
        </div>
        <div class="mk-benchmark-highlight">
          ${benchmarkSavings
            .map(
              (saving) => `
                <div class="mk-highlight-card">
                  <strong>${saving.stat} <span class="mk-highlight-detail">${saving.detail}</span></strong>
                  <span>${saving.context}</span>
                </div>`
            )
            .join("")}
        </div>
      </section>
    </div>`;
}

export function renderMarketingHomePage(): string {
  return renderMarketingLayout({
    title: "Claritect | Turn data into decisions",
    active: "home",
    pageScript: getMarketingAssetPath("home.js"),
    pageStyle: getMarketingAssetPath("home.css"),
    mainClassName: "mk-home-root",
    fallback: renderHomeFallback()
  });
}

export function renderMarketingPricingPage(): string {
  return renderMarketingLayout({
    title: "Claritect | Pricing",
    active: "pricing",
    pageScript: getMarketingAssetPath("pricing.js"),
    pageStyle: getMarketingAssetPath("pricing.css"),
    mainClassName: "mk-pricing-root",
    fallback: renderPricingFallback()
  });
}
