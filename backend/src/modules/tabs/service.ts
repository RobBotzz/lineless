import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../../config/config";
import { Tab } from "./model";
import { TabPayment } from "../payments/model";
import { Order } from "../orders/model";
import { Event, DEFAULT_BASELINE_HOLD_CENTS } from "../events/model";
import { TabNotFoundError, TabStateError } from "./errors";
import { EventNotFoundError } from "../events/errors";
import { TAB_AUTHORIZATION_WINDOW_MS } from "../payments/service";
import { verifyEventOwnership } from "../events/ownership";
import {
  getActiveTabTotalCents,
  getAuthorizedTabCents,
  getReadyTabTotalCents,
  isTabReadyForCheckout,
} from "../orders/tabAuthorization";
import { releaseReservedStock } from "../orders/inventory";

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
  // The attendee session is bound to one event and is the sole authority on
  // which event a tab belongs to; never authorize a card for an event that is
  // not currently accepting orders.
  const event = await Event.findOne({
    _id: eventId,
    status: "ACTIVE",
    deletedAt: null,
  })
    .select("baselineHoldCents")
    .lean();
  if (!event) throw new EventNotFoundError();
  const baselineHoldCents =
    event.baselineHoldCents ?? DEFAULT_BASELINE_HOLD_CENTS;

  const pi = await stripe.paymentIntents.create({
    amount: baselineHoldCents,
    currency: "eur",
    capture_method: "manual",
    // Card only — Apple Pay / Google Pay ride on the card type, so they are
    // offered automatically; Link and other methods are excluded.
    payment_method_types: ["card"],
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
  } catch (err) {
    // The transaction rolled back, so cancel the PaymentIntent created above —
    // otherwise it is orphaned (no TabPayment row references it).
    await stripe.paymentIntents.cancel(pi.id).catch(() => undefined);
    throw err;
  } finally {
    await dbSession.endSession();
  }
}

// Read a tab the attendee owns, with its current authorization headroom. The
// frontend polls this after confirming a card hold: the tab only flips to OPEN
// once the Stripe webhook lands, so it waits on `status` before submitting the
// order. `availableCents` lets the client tell whether the next order will fit
// the existing hold or trigger a top-up.
export async function getTabForAttendee(tabId: string, sessionId: string) {
  const tab = await Tab.findOne({ _id: tabId, sessionId }).lean();
  if (!tab) throw new TabNotFoundError();

  const authorizedCents = await getAuthorizedTabCents(tabId);
  const consumedCents = await getActiveTabTotalCents(tabId);

  return {
    tabId: tab._id,
    status: tab.status,
    authorizedCents,
    consumedCents,
    availableCents: Math.max(authorizedCents - consumedCents, 0),
  };
}

