import { useCallback, useEffect, useState } from 'react';

import { buildRefundRows, getOrder, type RefundItemRow } from '@/api/orders';
import type { Order } from '@/types/order';

// Loads an order plus per-item rows (including cancelled/refunded items) for the
// refund screens. reload bumps a key to re-fetch after a refund so item states
// refresh. State is set inside the async continuation (never synchronously in the
// effect body), mirroring useCashierOrder.
export function useCashierRefundOrder(orderId: string, eventId: string, standId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [rows, setRows] = useState<RefundItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    getOrder(orderId, standId)
      .then(async (result) => {
        const view = await buildRefundRows(result, eventId, standId);
        if (active) {
          setOrder(result);
          setRows(view);
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
  }, [orderId, eventId, standId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { order, rows, isLoading, reload };
}
