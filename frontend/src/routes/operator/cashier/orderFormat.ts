import type { Order } from '../../../types/order';

// Time-of-day for an order timestamp, e.g. "10:11:15 PM".
export function formatOrderTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

// Date + time for an order timestamp, e.g. "10:11:15 PM - 5/17/2026".
export function formatOrderDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleTimeString()} - ${date.toLocaleDateString()}`;
}

// Total unit count — backend items are flat (one entry per unit).
export function itemCount(order: Order): number {
  return order.items.length;
}
