import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadExcelJs() {
  try {
    return require("exceljs");
  } catch {
    const pnpmDir = join(__dirname, "..", "node_modules", ".pnpm");
    const match = readdirSync(pnpmDir).find((entry) => entry.startsWith("exceljs@"));
    if (!match) {
      throw new Error("exceljs is not available in node_modules.");
    }
    return require(join(pnpmDir, match, "node_modules", "exceljs"));
  }
}

const ExcelJS = loadExcelJs();

const workbook = new ExcelJS.Workbook();
workbook.creator = "Claritect";
workbook.created = new Date();

const COLORS = {
  base: "FF0F0B1A",
  panel: "FF171226",
  panelAlt: "FF1D1730",
  header: "FF6C3AED",
  white: "FFF5F3FF",
  soft: "FFB8AFCA",
  muted: "FF8B7FA6",
  border: "FF2A2040",
  partial: "FFF59E0B",
  open: "FFEC4899",
  product: "FF3B1261",
  marketing: "FF24163A",
  backend: "FF151020",
  green: "FF34D399",
};

const thinBorder = {
  top: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

const categories = [
  {
    name: "Main product (post-login pages)",
    fill: COLORS.product,
    items: [
      {
        status: "Partial",
        item: "Report quality at consultant level",
        details: "Tighten narrative quality, chart polish, findings, and recommendation quality so the final output feels board-ready."
      },
      {
        status: "Partial",
        item: "Error handling polish",
        details: "Customer-facing failures should feel calm and actionable across chat, reports, scheduling, and connection setup."
      },
      {
        status: "Partial",
        item: "Progress indicators",
        details: "All long-running actions should show clear step-based progress instead of feeling stalled."
      },
      {
        status: "Partial",
        item: "Mobile-responsive reports",
        details: "Report views need a final quality pass for mobile readability and hierarchy."
      },
    ],
  },
  {
    name: "Marketing pages (pre-login pages)",
    fill: COLORS.marketing,
    items: [
      {
        status: "Partial",
        item: "One-click demo flow",
        details: "The public site should move a prospect from curiosity to first live answer with minimal friction."
      },
      {
        status: "Partial",
        item: "Pilot booking flow",
        details: "Replace light CTA handling with a proper booking path for live pilots."
      },
      {
        status: "Partial",
        item: "ROI calculation ready",
        details: "Have a tighter and more explicit launch-ready ROI comparison that sales can use live."
      },
      {
        status: "Open",
        item: "3 example reports on website",
        details: "Publish example finance, operations, and business-case outputs so visitors can see what Claritect produces."
      },
      {
        status: "Open",
        item: "30-second product video",
        details: "Short screen-led loop showing question to report in a few beats."
      },
      {
        status: "Open",
        item: "2-3 minute demo video",
        details: "A fuller walkthrough for buyers who want the complete product story before a call."
      },
      {
        status: "Open",
        item: "Blog with 2-3 SEO articles",
        details: "Seed early search visibility with launch-adjacent thought pieces and use cases."
      },
      {
        status: "Open",
        item: "Favicon, OG tags, meta descriptions",
        details: "Add the final metadata and sharing polish so the public pages look credible when shared."
      },
    ],
  },
  {
    name: "Non-UI and backend related",
    fill: COLORS.backend,
    items: [
      {
        status: "Partial",
        item: "SOC 2 readiness",
        details: "Not certification yet. Document practices, access logging, encryption, and operational controls."
      },
      {
        status: "Partial",
        item: "Usage metering per tenant",
        details: "The foundations exist, but launch-grade tenant metering for limits and billing should be tightened."
      },
      {
        status: "Partial",
        item: "Usage dashboard for yourself",
        details: "You need an internal operator view of tenant usage, cost, and report volume."
      },
      {
        status: "Open",
        item: "Data handling policy",
        details: "Document what data is stored, for how long, and how generated evidence and runs are handled."
      },
      {
        status: "Open",
        item: "Terms of Service",
        details: "Customer-facing legal terms covering liability, acceptable use, and service boundaries."
      },
      {
        status: "Open",
        item: "Privacy Policy",
        details: "A publishable privacy statement aligned with how the application handles customer and user data."
      },
      {
        status: "Open",
        item: "Security one-pager PDF",
        details: "A compact trust document answering the first security-review questions without requiring a meeting."
      },
      {
        status: "Open",
        item: "Production deployment",
        details: "Move from local/dev readiness to a real deployed environment with repeatable rollout steps."
      },
      {
        status: "Open",
        item: "Custom domain",
        details: "Serve the production app on the real Claritect domain, not a temporary or platform hostname."
      },
      {
        status: "Open",
        item: "Automated daily backups",
        details: "Back up the metadata layer and validate restore confidence before launch."
      },
      {
        status: "Open",
        item: "Uptime monitoring",
        details: "Track application availability externally so outages are caught before customers report them."
      },
      {
        status: "Open",
        item: "Error alerting",
        details: "Add operational alerting for API, worker, scheduler, and report-generation failures."
      },
      {
        status: "Open",
        item: "Rate limiting per tenant",
        details: "Protect the shared LLM/runtime budget from abuse or accidental overconsumption."
      },
      {
        status: "Open",
        item: "Environment separation",
        details: "Keep production and staging cleanly separated so testing never touches live customer workflows."
      },
      {
        status: "Open",
        item: "Pilot demo script",
        details: "A rehearsed sequence for live pilots so every session feels deliberate and repeatable."
      },
      {
        status: "Open",
        item: "5 killer demo questions prepared",
        details: "A short list of compelling recurring business questions ready for finance, operations, product, and leadership."
      },
      {
        status: "Open",
        item: "Backup demo recording",
        details: "A fallback walkthrough in case a live pilot is disrupted by data, networking, or model latency issues."
      },
      {
        status: "Open",
        item: "Follow-up email template",
        details: "A reusable post-pilot email covering what was shown, next steps, pricing, and access links."
      },
      {
        status: "Open",
        item: "Proposal template",
        details: "A simple commercial proposal that can be turned around quickly after a successful pilot."
      },
      {
        status: "Open",
        item: "CRM",
        details: "Even a lightweight system is enough, but leads and follow-up dates need a consistent home."
      },
      {
        status: "Open",
        item: "Business entity registered",
        details: "Formal business structure in place before taking recurring commercial payments."
      },
      {
        status: "Open",
        item: "Business bank account",
        details: "Separate business finances from personal operations before live billing starts."
      },
      {
        status: "Open",
        item: "Stripe account verified",
        details: "Complete billing setup and test live payment behavior end to end."
      },
      {
        status: "Open",
        item: "Cancellation flow",
        details: "Define and implement the customer offboarding path clearly before charging real accounts."
      },
      {
        status: "Open",
        item: "Refund policy",
        details: "Have a plain-language refund stance ready before launch conversations start."
      },
      {
        status: "Open",
        item: "Contract template",
        details: "A lightweight agreement for early customers so the sales cycle does not stall on paperwork."
      },
      {
        status: "Open",
        item: "Customer onboarding email sequence",
        details: "A simple post-signup sequence to get new customers from connection to first recurring report."
      },
      {
        status: "Open",
        item: "Weekly check-in with first 5 customers",
        details: "A founder-led feedback loop for the first set of paying or pilot customers."
      },
      {
        status: "Open",
        item: "Collect testimonials",
        details: "Capture short quotes once early customers have successful live outcomes."
      },
    ],
  },
];

const allItems = categories.flatMap((category) => category.items);
const partialCount = allItems.filter((item) => item.status === "Partial").length;
const openCount = allItems.filter((item) => item.status === "Open").length;

const ws = workbook.addWorksheet("Launch Checklist", {
  properties: { defaultColWidth: 18, defaultRowHeight: 22 },
  views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
});

ws.properties.tabColor = { argb: COLORS.header };
ws.columns = [
  { key: "done", width: 8 },
  { key: "category", width: 32 },
  { key: "status", width: 12 },
  { key: "item", width: 40 },
  { key: "details", width: 76 },
  { key: "notes", width: 26 },
];

ws.mergeCells("A1:F1");
const titleCell = ws.getCell("A1");
titleCell.value = "CLARITECT - REMAINING LAUNCH CHECKLIST";
titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: COLORS.white } };
titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.base } };
titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
ws.getRow(1).height = 38;

