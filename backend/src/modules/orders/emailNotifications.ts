import { config } from "../../config/config";
import {
  sendOrderConfirmedEmail,
  sendOrderCreatedEmail,
} from "../../lib/email/mailer";
import type { OrderEmailStandGroup } from "../../lib/email/templates/orderEmailShared";
import { Event } from "../events/model";
import { Product } from "../products/model";
import { Stand } from "../stands/model";
import type { OrderDoc } from "./model";

// Order lifecycle notifications to the attendee. Every entry point here is
// fire-and-forget-safe: it resolves its own data, catches its own failures and
// only logs them — a broken mail must never break an order flow. Callers just
// `void notifyX(order)` after their transaction has committed (never inside a
// transaction: withTransaction may retry, which would duplicate mails).

type OrderEmailPayload = {
  eventName: string;
  stands: OrderEmailStandGroup[];
  totalCents: number;
  trackOrderUrl: string;
};

// Email clients need absolute image URLs; uploaded images are stored as
// paths relative to our own origin.
function toAbsoluteImageUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${config.appBaseUrl}${url}`;
}

// Loads the event, product and stand context for an order and aggregates its
// per-unit items into quantity rows grouped by stand — the same "Products by
// Stand" shape the attendee webview renders. Cancelled items are excluded.
async function buildOrderEmailPayload(
  order: OrderDoc
): Promise<OrderEmailPayload | null> {
  const items = order.items.filter((item) => !item.cancelledAt);
  if (items.length === 0) return null;

  const productIds = [...new Set(items.map((item) => item.productId))];
  const [event, products] = await Promise.all([
    Event.findById(order.eventId).select("name").lean(),
    // No deletedAt filter: a product deleted after ordering must still be
    // named in the mail for the order as it was placed.
    Product.find({ _id: { $in: productIds } })
      .select("productName productImageUrl standId")
      .lean(),
  ]);
  if (!event) return null;

  const productById = new Map(products.map((p) => [p._id, p]));
  const standIds = [...new Set(products.map((p) => p.standId))];
  const stands = await Stand.find({ _id: { $in: standIds } })
    .select("standName")
    .lean();
  const standNameById = new Map(stands.map((s) => [s._id, s.standName]));

  const rowsByStand = new Map<
    string,
    Map<string, OrderEmailStandGroup["items"][number]>
  >();
  let totalCents = 0;
  for (const item of items) {
    totalCents += item.priceIncludingTaxAtPurchase;
    const product = productById.get(item.productId);
    if (!product) continue;
    const standRows =
      rowsByStand.get(product.standId) ?? new Map<string, never>();
    const row = standRows.get(item.productId) ?? {
      name: product.productName,
      quantity: 0,
      unitPriceCents: item.priceIncludingTaxAtPurchase,
      imageUrl: toAbsoluteImageUrl(product.productImageUrl),
    };
    row.quantity += 1;
    standRows.set(item.productId, row);
    rowsByStand.set(product.standId, standRows);
  }

  return {
    eventName: event.name,
    stands: [...rowsByStand.entries()].map(([standId, rows]) => ({
      standName: standNameById.get(standId) ?? "Stand",
      items: [...rows.values()],
    })),
    totalCents,
    trackOrderUrl: `${config.appBaseUrl}/event/${order.eventId}/orders/${order._id}`,
  };
}

/** "Order placed, please pay at the cashier" — for unpaid cash orders. */
export async function notifyOrderCreated(order: OrderDoc): Promise<void> {
  if (!order.customerEmail) return;
  try {
    const payload = await buildOrderEmailPayload(order);
    if (!payload) return;
    await sendOrderCreatedEmail({
      to: order.customerEmail,
      orderNumber: order.orderNumber,
      ...payload,
    });
  } catch (err) {
    console.error("Order-created email failed:", err);
  }
}

/** "Order paid, here is your pickup code" — on every unpaid→paid transition. */
export async function notifyOrderPaid(order: OrderDoc): Promise<void> {
  if (!order.customerEmail) return;
  try {
    const payload = await buildOrderEmailPayload(order);
    if (!payload) return;
    await sendOrderConfirmedEmail({
      to: order.customerEmail,
      orderNumber: order.orderNumber,
      pickupCode: order.pickupCode,
      ...payload,
    });
  } catch (err) {
    console.error("Order-confirmed email failed:", err);
  }
}
