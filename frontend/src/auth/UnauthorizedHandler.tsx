import { useEffect } from 'react';

import { setUnauthorizedHandler } from '../api/client';
import { useOrganizerAuth } from './organizer/OrganizerAuthContext';
import { clearAttendeeSession, clearOperatorCredential, clearOperatorStand } from './keychain';

// Cross-cutting 401 router: clears only the credential scope that failed. Lives
// at the auth root (not under organizer/) because it spans every persona. Must
// be mounted inside <OrganizerAuthProvider> so it can call the organizer logout.
export function UnauthorizedHandler() {
  const { logout } = useOrganizerAuth();

  useEffect(() => {
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
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  return null;
}
