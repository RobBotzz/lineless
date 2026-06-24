import type { LoaderFunctionArgs } from 'react-router';

import {
  getEventControlCenter,
  getEventOrders,
  type EventControlCenterData,
  type LiveOrder,
} from '@/api/eventControlCenter';
import { getEvent } from '@/api/events';
import { getStandProducts } from '@/api/products';
import { getEventStands } from '@/api/stands';
import type { Event } from '@/types/event';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';

export interface EventControlCenterLoaderData {
  analytics: EventControlCenterData;
  event: Event;
  liveOrders: LiveOrder[];
  stands: Stand[];
  productsByStand: Record<string, Product[]>;
}

export async function eventControlCenterLoader({
  params,
}: LoaderFunctionArgs): Promise<EventControlCenterLoaderData> {
  const eventId = params.eventId;
  if (!eventId) throw new Error('Missing event id.');

  const [analytics, event, liveOrders, stands] = await Promise.all([
    getEventControlCenter(eventId),
    getEvent(eventId),
    getEventOrders(eventId),
    getEventStands(eventId),
  ]);

  const productsByStandEntries = await Promise.all(
    stands.map(async (stand) => {
      const products = await getStandProducts(stand._id).catch(() => [] as Product[]);
      return [stand._id, products] as const;
    }),
  );

  return {
    analytics,
    event,
    liveOrders,
    stands,
    productsByStand: Object.fromEntries(productsByStandEntries),
  };
}
