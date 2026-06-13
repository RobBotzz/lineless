import { getAttendeeSession, getCredential, getOperatorStandToken } from '../auth/keychain';

// All backend calls go through Vite's /api proxy (see vite.config.ts).
const BASE_URL = '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type ApiAuthMode = 'public' | 'organizer' | 'attendee' | 'operator' | 'operator-link';

export type AuthScope = Exclude<ApiAuthMode, 'public'>;

// Ids identifying which scoped credential a request targets: standId for
// operator, eventId for attendee. Passed to the 401 handler so it clears only
// the exact credential that failed.
export interface ScopeIds {
  standId?: string;
  eventId?: string;
}

// AuthProvider registers a handler so a 401 on an authed request can clear only
// the credential scope that failed.
let onUnauthorized: ((scope: AuthScope, ids?: ScopeIds) => void) | null = null;
export function setUnauthorizedHandler(
  handler: ((scope: AuthScope, ids?: ScopeIds) => void) | null,
): void {
  onUnauthorized = handler;
}

// Token refresher registered by the auth layer. On a 401 for a credential that
// has a refresh token (organizer, operator) we try to mint a fresh access token
// and retry once before giving up and clearing the credential. Resolves true if
// the credential was refreshed (the new token is already stored in the keychain).
let refreshCredential: ((scope: AuthScope, ids?: ScopeIds) => Promise<boolean>) | null = null;
export function setTokenRefresher(
  refresher: ((scope: AuthScope, ids?: ScopeIds) => Promise<boolean>) | null,
): void {
  refreshCredential = refresher;
}

// Only these credentials carry a refresh token; attendee uses an auto-renewing
// session and operator-link carries a long-lived access key, so neither refreshes.
function canRefresh(auth: ApiAuthMode): auth is 'organizer' | 'operator' {
  return auth === 'organizer' || auth === 'operator';
}

interface ApiFetchOptions extends RequestInit {
  auth: ApiAuthMode;
  // Required when auth is 'operator': which stand's token to send.
  standId?: string;
  // Required when auth is 'attendee': which event's session to send.
  eventId?: string;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  return doFetch<T>(path, options, false);
}

// `isRetry` guards against a refresh loop: we attempt at most one refresh +
// retry per request. The refreshed token is re-read from the keychain by
// attachAuthHeader on the retry, so options stay untouched.
async function doFetch<T>(path: string, options: ApiFetchOptions, isRetry: boolean): Promise<T> {
  const { auth, standId, eventId, headers, body, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  attachAuthHeader(finalHeaders, auth, { standId, eventId });

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    body,
    headers: finalHeaders,
  });

  if (res.status === 401 && auth !== 'public') {
    // Try a one-shot token refresh before treating the credential as dead.
    if (!isRetry && canRefresh(auth) && refreshCredential) {
      const refreshed = await refreshCredential(auth, { standId, eventId });
      if (refreshed) return doFetch<T>(path, options, true);
    }
    onUnauthorized?.(auth, { standId, eventId });
  }

  if (!res.ok) {
    const message = await extractError(res);
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function attachAuthHeader(headers: Headers, auth: ApiAuthMode, ids: ScopeIds): void {
  switch (auth) {
    case 'public':
      return;
    case 'organizer': {
      const credential = getCredential('organizer');
      if (!credential) throwMissingCredential('organizer');
      headers.set('Authorization', `Bearer ${credential.token}`);
      return;
    }
    case 'attendee': {
      if (!ids.eventId) throw new ApiError(400, "attendee auth requires an 'eventId' option");
      const session = getAttendeeSession(ids.eventId);
      if (!session) throwMissingCredential('attendee', ids);
      headers.set('X-Attendee-Session-ID', session.sessionId);
      return;
    }
    case 'operator': {
      if (!ids.standId) throw new ApiError(400, "operator auth requires a 'standId' option");
      const token = getOperatorStandToken(ids.standId);
      if (!token) throwMissingCredential('operator', ids);
      headers.set('Authorization', `Bearer ${token}`);
      return;
    }
    case 'operator-link': {
      const credential = getCredential('operator');
      if (!credential) throwMissingCredential('operator-link');
      headers.set('X-Operator-Access-Key', credential.operatorAccessKey);
      return;
    }
  }
}

function throwMissingCredential(scope: AuthScope, ids?: ScopeIds): never {
  onUnauthorized?.(scope, ids);
  const label = ids?.standId
    ? `operator stand ${ids.standId}`
    : ids?.eventId
      ? `attendee event ${ids.eventId}`
      : scope;
  throw new ApiError(401, `Missing ${label} credential`);
}

// Backend errors come back as { message } or { error }; fall back to status text.
async function extractError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.message ?? data?.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}
