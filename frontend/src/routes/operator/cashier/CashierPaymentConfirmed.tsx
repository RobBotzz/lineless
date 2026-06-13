import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { getOrder } from '@/api/orders';
import type { Order } from '@/types/order';
import { paths } from '@/paths';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';

const FALLBACK_EVENT_ID = 'demo-event';

// Confirmation screen shown after a cash payment succeeds. Thin shell: fetch the
// order, then render the shared OrderConfirmation with cashier-worded copy.
export default function CashierPaymentConfirmed() {
  const { eventId = FALLBACK_EVENT_ID, orderId = '' } = useParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getOrder(orderId)
      .then((result) => {
        if (active) setOrder(result);
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
            title="Payment Successful!"
            subtitle="The order has been paid and is being processed."
            wide
          />
        </div>
      )}
    </div>
  );
}
