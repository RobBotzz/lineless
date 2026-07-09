import type { OrderItem, OrderItemView } from '../types/order';

export type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED';

// A stable, order-independent signature of a set of order items — used to key
// idempotency requests so array/object key reordering doesn't change the
// fingerprint (unlike JSON.stringify, which is key-order-dependent).
export function orderItemsFingerprint(items: OrderItemView[]): string {
  return items
    .map((item) => `${item.productId}:${item.quantity}:${item.comments.join('|')}`)
    .sort()
    .join(';');
}

// Derives the current status of an order item from its timestamp fields.
// Priority mirrors the backend state machine: REFUNDED > CANCELLED > FULFILLED > READY > PREPARING > PENDING.
export function getItemStatus(item: OrderItem): ItemStatus {
  if (item.cancelledAt) return item.refundedAt ? 'REFUNDED' : 'CANCELLED';
  if (item.fulfilledAt) return 'FULFILLED';
  if (item.readyAt) return 'READY';
  if (item.startedAt) return 'PREPARING';
  return 'PENDING';
}
