import { redirect } from 'react-router';

import { apiFetch, ApiError } from '@/api/client';
import type { Event } from '@/types/event';

export type DashboardActionResult = { ok: false; error: string };

// One-shot fetch of the organizer's events for the dashboard list.
export function dashboardLoader() {
  return apiFetch<Event[]>('/events');
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
