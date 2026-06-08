import type { LoaderFunctionArgs } from 'react-router';

import { apiFetch } from '@/api/client';
import type { Event } from '@/types/event';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';

export interface ProductSelectionLoaderData {
  event: Event;
  stands: Stand[];
  productsByStand: Record<string, Product[]>;
}

// TODO: the stand- and product-list endpoints are currently organizer-scoped
// (authAccount). An attendee-facing, session-authenticated catalog endpoint
// does not exist yet, so in production this loader needs the backend to expose
// a public/session menu route. In dev it works with an organizer token present.
export async function productSelectionLoader({
  params,
}: LoaderFunctionArgs): Promise<ProductSelectionLoaderData> {
  const eventId = params.eventId as string;

  const [event, stands] = await Promise.all([
    apiFetch<Event>(`/events/${eventId}`, { auth: 'organizer' }),
    apiFetch<Stand[]>(`/events/${eventId}/stands`, { auth: 'organizer' }),
  ]);

  const productLists = await Promise.all(
    stands.map((stand) =>
      apiFetch<Product[]>(`/stands/${stand._id}/products`, { auth: 'organizer' }),
    ),
  );

  const productsByStand: Record<string, Product[]> = {};
  stands.forEach((stand, i) => {
    productsByStand[stand._id] = productLists[i].filter((p) => p.productStatus === 'LIVE');
  });

  return { event, stands, productsByStand };
}
