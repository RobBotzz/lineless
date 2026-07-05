import type { RefundItemRow } from '@/api/orders';
import type { Order } from '@/types/order';
import { formatMoney } from '@/types/product';
import { cn } from '@/lib/utils';

import { formatOrderDateTime } from './orderFormat';

function isRefundable(row: RefundItemRow): boolean {
  return row.cancelledAt != null && row.refundedAt == null;
}

interface OrderDetailsSectionProps {
  order: Pick<Order, 'orderNumber' | 'createdAt'>;
  rows: RefundItemRow[];
}

// Plain, no-image order item list grouped into Active / To-be-refunded /
// Already-refunded buckets. Shared by the cashier refund details page and the
// refund confirmation page, so both show the same item breakdown.
export function OrderDetailsSection({ order, rows }: OrderDetailsSectionProps) {
  const activeRows = rows.filter((r) => r.cancelledAt == null);
  const refundableRows = rows.filter(isRefundable);
  const refundedRows = rows.filter((r) => r.refundedAt != null);

  return (
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
            Cancelled — to be refunded
          </h3>
          <ul className="mt-2 divide-y divide-danger/20">
            {refundableRows.map((row) => (
              <li key={row._id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-text">
                  {row.productName}
                  {row.standName ? (
                    <span className="text-text-muted"> · {row.standName}</span>
                  ) : null}
                </span>
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
  );
}
