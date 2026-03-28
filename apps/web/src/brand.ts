export const CLARITECT_LOGO_PATH = "/assets/claritect-logo.svg";

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function renderClaritectLogoImage(className: string, alt = "Claritect logo"): string {
  return `<img class="${escapeAttribute(className)}" src="${CLARITECT_LOGO_PATH}" alt="${escapeAttribute(alt)}" />`;
}
