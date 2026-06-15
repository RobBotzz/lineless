import type { LoaderFunctionArgs } from 'react-router';

import { getAttendeeEvent } from '@/api/events';
import { getAttendeeOrders } from '@/api/orders';
import { getAttendeeStandProducts } from '@/api/products';
import { getAttendeeStands } from '@/api/stands';
import { ensureAttendeeSession } from '@/auth/attendee/attendeeSession';
import type { Event } from '@/types/event';
import type { Order } from '@/types/order';
import type { Product } from '@/types/product';

export interface OrderHistoryLoaderData {
  event: Event;
  orders: Order[];
  // productId -> name, so order items (which only carry productId) can be labelled.
  productNames: Record<string, string>;
}

export async function orderHistoryLoader({
  params,
}: LoaderFunctionArgs): Promise<OrderHistoryLoaderData> {
  const eventId = params.eventId as string;

  await ensureAttendeeSession(eventId);

  const [event, orders, stands] = await Promise.all([
    getAttendeeEvent(eventId),
    getAttendeeOrders(eventId),
    getAttendeeStands(eventId),
  ]);

  const productLists = await Promise.all(
    stands.map((stand) => getAttendeeStandProducts(eventId, stand._id)),
  );

  const productNames: Record<string, string> = {};
  productLists.flat().forEach((product: Product) => {
    productNames[product._id] = product.productName;
  });

  return { event, orders, productNames };
}
