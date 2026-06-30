export type Branding = {
  primaryColor: string;
  secondaryColor: string;
  // null = Auto: derive a legible accent text color from primaryColor.
  accentTextColor: string | null;
  logoUrl: string | null;
};

// Mirrors the backend hex validation (events/types.ts): #RGB or #RRGGBB.
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Page background the accent is read against when used as text (--color-bg).
const PAGE_BG = '#f5f5f7';
// Default text color we darken the accent toward when contrast is too low.
const TEXT_COLOR = '#1f2937';
// WCAG AA for normal text.
const MIN_CONTRAST = 4.5;
// WCAG AA Large Text — button labels are bold and ≥14pt, so 3:1 is the correct bar.
const MIN_CONTRAST_LARGE = 3.0;

function isHex(value: string): boolean {
  return HEX_COLOR.test(value);
}

// Expand #RGB to #RRGGBB and return 0-255 channels.
function toRgb(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// WCAG relative luminance.
function relativeLuminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Bucket a text/background contrast into a legibility rating. Reuses the WCAG
// thresholds above so the UI badge stays in sync with the branding logic:
// AA normal (4.5) = good, AA Large/bold (3.0) = acceptable, below = too low.
export type ContrastRating = 'too-low' | 'acceptable' | 'good';
export function contrastRating(textColor: string, background: string): ContrastRating {
  const ratio = contrastRatio(textColor, background);
  if (ratio >= MIN_CONTRAST) return 'good';
  if (ratio >= MIN_CONTRAST_LARGE) return 'acceptable';
  return 'too-low';
}

// Linear blend of `hex` toward `target` by `amount` (0..1).
function mixTowards(hex: string, target: string, amount: number): string {
  const [r1, g1, b1] = toRgb(hex);
  const [r2, g2, b2] = toRgb(target);
  return toHex([r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount]);
}

// Accent rendered as text on the page background must stay legible. If the raw
// primary already clears AA, keep it; otherwise darken toward the text color
// until it does (the brand hue is preserved as much as possible).
function accentForText(primary: string): string {
  if (contrastRatio(primary, PAGE_BG) >= MIN_CONTRAST) return primary;
  for (let amount = 0.1; amount <= 1; amount += 0.1) {
    const candidate = mixTowards(primary, TEXT_COLOR, amount);
    if (contrastRatio(candidate, PAGE_BG) >= MIN_CONTRAST) return candidate;
  }
  return TEXT_COLOR;
}

// Defaults mirror the :root brand tokens in index.css, used when a field is unset
// or not a valid hex (e.g. mid-edit in the organizer form).
const DEFAULT_ACCENT = '#020887';
const DEFAULT_BUTTON_TEXT = '#ffffff';

// The brand colors actually rendered, after all contrast clamping. Single source
// of truth shared by applyBranding() (attendee runtime) and the organizer preview,
// so the preview can never drift from what attendees see.
export type ResolvedBranding = {
  accent: string; // --color-accent (button/highlight fill)
  buttonText: string; // --color-button-text (label on the fill)
  accentText: string; // --color-accent-contrast (accent as text on the page)
};

export function resolveBranding(branding: Branding): ResolvedBranding {
  const accent = isHex(branding.primaryColor) ? branding.primaryColor : DEFAULT_ACCENT;
  // Enforce the organizer's explicit White/Black choice as-is — the form's
  // contrast badge warns them, but we never silently override their pick.
  const buttonText = isHex(branding.secondaryColor) ? branding.secondaryColor : DEFAULT_BUTTON_TEXT;
  // Auto (null/invalid) → derive a legible accent text color; otherwise honor the
  // organizer's pick as-is (the form warns them when it fails contrast).
  const accentText =
    branding.accentTextColor && isHex(branding.accentTextColor)
      ? branding.accentTextColor
      : accentForText(accent);
  return { accent, buttonText, accentText };
}

// The properties we may set, so resetBranding stays in sync.
const MANAGED_PROPS = ['--color-accent', '--color-button-text', '--color-accent-contrast'] as const;

// Apply per-event branding by overriding the brand CSS variables on the document
// root. It must be the root (not a descendant) so the `:root` color-mix()
// derivations (--color-accent-soft/-raised, --shadow-navbar) recompute against the
// override; a descendant override would leave those stuck at the default.
export function applyBranding(el: HTMLElement, branding: Branding) {
  const { accent, buttonText, accentText } = resolveBranding(branding);
  el.style.setProperty('--color-accent', accent);
  el.style.setProperty('--color-button-text', buttonText);
  el.style.setProperty('--color-accent-contrast', accentText);
}

export function resetBranding(el: HTMLElement) {
  for (const prop of MANAGED_PROPS) el.style.removeProperty(prop);
}
