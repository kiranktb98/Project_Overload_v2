import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const require = createRequire(resolve(process.cwd(), "packages/report-render/package.json"));
const puppeteer = require("puppeteer-core");

const BRAND = {
  base: "#0F0B1A",
  accentA: "#6C3AED",
  accentB: "#EC4899",
  input: "#6B5C8A",
  output: "#F5F3FF",
  soft: "#B8AFCA",
  panel: "rgba(23, 18, 38, 0.94)",
  line: "rgba(167, 146, 214, 0.18)"
};

const slides = [];

const slideDir = join(__dirname, "slides");
const pdfDir = join(__dirname, "pdfs");
const pngDir = join(__dirname, "previews");
const finalPdfPath = join(__dirname, "CLARITECT_PITCH_DECK.pdf");

slides.push({
  eyebrow: "Claritect",
  title: "Define the report once. Run it forever.",
  subtitle:
    "A governed AI reporting system that turns one scoped chat into a reusable reporting contract, recurring executive output, and follow-up decision support.",
  variant: "hero",
  body: `
    <div class="hero-grid">
      <div class="hero-copy">
        <div class="hero-badges">
          <span>Governed SQL</span>
          <span>Recurring reports</span>
          <span>Executive-ready output</span>
        </div>
        <p class="hero-note">Claritect combines governed data access, scoped analytical chat, HTML and PDF reporting, report clarification, business case follow-up, and deterministic scheduling in one operator surface.</p>
      </div>
      <div class="hero-visual">
        ${logoMarkup("large")}
      </div>
    </div>
  `
});

slides.push({
  eyebrow: "The problem",
  title: "Reporting breaks because the workflow is fragmented.",
  subtitle: "Teams do not just need answers. They need repeatable, trusted, business-readable reporting.",
  body: `
    <div class="two-col">
      <div class="issue-list">
        ${numberedCard("01", "Analysts rewrite the same logic every week", "Date windows, joins, and filters get rebuilt instead of reused.")}
        ${numberedCard("02", "Chat outputs are often one-off and non-operational", "A good answer today does not become a dependable reporting system tomorrow.")}
        ${numberedCard("03", "Governance and readability pull in opposite directions", "Teams either get raw SQL with risk or pretty output with weak trust.")}
      </div>
      <div class="issue-panel">
        <h3>What buyers actually want</h3>
        <ul class="clean-list">
          <li>A governed way to connect to production data.</li>
          <li>A way to scope the report once without repeating clarifications.</li>
          <li>Business-ready output that leadership can actually use.</li>
          <li>A repeatable schedule that rolls forward safely.</li>
          <li>Follow-up analysis without losing context.</li>
        </ul>
      </div>
    </div>
  `
});

slides.push({
  eyebrow: "The product",
  title: "Claritect turns one analytical chat into a reusable report contract.",
  subtitle: "The system captures not just the question, but the governed logic, assumptions, and rerun behavior needed to operate the report over time.",
  body: `
    <div class="pillar-grid">
      ${pillarCard("Connect a governed source", "Guide the user through source, governance, cataloging, and activation across Postgres, MySQL, Snowflake, and BigQuery.")}
      ${pillarCard("Scope once in chat", "Break the report into atomic questions, ask clarifications, suggest useful follow-ups, and lock the final plan.")}
      ${pillarCard("Run, explain, and schedule", "Generate the report, answer questions on it, build business cases, and save it as a recurring schedule.")}
    </div>
    <div class="bottom-strip">
      <div><strong>System of record:</strong> report contract</div>
      <div><strong>Primary output:</strong> HTML + PDF report</div>
      <div><strong>Recurring value:</strong> deterministic scheduled reruns</div>
    </div>
  `
});

