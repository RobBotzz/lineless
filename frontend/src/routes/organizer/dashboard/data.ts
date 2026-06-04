import { redirect } from 'react-router';

import { apiFetch, ApiError } from '@/api/client';
import type { Event } from '@/types/event';
import type { Stand } from '@/types/stand';
import type { Product } from '@/types/product';

export type DashboardActionResult = { ok: false; error: string };

export interface DashboardLoaderData {
  events: Event[];
  standCounts: Record<string, number>;
  productCounts: Record<string, number>;
}

export async function dashboardLoader(): Promise<DashboardLoaderData> {
  const events = await apiFetch<Event[]>('/events');

  const standArrays = await Promise.all(
    events.map((e) => apiFetch<Stand[]>(`/events/${e._id}/stands`).catch(() => [] as Stand[])),
  );

  const standCounts: Record<string, number> = {};
  const productCounts: Record<string, number> = {};
  await Promise.all(
    events.map(async (e, i) => {
      const stands = standArrays[i] ?? [];
      standCounts[e._id] = stands.length;
      const perStand = await Promise.all(
        stands.map((s) =>
          apiFetch<Product[]>(`/stands/${s._id}/products`)
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
