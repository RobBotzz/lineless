import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../../config/config";
import { Tab } from "./model";
import { TabPayment } from "../payments/model";
import { Order } from "../orders/model";
import { TabNotFoundError, TabStateError } from "./errors";

const stripe = new Stripe(config.stripe.secretKey);

// Baseline hold in cents placed on every new tab (€10.00).
// TODO: make this configurable per event.
const BASELINE_HOLD_CENTS = 1000;

export async function createTab(sessionId: string, eventId: string) {
  const pi = await stripe.paymentIntents.create({
    amount: BASELINE_HOLD_CENTS,
    currency: "eur",
    capture_method: "manual",
    metadata: { sessionId, eventId },
  });

  const dbSession = await mongoose.startSession();
  try {
    let tabId: string | undefined;
    await dbSession.withTransaction(async () => {
      const tabs = await Tab.create([{ sessionId, eventId }], {
        session: dbSession,
      });
      const tab = tabs[0];
      tabId = tab?._id;
      await TabPayment.create(
        [
          {
            tabId,
            stripePaymentIntentId: pi.id,
            tabPaymentStatus: "PENDING",
            authorizedCentsAmount: BASELINE_HOLD_CENTS,
          },
        ],
        { session: dbSession }
      );
    });
    return {
      tabId,
      stripePaymentIntentId: pi.id,
      clientSecret: pi.client_secret,
    };
  } finally {
    await dbSession.endSession();
  }
}

export async function checkoutTab(tabId: string, sessionId: string) {
  const dbSession = await mongoose.startSession();
  let paymentsToCapture: Awaited<ReturnType<typeof TabPayment.find>> = [];

  try {
    await dbSession.withTransaction(async () => {
      const tab = await Tab.findOne({ _id: tabId, sessionId }).session(
        dbSession
      );
      if (!tab) throw new TabNotFoundError();
      // Allow CHECKOUT_PENDING too, so a checkout interrupted mid-capture can be
      // safely retried — the loop below only captures still-AUTHORIZED holds.
      if (tab.status !== "OPEN" && tab.status !== "CHECKOUT_PENDING")
        throw new TabStateError();

      tab.status = "CHECKOUT_PENDING";
      await tab.save({ session: dbSession });

      paymentsToCapture = await TabPayment.find({
        tabId,
        tabPaymentStatus: "AUTHORIZED",
      }).session(dbSession);
    });

    // Capture outside the transaction — Stripe calls cannot be rolled back.
    let totalCaptured = 0;
    for (const payment of paymentsToCapture) {
      await stripe.paymentIntents.capture(payment.stripePaymentIntentId);
      totalCaptured += payment.authorizedCentsAmount;
      await TabPayment.updateOne(
        { _id: payment._id },
        {
          tabPaymentStatus: "CAPTURED",
          capturedCentsAmount: payment.authorizedCentsAmount,
        }
      );
    }

    await dbSession.withTransaction(async () => {
      await Tab.updateOne(
        { _id: tabId },
        { status: "PAID" },
        { session: dbSession }
      );
      await Order.updateMany(
        { tabId, paidAt: null },
        { $set: { paidAt: new Date() } },
        { session: dbSession }
      );
    });

    return { capturedTotal: totalCaptured, status: "PAID" };
  } finally {
    await dbSession.endSession();
  }
}
