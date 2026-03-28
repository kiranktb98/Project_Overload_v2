import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(resolve(process.cwd(), "packages/report-render/package.json"));
const puppeteer = require("puppeteer-core");

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

const inputPath = "docs/PROJECT_OVERLOAD_SYSTEM_BRIEF.html";
const outputPath = "docs/PROJECT_OVERLOAD_SYSTEM_BRIEF.pdf";
const html = readFileSync(inputPath, "utf8");

const browser = await puppeteer.launch({
  executablePath: findChromePath(),
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
});

const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
const pdf = await page.pdf({
  format: "A4",
  printBackground: true,
  margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" }
});
writeFileSync(outputPath, pdf);
await browser.close();

console.log(`PDF written to ${outputPath}`);
