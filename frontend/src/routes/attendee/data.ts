import type { LoaderFunctionArgs } from 'react-router';

import { getAttendeeEvent, getEventPublicInfo } from '@/api/events';
import { ensureAttendeeSession, hasValidAttendeeSession } from '@/auth/attendee/attendeeSession';
import type { Event, PublicEventInfo } from '@/types/event';

export interface AttendeeLayoutLoaderData {
  event: Event | PublicEventInfo;
  hasSession: boolean;
}

// Owns the event fetch for the whole attendee subtree. Child pages access the
// event via useRouteLoaderData('attendee-event') so they don't re-fetch it.
//
// The loader must handle every event status gracefully:
//   DRAFT          → gate page ("event starts soon"), no session needed
//   ACTIVE         → normal flow: ensure session, load full event
//   STOPPED/COMPLETED → existing session holders get full event; new visitors get a gate page
export async function attendeeLayoutLoader({
  params,
}: LoaderFunctionArgs): Promise<AttendeeLayoutLoaderData> {
  const eventId = params.eventId as string;

  // Fast path: already have a valid session → load the full event.
  // The backend allows STOPPED/COMPLETED events for authenticated sessions.
  if (hasValidAttendeeSession(eventId)) {
    const event = await getAttendeeEvent(eventId);
    return { event, hasSession: true };
  }

  // No session: check event status publicly before attempting to create one.
  const publicInfo = await getEventPublicInfo(eventId);

  if (publicInfo.status === 'ACTIVE') {
    await ensureAttendeeSession(eventId);
    const event = await getAttendeeEvent(eventId);
    return { event, hasSession: true };
  }

  // Event is not active — return public info so the layout can show a gate page.
  return { event: publicInfo, hasSession: false };
}
