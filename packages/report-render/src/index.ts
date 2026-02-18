import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";
import { type ExecBrief, ExecBriefSchema } from "@project-overload/shared";

export type RenderedPdfDocument = {
  bytes: Buffer;
  mime_type: "application/pdf";
  engine: "puppeteer";
  page_count: number;
};

export function renderExecBriefHtml(execBriefInput: ExecBrief): string {
  const execBrief = ExecBriefSchema.parse(execBriefInput);

  const section = (title: string, items: string[]) => {
    const listItems = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    return `<section><h2>${escapeHtml(title)}</h2><ul>${listItems}</ul></section>`;
  };

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Exec Brief</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
      h1 { margin-bottom: 8px; }
      h2 { margin-top: 20px; }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    <h1>Executive Brief</h1>
    <p>Generated at ${escapeHtml(execBrief.generated_at)}</p>
    ${section("What changed", execBrief.what_changed)}
    ${section("Why", execBrief.why)}
    ${section("So what", execBrief.so_what)}
    ${section("What to do", execBrief.what_to_do)}
    ${section("Appendix refs", execBrief.appendix_refs.length > 0 ? execBrief.appendix_refs : ["None"])}
    ${section("Deltas vs last run", execBrief.deltas_vs_last_run.length > 0 ? execBrief.deltas_vs_last_run : ["No delta captured"])}
  </body>
</html>`;
}

/**
 * Resolve a Chrome/Chromium executable path.
 * Priority: CHROME_PATH env → common system paths → @puppeteer/browsers cache.
 */
function findChromePath(): string {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
        ]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Chrome not found. Set CHROME_PATH env variable or install Chrome. " +
      "You can also run: npx @puppeteer/browsers install chrome@stable --path .cache/puppeteer"
  );
}

export async function renderPdfFromHtml(html: string): Promise<RenderedPdfDocument> {
  const executablePath = findChromePath();

  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" }
    });

    // Count pages by checking the PDF cross-reference table
    const pdfString = Buffer.from(pdfBuffer).toString("latin1");
    const pageCount = (pdfString.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

    return {
      bytes: Buffer.from(pdfBuffer),
      mime_type: "application/pdf",
      engine: "puppeteer",
      page_count: Math.max(pageCount, 1)
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
