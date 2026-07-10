import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../../config/config";
import { Tab } from "./model";
import { TabPayment } from "../payments/model";
import { Order } from "../orders/model";
import { TabNotFoundError, TabStateError } from "./errors";
import {
  getReadyTabTotalCents,
  isTabReadyForCheckout,
} from "../orders/tabAuthorization";
import { releaseReservedStock } from "../orders/inventory";

const stripe = new Stripe(config.stripe.secretKey);

// Reads settlement info from a captured PaymentIntent whose
// latest_charge.balance_transaction was expanded: the processing fee and the
// `available_on` date when the funds clear Stripe's pending balance. Stripe only
// reports these once the charge settles, so this is the single source of truth.
type CapturedIntent = Awaited<ReturnType<typeof stripe.paymentIntents.capture>>;

function extractCaptureSettlement(intent: CapturedIntent): {
  capturedCents: number;
  feeCents: number;
  balanceTxnId: string | null;
  availableOn: Date | null;
} {
  // Trust the amount Stripe actually collected, not the locally-computed one:
  // on the reconcile path (see captureHold) the recovered intent may have been
  // captured for a different amount than this attempt recomputed.
  const capturedCents = intent.amount_received;
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string") {
    return {
      capturedCents,
      feeCents: 0,
      balanceTxnId: null,
      availableOn: null,
    };
  }
  const balanceTxn = charge.balance_transaction;
  if (!balanceTxn || typeof balanceTxn === "string") {
    return {
      capturedCents,
      feeCents: 0,
      balanceTxnId: null,
      availableOn: null,
    };
  }
  return {
    capturedCents,
    feeCents: balanceTxn.fee,
    balanceTxnId: balanceTxn.id,
    // Stripe sends available_on as a unix timestamp in seconds.
    availableOn: new Date(balanceTxn.available_on * 1000),
  };
}

// Captures a hold with a deterministic idempotency key, so a settlement retried
// after a crash or dropped response replays the original capture instead of
// erroring on an already-captured intent (which would strand the tab in
// CHECKOUT_PENDING with the money already taken). If Stripe still rejects the
// call, reconcile: a PaymentIntent that already reads as captured is returned as
// success rather than failing the whole settlement — and never double-captured.
async function captureHold(
  paymentId: string,
  intentId: string,
  amountToCapture: number
): Promise<CapturedIntent> {
  try {
    return await stripe.paymentIntents.capture(
      intentId,
      {
        amount_to_capture: amountToCapture,
        expand: ["latest_charge.balance_transaction"],
      },
      { idempotencyKey: `capture:${paymentId}` }
    );
  } catch (err) {
    const intent = await stripe.paymentIntents.retrieve(intentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    if (intent.status === "succeeded") return intent;
    throw err;
  }
}

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

export async function settleTab(tabId: string, filters: { eventId?: string }) {
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
        const intent = await captureHold(
          payment._id,
          payment.stripePaymentIntentId,
          captureAmount
        );
        const { capturedCents, feeCents, balanceTxnId, availableOn } =
          extractCaptureSettlement(intent);
        // Record what Stripe actually captured. On the reconcile path this can
        // differ from captureAmount; driving the ledger and the remaining-owed
        // spread off the real figure keeps both consistent with the charge.
        await TabPayment.updateOne(
          { _id: payment._id },
          {
            tabPaymentStatus: "CAPTURED",
            capturedCentsAmount: capturedCents,
            processingFeeCents: feeCents,
            stripeBalanceTxnId: balanceTxnId,
            availableOn,
          }
        );
        if (capturedCents > captureAmount) {
          console.warn(
            `Tab ${tabId}: over-capture on payment ${String(payment._id)} — ` +
              `expected ${captureAmount}¢, Stripe returned ${capturedCents}¢`
          );
        }
        totalCaptured += capturedCents;
        remaining -= capturedCents;
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

export async function checkoutReadyTabsForEvent(
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

// Prepares a single tab for final settlement at event end: items the guest never
// received (not READY/FULFILLED) are cancelled so they are never charged, and any
// unconfirmed top-up hold is released. This leaves only delivered items, so the
// unchanged settlement path charges exactly those and releases the remaining
// authorization.
export async function finalizeTabForEventEnd(tabId: string): Promise<void> {
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
