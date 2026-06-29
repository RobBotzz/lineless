import { useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';

import { AlertDialog } from '@/components/feedback';
import { BackButton } from '@/components/shared';
import { confirmCashPayment } from '@/api/orders';
import { computeTotal } from '@/types/order';
import { formatMoney } from '@/types/product';
import { paths } from '@/paths';
import { OrderSummary } from '@/features/orders/OrderSummary';
import { formatOrderDateTime } from './orderFormat';
import type { CashierContext } from './CashierLayout';
import { useCashierOrder } from './useCashierOrder';

export default function CashierPaymentDetails() {
  const { orderId } = useParams() as { orderId: string };
  const { eventId, standId } = useOutletContext<CashierContext>();
  const navigate = useNavigate();

  const { order, items: viewItems, isLoading } = useCashierOrder(orderId, eventId, standId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function confirmPayment() {
    if (!order) return;
    setConfirmOpen(false);
    setIsPaying(true);
    try {
      await confirmCashPayment(order._id);
      navigate(paths.operator.cashierPaymentConfirmed(eventId, order._id));
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not confirm the payment.');
      setIsPaying(false);
    }
  }

  const total = order ? computeTotal(order) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.cashierPayment(eventId)}>Orders</BackButton>

      {isLoading ? (
        <p className="mt-10 text-center text-sm text-text-muted">Loading order…</p>
      ) : !order ? (
        <p className="mt-10 text-center text-sm text-text-muted">
          Order &quot;{orderId}&quot; could not be found.
        </p>
      ) : (
        <div className="mt-6 space-y-4 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6 lg:space-y-0">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-base font-semibold text-text">Order Details</h2>
            <div className="mt-4">
              <OrderSummary items={viewItems} total={total} />
            </div>
            <div className="mt-3 space-y-1 text-xs text-text-muted">
              <p>
                <span className="font-semibold text-text">Order Number:</span> {order.orderNumber}
              </p>
              <p>
                <span className="font-semibold text-text">Order Time:</span>{' '}
                {formatOrderDateTime(order.createdAt)}
              </p>
            </div>
          </section>

          <div className="sticky top-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-text">Total</span>
              <span className="text-2xl font-bold text-accent">EUR {formatMoney(total)}</span>
            </div>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={isPaying}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-success px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            >
              {isPaying ? 'Processing…' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      )}

      <AlertDialog
        message={
          confirmOpen && order
            ? `Confirm cash payment of EUR ${formatMoney(total)} for order ${order.orderNumber}?`
            : null
        }
        title="Confirm payment"
        variant="success"
        acknowledgeLabel="Yes, confirm"
        cancelLabel="Cancel"
        onAcknowledge={confirmPayment}
        onCancel={() => setConfirmOpen(false)}
      />

      <AlertDialog
        message={payError}
        title="Payment failed"
        acknowledgeLabel="Close"
        onAcknowledge={() => setPayError(null)}
      />
    </div>
  );
}
