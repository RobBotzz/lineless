import { setAttendeeSession } from '@/auth/keychain';
import { apiFetch } from './client';

export interface CreateAttendeeSessionInput {
  eventId: string;
}

export interface AttendeeSessionResponse {
  sessionId: string;
  eventId: string;
  expiresAt: string;
}

export async function createAttendeeSession(eventId: string): Promise<AttendeeSessionResponse> {
  const response = await apiFetch<AttendeeSessionResponse>('/sessions/create', {
    method: 'POST',
    body: JSON.stringify({ eventId } satisfies CreateAttendeeSessionInput),
    auth: 'public',
  });
  setAttendeeSession(response);
  return response;
}
