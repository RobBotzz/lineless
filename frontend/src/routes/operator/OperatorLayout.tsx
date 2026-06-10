import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router';

import { OperatorNavbar } from '../../components/layout/navbars';
import { OperatorOutletContext, type OperatorNavbarActions } from './operatorNavbarActions';
import { operatorStandQueryOptions } from './operatorQueries';

export default function OperatorLayout() {
  const { pathname } = useLocation();
  const standTitleRequest = useMemo(() => getStandTitleRequest(pathname), [pathname]);
  const standTitleQuery = useQuery({
    ...operatorStandQueryOptions(standTitleRequest?.standId ?? ''),
    enabled: !!standTitleRequest,
  });
  const navbarTitle = getOperatorNavbarTitle(
    pathname,
    standTitleRequest ? (standTitleQuery.data?.standName ?? null) : null,
  );
  const [navbarActions, setNavbarActions] = useState<OperatorNavbarActions>({});
  const outletContext = useMemo(() => ({ setNavbarActions }), []);

  return (
    <div className="min-h-screen bg-background">
      <OperatorNavbar
        center={
          <span className="text-center text-sm font-semibold text-text sm:text-base">
            {navbarTitle}
          </span>
        }
        left={<CustomerLogoPlaceholder />}
        right={navbarActions.right}
        widthClassName="w-[calc(100%_-_2rem)] max-w-[calc(80rem-2rem)] sm:w-[calc(100%_-_3rem)] sm:max-w-[calc(80rem-3rem)] lg:w-[calc(100%_-_4rem)] lg:max-w-[calc(80rem-4rem)]"
      />
      <main>
        <OperatorOutletContext.Provider value={outletContext}>
          <Outlet />
        </OperatorOutletContext.Provider>
      </main>
    </div>
  );
}

function CustomerLogoPlaceholder() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border bg-surface-muted text-xs font-semibold text-text-muted">
      Logo
    </div>
  );
}

function getOperatorNavbarTitle(pathname: string, standTitle: string | null) {
  const pathSegments = pathname.split('/').filter(Boolean);

  if (pathSegments[0] === 'operator' && pathSegments.includes('pickup')) {
    return 'Pick Up';
  }

  if (pathSegments[0] === 'operator' && pathSegments.includes('cashier')) {
    return 'Cashier';
  }

  if (/^\/operator\/[^/]+$/.test(pathname)) {
    return 'Stand Selection';
  }

  if (/^\/operator\/[^/]+\/[^/]+$/.test(pathname)) {
    return standTitle ?? 'Operator Dashboard';
  }

  return 'Operator';
}

function getStandTitleRequest(pathname: string) {
  const match = /^\/operator\/([^/]+)\/([^/]+)$/.exec(pathname);
  if (!match) return null;

  const [, eventId, standId] = match;
  if (!eventId || !standId || standId === 'pickup' || standId === 'cashier') return null;

  return {
    standId,
  };
}
