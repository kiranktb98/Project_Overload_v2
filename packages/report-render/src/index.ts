import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { type ExecBrief, ExecBriefSchema } from "@project-overload/shared";

export type RenderedPdfDocument = {
  bytes: Buffer;
  mime_type: "application/pdf";
  engine: "pdf-lib";
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
      .confidence { margin-top: 20px; padding: 12px; border: 1px solid #d1d5db; }
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
    <div class="confidence">
      <strong>Confidence:</strong> ${execBrief.confidence.score}
      <p>${escapeHtml(execBrief.confidence.rationale)}</p>
    </div>
  </body>
</html>`;
}

export async function renderPdfFromHtml(html: string): Promise<RenderedPdfDocument> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 40;
  const lineHeight = 14;
  const fontSize = 11;
  const maxWidth = pageSize[0] - margin * 2;

  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const drawLine = (text: string, isHeading = false): void => {
    const font = isHeading ? bold : regular;
    const size = isHeading ? 14 : fontSize;
    const wrappedLines = wrapText(text, font, size, maxWidth);

    for (const wrappedLine of wrappedLines) {
      if (y < margin + lineHeight) {
        page = pdf.addPage(pageSize);
        y = pageSize[1] - margin;
      }

      page.drawText(wrappedLine, {
        x: margin,
        y,
        size,
        font,
        color: rgb(0.12, 0.16, 0.22)
      });

      y -= lineHeight;
    }

    y -= isHeading ? 4 : 2;
  };

  drawLine("Executive Brief", true);

  const plainText = htmlToText(html);
  const lines = plainText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    drawLine(line);
  }

  const pdfBytes = await pdf.save();

  return {
    bytes: Buffer.from(pdfBytes),
    mime_type: "application/pdf",
    engine: "pdf-lib",
    page_count: pdf.getPageCount()
  };
}

function wrapText(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[index];
    }
  }

  lines.push(current);
  return lines;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?(h1|h2|h3|p|section|div|ul|ol|li|br)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}