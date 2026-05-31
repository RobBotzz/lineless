import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

import { applyBranding, resetBranding, type Branding } from './applyBranding';

const BrandingContext = createContext<Branding | null>(null);

export function BrandingProvider({
  branding,
  children,
}: {
  branding: Branding;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) applyBranding(el, branding);
    return () => {
      if (el) resetBranding(el);
    };
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>
      {/* display:contents — no layout impact, just a CSS variable scope boundary */}
      <div ref={ref} style={{ display: 'contents' }}>
        {children}
      </div>
    </BrandingContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBranding() {
  return useContext(BrandingContext);
}
