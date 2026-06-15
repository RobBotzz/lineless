import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../../config/config";
import { Tab } from "./model";
import { TabPayment } from "../payments/model";
import { Order } from "../orders/model";
import { Event, DEFAULT_BASELINE_HOLD_CENTS } from "../events/model";
import { TabNotFoundError, TabStateError } from "./errors";
import { TAB_AUTHORIZATION_WINDOW_MS } from "../payments/service";
import { verifyEventOwnership } from "../events/ownership";
import {
  getReadyTabTotalCents,
  isTabReadyForCheckout,
} from "../orders/tabAuthorization";

const stripe = new Stripe(config.stripe.secretKey);

export interface TabCheckoutResult {
  tabId: string;
  status: "PAID" | "SKIPPED" | "FAILED";
  capturedTotal?: number;
  reason?: string;
}

export interface BulkTabCheckoutResult {
  eventId: string;
  processed: number;
  settled: number;
  skipped: number;
  failed: number;
  results: TabCheckoutResult[];
}

export async function createTab(sessionId: string, eventId: string) {
  const event = await Event.findOne({ _id: eventId, deletedAt: null })
    .select("baselineHoldCents")
    .lean();
  const baselineHoldCents =
    event?.baselineHoldCents ?? DEFAULT_BASELINE_HOLD_CENTS;

  const pi = await stripe.paymentIntents.create({
    amount: baselineHoldCents,
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
            authorizedCentsAmount: baselineHoldCents,
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

async function settleTab(
  tabId: string,
  filters: { sessionId?: string; eventId?: string }
) {
  const dbSession = await mongoose.startSession();
  let paymentsToCapture: Awaited<ReturnType<typeof TabPayment.find>> = [];
  let consumedCents = 0;
  let alreadyCapturedCents = 0;

  try {
    await dbSession.withTransaction(async () => {
      const tab = await Tab.findOne({ _id: tabId, ...filters }).session(
        dbSession
      );
      if (!tab) throw new TabNotFoundError();
      // Allow CHECKOUT_PENDING too, so a checkout interrupted mid-capture can be
      // safely retried — the loop below only captures still-AUTHORIZED holds.
      if (tab.status !== "OPEN" && tab.status !== "CHECKOUT_PENDING")
        throw new TabStateError();

      const readyForCheckout = await isTabReadyForCheckout(tabId, dbSession);
      if (!readyForCheckout) {
        throw new TabStateError(
          "Tab has non-cancelled items that are not ready"
        );
      }

      tab.status = "CHECKOUT_PENDING";
      await tab.save({ session: dbSession });

      // Charge only items that reached READY/FULFILLED, not the full hold.
      consumedCents = await getReadyTabTotalCents(tabId, dbSession);
      alreadyCapturedCents = (
        await TabPayment.find({
          tabId,
          tabPaymentStatus: "CAPTURED",
        }).session(dbSession)
      ).reduce((sum, payment) => sum + payment.capturedCentsAmount, 0);

      paymentsToCapture = await TabPayment.find({
        tabId,
        tabPaymentStatus: "AUTHORIZED",
      })
        .sort({ createdAt: 1 })
        .session(dbSession);
    });

    // Capture outside the transaction — Stripe calls cannot be rolled back.
    // Spread the consumed amount across the holds (baseline first): capture each
    // hold only up to what is still owed, letting Stripe release the rest, and
    // cancel any hold that is not needed at all.
    const authorizedTotal = paymentsToCapture.reduce(
      (sum, payment) => sum + payment.authorizedCentsAmount,
      0
    );
    const remainingToCapture = Math.max(
      consumedCents - alreadyCapturedCents,
      0
    );
    if (authorizedTotal < remainingToCapture) {
      await Tab.updateOne({ _id: tabId }, { status: "OPEN" });
      throw new TabStateError("Authorized holds do not cover the tab total");
    }

    let remaining = remainingToCapture;
    let totalCaptured = 0;
    for (const payment of paymentsToCapture) {
      const captureAmount = Math.min(remaining, payment.authorizedCentsAmount);
      if (captureAmount > 0) {
        await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
          amount_to_capture: captureAmount,
        });
        await TabPayment.updateOne(
          { _id: payment._id },
          {
            tabPaymentStatus: "CAPTURED",
            capturedCentsAmount: captureAmount,
          }
        );
        totalCaptured += captureAmount;
        remaining -= captureAmount;
      } else {
        // Nothing left to charge against this hold — release it.
        try {
          await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
        } catch {
          // Already resolved on Stripe's side; nothing to release.
        }
        await TabPayment.updateOne(
          { _id: payment._id },
          { tabPaymentStatus: "RELEASED", capturedCentsAmount: 0 }
        );
      }
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

async function checkoutReadyTabsForEvent(
  eventId: string
): Promise<BulkTabCheckoutResult> {
  const tabs = await Tab.find({
    eventId,
    status: { $in: ["OPEN", "CHECKOUT_PENDING"] },
  })
    .select("_id")
    .lean();

  const results: TabCheckoutResult[] = [];
  for (const tab of tabs) {
    if (!(await isTabReadyForCheckout(tab._id))) {
      results.push({
        tabId: tab._id,
        status: "SKIPPED",
        reason: "Tab has non-cancelled items that are not ready",
      });
      continue;
    }

    try {
      const result = await settleTab(tab._id, { eventId });
      results.push({
        tabId: tab._id,
        status: "PAID",
        capturedTotal: result.capturedTotal,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Checkout failed";
      results.push({ tabId: tab._id, status: "FAILED", reason });
    }
  }

  return {
    eventId,
    processed: tabs.length,
    settled: results.filter((result) => result.status === "PAID").length,
    skipped: results.filter((result) => result.status === "SKIPPED").length,
    failed: results.filter((result) => result.status === "FAILED").length,
    results,
  };
}

export async function checkoutTabsForEvent(
  eventId: string
): Promise<BulkTabCheckoutResult> {
  return checkoutReadyTabsForEvent(eventId);
}

export async function checkoutTabsForOrganizerEvent(
  eventId: string,
  accountId: string
): Promise<BulkTabCheckoutResult> {
  await verifyEventOwnership(eventId, accountId);
  return checkoutReadyTabsForEvent(eventId);
}

export async function checkoutDueTabs(now = new Date()): Promise<void> {
  const fallbackCutoff = new Date(now.getTime() - TAB_AUTHORIZATION_WINDOW_MS);
  const tabIds = await TabPayment.distinct("tabId", {
    tabPaymentStatus: "AUTHORIZED",
    $or: [
      { expiresAt: { $lte: now } },
      { expiresAt: null, updatedAt: { $lte: fallbackCutoff } },
    ],
  });

  for (const tabId of tabIds) {
    try {
      await settleTab(tabId, {});
    } catch (err) {
      if (err instanceof TabStateError || err instanceof TabNotFoundError) {
        continue;
      }
      throw err;
    }
  }
}
