import { redirect, type ActionFunctionArgs } from 'react-router';

import { ApiError } from '@/api/client';
import { createEvent, deleteEvent, getEvents } from '@/api/events';
import { getStandProducts } from '@/api/products';
import { getEventStands } from '@/api/stands';
import type { Event } from '@/types/event';
import type { Stand } from '@/types/stand';

export type DashboardActionResult = { ok: true } | { ok: false; error: string };

export interface DashboardLoaderData {
  events: Event[];
  standCounts: Record<string, number>;
  productCounts: Record<string, number>;
}

export async function dashboardLoader(): Promise<DashboardLoaderData> {
  const events = await getEvents();

  const standArrays = await Promise.all(
    events.map((e) => getEventStands(e._id).catch(() => [] as Stand[])),
  );

  const standCounts: Record<string, number> = {};
  const productCounts: Record<string, number> = {};
  await Promise.all(
    events.map(async (e, i) => {
      const stands = standArrays[i] ?? [];
      standCounts[e._id] = stands.length;
      const perStand = await Promise.all(
        stands.map((s) =>
          getStandProducts(s._id)
            .then((products) => products.length)
            .catch(() => 0),
        ),
      );
      productCounts[e._id] = perStand.reduce((sum, n) => sum + n, 0);
    }),
  );

  return { events, standCounts, productCounts };
}

// Create a draft event by default, or handle explicit dashboard mutations.
export async function dashboardAction({ request }: ActionFunctionArgs) {
  let actionLabel = 'create';

  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { intent?: string; eventId?: string };
      if (body.intent === 'deleteEvent') {
        actionLabel = 'delete';
        if (!body.eventId) throw new Error('Missing event id.');
        await deleteEvent(body.eventId);
        return { ok: true } satisfies DashboardActionResult;
      }
    }

    const event = await createEvent({ name: 'New Event' });
    return redirect(`/organizer/events/${event._id}`);
  } catch (err) {
    const message =
      err instanceof ApiError
        ? err.message
        : actionLabel === 'delete'
          ? 'Could not delete the event. Please try again.'
          : 'Could not create the event. Please try again.';
    return { ok: false, error: message } as DashboardActionResult;
  }
}
