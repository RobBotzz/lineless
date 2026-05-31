import { getToken } from '../auth/tokenStorage';

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

// AuthProvider registers a handler so a 401 on an authed request can trigger
// a global logout, regardless of which component fired the request.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface ApiFetchOptions extends RequestInit {
  // Attach the Bearer token? Disable for login/signup. Defaults to true.
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { auth = true, headers, body, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    body,
    headers: finalHeaders,
  });

  if (res.status === 401 && auth) {
    onUnauthorized?.();
  }

  if (!res.ok) {
    const message = await extractError(res);
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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