slides.push({
  eyebrow: "Operator flow",
  title: "The workflow moves from source connection to recurring intelligence.",
  subtitle: "Every major step is explicit, governed, and persisted.",
  body: `
    <div class="flow-row">
      ${flowStep("01", "Connect", "Choose the source, test access, govern the allowlist, catalogue the schema, and activate safe queries.")}
      ${flowArrow()}
      ${flowStep("02", "Scope", "Ask for the report, clarify each question, add or remove scope items, and lock the final plan.")}
      ${flowArrow()}
      ${flowStep("03", "Prepare", "Preview the governed queries, inspect sample output, and edit a query before final analysis.")}
      ${flowArrow()}
      ${flowStep("04", "Generate", "Produce the final report in HTML or PDF, then unlock report clarification and business case follow-up.")}
      ${flowArrow()}
      ${flowStep("05", "Schedule", "Save cadence, question rerun logic, query templates, and the report template snapshot.")}
    </div>
  `
});

slides.push({
  eyebrow: "The contract",
  title: "The report contract is what makes the system reusable.",
  subtitle: "Claritect persists the structure of the report, not just a single answer.",
  body: `
    <div class="two-col contract-grid">
      <div class="panel-card">
        <h3>Saved in the contract</h3>
        <ul class="clean-list">
          <li>Report title, audience, and timezone</li>
          <li>Scoped questions and clarification answers</li>
          <li>Metric definitions and business context</li>
          <li>Guardrails such as allowlisted relations and schemas</li>
          <li>Prepared query overrides after operator SQL edits</li>
          <li>KPI watchlists and schedule state when the report becomes recurring</li>
        </ul>
      </div>
      <div class="panel-card emphasis">
        <h3>Why this matters</h3>
        <p>Most analytics tools persist charts. Most chat tools persist transcripts. Claritect persists an operational reporting contract that can be rerun, audited, and evolved.</p>
        <div class="quote-line">One scoped conversation becomes a repeatable operating asset.</div>
      </div>
    </div>
  `
});

slides.push({
  eyebrow: "Trust layer",
  title: "Judgment and governance are deliberately split.",
  subtitle: "AI handles reasoning where nuance matters. Deterministic code handles risk where trust matters.",
  body: `
    <div class="split-stack">
      <div class="stack-card">
        <h3>AI-powered layers</h3>
        <ul class="clean-list">
          <li>Conversation orchestration and scoping</li>
          <li>Batch analysis and forecast analysis</li>
          <li>Report composition</li>
          <li>Report clarification</li>
          <li>Business case generation</li>
        </ul>
      </div>
      <div class="stack-card">
        <h3>Deterministic layers</h3>
        <ul class="clean-list">
          <li>SELECT-only SQL enforcement</li>
          <li>Allowlist and schema checks</li>
          <li>Forced limits and evidence row cap</li>
          <li>Cron plus timezone scheduling</li>
          <li>Queueing, retries, and audit logging</li>
        </ul>
      </div>
    </div>
    <div class="guardrail-band">
      <span>Read-only customer access</span>
      <span>Evidence row cap ≤ 200</span>
      <span>Deterministic scheduling</span>
      <span>Business-consumable output</span>
    </div>
  `
});

slides.push({
  eyebrow: "Outputs",
  title: "The report is not the end of the flow. It becomes a decision surface.",
  subtitle: "Every completed run can immediately support operator follow-up.",
  body: `
    <div class="three-panel">
      ${outputCard("HTML + PDF report", "Customer-facing narrative output with structured sections, charts and tables, and metric-definition support.")}
      ${outputCard("Ask clarifications on the report", "Grounded follow-up answers using report HTML, exec brief, prepared payloads, summaries, and metric definitions.")}
      ${outputCard("Ask for business case analysis", "Detailed scenario and business case work only for genuinely actionable recommendations from the run.")}
    </div>
    <div class="bottom-strip">
      <div><strong>Same context</strong> stays available after generation.</div>
      <div><strong>Same chat</strong> remains the working thread.</div>
      <div><strong>Same run</strong> can be reopened later from Scheduled Reports.</div>
    </div>
  `
});

