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
  return response;
}

export async function setAttendeeSessionEmail(
  eventId: string,
  email: string,
): Promise<{ email: string }> {
  return apiFetch<{ email: string }>('/sessions/email', {
    method: 'PATCH',
    body: JSON.stringify({ email }),
    auth: 'attendee',
    eventId,
  });
}
