import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../../config/config";
import { Tab } from "./model";
import { TabPayment } from "../payments/model";
import { Order } from "../orders/model";
import { TabNotFoundError, TabStateError } from "./errors";

const stripe = new Stripe(config.stripe.secretKey as string);

// Baseline hold in cents placed on every new tab (e.g. €10.00)
const BASELINE_HOLD_CENTS = 1000;

export async function createTab(userId: string) {
  const pi = await stripe.paymentIntents.create({
    amount: BASELINE_HOLD_CENTS,
    currency: "eur",
    capture_method: "manual",
    metadata: { userId },
  });

  const session = await mongoose.startSession();
  try {
    let tabId: string | undefined;
    await session.withTransaction(async () => {
      const tabs = await Tab.create([{ userId }], { session });
      const tab = tabs[0];
      tabId = tab?._id as string;
      await TabPayment.create(
        [
          {
            tabId,
            stripePaymentIntentId: pi.id,
            tabPaymentStatus: "PENDING",
            authorizedCentsAmount: BASELINE_HOLD_CENTS,
          },
        ],
        { session }
      );
    });
    return { tabId, stripePaymentIntentId: pi.id, clientSecret: pi.client_secret };
  } finally {
    await session.endSession();
  }
}

export async function checkoutTab(tabId: string, userId: string) {
  const session = await mongoose.startSession();
  let paymentsToCapture: Awaited<ReturnType<typeof TabPayment.find>> = [];

  try {
    await session.withTransaction(async () => {
      const tab = await Tab.findOne({ _id: tabId, userId }).session(session);
      if (!tab) throw new TabNotFoundError();
      if (tab.status !== "OPEN") throw new TabStateError();

      tab.status = "CHECKOUT_PENDING";
      await tab.save({ session });

      paymentsToCapture = await TabPayment.find({ 
        tabId, 
        tabPaymentStatus: "AUTHORIZED" 
      }).session(session);
    });

    // Capture outside of transaction
    let totalCaptured = 0;
    for (const payment of paymentsToCapture) {
      await stripe.paymentIntents.capture(payment.stripePaymentIntentId as string);
      totalCaptured += payment.authorizedCentsAmount as number;

      await TabPayment.updateOne(
        { _id: payment._id },
        {
          tabPaymentStatus: "CAPTURED",
          capturedCentsAmount: payment.authorizedCentsAmount,
        }
      );
    }

    await session.withTransaction(async () => {
      await Tab.updateOne({ _id: tabId }, { status: "PAID" }, { session });
      await Order.updateMany(
        { tabId, paidAt: null },
        { $set: { paidAt: new Date() } },
        { session }
      );
    });

    return { capturedTotal: totalCaptured, status: "PAID" };
  } finally {
    await session.endSession();
  }
}