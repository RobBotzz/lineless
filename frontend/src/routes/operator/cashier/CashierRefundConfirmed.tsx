import { useNavigate, useOutletContext, useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { paths } from '@/paths';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
import { OrderDetailsSection } from './OrderDetailsSection';
import type { CashierContext } from './CashierLayout';
import { useCashierRefundOrder } from './useCashierRefundOrder';

export default function CashierRefundConfirmed() {
  const { orderId } = useParams() as { orderId: string };
  const { eventId, standId } = useOutletContext<CashierContext>();
  const navigate = useNavigate();

  const { order, rows, isLoading } = useCashierRefundOrder(orderId, eventId, standId);

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
        <div className="mt-6 space-y-6">
          <OrderConfirmation
            order={order}
            title="Refund Successful!"
            subtitle="The cancelled items have been refunded in cash."
          >
            <OrderDetailsSection order={order} rows={rows} />
          </OrderConfirmation>
          <Button className="w-full" onClick={() => navigate(paths.operator.cashier(eventId))}>
            Back to Cashier Stand
          </Button>
        </div>
      )}
    </div>
  );
}
