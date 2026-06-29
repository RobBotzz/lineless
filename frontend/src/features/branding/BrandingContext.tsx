import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';

import { applyBranding, resetBranding, type Branding } from './applyBranding';

const BrandingContext = createContext<Branding | null>(null);

export function BrandingProvider({
  branding,
  children,
}: {
  branding: Branding;
  children: ReactNode;
}) {
  // Apply on the document root (not a wrapper) so the :root color-mix() tokens
  // recompute. useLayoutEffect runs before paint, so the brand colors land on the
  // first frame — no flash of the default theme. Reset on unmount keeps branding
  // scoped to the attendee subtree (no leak into organizer/operator views).
  useLayoutEffect(() => {
    const root = document.documentElement;
    applyBranding(root, branding);
    return () => resetBranding(root);
  }, [branding]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBranding() {
  return useContext(BrandingContext);
}
