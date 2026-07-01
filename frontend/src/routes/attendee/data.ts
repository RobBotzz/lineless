import type { LoaderFunctionArgs } from 'react-router';

import { getAttendeeEvent } from '@/api/events';
import { ensureAttendeeSession } from '@/auth/attendee/attendeeSession';
import type { Event } from '@/types/event';

export interface AttendeeLayoutLoaderData {
  event: Event;
}

// Owns the event fetch for the whole attendee subtree: branding (applied at the
// layout) and the event itself are available to every nested page via
// useRouteLoaderData('attendee-event'), so child pages don't refetch it.
export async function attendeeLayoutLoader({
  params,
}: LoaderFunctionArgs): Promise<AttendeeLayoutLoaderData> {
  const eventId = params.eventId as string;
  await ensureAttendeeSession(eventId);
  const event = await getAttendeeEvent(eventId);
  return { event };
}
