import { useOutletContext, useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { computeTotal } from '@/types/order';
import { paths } from '@/paths';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
import type { CashierContext } from './CashierLayout';
import { useCashierOrder } from './useCashierOrder';

export default function CashierPaymentConfirmed() {
  const { orderId } = useParams() as { orderId: string };
  const { eventId, standId } = useOutletContext<CashierContext>();
  const { order, items, isLoading } = useCashierOrder(orderId, eventId, standId);

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
            items={items}
            total={computeTotal(order)}
            title="Payment Successful!"
            subtitle="The order has been paid and is being processed."
          />
        </div>
      )}
    </div>
  );
}
