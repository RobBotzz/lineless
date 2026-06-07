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

export interface AuthKeychainSnapshot {
  organizer?: OrganizerCredential;
  operator?: OperatorCredential;
  attendee?: AttendeeCredential;
}

const KEYCHAIN_KEY = 'lineless.auth.keychain.v1';

type CredentialByKind = {
  organizer: OrganizerCredential;
  operator: OperatorCredential;
  attendee: AttendeeCredential;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseKeychain(value: string | null): AuthKeychainSnapshot {
  if (!value) return {};

  try {
    const data = JSON.parse(value) as unknown;
    if (!isRecord(data)) return {};

    const snapshot: AuthKeychainSnapshot = {};
    if (isRecord(data.organizer) && isString(data.organizer.token)) {
      snapshot.organizer = { token: data.organizer.token };
    }
    if (
      isRecord(data.operator) &&
      isString(data.operator.token) &&
      isString(data.operator.standId)
    ) {
      snapshot.operator = {
        token: data.operator.token,
        standId: data.operator.standId,
      };
    }
    if (
      isRecord(data.attendee) &&
      isString(data.attendee.sessionId) &&
      isString(data.attendee.eventId) &&
      isString(data.attendee.expiresAt)
    ) {
      snapshot.attendee = {
        sessionId: data.attendee.sessionId,
        eventId: data.attendee.eventId,
        expiresAt: data.attendee.expiresAt,
      };
    }

    return snapshot;
  } catch {
    return {};
  }
}

function writeKeychain(snapshot: AuthKeychainSnapshot): void {
  localStorage.setItem(KEYCHAIN_KEY, JSON.stringify(snapshot));
}

function readKeychain(): AuthKeychainSnapshot {
  return parseKeychain(localStorage.getItem(KEYCHAIN_KEY));
}

export function getCredential<K extends AuthKind>(kind: K): CredentialByKind[K] | null {
  return (readKeychain()[kind] as CredentialByKind[K] | undefined) ?? null;
}

export function hasCredential(kind: AuthKind): boolean {
  return getCredential(kind) !== null;
}

export function setOrganizerToken(token: string): void {
  const snapshot = readKeychain();
  snapshot.organizer = { token };
  writeKeychain(snapshot);
}

export function setOperatorToken(token: string, standId: string): void {
  const snapshot = readKeychain();
  snapshot.operator = { token, standId };
  writeKeychain(snapshot);
}

export function setAttendeeSession(session: AttendeeCredential): void {
  const snapshot = readKeychain();
  snapshot.attendee = session;
  writeKeychain(snapshot);
}

export function clearCredential(kind: AuthKind): void {
  const snapshot = readKeychain();
  delete snapshot[kind];
  writeKeychain(snapshot);
}
