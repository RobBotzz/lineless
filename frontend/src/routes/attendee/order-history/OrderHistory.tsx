import { useParams, useLoaderData, Link } from 'react-router';

import { BackButton } from '@/components/shared';
import { paths } from '@/paths';
import { computeTotal, deriveOrderStatus, type Order } from '@/types/order';
import { formatMoney } from '@/types/product';
import { ChevronRightIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

export default function OrderHistory() {
  const { eventId } = useParams() as { eventId: string };
  const orders = useLoaderData() as Order[];

  if (orders.length === 0) {
    return (
      <div className="space-y-4">
        <BackButton to={paths.attendee.event(eventId)}>Shop</BackButton>
        <h1 className="text-lg font-semibold text-text">Order History</h1>
        <div className="rounded-lg bg-surface-muted p-4 text-center text-sm text-text-muted">
          No orders yet. When you place an order, it will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackButton to={paths.attendee.event(eventId)}>Shop</BackButton>
      <h1 className="text-lg font-semibold text-text">Order History</h1>

      <div className="space-y-3">
        {orders.map((order) => {
          const status = deriveOrderStatus(order);
          const statusLabel =
            status === 'in-preparation'
              ? 'In Preparation'
              : status === 'cancelled'
                ? 'Cancelled'
                : 'Fulfilled';
          const statusColor =
            status === 'in-preparation'
              ? 'bg-warning/10 text-warning border-warning/40'
              : status === 'cancelled'
                ? 'bg-danger/10 text-danger border-danger/40'
                : 'bg-success/5 text-success border-success/40';

          return (
            <Link
              key={order._id}
              to={`${paths.attendee.trackOrder(eventId, order._id)}?from=orders`}
              className="rounded-xl border border-border bg-surface shadow-sm px-6 py-4 flex items-center gap-4 hover:bg-surface-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-sm font-semibold text-accent">#{order.orderNumber}</p>
                  <span
                    className={cn(
                      'inline-block px-2 py-1 rounded text-xs font-medium border',
                      statusColor,
                    )}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="text-xs text-text-muted mb-2">
                  {new Date(order.createdAt).toLocaleDateString()} at{' '}
                  {new Date(order.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-sm font-semibold text-text">
                  EUR {formatMoney(computeTotal(order))}
                </p>
              </div>

              <ChevronRightIcon className="h-5 w-5 text-accent shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