slides.push({
  eyebrow: "Scheduled intelligence",
  title: "Recurring runs are more than cron jobs.",
  subtitle: "Claritect stores enough context to rerun the report as a stable product experience, not a fragile script.",
  body: `
    <div class="schedule-layout">
      <div class="panel-card">
        <h3>Saved with the schedule</h3>
        <ul class="clean-list">
          <li>Frequency, timezone, and cron</li>
          <li>Question-by-question rerun behavior</li>
          <li>Windowing instructions</li>
          <li>Query template snapshot</li>
          <li>HTML template snapshot</li>
        </ul>
      </div>
      <div class="panel-card">
        <h3>What happens on the next run</h3>
        <ul class="clean-list">
          <li>Time windows roll forward to the next reporting period.</li>
          <li>The query strategist can reuse saved query patterns.</li>
          <li>The composer can reuse the previous HTML structure.</li>
          <li>A change-checker layer adds what-changed notes versus the last run.</li>
        </ul>
      </div>
    </div>
  `
});

slides.push({
  eyebrow: "Why it wins",
  title: "Claritect sits between dashboards and one-off AI chat.",
  subtitle: "It combines repeatability, governance, and executive-ready output in one operating model.",
  body: `
    <table class="compare-table">
      <thead>
        <tr>
          <th></th>
          <th>Traditional BI</th>
          <th>One-off AI chat</th>
          <th>Claritect</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Governed source access</td><td>Partial</td><td>Inconsistent</td><td>Built in</td></tr>
        <tr><td>Atomic scoped questions</td><td>Manual setup</td><td>Ad hoc</td><td>Built in</td></tr>
        <tr><td>Business-readable report output</td><td>Usually manual</td><td>Variable</td><td>Built in</td></tr>
        <tr><td>Repeatable schedules</td><td>Possible but brittle</td><td>Weak</td><td>Deterministic</td></tr>
        <tr><td>Report Q&A after generation</td><td>Rare</td><td>Context loss</td><td>Built in</td></tr>
        <tr><td>Business case follow-up</td><td>Separate workstream</td><td>Ungrounded</td><td>Built in</td></tr>
      </tbody>
    </table>
  `
});

slides.push({
  eyebrow: "Closing",
  title: "Claritect turns reporting into a governed recurring system.",
  subtitle: "From first connection to scheduled rerun, the product is built to move from exploratory analysis to repeatable operating output.",
  variant: "closing",
  body: `
    <div class="closing-grid">
      <div class="closing-copy">
        <div class="closing-points">
          <div><strong>Trusted by governance.</strong> Read-only, SELECT-only, allowlisted, auditable.</div>
          <div><strong>Useful to operators.</strong> Query preview, query editing, report clarification, business case follow-up.</div>
          <div><strong>Useful to leadership.</strong> Narrative HTML and PDF output plus recurring scheduled delivery.</div>
        </div>
      </div>
      <div class="closing-logo">
        ${logoMarkup("medium")}
        <div class="wordmark">Claritect</div>
        <div class="tagline">From raw tables to recurring intelligence.</div>
      </div>
    </div>
  `
});

rmSync(slideDir, { recursive: true, force: true });
rmSync(pdfDir, { recursive: true, force: true });
rmSync(pngDir, { recursive: true, force: true });
mkdirSync(slideDir, { recursive: true });
mkdirSync(pdfDir, { recursive: true });
mkdirSync(pngDir, { recursive: true });

const htmlPaths = slides.map((slide, index) => {
  const html = renderSlide(slide, index, slides.length);
  const file = join(slideDir, `slide-${String(index + 1).padStart(2, "0")}.html`);
  writeFileSync(file, html, "utf8");
  return file;
});

const browser = await puppeteer.launch({
  executablePath: findChromePath(),
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
});

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });

const pdfPaths = [];
for (let index = 0; index < htmlPaths.length; index += 1) {
  const htmlPath = htmlPaths[index];
  const html = readFileSync(htmlPath, "utf8");
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 2500))
        ]);
      } catch {
        // ignore font readiness failures
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  });
  const pdfPath = join(pdfDir, `slide-${String(index + 1).padStart(2, "0")}.pdf`);
  const pngPath = join(pngDir, `slide-${String(index + 1).padStart(2, "0")}.png`);
  await page.pdf({
    path: pdfPath,
    width: "13.333in",
    height: "7.5in",
    printBackground: true,
    margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" }
  });
  await page.screenshot({ path: pngPath, type: "png" });
  pdfPaths.push(pdfPath);
}

