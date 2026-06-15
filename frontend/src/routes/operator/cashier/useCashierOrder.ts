import { useEffect, useState } from 'react';

import { buildOrderViewItems, getOrder } from '@/api/orders';
import type { Order, OrderItemView } from '@/types/order';

// Loads an order plus its display items for the cashier payment screens.
// order is null once loading finishes if the fetch failed (order not found).
export function useCashierOrder(orderId: string, eventId: string, standId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItemView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getOrder(orderId, standId)
      .then(async (result) => {
        const view = await buildOrderViewItems(result, eventId, standId);
        if (active) {
          setOrder(result);
          setItems(view);
        }
      })
      .catch(() => {
        if (active) setOrder(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId, eventId, standId]);

  return { order, items, isLoading };
}
