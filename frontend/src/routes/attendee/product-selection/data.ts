import type { LoaderFunctionArgs } from 'react-router';

import { getAttendeeEvent } from '@/api/events';
import { getAttendeeStandProducts } from '@/api/products';
import { getAttendeeStands } from '@/api/stands';
import { ensureAttendeeSession } from '@/auth/attendee/attendeeSession';
import type { Event } from '@/types/event';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';

export interface ProductSelectionLoaderData {
  event: Event;
  stands: Stand[];
  productsByStand: Record<string, Product[]>;
}

export async function productSelectionLoader({
  params,
}: LoaderFunctionArgs): Promise<ProductSelectionLoaderData> {
  const eventId = params.eventId as string;

  await ensureAttendeeSession(eventId);

  const [event, stands] = await Promise.all([
    getAttendeeEvent(eventId),
    getAttendeeStands(eventId),
  ]);

  const productLists = await Promise.all(
    stands.map((stand) => getAttendeeStandProducts(eventId, stand._id)),
  );

  const productsByStand: Record<string, Product[]> = {};
  stands.forEach((stand, i) => {
    productsByStand[stand._id] = productLists[i].filter((p) => p.productStatus === 'LIVE');
  });

  return { event, stands, productsByStand };
}
