export const CLARITECT_LOGO_PATH = "/assets/claritect-logo.svg";
export const CLARITECT_FAVICON_PATH = "/favicon.svg";
export const CLARITECT_FAVICON_SVG = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="18" fill="#0F0B1A"/>
  <rect x="1" y="1" width="62" height="62" rx="17" stroke="url(#frame)" stroke-opacity="0.45"/>
  <g filter="url(#glow)">
    <circle cx="21" cy="32" r="6.5" fill="url(#core)"/>
  </g>
  <path d="M14 27.5H30.5" stroke="#F5F3FF" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M10.5 32H30.5" stroke="#F5F3FF" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M13 36.5H30.5" stroke="#F5F3FF" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M33 25.5H49.5V38.5H33" stroke="#F5F3FF" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M39.5 21.5L47.5 21.5" stroke="#EC4899" stroke-width="2.4" stroke-linecap="round"/>
  <defs>
    <filter id="glow" x="4.5" y="15.5" width="33" height="33" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
      <feGaussianBlur stdDeviation="5" result="effect1_foregroundBlur_0_1"/>
    </filter>
    <linearGradient id="frame" x1="10" y1="8" x2="58" y2="58" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6C3AED"/>
      <stop offset="1" stop-color="#EC4899"/>
    </linearGradient>
    <radialGradient id="core" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(21 32) rotate(49.4) scale(10.8)">
      <stop stop-color="#FFB7D7"/>
      <stop offset="1" stop-color="#6C3AED"/>
    </radialGradient>
  </defs>
</svg>`;

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function renderClaritectLogoImage(className: string, alt = "Claritect logo"): string {
  return `<img class="${escapeAttribute(className)}" src="${CLARITECT_LOGO_PATH}" alt="${escapeAttribute(alt)}" />`;
}

export function renderClaritectFaviconLinks(): string {
  return `<link rel="icon" href="${CLARITECT_FAVICON_PATH}" type="image/svg+xml" sizes="any" />
    <link rel="shortcut icon" href="${CLARITECT_FAVICON_PATH}" type="image/svg+xml" />`;
}
