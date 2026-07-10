import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../../config/config";
import { Tab } from "./model";
import { TabPayment } from "../payments/model";
import { Order } from "../orders/model";
import { releaseReservedStock } from "../orders/inventory";

const stripe = new Stripe(config.stripe.secretKey);

type HydratedTabPayment = Awaited<ReturnType<typeof TabPayment.find>>[number];

// Releases one unconfirmed or failed top-up hold: cancels it on Stripe, cancels
// its gated order's not-yet-started items, marks the hold RELEASED, and reopens
// the tab to OPEN once no PENDING holds remain. Mirrors cancelPendingOrder.
async function releaseUnconfirmedTopUp(
  payment: HydratedTabPayment
): Promise<void> {
  try {
    await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
  } catch {
    // Already resolved on Stripe's side — nothing to release.
  }

  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const order = await Order.findById(payment.orderId).session(dbSession);
      if (order) {
        const now = new Date();
        const cancelledItems = order.items.filter(
          (item) => !item.startedAt && !item.cancelledAt
        );
        await releaseReservedStock(cancelledItems, dbSession);
        cancelledItems.forEach((item) => {
          item.cancelledAt = now;
        });
        await order.save({ session: dbSession });
      }

      await TabPayment.updateOne(
        {
          _id: payment._id,
          tabPaymentStatus: { $in: ["PENDING", "FAILED"] },
        },
        { tabPaymentStatus: "RELEASED" },
        { session: dbSession }
      );

      const pending = await TabPayment.countDocuments({
        tabId: payment.tabId,
        tabPaymentStatus: "PENDING",
      }).session(dbSession);
      if (pending === 0) {
        await Tab.updateOne(
          { _id: payment.tabId, status: "PENDING_AUTHORIZATION" },
          { status: "OPEN" },
          { session: dbSession }
        );
      }
    });
  } finally {
    await dbSession.endSession();
  }
}

// A top-up the guest never completed leaves its order's items gated. PENDING
// holds can also keep the tab blocked, while FAILED holds reopen it but retain
// the same reserved stock. Release both stale states before the sweep settles.
export async function releaseStaleUnconfirmedTopUps(
  cutoff: Date
): Promise<void> {
  const stale = await TabPayment.find({
    tabPaymentStatus: { $in: ["PENDING", "FAILED"] },
    orderId: { $ne: null },
    updatedAt: { $lte: cutoff },
  });
  for (const payment of stale) {
    await releaseUnconfirmedTopUp(payment);
  }
}

// Same release, but for every unfinished top-up on an event's tabs regardless
// of age. The organizer's manual "charge open tabs" only scans OPEN/
// CHECKOUT_PENDING tabs, so a tab parked in PENDING_AUTHORIZATION by an
// unconfirmed top-up — whose gated items never reach an operator — would
// otherwise be uncharge-able. Freeing the hold reopens the tab so its delivered
// items can settle in the same charge.
export async function releaseGatedTopUpsForEvent(
  eventId: string
): Promise<void> {
  const tabIds = await Tab.find({ eventId }).distinct("_id");
  const gated = await TabPayment.find({
    tabId: { $in: tabIds },
    tabPaymentStatus: { $in: ["PENDING", "FAILED"] },
    orderId: { $ne: null },
  });
  for (const payment of gated) {
    await releaseUnconfirmedTopUp(payment);
  }
}