await browser.close();
const mergedOutputPath = mergePdfs(pdfPaths, finalPdfPath);

console.log(`Slides written to ${slideDir}`);
console.log(`Per-slide PDFs written to ${pdfDir}`);
console.log(`Merged deck written to ${mergedOutputPath}`);

function renderSlide(slide, index, total) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claritect Pitch Deck - Slide ${index + 1}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@600;700;800&family=Nunito+Text:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        --base: ${BRAND.base};
        --accent-a: ${BRAND.accentA};
        --accent-b: ${BRAND.accentB};
        --input: ${BRAND.input};
        --output: ${BRAND.output};
        --soft: ${BRAND.soft};
        --panel: ${BRAND.panel};
        --line: ${BRAND.line};
      }
      * { box-sizing: border-box; }
      @page { size: 13.333in 7.5in; margin: 0; }
      html, body {
        margin: 0;
        width: 1600px;
        height: 900px;
        overflow: hidden;
        background: var(--base);
        color: var(--output);
        font-family: "Nunito Text", "Segoe UI", sans-serif;
      }
      body { position: relative; }
      .slide {
        position: relative;
        width: 100%;
        height: 100%;
        padding: 58px 72px 54px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background:
          radial-gradient(circle at 78% 18%, rgba(108, 58, 237, 0.18), transparent 30%),
          radial-gradient(circle at 18% 84%, rgba(236, 72, 153, 0.14), transparent 28%),
          linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)),
          var(--base);
      }
      .slide::before {
        content: "";
        position: absolute;
        inset: 22px;
        border: 1px solid rgba(245, 243, 255, 0.06);
        border-radius: 28px;
        pointer-events: none;
      }
      .topbar {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }
      .brand { display: flex; align-items: center; gap: 14px; }
      .brand-text { display: flex; flex-direction: column; gap: 2px; }
      .brand-name { font-family: "Nunito Sans", sans-serif; font-weight: 800; font-size: 22px; letter-spacing: 0.02em; }
      .brand-kicker { color: var(--soft); opacity: 0.82; font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; }
      .content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin-top: 20px;
        flex: 1;
      }
      .eyebrow { color: #cbbcf1; text-transform: uppercase; letter-spacing: 0.28em; font-size: 12px; font-weight: 700; }
      .headline {
        font-family: "Nunito Sans", sans-serif;
        font-weight: 800;
        font-size: 54px;
        line-height: 1.03;
        max-width: 1120px;
        margin: 0;
      }
      .subtitle { margin: 0; font-size: 22px; line-height: 1.4; color: #d3c8ec; max-width: 1150px; }
      .body { margin-top: 8px; display: flex; flex-direction: column; gap: 18px; }
      .hero-grid, .closing-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 30px; align-items: end; min-height: 470px; }
      .hero-copy, .closing-copy { display: flex; flex-direction: column; gap: 22px; }
      .hero-badges { display: flex; flex-wrap: wrap; gap: 12px; }
      .hero-badges span, .bottom-strip div, .guardrail-band span {
        border: 1px solid rgba(245,243,255,0.12);
        background: rgba(255,255,255,0.035);
        color: var(--output);
        padding: 10px 14px;
        border-radius: 999px;
        font-size: 15px;
        font-weight: 700;
      }
      .hero-note { font-size: 24px; line-height: 1.5; max-width: 920px; margin: 0; }
      .hero-visual, .closing-logo {
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
        min-height: 430px; border: 1px solid rgba(255,255,255,0.05);
        background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
        border-radius: 28px;
      }
      .wordmark { font-family: "Nunito Sans", sans-serif; font-weight: 800; font-size: 40px; }
      .tagline { color: #d1c7eb; font-size: 18px; }
      .two-col, .schedule-layout, .split-stack { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
      .issue-list, .pillar-grid, .arch-grid, .three-panel { display: grid; gap: 18px; }
      .pillar-grid, .three-panel { grid-template-columns: repeat(3, 1fr); }
      .arch-grid { grid-template-columns: repeat(2, 1fr); }
      .issue-card, .pillar-card, .panel-card, .stack-card, .arch-card, .output-card {
        background: var(--panel); border: 1px solid var(--line); border-radius: 24px; padding: 22px 24px;
      }
      .issue-card { display: grid; grid-template-columns: 74px 1fr; gap: 18px; }
      .issue-num {
        width: 74px; height: 74px; border-radius: 22px; display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, rgba(108,58,237,0.28), rgba(236,72,153,0.18));
        font-family: "Nunito Sans", sans-serif; font-weight: 800; font-size: 24px;
      }
      .issue-card h3, .pillar-card h3, .panel-card h3, .stack-card h3, .arch-card h3, .output-card h3, .issue-panel h3 {
        margin: 0 0 8px; font-family: "Nunito Sans", sans-serif; font-size: 24px; font-weight: 800;
      }
      .issue-card p, .pillar-card p, .panel-card p, .stack-card p, .arch-card p, .output-card p, .issue-panel p {
        margin: 0; color: #d3c8ec; font-size: 18px; line-height: 1.5;
      }
      .issue-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: 26px 28px; }
      .clean-list { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 12px; }
      .clean-list li { color: #e2daf4; font-size: 19px; line-height: 1.45; }
      .pillar-card, .output-card, .arch-card { min-height: 210px; }
      .bottom-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 8px; }
      .guardrail-band { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 8px; }
      .flow-row { display: grid; grid-template-columns: 1fr 30px 1fr 30px 1fr 30px 1fr 30px 1fr; gap: 10px; align-items: stretch; }
      .flow-card { background: var(--panel); border: 1px solid var(--line); border-radius: 24px; padding: 18px 18px 20px; display: flex; flex-direction: column; gap: 10px; }
      .flow-num { font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #c9bbea; }
      .flow-card h3 { margin: 0; font-family: "Nunito Sans", sans-serif; font-size: 24px; font-weight: 800; }
      .flow-card p { margin: 0; color: #d6ccee; font-size: 16px; line-height: 1.45; }
      .flow-arrow { display: flex; align-items: center; justify-content: center; color: #b59be4; font-size: 28px; font-family: "Nunito Sans", sans-serif; font-weight: 800; }
      .quote-line { margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.08); font-family: "Nunito Sans", sans-serif; font-size: 22px; color: #f2d6ef; font-weight: 800; }
      .compare-table { width: 100%; border-collapse: collapse; border-spacing: 0; overflow: hidden; border-radius: 24px; border: 1px solid var(--line); }
      .compare-table th, .compare-table td { border: 1px solid var(--line); padding: 16px 18px; text-align: left; font-size: 17px; }
      .compare-table th { background: rgba(255,255,255,0.05); font-family: "Nunito Sans", sans-serif; font-size: 18px; }
      .compare-table td:first-child, .compare-table th:first-child { width: 28%; font-family: "Nunito Sans", sans-serif; font-weight: 700; }
      .arch-footer { margin-top: 12px; font-size: 19px; color: #d9d0ee; }
      .closing-points { display: flex; flex-direction: column; gap: 18px; }
      .closing-points div { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 22px; padding: 18px 20px; font-size: 22px; line-height: 1.45; }
      .topbar-spacer { width: 1px; height: 1px; }
    </style>
  </head>
  <body>
    <section class="slide ${slide.variant || ""}">
      <header class="topbar">
        <div class="brand">
          ${logoMarkup("small")}
          <div class="brand-text">
            <div class="brand-name">Claritect</div>
            <div class="brand-kicker">Governed recurring intelligence</div>
          </div>
        </div>
        <div class="topbar-spacer" aria-hidden="true"></div>
      </header>
      <div class="content">
        <div class="eyebrow">${escapeHtml(slide.eyebrow)}</div>
        <h1 class="headline">${escapeHtml(slide.title)}</h1>
        <p class="subtitle">${escapeHtml(slide.subtitle)}</p>
        <div class="body">${slide.body}</div>
      </div>
    </section>
  </body>
</html>`;
}

function numberedCard(num, title, body) {
  return `
    <div class="issue-card">
      <div class="issue-num">${escapeHtml(num)}</div>
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
      </div>
    </div>
  `;
}

function pillarCard(title, body) {
  return `<div class="pillar-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`;
}

function flowStep(num, title, body) {
  return `
    <div class="flow-card">
      <div class="flow-num">${escapeHtml(num)}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

function flowArrow() {
  return `<div class="flow-arrow">→</div>`;
}

function architectureBlock(title, body) {
  return `<div class="arch-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`;
}

function outputCard(title, body) {
  return `<div class="output-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`;
}

function logoMarkup(size) {
  const dims =
    size === "small"
      ? { w: 58, h: 38 }
      : size === "medium"
        ? { w: 186, h: 124 }
        : { w: 320, h: 214 };

  return `
    <svg width="${dims.w}" height="${dims.h}" viewBox="0 0 320 214" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="claritect-grad" x1="22" y1="107" x2="308" y2="107" gradientUnits="userSpaceOnUse">
          <stop stop-color="${BRAND.accentA}" />
          <stop offset="1" stop-color="${BRAND.accentB}" />
        </linearGradient>
        <radialGradient id="claritect-orb" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(219 107) rotate(90) scale(54)">
          <stop offset="0" stop-color="#F7A98F" />
          <stop offset="0.55" stop-color="${BRAND.accentA}" />
          <stop offset="1" stop-color="${BRAND.accentA}" stop-opacity="0.94" />
        </radialGradient>
        <filter id="claritect-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#claritect-glow)">
        <path d="M8 112L159 100L158 116L8 112Z" fill="url(#claritect-grad)" />
        <path d="M70 65L159 87L155 102L70 65Z" fill="url(#claritect-grad)" />
        <path d="M98 40L173 79L167 93L98 40Z" fill="url(#claritect-grad)" />
        <path d="M63 160L157 122L160 137L63 160Z" fill="url(#claritect-grad)" />
        <path d="M97 198L172 137L179 151L97 198Z" fill="url(#claritect-grad)" />
        <circle cx="216" cy="107" r="42" fill="url(#claritect-orb)" />
        <rect x="254" y="74" width="58" height="16" rx="1.5" fill="${BRAND.output}" />
        <rect x="254" y="100" width="58" height="16" rx="1.5" fill="${BRAND.output}" />
        <rect x="254" y="126" width="58" height="16" rx="1.5" fill="${BRAND.output}" />
      </g>
    </svg>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function findChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
        ]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : ["/usr/bin/google-chrome", "/usr/bin/chromium-browser"];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Chrome not found. Set CHROME_PATH.");
}

function mergePdfs(pdfPaths, outputPath) {
  const fallbackOutputPath = outputPath.replace(/\.pdf$/i, "_UPDATED.pdf");
  const pythonScript = `
from pypdf import PdfWriter, PdfReader
from pathlib import Path

writer = PdfWriter()
paths = ${JSON.stringify(pdfPaths)}
for path in paths:
    reader = PdfReader(path)
    for page in reader.pages:
        writer.add_page(page)

out_path = Path(${JSON.stringify(outputPath)})
fallback_path = Path(${JSON.stringify(fallbackOutputPath)})

def write_to(target):
    with target.open("wb") as fh:
        writer.write(fh)
    print(f"Merged PDF written to {target}")

try:
    write_to(out_path)
except PermissionError:
    write_to(fallback_path)
`;

  const result = spawnSync("python", ["-c", pythonScript], {
    cwd: __dirname,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error("Failed to merge slide PDFs.");
  }

  const stdout = `${result.stdout || ""}${result.stderr || ""}`;
  process.stdout.write(stdout);
  if (stdout.includes(fallbackOutputPath)) {
    return fallbackOutputPath;
  }
  return outputPath;
}
