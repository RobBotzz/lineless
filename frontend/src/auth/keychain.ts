export type AuthKind = 'organizer' | 'operator' | 'attendee';

export interface OrganizerCredential {
  token: string;
}

export interface AttendeeCredential {
  sessionId: string;
  eventId: string;
  expiresAt: string;
}

export interface OperatorCredential {
  eventId: string;
  operatorAccessKey: string;
  stands: Record<string, string>;
}

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

function parseOrganizer(data: Record<string, unknown>): OrganizerCredential | null {
  return isString(data.token) ? { token: data.token } : null;
}

function parseAttendee(data: Record<string, unknown>): AttendeeCredential | null {
  return isString(data.sessionId) && isString(data.eventId) && isString(data.expiresAt)
    ? { sessionId: data.sessionId, eventId: data.eventId, expiresAt: data.expiresAt }
    : null;
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

export function getOperatorStandToken(standId: string): string | null {
  return getCredential('operator')?.stands[standId] ?? null;
}

export function setOrganizer(token: string): void {
  write(KEYS.organizer, { token } satisfies OrganizerCredential);
}

export function setAttendee(sessionId: string, eventId: string, expiresAt: string): void {
  write(KEYS.attendee, { sessionId, eventId, expiresAt } satisfies AttendeeCredential);
}

// Persist the secret link key for an event. Switching to a different event
// resets the stored stand tokens; re-opening the same event's link keeps them.
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

// Drop a single stand's token (e.g. it expired). The link key and other stands
// stay intact so the device keeps working for the rest.
export function clearOperatorStand(standId: string): void {
  const credential = getCredential('operator');
  if (!credential || !credential.stands[standId]) return;
  delete credential.stands[standId];
  write(KEYS.operator, credential);
}

// Clears any one credential key, including the whole operator session
// (`clearCredential('operator')`). To drop a single stand, use clearOperatorStand.
export function clearCredential(kind: AuthKind): void {
  localStorage.removeItem(KEYS[kind]);
}
