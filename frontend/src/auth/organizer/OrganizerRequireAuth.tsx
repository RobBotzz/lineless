import { Navigate, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useOrganizerAuth } from './OrganizerAuthContext';
import { paths } from '../../paths';

// Gate for organizer routes. Renders children only when authenticated;
// otherwise redirects to the login page, remembering where the user wanted to go.
export function OrganizerRequireAuth({ children }: { children: ReactNode }) {
  const { status, logoutRedirect } = useOrganizerAuth();
  const location = useLocation();

  if (status === 'loading') {
    // Avoids a redirect flicker while a stored token is being validated.
    return <div>Lade…</div>;
  }

  if (status === 'unauthenticated') {
    if (logoutRedirect) return <Navigate to={logoutRedirect} replace />;
    return <Navigate to={paths.auth} replace state={{ from: location }} />;
  }

  return children;
}
