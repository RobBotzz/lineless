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

// On a 401 for an authed request: try a one-shot token refresh. Returns true if
// the caller should retry once (the token was refreshed); otherwise routes the
// dead credential to onUnauthorized and returns false. Shared by doFetch and
// doStream so fetch and stream auth can never drift apart.
async function tryRefreshOr401(auth: AuthScope, isRetry: boolean, ids: ScopeIds): Promise<boolean> {
  if (!isRetry && canRefresh(auth) && refreshCredential) {
    if (await refreshCredential(auth, ids)) return true;
  }
  onUnauthorized?.(auth, ids);
  return false;
}

interface ApiFetchOptions extends RequestInit {
  auth: ApiAuthMode;
  // Required when auth is 'operator': which stand's token to send.
  standId?: string;
  // Required when auth is 'attendee': which event's session to send.
  eventId?: string;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const { data } = await doFetch<T>(path, options, false, []);
  return data;
}

// Like apiFetch, but resolves (instead of throwing) for the listed non-2xx
// statuses, returning the status so the caller can branch on it. Used for
// POST /orders, where a 402 is not an error but a Stripe authorization step
// whose body carries the clientSecret to confirm.
export async function apiFetchAllowing<T>(
  path: string,
  options: ApiFetchOptions,
  allowStatuses: number[],
): Promise<{ status: number; data: T }> {
  return doFetch<T>(path, options, false, allowStatuses);
}

// `isRetry` guards against a refresh loop: we attempt at most one refresh +
// retry per request. The refreshed token is re-read from the keychain by
// attachAuthHeader on the retry, so options stay untouched. `allowStatuses`
// lists non-2xx codes the caller handles itself (returned, not thrown).
async function doFetch<T>(
  path: string,
  options: ApiFetchOptions,
  isRetry: boolean,
  allowStatuses: number[],
): Promise<{ status: number; data: T }> {
  const { auth, standId, eventId, headers, body, ...rest } = options;

  const finalHeaders = new Headers(headers);
  // Let the browser set the multipart boundary for FormData; only default to
  // JSON for plain (string) bodies.
  if (body !== undefined && !(body instanceof FormData) && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  attachAuthHeader(finalHeaders, auth, { standId, eventId });

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    body,
    headers: finalHeaders,
  });

  if (res.status === 401 && auth !== 'public') {
    if (await tryRefreshOr401(auth, isRetry, { standId, eventId })) {
      return doFetch<T>(path, options, true, allowStatuses);
    }
  }

  if (!res.ok && !allowStatuses.includes(res.status)) {
    const message = await extractError(res);
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return { status: res.status, data: undefined as T };
  return { status: res.status, data: (await res.json()) as T };
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

export interface SseFrame {
  event: string;
  data: string;
}

export interface StreamSseOptions extends Omit<ApiFetchOptions, 'body' | 'method' | 'signal'> {
  // Abort to close the stream (unmount / dependency change). Required so a stream
  // can never outlive its component.
  signal: AbortSignal;
  onMessage: (frame: SseFrame) => void;
  // Fires once the connection is established (HTTP 200, before the first frame).
  onOpen?: () => void;
}

// Low-level Server-Sent-Events transport: the streaming sibling of apiFetch.
// It attaches the same persona credential (attachAuthHeader), performs the same
// one-shot refresh + onUnauthorized on a 401, then keeps the connection open and
// hands every decoded frame to onMessage until the server closes, the caller
// aborts (options.signal), or the socket errors. Resolves on a clean end; rejects
// on a connection/HTTP error so useSSE can decide whether to reconnect.
//
// We read the stream over fetch rather than via the native EventSource because
// EventSource cannot send an Authorization header, which every authed stream needs.
export async function streamSse(path: string, options: StreamSseOptions): Promise<void> {
  return doStream(path, options, false);
}

// `isRetry` mirrors doFetch: at most one refresh + reconnect per connect attempt.
async function doStream(path: string, options: StreamSseOptions, isRetry: boolean): Promise<void> {
  const { auth, standId, eventId, signal, onMessage, onOpen, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set('Accept', 'text/event-stream');
  attachAuthHeader(finalHeaders, auth, { standId, eventId });

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    signal,
  });

  if (res.status === 401 && auth !== 'public') {
    if (await tryRefreshOr401(auth, isRetry, { standId, eventId })) {
      return doStream(path, options, true);
    }
  }

  if (!res.ok || !res.body) {
    const message = await extractError(res);
    throw new ApiError(res.status, message);
  }

  onOpen?.();
  await readSseStream(res.body, onMessage);
}

// Decode the chunked body and split it into SSE frames on the blank-line delimiter.
async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onMessage: (frame: SseFrame) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = parseSseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (frame) onMessage(frame);
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
}

// Parse one frame block. Returns null for heartbeats (comment-only, no data line).
function parseSseFrame(raw: string): SseFrame | null {
  let event = 'message';
  const data: string[] = [];

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '' || line.startsWith(':')) continue; // blank or comment (heartbeat)

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1); // SSE strips one leading space

    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }

  return data.length > 0 ? { event, data: data.join('\n') } : null;
}
