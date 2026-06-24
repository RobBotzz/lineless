import type { LoaderFunctionArgs } from 'react-router';

import { getAttendeeOrders } from '@/api/orders';
import type { Order } from '@/types/order';

export async function ordersLoader({ params }: LoaderFunctionArgs): Promise<Order[]> {
  const { eventId } = params as { eventId: string };
  return getAttendeeOrders(eventId);
}