ws.mergeCells("A2:F2");
const subtitleCell = ws.getCell("A2");
subtitleCell.value =
  "42 remaining items across 3 launch buckets. Items already assessed as done are removed. Email delivery and SSL/TLS everywhere were intentionally removed from this workbook.";
subtitleCell.font = { name: "Segoe UI", size: 10, color: { argb: COLORS.soft } };
subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.base } };
subtitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
ws.getRow(2).height = 34;

const summaryRow = ws.getRow(3);
[
  `Total remaining: ${allItems.length}`,
  `Partial: ${partialCount}`,
  `Open: ${openCount}`,
  "Categories: Main product / Marketing pages / Non-UI and backend related",
  "",
  "",
].forEach((value, index) => {
  const cell = summaryRow.getCell(index + 1);
  cell.value = value;
  cell.font = {
    name: "Segoe UI",
    size: 9.5,
    bold: index < 4,
    color: { argb: index === 1 ? COLORS.partial : index === 2 ? COLORS.open : COLORS.green },
  };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.base } };
  cell.alignment = { vertical: "middle", horizontal: index === 0 ? "left" : "center", wrapText: true };
});
ws.mergeCells("D3:F3");
summaryRow.height = 24;

const headerRow = ws.getRow(4);
["Done", "Category", "Status", "Item", "Details", "Notes"].forEach((value, index) => {
  const cell = headerRow.getCell(index + 1);
  cell.value = value;
  cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: COLORS.white } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.header } };
  cell.alignment = { vertical: "middle", horizontal: index === 0 ? "center" : "left" };
  cell.border = thinBorder;
});
headerRow.height = 26;

