import { apiFetch, apiFetchAllowing } from './client';
import { getAttendeeStandProducts, getOperatorEventProducts } from './products';
import { getOperatorStands } from './stands';
import type { AttendeeOrder, Order, OrderItemView } from '../types/order';
import type { Stand } from '../types/stand';

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

export function cancelOrder(orderId: string): Promise<unknown> {
  return apiFetch<unknown>(`/orders/${orderId}/cancel`, {
    method: 'POST',
    auth: 'organizer',
  });
}

// Abandons an attendee order that is still gated behind a card top-up. The
// backend releases the pending hold and makes the tab orderable again.
export function cancelPendingOrderAuthorization(orderId: string, eventId: string): Promise<void> {
  return apiFetch<void>(`/orders/${orderId}/cancel-pending-authorization`, {
    method: 'POST',
    auth: 'attendee',
    eventId,
  });
}

export function cancelOrderItems(orderId: string, itemIds: string[]): Promise<unknown> {
  return apiFetch<unknown>(`/orders/${orderId}/items/cancel`, {
    method: 'POST',
    auth: 'organizer',
    body: JSON.stringify({ itemIds }),
  });
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
      standId: product?.standId ?? '',
      standName: product ? (standNameById.get(product.standId) ?? '') : '',
      unitPrice: item.priceIncludingTaxAtPurchase,
      quantity: 1,
      comments: [item.customerComment ?? ''],
    });
  }
  return [...groups.values()];
}

