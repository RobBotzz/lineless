import { getCredential } from '../auth/keychain';
import type { AuthKind } from '../auth/keychain';

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

export type ApiAuthMode = 'public' | AuthKind;

// AuthProvider registers a handler so a 401 on an authed request can clear only
// the credential type that failed.
let onUnauthorized: ((kind: AuthKind) => void) | null = null;
export function setUnauthorizedHandler(handler: ((kind: AuthKind) => void) | null): void {
  onUnauthorized = handler;
}

interface ApiFetchOptions extends RequestInit {
  auth: ApiAuthMode;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const { auth, headers, body, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  attachAuthHeader(finalHeaders, auth);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    body,
    headers: finalHeaders,
  });

  if (res.status === 401 && auth !== 'public') {
    onUnauthorized?.(auth);
  }

  if (!res.ok) {
    const message = await extractError(res);
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function attachAuthHeader(headers: Headers, auth: ApiAuthMode): void {
  switch (auth) {
    case 'public':
      return;
    case 'organizer': {
      const credential = getCredential('organizer');
      if (!credential) throwMissingCredential('organizer');
      headers.set('Authorization', `Bearer ${credential.token}`);
      return;
    }
    case 'operator': {
      const credential = getCredential('operator');
      if (!credential) throwMissingCredential('operator');
      headers.set('Authorization', `Bearer ${credential.token}`);
      return;
    }
    case 'attendee': {
      const credential = getCredential('attendee');
      if (!credential) throwMissingCredential('attendee');
      headers.set('X-Attendee-Session-ID', credential.sessionId);
      return;
    }
  }
}

function throwMissingCredential(kind: AuthKind): never {
  onUnauthorized?.(kind);
  throw new ApiError(401, `Missing ${kind} credential`);
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
