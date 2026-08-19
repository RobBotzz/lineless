import { useEffect } from 'react';

import { setTokenRefresher, setUnauthorizedHandler } from '../api/client';
import { useOrganizerAuth } from './organizer/OrganizerAuthContext';
import { clearAttendeeSession, clearOperatorCredential, clearOperatorStand } from './keychain';
import { refreshCredential } from './tokenRefresh';

// Cross-cutting 401 router: clears only the credential scope that failed. Lives
// at the auth root (not under organizer/) because it spans every persona. Must
// be mounted inside <OrganizerAuthProvider> so it can call the organizer logout.
// Also wires the token refresher so a 401 retries with a fresh access token
// before any credential is cleared.
export function UnauthorizedHandler() {
  const { logout } = useOrganizerAuth();

  useEffect(() => {
    setTokenRefresher(refreshCredential);
    setUnauthorizedHandler((scope, ids) => {
      switch (scope) {
        case 'organizer':
          logout();
          break;
        case 'operator':
          if (ids?.standId) clearOperatorStand(ids.standId);
          break;
        case 'operator-link':
          clearOperatorCredential();
          break;
        case 'attendee':
          if (ids?.eventId) clearAttendeeSession(ids.eventId);
          break;
      }
    });
    return () => {
      setUnauthorizedHandler(null);
      setTokenRefresher(null);
    };
  }, [logout]);

  return null;
}
