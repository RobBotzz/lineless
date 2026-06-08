import { getCredential, getOperatorStandToken } from '../auth/keychain';

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

// AuthProvider registers a handler so a 401 on an authed request can clear only
// the credential scope that failed.
let onUnauthorized: ((scope: AuthScope, standId?: string) => void) | null = null;
export function setUnauthorizedHandler(
  handler: ((scope: AuthScope, standId?: string) => void) | null,
): void {
  onUnauthorized = handler;
}

interface ApiFetchOptions extends RequestInit {
  auth: ApiAuthMode;
  // Required when auth is 'operator': which stand's token to send.
  standId?: string;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const { auth, standId, headers, body, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  attachAuthHeader(finalHeaders, auth, standId);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    body,
    headers: finalHeaders,
  });

  if (res.status === 401 && auth !== 'public') {
    onUnauthorized?.(auth, standId);
  }

  if (!res.ok) {
    const message = await extractError(res);
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function attachAuthHeader(headers: Headers, auth: ApiAuthMode, standId?: string): void {
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
      const credential = getCredential('attendee');
      if (!credential) throwMissingCredential('attendee');
      headers.set('X-Attendee-Session-ID', credential.sessionId);
      return;
    }
    case 'operator': {
      if (!standId) throw new ApiError(400, "operator auth requires a 'standId' option");
      const token = getOperatorStandToken(standId);
      if (!token) throwMissingCredential('operator', standId);
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

function throwMissingCredential(scope: AuthScope, standId?: string): never {
  onUnauthorized?.(scope, standId);
  const label = standId ? `operator stand ${standId}` : scope;
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
