import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../../config/config";
import {
  Tab,
  TAB_AUTO_CHARGE_AFTER_MS,
  TAB_ORDER_FREEZE_AFTER_MS,
} from "./model";
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

export async function createTab(
  sessionId: string,
  eventId: string,
  firstOrderCents = 0
) {
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
  // Size the first hold to cover the first order in a single authorization,
  // rounded up to a whole multiple of the baseline hold (mirrors the top-up
  // rounding in orders). A missing/zero first order falls back to one baseline.
  const holdCents =
    Math.max(1, Math.ceil(firstOrderCents / baselineHoldCents)) *
    baselineHoldCents;

  const pi = await stripe.paymentIntents.create({
    amount: holdCents,
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
            authorizedCentsAmount: holdCents,
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
export async function getTabForAttendee(
  tabId: string,
  sessionId: string,
  eventId: string
) {
  // Match by event, not by the opening session: a tab can outlive the 24h
  // attendee session on a long event. Re-bind it to the caller's current
  // session so a rolled-over guest keeps their tab (mirrors submitOrder).
  const tab = await Tab.findOne({ _id: tabId, eventId });
  if (!tab) throw new TabNotFoundError();
  if (tab.sessionId !== sessionId) {
    tab.sessionId = sessionId;
    await tab.save();
  }

  const authorizedCents = await getAuthorizedTabCents(tabId);
  const consumedCents = await getActiveTabTotalCents(tabId);

  return {
    tabId: tab._id,
    status: tab.status,
    authorizedCents,
    consumedCents,
    availableCents: Math.max(authorizedCents - consumedCents, 0),
    // False once the tab is past its order-freeze window (or no longer OPEN):
    // the guest can still track/settle it but can no longer add orders.
    acceptingOrders:
      tab.status === "OPEN" &&
      Date.now() - tab.createdAt.getTime() < TAB_ORDER_FREEZE_AFTER_MS,
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
  // Free tabs stuck in PENDING_AUTHORIZATION by unconfirmed top-ups first, so
  // their delivered items become chargeable in this same run.
  await releaseGatedTopUpsForEvent(eventId);
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
async function releaseStaleUnconfirmedTopUps(cutoff: Date): Promise<void> {
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
async function releaseGatedTopUpsForEvent(eventId: string): Promise<void> {
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

export async function checkoutDueTabs(now = new Date()): Promise<void> {
  const staleCutoff = new Date(now.getTime() - TAB_AUTHORIZATION_WINDOW_MS);

  // Free up tabs blocked by never-confirmed top-ups first, so their genuinely
  // ready items can settle on the baseline hold in this same run.
  await releaseStaleUnconfirmedTopUps(staleCutoff);

  // Auto-charge tabs that have been open too long. Like an event stop, cancel
  // whatever the guest never received (never charged) and capture the delivered
  // items, releasing the remaining authorization. 48h < Stripe's ~7-day hold
  // validity, so the authorization is always still capturable here.
  const autoChargeCutoff = new Date(now.getTime() - TAB_AUTO_CHARGE_AFTER_MS);
  const dueTabIds = await Tab.distinct("_id", {
    status: { $in: ["OPEN", "CHECKOUT_PENDING", "PENDING_AUTHORIZATION"] },
    createdAt: { $lte: autoChargeCutoff },
  });

  for (const tabId of dueTabIds) {
    try {
      await finalizeTabForEventEnd(tabId);
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
