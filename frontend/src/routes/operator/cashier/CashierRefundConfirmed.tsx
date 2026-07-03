import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { buildRefundedViewItems, getOrder } from '@/api/orders';
import type { Order, OrderItemView } from '@/types/order';
import { paths } from '@/paths';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
import type { CashierContext } from './CashierLayout';

export default function CashierRefundConfirmed() {
  const { orderId } = useParams() as { orderId: string };
  const { eventId, standId } = useOutletContext<CashierContext>();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItemView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getOrder(orderId, standId)
      .then(async (result) => {
        const view = await buildRefundedViewItems(result, eventId, standId);
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

  const refundedTotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.cashierRefund(eventId)}>Refunds</BackButton>

      {isLoading ? (
        <p className="mt-10 text-center text-sm text-text-muted">Loading order…</p>
      ) : !order ? (
        <p className="mt-10 text-center text-sm text-text-muted">
          Order &quot;{orderId}&quot; could not be found.
        </p>
      ) : (
        <div className="mt-6">
          <OrderConfirmation
            order={order}
            items={items}
            total={refundedTotal}
            title="Refund Successful!"
            subtitle="The cancelled items have been refunded in cash."
          />
        </div>
      )}
    </div>
  );
}
