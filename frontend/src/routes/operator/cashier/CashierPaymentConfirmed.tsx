import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { CheckCircleIcon, StandIcon } from '../../../components/icons';
import { BackButton } from '../../../components/shared';
import { buttonVariants } from '../../../components/ui/button';
import { getOrder } from '../../../api/orders';
import type { Order, OrderItem } from '../../../types/order';
import { formatMoney } from '../../../types/product';
import { paths } from '../../../paths';

const FALLBACK_EVENT_ID = 'demo-event';

// Group an order's items by stand name, preserving first-seen order.
function groupByStand(items: OrderItem[]): [string, OrderItem[]][] {
  const groups = new Map<string, OrderItem[]>();
  for (const item of items) {
    const existing = groups.get(item.standName);
    if (existing) existing.push(item);
    else groups.set(item.standName, [item]);
  }
  return [...groups.entries()];
}

// Confirmation screen shown after a cash payment succeeds.
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
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.cashier(eventId)}>Back to Cashier Stand</BackButton>

      {isLoading ? (
        <p className="mt-10 text-center text-sm text-text-muted">Loading order…</p>
      ) : !order ? (
        <p className="mt-10 text-center text-sm text-text-muted">
          Order &quot;{orderId}&quot; could not be found.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-success/40 bg-success/5 p-8 text-center">
            <CheckCircleIcon className="h-12 w-12 text-success" />
            <h2 className="text-xl font-semibold text-text">Payment Successful!</h2>
            <p className="text-sm text-text-muted">
              The order has been paid and is being processed.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs text-text-muted">Order ID</p>
              <p className="mt-1 text-lg font-semibold text-accent">{order.orderId}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs text-text-muted">Authentication ID</p>
              <p className="mt-1 text-lg font-semibold text-success">{order.authenticationId}</p>
            </div>
          </div>

          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-2 text-text">
              <StandIcon className="h-5 w-5" />
              <h3 className="font-semibold">Products by Stand</h3>
            </div>

            <div className="mt-4 space-y-5">
              {groupByStand(order.items).map(([standName, items]) => (
                <div key={standName} className="border-l-2 border-accent pl-4">
                  <p className="text-sm font-semibold text-text">{standName}</p>
                  <ul className="mt-2 space-y-2">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text">{item.productName}</p>
                          <p className="text-xs text-text-muted">Quantity: {item.quantity}</p>
                          {item.comment ? (
                            <p className="mt-1 text-xs text-text-muted italic">“{item.comment}”</p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-accent">
                            EUR {formatMoney(item.unitPrice * item.quantity)}
                          </p>
                          <p className="text-xs text-text-muted">
                            EUR {formatMoney(item.unitPrice)} / pc
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-6 py-4 shadow-sm">
            <span className="text-sm font-medium text-text-muted">Total Amount</span>
            <span className="text-xl font-bold text-accent">EUR {formatMoney(order.total)}</span>
          </div>

          <div className="flex justify-end">
            <Link to={paths.operator.cashier(eventId)} className={buttonVariants({ size: 'sm' })}>
              Back to Cashier Stand
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