async function settleTab(tabId: string, filters: { eventId?: string }) {
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

export async function checkoutTabsForOrganizerEvent(
  eventId: string,
  accountId: string
): Promise<BulkTabCheckoutResult> {
  await verifyEventOwnership(eventId, accountId);
  return checkoutReadyTabsForEvent(eventId);
}

// Prepares a single tab for final settlement at event end: items the guest never
// received (not READY/FULFILLED) are cancelled so they are never charged, and any
// unconfirmed top-up hold is released. This leaves only delivered items, so the
// unchanged settlement path charges exactly those and releases the remaining
// authorization.
async function finalizeTabForEventEnd(tabId: string): Promise<void> {
  const dbSession = await mongoose.startSession();
  let pendingIntentIds: string[] = [];
  try {
    await dbSession.withTransaction(async () => {
      const pendingHolds = await TabPayment.find({
        tabId,
        tabPaymentStatus: "PENDING",
      }).session(dbSession);
      // withTransaction may retry the callback, so replace instead of append.
      pendingIntentIds = pendingHolds.map((hold) => hold.stripePaymentIntentId);

      const orders = await Order.find({ tabId }).session(dbSession);
      const now = new Date();
      for (const order of orders) {
        const cancelledItems = order.items.filter(
          (item) => !item.readyAt && !item.fulfilledAt && !item.cancelledAt
        );
        if (cancelledItems.length === 0) continue;
        await releaseReservedStock(cancelledItems, dbSession);
        cancelledItems.forEach((item) => {
          item.cancelledAt = now;
        });
        await order.save({ session: dbSession });
      }

      await TabPayment.updateMany(
        { tabId, tabPaymentStatus: "PENDING" },
        { tabPaymentStatus: "RELEASED" },
        { session: dbSession }
      );

      // A tab parked mid top-up returns to OPEN so the settlement loop picks it up.
      await Tab.updateOne(
        { _id: tabId, status: "PENDING_AUTHORIZATION" },
        { status: "OPEN" },
        { session: dbSession }
      );
    });
  } finally {
    await dbSession.endSession();
  }

  // MongoDB decides whether cleanup or the authorization webhook wins. Stripe
  // is cancelled afterwards because it cannot participate in that transaction.
  for (const intentId of pendingIntentIds) {
    await stripe.paymentIntents.cancel(intentId).catch(() => undefined);
  }
}

// Final settlement when an event is stopped: closes every open tab. Undelivered
// items are cancelled (and so never charged), then the existing settlement
// charges each guest for their READY/FULFILLED items and releases the rest.
export async function finalizeEventTabs(
  eventId: string
): Promise<BulkTabCheckoutResult> {
  const tabs = await Tab.find({
    eventId,
    status: { $in: ["OPEN", "CHECKOUT_PENDING", "PENDING_AUTHORIZATION"] },
  })
    .select("_id")
    .lean();

  for (const tab of tabs) {
    await finalizeTabForEventEnd(tab._id);
  }

  return checkoutReadyTabsForEvent(eventId);
}

// A top-up the guest never confirmed leaves its order's items gated and the tab
// stuck in PENDING_AUTHORIZATION, which blocks settlement and would let the
// baseline hold expire uncaptured (lost revenue). Release these stale PENDING
// holds and cancel their gated orders before the sweep settles, mirroring
// cancelPendingOrder.
async function releaseStaleUnconfirmedTopUps(cutoff: Date): Promise<void> {
  const stale = await TabPayment.find({
    tabPaymentStatus: "PENDING",
    orderId: { $ne: null },
    updatedAt: { $lte: cutoff },
  });

  for (const payment of stale) {
    const dbSession = await mongoose.startSession();
    let claimedIntentId: string | null = null;
    try {
      await dbSession.withTransaction(async () => {
        claimedIntentId = null;
        const claimedPayment = await TabPayment.findOne({
          _id: payment._id,
          tabPaymentStatus: "PENDING",
          updatedAt: { $lte: cutoff },
        }).session(dbSession);
        if (!claimedPayment) return;

        const order = await Order.findById(claimedPayment.orderId).session(
          dbSession
        );
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

        claimedPayment.tabPaymentStatus = "RELEASED";
        await claimedPayment.save({ session: dbSession });

        const pending = await TabPayment.countDocuments({
          tabId: claimedPayment.tabId,
          tabPaymentStatus: "PENDING",
        }).session(dbSession);
        if (pending === 0) {
          await Tab.updateOne(
            {
              _id: claimedPayment.tabId,
              status: "PENDING_AUTHORIZATION",
            },
            { status: "OPEN" },
            { session: dbSession }
          );
        }

        claimedIntentId = claimedPayment.stripePaymentIntentId;
      });
    } finally {
      await dbSession.endSession();
    }

    if (claimedIntentId) {
      await stripe.paymentIntents
        .cancel(claimedIntentId)
        .catch(() => undefined);
    }
  }
}

export async function checkoutDueTabs(now = new Date()): Promise<void> {
  const fallbackCutoff = new Date(now.getTime() - TAB_AUTHORIZATION_WINDOW_MS);

  // Free up tabs blocked by never-confirmed top-ups first, so their genuinely
  // ready items can settle on the baseline hold in this same run.
  await releaseStaleUnconfirmedTopUps(fallbackCutoff);

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
      // Expected, benign states (tab not ready, already gone) are skipped
      // quietly. Anything unexpected (Stripe/DB failure) is logged but must NOT
      // abort the sweep: these tabs have expiring authorization holds, so a
      // single failing tab cannot be allowed to block the ones behind it.
      if (err instanceof TabStateError || err instanceof TabNotFoundError) {
        continue;
      }
      console.error(`Tab checkout sweep failed for tab ${tabId}:`, err);
    }
  }
}
