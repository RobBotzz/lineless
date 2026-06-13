// Order API for the cashier. The cashier always acts as its event's CASHIER
// stand; callers pass that standId (resolved by CashierLayout) for operator auth.
import { apiFetch } from './client';
import { getOperatorEventProducts } from './products';
import { getOperatorStands } from './stands';
import type { Order, OrderItemView } from '../types/order';

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

// POST /api/orders — creates a cashier order (operator auth, no attendee session).
export async function createManualOrder(
  input: { eventId: string; items: OrderItemView[] },
  standId: string,
): Promise<Order> {
  // Each cart line becomes N individual items (one per unit), carrying its comment.
  const flatItems = input.items.flatMap((view) =>
    Array.from({ length: view.quantity }, (_, i) => ({
      productId: view.productId,
      ...(view.comments[i] ? { customerComment: view.comments[i] } : {}),
    })),
  );

  return apiFetch<Order>('/orders', {
    method: 'POST',
    auth: 'operator',
    standId,
    body: JSON.stringify({ eventId: input.eventId, items: flatItems }),
  });
}

// GET /api/stands/:standId/orders — unpaid orders for the cashier's event.
export function getUnpaidOrders(standId: string): Promise<Order[]> {
  return apiFetch<Order[]>(`/stands/${standId}/orders`, { auth: 'operator', standId });
}

// Mocked: the real POST /api/orders/:orderId/cash-payment (mark paid + release
// instant items) lands in a follow-up MR — payments are out of scope here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function confirmCashPayment(_orderId: string): Promise<void> {
  return Promise.resolve();
}
