import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../../config/config";
import {
  Tab,
  TAB_AUTO_CHARGE_AFTER_MS,
  TAB_ORDER_FREEZE_AFTER_MS,
} from "./model";
import { TabPayment } from "../payments/model";
import { Event, DEFAULT_BASELINE_HOLD_CENTS } from "../events/model";
import { TabNotFoundError, TabStateError } from "./errors";
import { EventNotFoundError } from "../events/errors";
import { TAB_AUTHORIZATION_WINDOW_MS } from "../payments/service";
import { verifyEventOwnership } from "../events/ownership";
import {
  getActiveTabTotalCents,
  getAuthorizedTabCents,
} from "../orders/tabAuthorization";
import {
  checkoutReadyTabsForEvent,
  finalizeTabForEventEnd,
  settleTab,
  type BulkTabCheckoutResult,
} from "./tabSettlement";
import {
  releaseGatedTopUpsForEvent,
  releaseStaleUnconfirmedTopUps,
} from "./tabTopUps";

export type { BulkTabCheckoutResult, TabCheckoutResult } from "./tabSettlement";

const stripe = new Stripe(config.stripe.secretKey);

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