let rowNumber = 5;
for (const category of categories) {
  for (let index = 0; index < category.items.length; index += 1) {
    const entry = category.items[index];
    const row = ws.getRow(rowNumber);

    row.getCell(1).value = "☐";
    row.getCell(1).font = { name: "Segoe UI", size: 14, color: { argb: COLORS.muted } };
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(2).value = index === 0 ? category.name : "";
    row.getCell(2).font = {
      name: "Segoe UI",
      size: 10,
      bold: index === 0,
      color: { argb: index === 0 ? COLORS.white : COLORS.soft },
    };

    row.getCell(3).value = entry.status;
    row.getCell(3).font = {
      name: "Segoe UI",
      size: 9.5,
      bold: true,
      color: { argb: entry.status === "Partial" ? COLORS.partial : COLORS.open },
    };
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(4).value = entry.item;
    row.getCell(4).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: COLORS.white } };
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };

    row.getCell(5).value = entry.details;
    row.getCell(5).font = { name: "Segoe UI", size: 9.5, color: { argb: COLORS.soft } };
    row.getCell(5).alignment = { wrapText: true, vertical: "top" };

    row.getCell(6).value = "";
    row.getCell(6).font = { name: "Segoe UI", size: 9.5, color: { argb: COLORS.soft } };

    for (let column = 1; column <= 6; column += 1) {
      row.getCell(column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: category.fill } };
      row.getCell(column).border = thinBorder;
    }

    row.height = 28;
    rowNumber += 1;
  }

  const separator = ws.getRow(rowNumber);
  for (let column = 1; column <= 6; column += 1) {
    separator.getCell(column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.base } };
    separator.getCell(column).border = {
      bottom: { style: "thin", color: { argb: COLORS.border } },
    };
  }
  separator.height = 6;
  rowNumber += 1;
}

rowNumber += 1;
ws.mergeCells(`A${rowNumber}:F${rowNumber}`);
const footer = ws.getCell(`A${rowNumber}`);
footer.value =
  "Suggested use: close Main product first, then Marketing pages, then the Non-UI and backend related launch layer.";
footer.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: COLORS.green } };
footer.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.base } };
footer.alignment = { horizontal: "center" };

await workbook.xlsx.writeFile("docs/claritect-launch-checklist.xlsx");
console.log("Excel written to docs/claritect-launch-checklist.xlsx");
