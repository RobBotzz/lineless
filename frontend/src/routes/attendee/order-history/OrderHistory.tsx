import { useState } from 'react';
import { useParams, useLoaderData } from 'react-router';

import { BackButton } from '@/components/shared';
import { paths } from '@/paths';
import { computeTotal, deriveItemStatus, deriveOrderStatus, type Order } from '@/types/order';
import { formatMoney } from '@/types/product';
import { ChevronDownIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

export default function OrderHistory() {
  const { eventId } = useParams() as { eventId: string };
  const orders = useLoaderData() as Order[];
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  if (orders.length === 0) {
    return (
      <div className="space-y-4">
        <BackButton to={paths.attendee.event(eventId)}>Back</BackButton>
        <h1 className="text-lg font-semibold text-text">Order History</h1>
        <div className="rounded-lg bg-surface-muted p-4 text-center text-sm text-text-muted">
          No orders yet. When you place an order, it will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackButton to={paths.attendee.event(eventId)}>Back</BackButton>
      <h1 className="text-lg font-semibold text-text">Order History</h1>

      <div className="space-y-3">
        {orders.map((order) => {
          const isExpanded = expandedOrderId === order._id;
          const status = deriveOrderStatus(order);
          const statusLabel = status === 'in-preparation' ? 'In Preparation' : 'Fulfilled';
          const statusColor =
            status === 'in-preparation'
              ? 'bg-warning/10 text-warning border-warning/40'
              : 'bg-success/5 text-success border-success/40';

          return (
            <div key={order._id} className="rounded-xl border border-border bg-surface shadow-sm">
              <button
                onClick={() => toggleExpand(order._id)}
                className="w-full px-6 py-4 text-left hover:bg-surface-muted/50 transition-colors flex items-center justify-between gap-4"
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
                <ChevronDownIcon
                  className={cn(
                    'h-5 w-5 text-text-muted shrink-0 transition-transform',
                    isExpanded && 'rotate-180',
                  )}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-border px-6 py-4 space-y-4 bg-surface-muted/30">
                  {/* Order meta */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-surface border border-border p-3">
                      <p className="text-xs text-text-muted">Order Number</p>
                      <p className="mt-1 text-sm font-semibold text-accent">{order.orderNumber}</p>
                    </div>
                    <div className="rounded-lg bg-surface border border-border p-3">
                      <p className="text-xs text-text-muted">Pickup Code</p>
                      <p className="mt-1 text-sm font-semibold text-success">{order.pickupCode}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="rounded-lg bg-surface border border-border p-4">
                    <p className="text-sm font-semibold text-text mb-3">Items</p>
                    <ul className="space-y-3">
                      {order.items.map((item) => {
                        if (item.cancelledAt) return null;
                        const itemStatus = deriveItemStatus(item);
                        return (
                          <li
                            key={item._id}
                            className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-text">
                                Product {item.productId}
                              </p>
                              <p className="text-xs text-text-muted">
                                EUR {formatMoney(item.priceIncludingTaxAtPurchase)}
                              </p>
                              {item.customerComment && (
                                <p className="text-xs text-text-muted italic mt-1">
                                  Note: {item.customerComment}
                                </p>
                              )}
                            </div>
                            {status === 'in-preparation' && (
                              <span className="text-xs font-medium text-text-muted px-2 py-1 bg-surface rounded whitespace-nowrap">
                                {itemStatus}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Payment summary placeholder */}
                  <div className="rounded-lg bg-surface border border-border p-4">
                    <p className="text-sm font-semibold text-text mb-2">Payment Summary</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-muted">Total Amount</span>
                      <span className="text-base font-bold text-accent">
                        EUR {formatMoney(computeTotal(order))}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-3 italic">
                      Payment details coming soon
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
