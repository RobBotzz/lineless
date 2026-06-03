import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { apiFetch, ApiError } from '@/api/client';
import type { Event, UpdateEventInput } from '@/types/event';
import type { Stand, CreateStandInput, UpdateStandInput } from '@/types/stand';

export type EventActionResult = { ok: true } | { ok: false; error: string };

export type EventConfigurationLoaderData = {
  event: Event;
  stands: Stand[];
};

export async function eventConfigurationLoader({
  params,
}: LoaderFunctionArgs): Promise<EventConfigurationLoaderData> {
  const [event, stands] = await Promise.all([
    apiFetch<Event>(`/events/${params.eventId}`),
    apiFetch<Stand[]>(`/events/${params.eventId}/stands`),
  ]);
  return { event, stands };
}

// Lifecycle + settings mutations. useFetcher revalidates the loader on success,
// so the component re-renders with the fresh event (e.g. updated status).
export async function eventConfigurationAction({
  request,
  params,
}: ActionFunctionArgs): Promise<EventActionResult> {
  const eventId = params.eventId;
  const body = (await request.json()) as
    | { intent: 'start' | 'stop' }
    | { intent: 'save'; patch: UpdateEventInput }
    | { intent: 'createStand'; patch: CreateStandInput }
    | { intent: 'updateStand'; standId: string; patch: UpdateStandInput }
    | { intent: 'deleteStand'; standId: string };

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
      case 'createStand':
        await apiFetch(`/events/${eventId}/stands`, {
          method: 'POST',
          body: JSON.stringify(body.patch),
        });
        break;
      case 'updateStand':
        await apiFetch(`/stands/${body.standId}`, {
          method: 'PATCH',
          body: JSON.stringify(body.patch),
        });
        break;
      case 'deleteStand':
        await apiFetch(`/stands/${body.standId}`, {
          method: 'DELETE',
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
