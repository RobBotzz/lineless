import { logoutOrganizer, refreshOrganizerSession } from '@/api/account';
import type { AuthScope, ScopeIds } from '@/api/client';
import { refreshOperatorSession } from '@/api/stands';
import {
  addOperatorStand,
  getCredential,
  getOperatorStandRefreshToken,
  setOrganizer,
} from './keychain';

// One refresh per credential at a time: when an access token expires, every
// in-flight request 401s at once. De-duping here means a single /refresh call
// rotates the token while the rest await the same promise — without it, the
// parallel calls would each consume-and-rotate, invalidating one another and
// tripping the backend's token-reuse (theft) detection.
const inFlight = new Map<string, Promise<boolean>>();

function dedupe(key: string, run: () => Promise<boolean>): Promise<boolean> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = run().finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

async function refreshOrganizer(): Promise<boolean> {
  const credential = getCredential('organizer');
  if (!credential) return false;
  try {
    const { token, refreshToken } = await refreshOrganizerSession(credential.refreshToken);
    setOrganizer(token, refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function refreshOperator(standId: string): Promise<boolean> {
  const refreshToken = getOperatorStandRefreshToken(standId);
  if (!refreshToken) return false;
  try {
    const response = await refreshOperatorSession(standId, refreshToken);
    addOperatorStand(response.standId, response.token, response.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// Registered with the API client (see setTokenRefresher): on a 401 it mints a
// fresh access token from the stored refresh token so the request can retry.
export function refreshCredential(scope: AuthScope, ids?: ScopeIds): Promise<boolean> {
  switch (scope) {
    case 'organizer':
      return dedupe('organizer', refreshOrganizer);
    case 'operator':
      if (!ids?.standId) return Promise.resolve(false);
      return dedupe(`operator:${ids.standId}`, () => refreshOperator(ids.standId!));
    default:
      // attendee and operator-link have no refresh token.
      return Promise.resolve(false);
  }
}

// Best-effort revocation of the organizer refresh token on explicit logout.
// Fire-and-forget: the local credential is cleared regardless of the outcome.
export function revokeOrganizerSession(): void {
  const credential = getCredential('organizer');
  if (!credential) return;
  void logoutOrganizer(credential.refreshToken).catch(() => {
    // Logout is idempotent backend-side; a failed revoke must not block the UI.
  });
}
