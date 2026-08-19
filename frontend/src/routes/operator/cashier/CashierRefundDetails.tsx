import { useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';

import { AlertDialog } from '@/components/feedback';
import { BackButton } from '@/components/shared';
import { refundOrderItems } from '@/api/orders';
import { formatMoney } from '@/types/product';
import { isRefundableItem } from '@/types/order';
import { paths } from '@/paths';
import { OrderDetailsSection } from './OrderDetailsSection';
import type { CashierContext } from './CashierLayout';
import { useCashierRefundOrder } from './useCashierRefundOrder';

export default function CashierRefundDetails() {
  const { orderId } = useParams() as { orderId: string };
  const { eventId, standId } = useOutletContext<CashierContext>();
  const navigate = useNavigate();

  const { order, rows, isLoading, reload } = useCashierRefundOrder(orderId, eventId, standId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const refundableRows = rows.filter(isRefundableItem);

  // All cancelled items are refunded together, or none — no partial refunds.
  const selectedIds = refundableRows.map((r) => r._id);
  const refundTotal = refundableRows.reduce((sum, r) => sum + r.unitPrice, 0);

  async function confirmRefund() {
    setConfirmOpen(false);
    if (selectedIds.length === 0) return;
    setIsRefunding(true);
    try {
      await refundOrderItems(orderId, selectedIds, standId);
      navigate(paths.operator.cashierRefundConfirmed(eventId, orderId));
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Could not issue the refund.');
      setIsRefunding(false);
      void reload();
    }
  }

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
        <div className="mt-6 space-y-4 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6 lg:space-y-0">
          <OrderDetailsSection order={order} rows={rows} />

          <div className="sticky top-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-text">Refund Total</span>
              <span className="text-2xl font-bold text-danger">EUR {formatMoney(refundTotal)}</span>
            </div>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={isRefunding || selectedIds.length === 0}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-success px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            >
              {isRefunding ? 'Processing…' : 'Confirm Refund'}
            </button>
          </div>
        </div>
      )}

      <AlertDialog
        message={
          confirmOpen && order
            ? `Refund EUR ${formatMoney(refundTotal)} in cash for ${selectedIds.length} item${
                selectedIds.length === 1 ? '' : 's'
              } of order ${order.orderNumber}?`
            : null
        }
        title="Confirm refund"
        variant="success"
        acknowledgeLabel="Yes, refund"
        cancelLabel="Cancel"
        onAcknowledge={confirmRefund}
        onCancel={() => setConfirmOpen(false)}
      />

      <AlertDialog
        message={refundError}
        title="Refund failed"
        acknowledgeLabel="Close"
        onAcknowledge={() => setRefundError(null)}
      />
    </div>
  );
}
