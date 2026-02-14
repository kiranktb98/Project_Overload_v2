import { type ExecBrief, ExecBriefSchema } from "@project-overload/shared";

export type RenderedPdfPlaceholder = {
  bytes: Buffer;
  mime_type: "application/pdf";
  engine: "placeholder";
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

export function renderPdfPlaceholder(html: string): RenderedPdfPlaceholder {
  return {
    bytes: Buffer.from(`PDF_PLACEHOLDER\n${html}`, "utf8"),
    mime_type: "application/pdf",
    engine: "placeholder"
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}