import { apiFetch } from './client';
import { getOperatorEventProducts } from './products';
import { getOperatorStands } from './stands';
import type { Order, OrderItemView } from '../types/order';

// Order item state machine: PENDING -> PREPARING -> READY -> FULFILLED.
// These transitions are operator-only (authOperator on the backend) and each
// persists server-side; the operator board's SSE stream then re-pushes the
// resulting board, so callers do not merge the response into local state.
type ItemTransition = 'start' | 'ready' | 'fulfill';

function transitionItem(
  orderId: string,
  itemId: string,
  action: ItemTransition,
  standId: string,
): Promise<void> {
  return apiFetch<void>(`/orders/${orderId}/items/${itemId}/${action}`, {
    method: 'POST',
    auth: 'operator',
    standId,
  });
}

// PENDING -> PREPARING
export function startOrderItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'start', standId);
}

// PREPARING -> READY
export function readyOrderItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'ready', standId);
}

// READY -> FULFILLED (handed to the customer; leaves the board)
export function fulfillOrderItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'fulfill', standId);
}

// --- Cashier order API ---------------------------------------------------------
// The cashier always acts as its event's CASHIER stand; callers pass that standId
// (resolved by CashierLayout) for operator auth.

// orderId must be the UUID _id, not the human-readable orderNumber.
export function getOrder(orderId: string, standId: string): Promise<Order> {
  return apiFetch<Order>(`/orders/${orderId}`, { auth: 'operator', standId });
}

// Builds enriched view items for display. The cashier spans the whole event, so
// names are resolved from the event-wide catalog and stand list rather than a
// single stand (an order's items may come from several stands).
export async function buildOrderViewItems(
  order: Order,
  eventId: string,
  standId: string,
): Promise<OrderItemView[]> {
  const [products, stands] = await Promise.all([
    getOperatorEventProducts(eventId, standId),
    getOperatorStands(eventId),
  ]);
  const productById = new Map(products.map((p) => [p._id, p]));
  const standNameById = new Map(stands.map((s) => [s._id, s.standName]));

  // Group the flat backend items (one per unit, cancelled excluded) by product.
  const groups = new Map<string, OrderItemView>();
  for (const item of order.items) {
    if (item.cancelledAt) continue;
    const existing = groups.get(item.productId);
    if (existing) {
      existing.quantity += 1;
      existing.comments.push(item.customerComment ?? '');
      continue;
    }
    const product = productById.get(item.productId);
    groups.set(item.productId, {
      productId: item.productId,
      productName: product?.productName ?? item.productId,
      standName: product ? (standNameById.get(product.standId) ?? '') : '',
      unitPrice: item.priceIncludingTaxAtPurchase,
      quantity: 1,
      comments: [item.customerComment ?? ''],
    });
  }
  return [...groups.values()];
}

// Each cart line becomes N individual items (one per unit), carrying its comment.
function flattenOrderItems(items: OrderItemView[]) {
  return items.flatMap((view) =>
    Array.from({ length: view.quantity }, (_, i) => ({
      productId: view.productId,
      ...(view.comments[i] ? { customerComment: view.comments[i] } : {}),
    })),
  );
}

// POST /api/orders — creates a cashier order (operator auth, no attendee session).
export function createManualOrder(
  input: { eventId: string; items: OrderItemView[] },
  standId: string,
): Promise<Order> {
  return apiFetch<Order>('/orders', {
    method: 'POST',
    auth: 'operator',
    standId,
    body: JSON.stringify({ eventId: input.eventId, items: flattenOrderItems(input.items) }),
  });
}

// POST /api/orders — creates an order for the attendee's own cart (attendee session auth).
export function createOrder(eventId: string, items: OrderItemView[]): Promise<Order> {
  return apiFetch<Order>('/orders', {
    method: 'POST',
    auth: 'attendee',
    eventId,
    body: JSON.stringify({ eventId, items: flattenOrderItems(items) }),
  });
}

// GET /api/orders/cashier — unpaid orders for the cashier's event.
// The stand is derived from the operator token, so no standId needed in the URL.
export function getUnpaidOrders(standId: string): Promise<Order[]> {
  return apiFetch<Order[]>('/orders/cashier', { auth: 'operator', standId });
}

// Mocked: the real POST /api/orders/:orderId/cash-payment (mark paid + release
// instant items) lands in a follow-up MR — payments are out of scope here.
export function confirmCashPayment(_orderId: string): Promise<void> {
  return Promise.resolve();
}
