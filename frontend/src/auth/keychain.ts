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
}

function parseOrganizer(data: Record<string, unknown>): OrganizerCredential | null {
  return isString(data.token) ? { token: data.token } : null;
}

export function setOrganizer(token: string): void {
  write(KEYS.organizer, { token } satisfies OrganizerCredential);
}

export function clearOrganizerCredential(): void {
  localStorage.removeItem(KEYS.organizer);
}

// ---------------------------------------------------------------------------
// Operator
// ---------------------------------------------------------------------------

export interface OperatorCredential {
  eventId: string;
  operatorAccessKey: string;
  //standId => standToken
  stands: Record<string, string>;
}

function parseOperator(data: Record<string, unknown>): OperatorCredential | null {
  if (!isString(data.eventId) || !isString(data.operatorAccessKey)) return null;
  const stands: Record<string, string> = {};
  if (isRecord(data.stands)) {
    for (const [standId, token] of Object.entries(data.stands)) {
      if (isString(token)) stands[standId] = token;
    }
  }
  return { eventId: data.eventId, operatorAccessKey: data.operatorAccessKey, stands };
}

export function getOperatorStandToken(standId: string): string | null {
  return getCredential('operator')?.stands[standId] ?? null;
}

export function startOperatorSession(eventId: string, operatorAccessKey: string): void {
  const existing = getCredential('operator');
  const credential: OperatorCredential =
    existing && existing.eventId === eventId
      ? { ...existing, operatorAccessKey }
      : { eventId, operatorAccessKey, stands: {} };
  write(KEYS.operator, credential);
}

export function addOperatorStand(standId: string, token: string): void {
  const credential = getCredential('operator');
  if (!credential) return;
  credential.stands[standId] = token;
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

export interface AttendeeCredential {
  //eventId => attendeeSession
  sessions: Record<string, AttendeeSession>;
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
  return { sessions };
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

export function setAttendeeSession(eventId: string, sessionId: string, expiresAt: string): void {
  const credential = getCredential('attendee') ?? { sessions: {} };
  credential.sessions[eventId] = { sessionId, expiresAt };
  write(KEYS.attendee, credential);
  notifyAttendee();
}

export function clearAttendeeSession(eventId: string): void {
  const credential = getCredential('attendee');
  if (!credential || !credential.sessions[eventId]) return;
  delete credential.sessions[eventId];
  write(KEYS.attendee, credential);
  notifyAttendee();
}
