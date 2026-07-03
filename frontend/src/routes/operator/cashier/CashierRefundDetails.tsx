import { useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';

import { AlertDialog } from '@/components/feedback';
import { BackButton } from '@/components/shared';
import { refundOrderItems, type RefundItemRow } from '@/api/orders';
import { formatMoney } from '@/types/product';
import { paths } from '@/paths';
import { cn } from '@/lib/utils';
import { formatOrderDateTime } from './orderFormat';
import type { CashierContext } from './CashierLayout';
import { useCashierRefundOrder } from './useCashierRefundOrder';

function isRefundable(row: RefundItemRow): boolean {
  return row.cancelledAt != null && row.refundedAt == null;
}

export default function CashierRefundDetails() {
  const { orderId } = useParams() as { orderId: string };
  const { eventId, standId } = useOutletContext<CashierContext>();
  const navigate = useNavigate();

  const { order, rows, isLoading, reload } = useCashierRefundOrder(orderId, eventId, standId);
  // Track de-selected items so every refundable item defaults to selected without
  // an initialization effect (empty set = all selected).
  const [deselected, setDeselected] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const activeRows = rows.filter((r) => r.cancelledAt == null);
  const refundableRows = rows.filter(isRefundable);
  const refundedRows = rows.filter((r) => r.refundedAt != null);

  const isSelected = (id: string) => !deselected[id];
  const selectedIds = refundableRows.filter((r) => isSelected(r._id)).map((r) => r._id);
  const refundTotal = refundableRows
    .filter((r) => isSelected(r._id))
    .reduce((sum, r) => sum + r.unitPrice, 0);

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
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-base font-semibold text-text">Order Details</h2>

            {activeRows.length > 0 ? (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Active Items
                </h3>
                <ul className="mt-2 divide-y divide-border">
                  {activeRows.map((row) => (
                    <li
                      key={row._id}
                      className="flex items-center justify-between gap-3 py-2 text-sm text-text-muted"
                    >
                      <span>
                        {row.productName}
                        {row.standName ? (
                          <span className="text-text-muted"> · {row.standName}</span>
                        ) : null}
                      </span>
                      <span>EUR {formatMoney(row.unitPrice)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {refundableRows.length > 0 ? (
              <div className="mt-5 rounded-lg border border-danger/40 bg-danger/5 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-danger">
                  Cancelled — select to refund
                </h3>
                <ul className="mt-2 divide-y divide-danger/20">
                  {refundableRows.map((row) => (
                    <li key={row._id} className="flex items-center justify-between gap-3 py-2">
                      <label className="flex items-center gap-3 text-sm text-text">
                        <input
                          type="checkbox"
                          checked={isSelected(row._id)}
                          onChange={(e) =>
                            setDeselected((prev) => ({ ...prev, [row._id]: !e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                        />
                        <span>
                          {row.productName}
                          {row.standName ? (
                            <span className="text-text-muted"> · {row.standName}</span>
                          ) : null}
                        </span>
                      </label>
                      <span className="text-sm font-medium text-text">
                        EUR {formatMoney(row.unitPrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {refundedRows.length > 0 ? (
              <div className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Already Refunded
                </h3>
                <ul className="mt-2 divide-y divide-border">
                  {refundedRows.map((row) => (
                    <li
                      key={row._id}
                      className={cn(
                        'flex items-center justify-between gap-3 py-2 text-sm text-text-muted',
                      )}
                    >
                      <span className="flex items-center gap-2 line-through">
                        {row.productName}
                        {row.standName ? <span> · {row.standName}</span> : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success no-underline">
                          Refunded
                        </span>
                        EUR {formatMoney(row.unitPrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 space-y-1 text-xs text-text-muted">
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
