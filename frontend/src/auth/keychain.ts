export type AuthKind = 'organizer' | 'operator' | 'attendee';

type CredentialByKind = {
  organizer: OrganizerCredential;
  operator: OperatorCredential;
  attendee: AttendeeCredential;
};

const KEYS: Record<AuthKind, string> = {
  organizer: 'lineless.auth.organizer.v1',
  operator: 'lineless.auth.operator.v1',
  attendee: 'lineless.auth.attendee.v1',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function readStored<T>(key: string, parse: (data: Record<string, unknown>) => T | null): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  return isRecord(data) ? parse(data) : null;
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

const PARSERS = {
  organizer: parseOrganizer,
  operator: parseOperator,
  attendee: parseAttendee,
};

export function getCredential<K extends AuthKind>(kind: K): CredentialByKind[K] | null {
  const parse = PARSERS[kind] as (data: Record<string, unknown>) => CredentialByKind[K] | null;
  return readStored(KEYS[kind], parse);
}

export function hasCredential(kind: AuthKind): boolean {
  return getCredential(kind) !== null;
}

// ---------------------------------------------------------------------------
// Organizer
// ---------------------------------------------------------------------------

export interface OrganizerCredential {
  token: string;
  refreshToken: string;
}

function parseOrganizer(data: Record<string, unknown>): OrganizerCredential | null {
  return isString(data.token) && isString(data.refreshToken)
    ? { token: data.token, refreshToken: data.refreshToken }
    : null;
}

export function setOrganizer(token: string, refreshToken: string): void {
  write(KEYS.organizer, { token, refreshToken } satisfies OrganizerCredential);
}

export function clearOrganizerCredential(): void {
  localStorage.removeItem(KEYS.organizer);
}

// ---------------------------------------------------------------------------
// Operator
// ---------------------------------------------------------------------------

export interface OperatorStandTokens {
  token: string;
  refreshToken: string;
}

export interface OperatorCredential {
  eventId: string;
  operatorAccessKey: string;
  stands: Record<string, OperatorStandTokens>;
}

function parseOperator(data: Record<string, unknown>): OperatorCredential | null {
  if (!isString(data.eventId) || !isString(data.operatorAccessKey)) return null;
  const stands: Record<string, OperatorStandTokens> = {};
  if (isRecord(data.stands)) {
    for (const [standId, value] of Object.entries(data.stands)) {
      if (isRecord(value) && isString(value.token) && isString(value.refreshToken)) {
        stands[standId] = { token: value.token, refreshToken: value.refreshToken };
      }
    }
  }
  return { eventId: data.eventId, operatorAccessKey: data.operatorAccessKey, stands };
}

export function getOperatorStandToken(standId: string): string | null {
  return getCredential('operator')?.stands[standId]?.token ?? null;
}

export function getOperatorStandRefreshToken(standId: string): string | null {
  return getCredential('operator')?.stands[standId]?.refreshToken ?? null;
}

export function startOperatorSession(eventId: string, operatorAccessKey: string): void {
  const existing = getCredential('operator');
  const credential: OperatorCredential =
    existing && existing.eventId === eventId
      ? { ...existing, operatorAccessKey }
      : { eventId, operatorAccessKey, stands: {} };
  write(KEYS.operator, credential);
}

export function addOperatorStand(standId: string, token: string, refreshToken: string): void {
  const credential = getCredential('operator');
  if (!credential) return;
  credential.stands[standId] = { token, refreshToken };
  write(KEYS.operator, credential);
}

export function clearOperatorStand(standId: string): void {
  const credential = getCredential('operator');
  if (!credential || !credential.stands[standId]) return;
  delete credential.stands[standId];
  write(KEYS.operator, credential);
}

export function clearOperatorCredential(): void {
  localStorage.removeItem(KEYS.operator);
}

// ---------------------------------------------------------------------------
// Attendee
// ---------------------------------------------------------------------------

export interface AttendeeSession {
  sessionId: string;
  expiresAt: string;
}

export interface AttendeeTab {
  tabId: string;
}

export interface AttendeeCredential {
  //eventId => attendeeSession
  sessions: Record<string, AttendeeSession>;
  // eventId => the attendee's payment tab for that event (a Stripe card hold
  // they keep ordering against until checkout). Persisted so repeat orders
  // reuse the same authorization instead of opening a new tab each time.
  tabs: Record<string, AttendeeTab>;
}

function parseAttendee(data: Record<string, unknown>): AttendeeCredential | null {
  const sessions: Record<string, AttendeeSession> = {};
  if (isRecord(data.sessions)) {
    for (const [eventId, value] of Object.entries(data.sessions)) {
      if (isRecord(value) && isString(value.sessionId) && isString(value.expiresAt)) {
        sessions[eventId] = { sessionId: value.sessionId, expiresAt: value.expiresAt };
      }
    }
  }
  const tabs: Record<string, AttendeeTab> = {};
  if (isRecord(data.tabs)) {
    for (const [eventId, value] of Object.entries(data.tabs)) {
      if (isRecord(value) && isString(value.tabId)) {
        tabs[eventId] = { tabId: value.tabId };
      }
    }
  }
  return { sessions, tabs };
}

type Listener = () => void;
const attendeeListeners = new Set<Listener>();

export function subscribeAttendee(listener: Listener): () => void {
  attendeeListeners.add(listener);
  return () => {
    attendeeListeners.delete(listener);
  };
}

function notifyAttendee(): void {
  for (const listener of attendeeListeners) listener();
}

export function getAttendeeSession(eventId: string): AttendeeSession | null {
  return getCredential('attendee')?.sessions[eventId] ?? null;
}

function emptyAttendeeCredential(): AttendeeCredential {
  return { sessions: {}, tabs: {} };
}

export function setAttendeeSession(eventId: string, sessionId: string, expiresAt: string): void {
  const credential = getCredential('attendee') ?? emptyAttendeeCredential();
  credential.sessions[eventId] = { sessionId, expiresAt };
  write(KEYS.attendee, credential);
  notifyAttendee();
}

export function clearAttendeeSession(eventId: string): void {
  const credential = getCredential('attendee');
  if (!credential || !credential.sessions[eventId]) return;
  delete credential.sessions[eventId];
  // The tab belongs to the session that opened it; drop it together so a new
  // session never inherits a stale, unusable tab.
  delete credential.tabs[eventId];
  write(KEYS.attendee, credential);
  notifyAttendee();
}

export function getAttendeeTab(eventId: string): AttendeeTab | null {
  return getCredential('attendee')?.tabs[eventId] ?? null;
}

export function setAttendeeTab(eventId: string, tabId: string): void {
  const credential = getCredential('attendee') ?? emptyAttendeeCredential();
  credential.tabs[eventId] = { tabId };
  write(KEYS.attendee, credential);
}

export function clearAttendeeTab(eventId: string): void {
  const credential = getCredential('attendee');
  if (!credential || !credential.tabs[eventId]) return;
  delete credential.tabs[eventId];
  write(KEYS.attendee, credential);
}
