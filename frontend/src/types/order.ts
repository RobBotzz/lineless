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

export type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'FULFILLED' | 'CANCELLED';

// Derive item state from timestamps (most recent non-null determines state).
export function deriveItemStatus(item: OrderItem): ItemStatus {
  if (item.cancelledAt) return 'CANCELLED';
  if (item.fulfilledAt) return 'FULFILLED';
  if (item.readyAt) return 'READY';
  if (item.startedAt) return 'PREPARING';
  return 'PENDING';
}

// Derive order status: fulfilled only if all non-cancelled items are fulfilled.
export function deriveOrderStatus(order: Order): 'in-preparation' | 'fulfilled' | 'cancelled' {
  const nonCancelledItems = order.items.filter((item) => !item.cancelledAt);
  if (nonCancelledItems.length === 0) return 'cancelled';
  const allFulfilled = nonCancelledItems.every((item) => item.fulfilledAt);
  return allFulfilled ? 'fulfilled' : 'in-preparation';
}
