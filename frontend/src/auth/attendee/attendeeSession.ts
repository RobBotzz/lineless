import { createAttendeeSession } from '@/api/sessions';
import { getAttendeeSession, setAttendeeSession } from '../keychain';

export function hasValidAttendeeSession(eventId: string): boolean {
  const session = getAttendeeSession(eventId);
  if (!session) return false;
  return new Date(session.expiresAt).getTime() > Date.now();
}

let pending: { eventId: string; promise: Promise<unknown> } | null = null;

export async function ensureAttendeeSession(eventId: string): Promise<void> {
  if (hasValidAttendeeSession(eventId)) return;
  if (pending?.eventId === eventId) {
    await pending.promise;
    return;
  }
  const promise = createAttendeeSession(eventId).then((session) => {
    setAttendeeSession(session.eventId, session.sessionId, session.expiresAt);
  });
  pending = { eventId, promise };
  try {
    await promise;
  } finally {
    if (pending?.promise === promise) pending = null;
  }
}
