import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { apiFetch, ApiError } from '@/api/client';
import type { Event, UpdateEventInput } from '@/types/event';

export type EventActionResult = { ok: true } | { ok: false; error: string };

export async function eventConfigurationLoader({ params }: LoaderFunctionArgs) {
  return apiFetch<Event>(`/events/${params.eventId}`);
}

// Lifecycle + settings mutations. useFetcher revalidates the loader on success,
// so the component re-renders with the fresh event (e.g. updated status).
export async function eventConfigurationAction({
  request,
  params,
}: ActionFunctionArgs): Promise<EventActionResult> {
  const eventId = params.eventId;
  const body = (await request.json()) as { intent: string; patch?: UpdateEventInput };

  try {
    switch (body.intent) {
      case 'start':
        await apiFetch(`/events/${eventId}/start`, { method: 'POST' });
        break;
      case 'stop':
        await apiFetch(`/events/${eventId}/stop`, { method: 'POST' });
        break;
      case 'save':
        await apiFetch(`/events/${eventId}`, {
          method: 'PATCH',
          body: JSON.stringify(body.patch ?? {}),
        });
        break;
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    return { ok: false, error: message };
  }
}
