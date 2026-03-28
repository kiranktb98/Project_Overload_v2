import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  resolve(process.cwd(), "packages/report-render/package.json")
);
const puppeteer = require("puppeteer-core");

function findChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        ]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : ["/usr/bin/google-chrome", "/usr/bin/chromium-browser"];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error("Chrome not found. Set CHROME_PATH.");
}

async function generatePdf(inputHtml, outputPdf, options = {}) {
  const html = readFileSync(inputHtml, "utf8");
  const browser = await puppeteer.launch({
    executablePath: findChromePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    ...options,
  });
  writeFileSync(outputPdf, pdf);
  await browser.close();
  console.log(`PDF written to ${outputPdf}`);
}

// Generate both PDFs
await generatePdf(
  "docs/claritect-one-pager.html",
  "docs/claritect-one-pager.pdf"
);

await generatePdf(
  "docs/claritect-gtm-plan.html",
  "docs/claritect-gtm-plan.pdf"
);

await generatePdf(
  "docs/claritect-launch-checklist.html",
  "docs/claritect-launch-checklist.pdf"
);

console.log("Done — all PDFs generated.");
