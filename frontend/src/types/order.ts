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
  refundedAt: string | null; // set once a cancelled item has been refunded
  inventoryState: 'UNTRACKED' | 'RESERVED' | 'CONSUMED' | 'RELEASED';
}

// Mirrors OrderDoc from backend (modules/orders/model.ts).
export interface Order {
  _id: string; // UUID — used in all API calls
  eventId: string;
  tabId: string | null;
  sessionId: string | null;
  requestId: string | null;
  orderNumber: string; // human-readable display ID, e.g. "A001"
  pickupCode: string; // 4-char hex pickup code shown to the customer
  customerEmail: string | null;
  paidAt: string | null; // null = unpaid; non-null = paid
  deletedAt: string | null; // set only when a cashier cancels an unpaid cash order
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StockShortage {
  productId: string;
  requested: number;
  available: number;
}

// Total in integer cents — not stored by the backend, derived from items.
// Excludes cancelled items.
export function computeTotal(order: Order): number {
  return order.items
    .filter((item) => !item.cancelledAt)
    .reduce((sum, item) => sum + item.priceIncludingTaxAtPurchase, 0);
}

// An item is refundable when it was cancelled but not yet refunded.
export function isRefundableItem(item: OrderItem): boolean {
  return item.cancelledAt != null && item.refundedAt == null;
}

// Total in integer cents of all still-refundable (cancelled, not-refunded) items.
export function computeRefundableTotal(order: Order): number {
  return order.items
    .filter(isRefundableItem)
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

export type OrderListStatus =
  | 'pending-payment'
  | 'in-preparation'
  | 'fulfilled'
  | 'cancelled'
  | 'refunded';

// A terminally cancelled order: either the cashier soft-deleted an unpaid order
// (deletedAt), or every item was cancelled — e.g. when the event is completed and
// unpaid cash orders are voided item-by-item without a deletedAt. Both mean there
// is nothing left to pay for, so no pay prompt should ever be shown.
export function isOrderCancelled(order: Order): boolean {
  if (order.deletedAt) return true;
  return order.items.length > 0 && order.items.every((item) => item.cancelledAt);
}

// A paid order whose every item was cancelled — i.e. fully refunded (the cancelled
// items are refundable at the cashier). Distinct from 'cancelled', which is an
// unpaid order voided before any money changed hands, so the attendee sees the
// same refund wording the cashier does.
export function isOrderRefunded(order: Order): boolean {
  return (
    order.paidAt != null && order.items.length > 0 && order.items.every((item) => item.cancelledAt)
  );
}

// Payment-aware status for the order-history list, which now includes unpaid cash
// orders. A paid, fully-cancelled order is 'refunded'; a cashier-cancelled cash
// order (deletedAt) or an unpaid all-items-cancelled order is 'cancelled'; an unpaid
// order awaiting the cashier is 'pending-payment'; otherwise it follows the
// preparation-tracking status.
export function deriveOrderListStatus(order: Order): OrderListStatus {
  // Refunded must be checked before cancelled (a refunded order is also fully
  // cancelled) and before the unpaid guard, so a paid+cancelled order never reads
  // 'Cancelled' or shows a €0.00 pay prompt for an order with nothing to pay for.
  if (isOrderRefunded(order)) return 'refunded';
  if (isOrderCancelled(order)) return 'cancelled';
  if (!order.paidAt) return 'pending-payment';
  return deriveOrderStatus(order);
}
