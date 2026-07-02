// Mirrors AttendeeOrderItem from backend (modules/orders/service.ts).
export interface OrderItem {
  _id: string;
  productId: string;
  productName: string;
  standName: string;
  customerComment: string | null; // single note per unit; null when none
  priceIncludingTaxAtPurchase: number; // integer cents, incl. tax
  taxRateAtPurchase: number; // basis points, e.g. 1900 for 19%
  startedAt: string | null;
  readyAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
}

// Mirrors OrderDoc from backend (modules/orders/model.ts).
export interface Order {
  _id: string; // UUID — used in all API calls
  eventId: string;
  tabId: string | null;
  sessionId: string | null;
  orderNumber: string; // human-readable display ID, e.g. "A001"
  pickupCode: string; // 4-char hex pickup code shown to the customer
  customerEmail: string | null;
  paidAt: string | null; // null = unpaid; non-null = paid
  deletedAt: string | null; // set only when a cashier cancels an unpaid cash order
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

// Total in integer cents — not stored by the backend, derived from items.
// Excludes cancelled items.
export function computeTotal(order: Order): number {
  return order.items
    .filter((item) => !item.cancelledAt)
    .reduce((sum, item) => sum + item.priceIncludingTaxAtPurchase, 0);
}

// Attendee-specific enriched order — the backend joins productName + standName
// onto each item so the frontend never has to fetch the product catalog.
export interface AttendeeOrderItem extends OrderItem {
  productName: string;
  standName: string;
}

export type AttendeeOrder = Omit<Order, 'items'> & { items: AttendeeOrderItem[] };

// Enriched view type for display. Backend items are flat (one per unit); callers
// group by productId and join product/stand names before passing here.
export interface OrderItemView {
  productId: string;
  productName: string;
  standId: string;
  standName: string;
  unitPrice: number; // integer cents (priceIncludingTaxAtPurchase)
  quantity: number;
  comments: string[]; // per-unit; index i = comment for unit #(i+1), '' if none
}

// Derive order status: fulfilled only if all non-cancelled items are fulfilled.
export function deriveOrderStatus(order: Order): 'in-preparation' | 'fulfilled' | 'cancelled' {
  const nonCancelledItems = order.items.filter((item) => !item.cancelledAt);
  if (nonCancelledItems.length === 0) return 'cancelled';
  const allFulfilled = nonCancelledItems.every((item) => item.fulfilledAt);
  return allFulfilled ? 'fulfilled' : 'in-preparation';
}

export type OrderListStatus = 'pending-payment' | 'in-preparation' | 'fulfilled' | 'cancelled';

// Payment-aware status for the order-history list, which now includes unpaid cash
// orders. A cashier-cancelled cash order (deletedAt) or an all-items-cancelled
// order is 'cancelled'; an unpaid order awaiting the cashier is 'pending-payment';
// otherwise it follows the preparation-tracking status.
export function deriveOrderListStatus(order: Order): OrderListStatus {
  if (order.deletedAt) return 'cancelled';
  if (!order.paidAt) return 'pending-payment';
  return deriveOrderStatus(order);
}
