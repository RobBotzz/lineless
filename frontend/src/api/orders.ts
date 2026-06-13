// Order API — wired to the backend where endpoints exist.
//
// NOT YET IN BACKEND (no endpoint):
//   getUnpaidOrders   — GET /api/stands/:standId/orders exists but returns PAID orders only
//   confirmCashPayment — needs POST /api/orders/:orderId/cash-payment (payments module)
import { apiFetch } from './client';
import { getCredential } from '../auth/keychain';
import { getOperatorStandProducts } from './products';
import { getOperatorStand } from './stands';
import type { Order, OrderItemView } from '../types/order';

// The cashier always operates for the stand the operator is logged into.
function currentStandId(): string {
  const cred = getCredential('operator');
  return Object.keys(cred?.stands ?? {})[0] ?? '';
}

// In-session cache of enriched view items built by createManualOrder.
// For orders not in this cache, buildOrderViewItems falls back to a products fetch.
const viewItemCache = new Map<string, OrderItemView[]>();

// orderId must be the UUID _id, not the human-readable orderNumber.
export function getOrder(orderId: string): Promise<Order> {
  return apiFetch<Order>(`/orders/${orderId}`, {
    auth: 'operator',
    standId: currentStandId(),
  });
}

// Builds enriched view items for display. Fast path reads from the in-session
// cache (set by createManualOrder) — no extra network call needed for that case.
export async function buildOrderViewItems(order: Order): Promise<OrderItemView[]> {
  const cached = viewItemCache.get(order._id);
  if (cached) return cached;

  const [products, stand] = await Promise.all([
    getOperatorStandProducts(order.standId),
    getOperatorStand(order.standId),
  ]);
  const productById = new Map(products.map((p) => [p._id, p]));

  // Group flat items by productId — each backend item is exactly one unit.
  // Exclude cancelled items.
  const groups = new Map<string, { unitPrice: number; comments: string[] }>();
  for (const item of order.items) {
    if (item.cancelledAt) continue;
    const existing = groups.get(item.productId);
    if (existing) {
      existing.comments.push(item.customerComment ?? '');
    } else {
      groups.set(item.productId, {
        unitPrice: item.priceIncludingTaxAtPurchase,
        comments: [item.customerComment ?? ''],
      });
    }
  }

  return [...groups.entries()].map(([productId, { unitPrice, comments }]) => ({
    productId,
    productName: productById.get(productId)?.productName ?? productId,
    standName: stand.standName,
    unitPrice,
    quantity: comments.length,
    ...(comments.some(Boolean) ? { comments } : {}),
  }));
}

// POST /api/orders — creates a cashier order (operator auth, no attendee session).
export async function createManualOrder(input: { items: OrderItemView[] }): Promise<Order> {
  const standId = currentStandId();

  // Each cart line becomes N individual items (one per unit), carrying its comment.
  const flatItems = input.items.flatMap((view) =>
    Array.from({ length: view.quantity }, (_, i) => ({
      productId: view.productId,
      ...(view.comments?.[i] ? { customerComment: view.comments[i] } : {}),
    })),
  );

  const order = await apiFetch<Order>('/orders', {
    method: 'POST',
    auth: 'operator',
    standId,
    body: JSON.stringify({ standId, items: flatItems }),
  });

  // Cache enriched items — the backend response has no product names.
  viewItemCache.set(order._id, input.items);
  return order;
}

// TODO: needs GET /api/stands/:standId/orders?paidAt=null — endpoint not yet available.
export function getUnpaidOrders(): Promise<Order[]> {
  return Promise.resolve([]);
}

// TODO: needs POST /api/orders/:orderId/cash-payment — payments module not yet available.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function confirmCashPayment(_orderId: string): Promise<Order> {
  return Promise.reject(
    new Error('Cash payment confirmation is not yet available in the backend.'),
  );
}
