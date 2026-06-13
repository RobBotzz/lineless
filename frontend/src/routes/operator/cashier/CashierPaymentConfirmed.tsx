import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { buildOrderViewItems, getOrder } from '@/api/orders';
import type { Order, OrderItemView } from '@/types/order';
import { computeTotal } from '@/types/order';
import { paths } from '@/paths';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';

const FALLBACK_EVENT_ID = 'demo-event';

export default function CashierPaymentConfirmed() {
  const { eventId = FALLBACK_EVENT_ID, orderId = '' } = useParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [viewItems, setViewItems] = useState<OrderItemView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getOrder(orderId)
      .then((result) => buildOrderViewItems(result).then((items) => ({ result, items })))
      .then(({ result, items }) => {
        if (active) {
          setOrder(result);
          setViewItems(items);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.cashier(eventId)}>Back to Cashier Stand</BackButton>

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
            items={viewItems}
            total={computeTotal(order)}
            title="Payment Successful!"
            subtitle="The order has been paid and is being processed."
            wide
          />
        </div>
      )}
    </div>
  );
}
