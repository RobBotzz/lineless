export type AuthKind = 'organizer' | 'operator' | 'attendee';

export interface OrganizerCredential {
  token: string;
}

export interface OperatorCredential {
  token: string;
  standId: string;
}

export interface AttendeeCredential {
  sessionId: string;
  eventId: string;
  expiresAt: string;
}

type CredentialByKind = {
  organizer: OrganizerCredential;
  operator: OperatorCredential;
  attendee: AttendeeCredential;
};

const STORAGE_KEYS: Record<AuthKind, string> = {
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

function parseOperator(data: Record<string, unknown>): OperatorCredential | null {
  return isString(data.token) && isString(data.standId)
    ? { token: data.token, standId: data.standId }
    : null;
}

function parseAttendee(data: Record<string, unknown>): AttendeeCredential | null {
  return isString(data.sessionId) && isString(data.eventId) && isString(data.expiresAt)
    ? { sessionId: data.sessionId, eventId: data.eventId, expiresAt: data.expiresAt }
    : null;
}

export function getCredential<K extends AuthKind>(kind: K): CredentialByKind[K] | null {
  const raw = localStorage.getItem(STORAGE_KEYS[kind]);
  if (!raw) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  let credential: OrganizerCredential | OperatorCredential | AttendeeCredential | null = null;
  switch (kind) {
    case 'organizer':
      credential = parseOrganizer(data);
      break;
    case 'operator':
      credential = parseOperator(data);
      break;
    case 'attendee':
      credential = parseAttendee(data);
      break;
  }

  return credential as CredentialByKind[K] | null;
}

export function hasCredential(kind: AuthKind): boolean {
  return getCredential(kind) !== null;
}

function setCredential<K extends AuthKind>(kind: K, credential: CredentialByKind[K]): void {
  localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(credential));
}

export function setOrganizerToken(token: string): void {
  setCredential('organizer', { token });
}

export function setOperatorToken(token: string, standId: string): void {
  setCredential('operator', { token, standId });
}

export function setAttendeeSession(sessionId: string, eventId: string, expiresAt: string): void {
  setCredential('attendee', { sessionId, eventId, expiresAt });
}

export function clearCredential(kind: AuthKind): void {
  localStorage.removeItem(STORAGE_KEYS[kind]);
}
