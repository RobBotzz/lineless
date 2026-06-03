import { redirect } from 'react-router';

import { apiFetch, ApiError } from '@/api/client';
import type { Event } from '@/types/event';
import type { Stand } from '@/types/stand';

export type DashboardActionResult = { ok: false; error: string };

export interface DashboardLoaderData {
  events: Event[];
  standCounts: Record<string, number>;
}

// Fetch events, then fetch each event's stands in parallel to build stand counts.
export async function dashboardLoader(): Promise<DashboardLoaderData> {
  const events = await apiFetch<Event[]>('/events');

  const standArrays = await Promise.all(
    events.map((e) => apiFetch<Stand[]>(`/events/${e._id}/stands`).catch(() => [] as Stand[])),
  );

  const standCounts: Record<string, number> = {};
  events.forEach((e, i) => {
    standCounts[e._id] = standArrays[i]?.length ?? 0;
  });

  return { events, standCounts };
}

// Create a draft event, then send the organizer straight to its config page.
export async function dashboardAction() {
  try {
    const event = await apiFetch<Event>('/events', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Event' }),
    });
    return redirect(`/organizer/events/${event._id}`);
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Could not create the event. Please try again.';
    return { ok: false, error: message } as DashboardActionResult;
  }
}
