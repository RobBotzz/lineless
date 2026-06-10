import { redirect } from 'react-router';

import { ApiError } from '@/api/client';
import { createEvent, getEvents } from '@/api/events';
import { getStandProducts } from '@/api/products';
import { getEventStands } from '@/api/stands';
import type { Event } from '@/types/event';
import type { Stand } from '@/types/stand';

export type DashboardActionResult = { ok: false; error: string };

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

// Create a draft event, then send the organizer straight to its config page.
export async function dashboardAction() {
  try {
    const event = await createEvent({ name: 'New Event' });
    return redirect(`/organizer/events/${event._id}`);
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Could not create the event. Please try again.';
    return { ok: false, error: message } as DashboardActionResult;
  }
}
