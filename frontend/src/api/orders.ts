import { ApiError, apiFetch, apiFetchAllowing } from './client';
import { getAttendeeStandProducts, getOperatorEventProducts } from './products';
import { getOperatorStands } from './stands';
import type { AttendeeOrder, Order, OrderItemView, StockShortage } from '../types/order';
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

interface InsufficientStockResponse {
  code: 'INSUFFICIENT_STOCK';
  error: string;
  shortages: StockShortage[];
}

export class InsufficientStockError extends ApiError {
  readonly shortages: StockShortage[];

  constructor(shortages: StockShortage[]) {
    super(409, 'Some products no longer have enough stock', {
      code: 'INSUFFICIENT_STOCK',
      shortages,
    });
    this.name = 'InsufficientStockError';
    this.shortages = shortages;
  }
}

function throwIfStockConflict(status: number, data: unknown): void {
  if (status !== 409 || !data || typeof data !== 'object') return;
  const response = data as Partial<InsufficientStockResponse>;
  if (response.code === 'INSUFFICIENT_STOCK' && Array.isArray(response.shortages)) {
    throw new InsufficientStockError(response.shortages);
  }
}

function unexpectedOrderResponse(status: number, data: unknown): ApiError {
  let message = `Unexpected order response (${status})`;
  if (data && typeof data === 'object') {
    const response = data as Record<string, unknown>;
    if (typeof response.error === 'string') message = response.error;
    else if (typeof response.message === 'string') message = response.message;
  }
  return new ApiError(status, message, data);
}

function createdOrderFromResponse(status: number, data: unknown): Order {
  if (status === 201 && data && typeof data === 'object') {
    const order = (data as Record<string, unknown>).order;
    if (order && typeof order === 'object') return order as Order;
  }
  throw unexpectedOrderResponse(status, data);
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
  requestId: string,
): Promise<Order> {
  // POST /orders wraps the created order as { order }, so unwrap it here rather
  // than treating the body as the order itself.
  const { status, data } = await apiFetchAllowing<{ order?: Order } | InsufficientStockResponse>(
    '/orders',
    {
      method: 'POST',
      auth: 'operator',
      standId,
      body: JSON.stringify({
        eventId: input.eventId,
        requestId,
        items: flattenOrderItems(input.items),
      }),
    },
    [409],
  );
  throwIfStockConflict(status, data);
  return createdOrderFromResponse(status, data);
}

// POST /api/orders — creates an order for the attendee's own cart (attendee session auth).
export async function createOrder(
  eventId: string,
  items: OrderItemView[],
  requestId: string,
): Promise<Order> {
  // POST /orders wraps the created order as { order } (same shape createCardOrder
  // reads), so unwrap it here rather than treating the body as the order itself.
  const { status, data } = await apiFetchAllowing<{ order?: Order } | InsufficientStockResponse>(
    '/orders',
    {
      method: 'POST',
      auth: 'attendee',
      eventId,
      body: JSON.stringify({ eventId, requestId, items: flattenOrderItems(items) }),
    },
    [409],
  );
  throwIfStockConflict(status, data);
  return createdOrderFromResponse(status, data);
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
  requestId: string,
  signal?: AbortSignal,
): Promise<CardOrderResult> {
  const { status, data } = await apiFetchAllowing<
    { order?: Order; clientSecret?: string; orderId?: string } | InsufficientStockResponse
  >(
    '/orders',
    {
      method: 'POST',
      auth: 'attendee',
      eventId,
      signal,
      body: JSON.stringify({ eventId, tabId, requestId, items: flattenOrderItems(items) }),
    },
    [402, 409],
  );

  throwIfStockConflict(status, data);

  if (status === 402) {
    const payment = data as { clientSecret?: string; orderId?: string };
    if (typeof payment.clientSecret !== 'string' || typeof payment.orderId !== 'string') {
      throw unexpectedOrderResponse(status, data);
    }
    return {
      status: 'authorizationRequired',
      clientSecret: payment.clientSecret,
      orderId: payment.orderId,
    };
  }
  return { status: 'created', order: createdOrderFromResponse(status, data) };
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
