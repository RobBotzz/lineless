import type { LoaderFunctionArgs } from 'react-router';

import { getAttendeeStandProducts } from '@/api/products';
import { getAttendeeStands } from '@/api/stands';
import { ensureAttendeeSession } from '@/auth/attendee/attendeeSession';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';

// The event itself is loaded by the parent layout route (attendeeLayoutLoader)
// and read via useRouteLoaderData('attendee-event'), so this loader fetches only
// the stand/product data unique to this page.
export interface ProductSelectionLoaderData {
  stands: Stand[];
  productsByStand: Record<string, Product[]>;
}

export async function productSelectionLoader({
  params,
}: LoaderFunctionArgs): Promise<ProductSelectionLoaderData> {
  const eventId = params.eventId as string;

  await ensureAttendeeSession(eventId);

  const stands = await getAttendeeStands(eventId);

  const productLists = await Promise.all(
    stands.map((stand) => getAttendeeStandProducts(eventId, stand._id)),
  );

  const productsByStand: Record<string, Product[]> = {};
  stands.forEach((stand, i) => {
    productsByStand[stand._id] = productLists[i].filter((p) => p.productStatus === 'LIVE');
  });

  return { stands, productsByStand };
}
