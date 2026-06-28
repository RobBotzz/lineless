import { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router';

import { SiteFooter } from '@/components/layout/SiteFooter';

// Top-level layout for every route. Renders the shared site footer on all pages
// except the operator area (which is a focused, full-bleed point-of-sale UI).
// The flex column keeps the footer pinned to the bottom on short pages.
export default function RootLayout() {
  const { pathname } = useLocation();
  const isOperatorArea = pathname === '/operator' || pathname.startsWith('/operator/');

  // Stop the browser from restoring the old scroll position on back/forward —
  // otherwise it briefly jumps to the previous offset before we scroll up.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Start every page at the top. useLayoutEffect runs before paint, so there's no
  // visible jump. Hash-only changes don't alter `pathname`, so in-page anchor
  // links still work.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">
        <Outlet />
      </div>
      {!isOperatorArea && <SiteFooter />}
    </div>
  );
}
