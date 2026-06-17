import type { OrderItem } from '../types/order';

export type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'FULFILLED' | 'CANCELLED';

// Derives the current status of an order item from its timestamp fields.
// Priority mirrors the backend state machine: CANCELLED > FULFILLED > READY > PREPARING > PENDING.
export function getItemStatus(item: OrderItem): ItemStatus {
  if (item.cancelledAt) return 'CANCELLED';
  if (item.fulfilledAt) return 'FULFILLED';
  if (item.readyAt) return 'READY';
  if (item.startedAt) return 'PREPARING';
  return 'PENDING';
}
