export type Branding = {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
};

export function applyBranding(el: HTMLElement, branding: Branding) {
  el.style.setProperty('--color-accent', branding.primaryColor);
  el.style.setProperty('--color-button-text', branding.secondaryColor);
  // --color-accent-soft and --shadow-navbar derive automatically via color-mix()
}

export function resetBranding(el: HTMLElement) {
  el.style.removeProperty('--color-accent');
  el.style.removeProperty('--color-button-text');
}
