import mongoose from "mongoose";
import { TabPayment } from "./model";
import { Tab } from "../tabs/model";
import { Order } from "../orders/model";

export async function handleAmountCapturableUpdated(intentId: string, eventId: string) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // 1. Idempotency guard
      const existing = await TabPayment.findOne({ stripeEventId: eventId }).session(session);
      if (existing) return;

      const payment = await TabPayment.findOne({ stripePaymentIntentId: intentId }).session(session);
      if (!payment || payment.tabPaymentStatus !== "PENDING") return;

      // 2. Update payment state
      payment.tabPaymentStatus = "AUTHORIZED";
      payment.stripeEventId = eventId;
      await payment.save({ session });

      const tabId = payment.tabId;

      // 3. Re-evaluate tab status
      const pendingPayments = await TabPayment.countDocuments({ tabId, tabPaymentStatus: "PENDING" }).session(session);
      if (pendingPayments === 0) {
        await Tab.updateOne({ _id: tabId }, { status: "OPEN" }, { session });
        
        // 4. Release gated order items
        await Order.updateMany(
          { tabId, "items.startedAt": null },
          { $set: { "items.$[elem].startedAt": new Date() } },
          { arrayFilters: [{ "elem.startedAt": null }], session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
}