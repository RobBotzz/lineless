import type { ClientSession } from "mongoose";
import { TabPayment } from "../payments/model";
import { Order } from "./model";

const AUTHORIZED_PAYMENT_STATUSES = ["AUTHORIZED", "CAPTURED"] as const;

export async function getAuthorizedTabCents(
  tabId: string,
  session?: ClientSession
): Promise<number> {
  const query = TabPayment.find({
    tabId,
    tabPaymentStatus: { $in: AUTHORIZED_PAYMENT_STATUSES },
  });
  if (session) query.session(session);

  const payments = await query;
  return payments.reduce((sum, p) => sum + p.authorizedCentsAmount, 0);
}

export async function getActiveTabTotalCents(
  tabId: string,
  session?: ClientSession
): Promise<number> {
  const query = Order.find({ tabId });
  if (session) query.session(session);

  const orders = await query;
  return orders
    .flatMap((o) => o.items)
    .filter((i) => !i.cancelledAt)
    .reduce((sum, i) => sum + i.priceIncludingTaxAtPurchase, 0);
}

export async function getReadyTabTotalCents(
  tabId: string,
  session?: ClientSession
): Promise<number> {
  const query = Order.find({ tabId });
  if (session) query.session(session);

  const orders = await query;
  return orders
    .flatMap((o) => o.items)
    .filter((i) => !i.cancelledAt && i.readyAt)
    .reduce((sum, i) => sum + i.priceIncludingTaxAtPurchase, 0);
}

export async function isTabReadyForCheckout(
  tabId: string,
  session?: ClientSession
): Promise<boolean> {
  const query = Order.find({ tabId });
  if (session) query.session(session);

  const orders = await query;
  return orders
    .flatMap((o) => o.items)
    .filter((i) => !i.cancelledAt)
    .every((i) => i.readyAt);
}

export async function markAuthorizedTabOrdersPaid(
  tabId: string,
  session: ClientSession,
  now = new Date()
): Promise<void> {
  const authorizedCents = await getAuthorizedTabCents(tabId, session);
  const orders = await Order.find({ tabId })
    .sort({ createdAt: 1 })
    .session(session);

  let consumedCents = 0;
  for (const order of orders) {
    const orderTotal = order.items
      .filter((item) => !item.cancelledAt)
      .reduce((sum, item) => sum + item.priceIncludingTaxAtPurchase, 0);

    if (orderTotal === 0) continue;
    consumedCents += orderTotal;
    if (consumedCents > authorizedCents) break;

    // Marking the order paid is what releases it onto the operator board; its
    // items stay PENDING until an operator explicitly starts preparing them.
    if (!order.paidAt) {
      order.paidAt = now;
      await order.save({ session });
    }
  }
}
