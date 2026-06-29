export type Branding = {
  primaryColor: string;
  secondaryColor: string;
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

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
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

// Button text sits on the primary fill. We cannot force organizers to pick a
// legible secondary, so if theirs fails AA against primary, fall back to whichever
// of black/white reads best on primary.
function buttonTextFor(primary: string, secondary: string): string {
  if (contrastRatio(secondary, primary) >= MIN_CONTRAST) return secondary;
  return contrastRatio('#ffffff', primary) >= contrastRatio('#000000', primary)
    ? '#ffffff'
    : '#000000';
}

// The properties we may set, so resetBranding stays in sync.
const MANAGED_PROPS = ['--color-accent', '--color-button-text', '--color-accent-contrast'] as const;

// Apply per-event branding by overriding the brand CSS variables on the document
// root. It must be the root (not a descendant) so the `:root` color-mix()
// derivations (--color-accent-soft/-raised, --shadow-navbar) recompute against the
// override; a descendant override would leave those stuck at the default.
export function applyBranding(el: HTMLElement, branding: Branding) {
  if (isHex(branding.primaryColor)) {
    el.style.setProperty('--color-accent', branding.primaryColor);
    el.style.setProperty('--color-accent-contrast', accentForText(branding.primaryColor));
    if (isHex(branding.secondaryColor)) {
      el.style.setProperty(
        '--color-button-text',
        buttonTextFor(branding.primaryColor, branding.secondaryColor),
      );
    }
  } else if (isHex(branding.secondaryColor)) {
    // No valid primary: secondary can still be applied as-is against the default accent.
    el.style.setProperty('--color-button-text', branding.secondaryColor);
  }
}

export function resetBranding(el: HTMLElement) {
  for (const prop of MANAGED_PROPS) el.style.removeProperty(prop);
}
