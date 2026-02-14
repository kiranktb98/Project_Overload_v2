export type RenderedPdfPlaceholder = {
  bytes: Buffer;
  mimeType: "application/pdf";
};

export function renderHtmlTemplate(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body>${body}</body></html>`;
}

export function renderPdfPlaceholder(html: string): RenderedPdfPlaceholder {
  return {
    bytes: Buffer.from(`PDF_PLACEHOLDER\n${html}`, "utf8"),
    mimeType: "application/pdf"
  };
}