// Builds enriched view items for an attendee. Accepts the already-fetched stands
// list (from the caller's own query) to avoid a duplicate network request.
export async function buildAttendeeOrderViewItems(
  order: Order,
  eventId: string,
  stands: Stand[],
): Promise<OrderItemView[]> {
  const productLists = await Promise.all(
    stands.map((s) => getAttendeeStandProducts(eventId, s._id)),
  );

  const productById = new Map(productLists.flat().map((p) => [p._id, p]));
  const standNameById = new Map(stands.map((s) => [s._id, s.standName]));

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
    // Fall back to names already stored on the order item by the backend enrichment.
    // This handles paused stands, which are excluded from the attendee catalog but
    // whose orders must still display correctly.
    groups.set(item.productId, {
      productId: item.productId,
      productName: product?.productName ?? item.productName,
      standId: product?.standId ?? `__paused__:${item.standName}:${item.productId}`,
      standName: product ? (standNameById.get(product.standId) ?? item.standName) : item.standName,
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
export async function createManualOrder(
  input: { eventId: string; items: OrderItemView[] },
  standId: string,
): Promise<Order> {
  // POST /orders wraps the created order as { order }, so unwrap it here rather
  // than treating the body as the order itself.
  const { order } = await apiFetch<{ order: Order }>('/orders', {
    method: 'POST',
    auth: 'operator',
    standId,
    body: JSON.stringify({ eventId: input.eventId, items: flattenOrderItems(input.items) }),
  });
  return order;
}

// POST /api/orders — creates an order for the attendee's own cart (attendee session auth).
export async function createOrder(eventId: string, items: OrderItemView[]): Promise<Order> {
  // POST /orders wraps the created order as { order } (same shape createCardOrder
  // reads), so unwrap it here rather than treating the body as the order itself.
  const { order } = await apiFetch<{ order: Order }>('/orders', {
    method: 'POST',
    auth: 'attendee',
    eventId,
    body: JSON.stringify({ eventId, items: flattenOrderItems(items) }),
  });
  return order;
}

// Outcome of placing a card order against a tab. `created` means the order fit
// the existing authorized hold and is live. `authorizationRequired` means the
// order exceeded the hold: the backend already created it (gated) and minted a
// top-up PaymentIntent whose clientSecret must be confirmed to release it.
export type CardOrderResult =
  | { status: 'created'; order: Order }
  | { status: 'authorizationRequired'; clientSecret: string; orderId: string };

// POST /api/orders with a tabId — places a card order against an OPEN tab.
// A 402 is an expected branch (top-up needed), not an error, so we let the
// client resolve it and read the clientSecret from the body.
export async function createCardOrder(
  eventId: string,
  items: OrderItemView[],
  tabId: string,
): Promise<CardOrderResult> {
  const { status, data } = await apiFetchAllowing<{
    order?: Order;
    clientSecret?: string;
    orderId?: string;
  }>(
    '/orders',
    {
      method: 'POST',
      auth: 'attendee',
      eventId,
      body: JSON.stringify({ eventId, tabId, items: flattenOrderItems(items) }),
    },
    [402],
  );

  if (status === 402) {
    return {
      status: 'authorizationRequired',
      clientSecret: data.clientSecret as string,
      orderId: data.orderId as string,
    };
  }
  return { status: 'created', order: data.order as Order };
}

// GET /api/orders/:orderId — the attendee's own order by id. Items include
// productName + standName joined by the backend.
export function getAttendeeOrder(orderId: string, eventId: string): Promise<AttendeeOrder> {
  return apiFetch<AttendeeOrder>(`/orders/${orderId}`, { auth: 'attendee', eventId });
}

// GET /api/orders/cashier — unpaid orders for the cashier's event.
// The stand is derived from the operator token, so no standId needed in the URL.
export function getUnpaidOrders(standId: string): Promise<Order[]> {
  return apiFetch<Order[]>('/orders/cashier', { auth: 'operator', standId });
}

// DELETE /api/orders/cashier/:orderId — soft-delete an unpaid order.
// The order stays in MongoDB for analytics; it is excluded from the cashier list.
export function deleteUnpaidOrder(orderId: string, standId: string): Promise<void> {
  return apiFetch<void>(`/orders/cashier/${orderId}`, {
    method: 'DELETE',
    auth: 'operator',
    standId,
  });
}

export function confirmCashPayment(orderId: string, standId: string): Promise<void> {
  return apiFetch<void>(`/orders/${orderId}/cash-payment`, {
    method: 'POST',
    auth: 'operator',
    standId,
    // Send an empty JSON body so Express parses req.body to {} — the endpoint's
    // validateBody(z.object({})) rejects an undefined body (no body = no
    // Content-Type = unparsed) with "Validation failed".
    body: JSON.stringify({}),
  });
}

// GET /api/orders — attendee's order history (paid orders only).
export function getAttendeeOrders(eventId: string): Promise<Order[]> {
  return apiFetch<Order[]>('/orders', { auth: 'attendee', eventId });
}

// --- Cash refund API -----------------------------------------------------------

// GET /api/orders/cashier/refundable — cash-paid orders for the cashier's event
// that still have at least one refundable (cancelled, not-refunded) item.
export function getRefundableOrders(standId: string): Promise<Order[]> {
  return apiFetch<Order[]>('/orders/cashier/refundable', { auth: 'operator', standId });
}

// POST /api/orders/:orderId/refund — refund the given cancelled items in one go.
export function refundOrderItems(
  orderId: string,
  itemIds: string[],
  standId: string,
): Promise<Order> {
  return apiFetch<Order>(`/orders/${orderId}/refund`, {
    method: 'POST',
    auth: 'operator',
    standId,
    body: JSON.stringify({ itemIds }),
  });
}

// Live cash figures for the net-cash panel, all integer cents.
export interface CashSummary {
  cashSalesCents: number;
  cashRefundCents: number;
  netCashCents: number;
}

// GET /api/orders/cashier/cash-summary — one-shot snapshot for the net-cash panel.
export function getCashSummary(standId: string): Promise<CashSummary> {
  return apiFetch<CashSummary>('/orders/cashier/cash-summary', { auth: 'operator', standId });
}

// SSE path for live net-cash updates (see useSSE). Recomputes on every order change.
export const CASHIER_CASH_SUMMARY_STREAM_PATH = '/orders/cashier/cash-summary/stream';

// One display row per individual order item — unlike buildOrderViewItems this keeps
// cancelled/refunded items so the refund screen can show the whole order and offer
// the refundable items for selection by their real item ids.
export interface RefundItemRow {
  _id: string;
  productName: string;
  standName: string;
  unitPrice: number; // integer cents
  cancelledAt: string | null;
  refundedAt: string | null;
}

export async function buildRefundRows(
  order: Order,
  eventId: string,
  standId: string,
): Promise<RefundItemRow[]> {
  const [products, stands] = await Promise.all([
    getOperatorEventProducts(eventId, standId),
    getOperatorStands(eventId),
  ]);
  const productById = new Map(products.map((p) => [p._id, p]));
  const standNameById = new Map(stands.map((s) => [s._id, s.standName]));

  return order.items.map((item) => {
    const product = productById.get(item.productId);
    return {
      _id: item._id,
      productName: product?.productName ?? item.productName ?? item.productId,
      standName: product ? (standNameById.get(product.standId) ?? '') : '',
      unitPrice: item.priceIncludingTaxAtPurchase,
      cancelledAt: item.cancelledAt,
      refundedAt: item.refundedAt,
    };
  });
}
