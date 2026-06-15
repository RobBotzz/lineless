import { Link, useLoaderData, useParams, useRouteError } from 'react-router';

import { BackButton } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import { paths } from '@/paths';
import type { Order } from '@/types/order';
import type { orderHistoryLoader } from './data';

// The distinct products in an order that have at least one fulfilled item — i.e.
// the products this order is eligible to review (one review per order+product).
function reviewableProductIds(order: Order): string[] {
  const ids = order.items.filter((item) => item.fulfilledAt !== null).map((item) => item.productId);
  return [...new Set(ids)];
}

export default function OrderHistory() {
  const { event, orders, productNames } = useLoaderData<typeof orderHistoryLoader>();
  const { eventId } = useParams();

  return (
    <div className="space-y-4">
      <BackButton to={eventId ? paths.attendee.event(eventId) : paths.home}>Back</BackButton>

      <h1 className="text-lg font-semibold text-text">Your Orders</h1>

      {orders.length === 0 ? (
        <p className="rounded-lg bg-surface-muted p-4 text-center text-sm text-text-muted">
          You have no orders yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const reviewable = reviewableProductIds(order);
            return (
              <li
                key={order._id}
                className="space-y-2 rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text">Order {order.orderNumber}</span>
                  <span className="text-xs text-text-muted">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {reviewable.length === 0 ? (
                  <p className="text-sm text-text-muted">No items handed out yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {reviewable.map((productId) => (
                      <li key={productId} className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-text">
                          {productNames[productId] ?? 'Product'}
                        </span>
                        {event.ratingsEnabled && eventId && (
                          <Link
                            to={paths.attendee.review(eventId, order._id, productId)}
                            className={`${buttonVariants({ variant: 'outline', size: 'sm' })} shrink-0`}
                          >
                            Leave review
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function OrderHistoryError() {
  const error = useRouteError();
  const message =
    error instanceof Error ? error.message : 'Your orders could not be loaded right now.';
  return (
    <div className="py-16 text-center">
      <h1 className="text-lg font-semibold text-text">Orders unavailable</h1>
      <p className="mt-2 text-sm text-text-muted">{message}</p>
    </div>
  );
}
