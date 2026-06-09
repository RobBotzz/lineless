import { createAttendeeSession } from '@/api/sessions';
import { getCredential, setAttendee } from './keychain';

export function hasValidAttendeeSession(eventId: string): boolean {
  const credential = getCredential('attendee');
  if (!credential || credential.eventId !== eventId) return false;
  return new Date(credential.expiresAt).getTime() > Date.now();
}

let pending: { eventId: string; promise: Promise<unknown> } | null = null;

export async function ensureAttendeeSession(eventId: string): Promise<void> {
  if (hasValidAttendeeSession(eventId)) return;
  if (pending?.eventId === eventId) {
    await pending.promise;
    return;
  }
  const promise = createAttendeeSession(eventId).then((session) => {
    setAttendee(session.sessionId, session.eventId, session.expiresAt);
  });
  pending = { eventId, promise };
  try {
    await promise;
  } finally {
    if (pending?.promise === promise) pending = null;
  }
}
