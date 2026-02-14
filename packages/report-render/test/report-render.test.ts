import { describe, expect, it } from "vitest";
import { renderExecBriefHtml, renderPdfPlaceholder } from "../src";

describe("report render", () => {
  it("renders html with fixed sections", () => {
    const html = renderExecBriefHtml({
      what_changed: ["Revenue increased 8%"],
      why: ["Holiday demand"],
      so_what: ["Pipeline remains healthy"],
      what_to_do: ["Increase inventory for top SKUs"],
      confidence: { score: 0.9, rationale: "Stable evidence coverage" },
      appendix_refs: ["req_1:batch-1"],
      deltas_vs_last_run: ["APAC accelerated"],
      generated_at: new Date().toISOString()
    });

    expect(html).toContain("What changed");
    expect(html).toContain("Deltas vs last run");
  });

  it("creates placeholder pdf payload", () => {
    const pdf = renderPdfPlaceholder("<html></html>");

    expect(pdf.engine).toBe("placeholder");
    expect(pdf.mime_type).toBe("application/pdf");
    expect(pdf.bytes.length).toBeGreaterThan(0);
  });
});