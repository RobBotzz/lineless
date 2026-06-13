import type { LoaderFunctionArgs } from 'react-router';

import { getEvent } from '@/api/events';
import { getStandProducts } from '@/api/products';
import { getEventStands } from '@/api/stands';
import type { Event } from '@/types/event';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';

export interface AnalyticsLoaderData {
  event: Event;
  stands: Stand[];
  productsByStand: Record<string, Product[]>;
}

export async function analyticsLoader({
  params,
}: LoaderFunctionArgs): Promise<AnalyticsLoaderData> {
  const eventId = params.eventId;
  if (!eventId) throw new Error('Missing event id.');

  const [event, stands] = await Promise.all([getEvent(eventId), getEventStands(eventId)]);

  const productsByStandEntries = await Promise.all(
    stands.map(async (stand) => {
      const products = await getStandProducts(stand._id).catch(() => [] as Product[]);
      return [stand._id, products] as const;
    }),
  );

  return {
    event,
    stands,
    productsByStand: Object.fromEntries(productsByStandEntries),
  };
}
