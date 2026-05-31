import { Navigate, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { paths } from '../paths';

// Gate for organizer routes. Renders children only when authenticated;
// otherwise redirects to the login page, remembering where the user wanted to go.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    // Avoids a redirect flicker while a stored token is being validated.
    return <div>Lade…</div>;
  }

  if (status === 'unauthenticated') {
    return <Navigate to={paths.login} replace state={{ from: location }} />;
  }

  return children;
}
