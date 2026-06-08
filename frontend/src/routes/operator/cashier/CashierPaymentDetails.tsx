import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { AlertDialog } from '../../../components/feedback';
import { BackButton } from '../../../components/shared';
import { confirmCashPayment, getOrder } from '../../../api/orders';
import type { Order } from '../../../types/order';
import { formatMoney } from '../../../types/product';
import { paths } from '../../../paths';
import { formatOrderDateTime } from './orderFormat';

const FALLBACK_EVENT_ID = 'demo-event';

// Order details for a single unpaid order, with cash-payment confirmation.
export default function CashierPaymentDetails() {
  const { eventId = FALLBACK_EVENT_ID, orderId = '' } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOrder(orderId)
      .then((result) => {
        if (active) setOrder(result);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  async function confirmPayment() {
    if (!order) return;
    setConfirmOpen(false);
    setIsPaying(true);
    try {
      await confirmCashPayment(order.orderId);
      navigate(paths.operator.cashierPaymentConfirmed(eventId, order.orderId));
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not confirm the payment.');
      setIsPaying(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.cashierPayment(eventId)}>Back to orders</BackButton>

      {isLoading ? (
        <p className="mt-10 text-center text-sm text-text-muted">Loading order…</p>
      ) : loadFailed || !order ? (
        <p className="mt-10 text-center text-sm text-text-muted">
          Order &quot;{orderId}&quot; could not be found.
        </p>
      ) : (
        <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text">Order Details</h2>

          <ul className="mt-4 space-y-3">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-text">{item.productName}</p>
                  <p className="text-xs text-text-muted">{item.standName}</p>
                  <p className="text-xs text-text-muted">Quantity: {item.quantity}</p>
                  {item.comment ? (
                    <p className="mt-1 text-xs text-text-muted italic">“{item.comment}”</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-accent">
                    EUR {formatMoney(item.unitPrice * item.quantity)}
                  </p>
                  <p className="text-xs text-text-muted">EUR {formatMoney(item.unitPrice)} / pc</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-base font-semibold text-text">Total Amount:</span>
            <span className="text-lg font-bold text-accent">EUR {formatMoney(order.total)}</span>
          </div>

          <div className="mt-3 space-y-1 text-xs text-text-muted">
            <p>
              <span className="font-semibold text-text">Order ID:</span> {order.orderId}
            </p>
            <p>
              <span className="font-semibold text-text">Order Time:</span>{' '}
              {formatOrderDateTime(order.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isPaying}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-success px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
          >
            {isPaying ? 'Processing…' : 'Confirm Payment'}
          </button>
        </section>
      )}

      <AlertDialog
        message={
          confirmOpen && order
            ? `Confirm cash payment of EUR ${formatMoney(order.total)} for order ${order.orderId}?`
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
