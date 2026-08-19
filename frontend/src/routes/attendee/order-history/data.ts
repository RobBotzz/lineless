import type { LoaderFunctionArgs } from 'react-router';

import { ApiError } from '@/api/client';
import { getAttendeeOrders } from '@/api/orders';
import type { Order } from '@/types/order';

export async function ordersLoader({ params }: LoaderFunctionArgs): Promise<Order[]> {
  const { eventId } = params as { eventId: string };
  // Without a valid session the backend returns 401; for non-ACTIVE events it
  // may return 404. Return empty so the parent layout gate renders instead.
  try {
    return await getAttendeeOrders(eventId);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
      return [];
    }
    throw err;
  }
}
