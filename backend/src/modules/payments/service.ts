import type { ClientSession } from "mongoose";
import { TabPayment } from "./model";
import { Tab } from "../tabs/model";
import { withProcessedEventGuard } from "./processedEvents";
import { markAuthorizedTabOrdersPaid } from "../orders/tabAuthorization";

export const TAB_AUTHORIZATION_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Reopens the tab to OPEN once it has no PENDING holds left, mirroring the
 * authorize/fail paths. Scoped to PENDING_AUTHORIZATION so it never disturbs a
 * tab that is checking out or already paid.
 */
async function reopenTabIfSettled(
  tabId: string,
  session: ClientSession
): Promise<void> {
  const pending = await TabPayment.countDocuments({
    tabId,
    tabPaymentStatus: "PENDING",
  }).session(session);
  if (pending === 0) {
    await Tab.updateOne(
      { _id: tabId, status: "PENDING_AUTHORIZATION" },
      { status: "OPEN" },
      { session }
    );
  }
}

/** Stripe confirmed the hold. Authorize the payment and release its order. */
export async function handleAmountCapturableUpdated(
  intentId: string,
  eventId: string
) {
  await withProcessedEventGuard(
    eventId,
    "payment_intent.amount_capturable_updated",
    async (session) => {
      const payment = await TabPayment.findOne({
        stripePaymentIntentId: intentId,
      }).session(session);
      if (!payment || payment.tabPaymentStatus !== "PENDING") return;

      const now = new Date();
      payment.tabPaymentStatus = "AUTHORIZED";
      payment.stripeEventId = eventId;
      payment.expiresAt = new Date(now.getTime() + TAB_AUTHORIZATION_WINDOW_MS);
      await payment.save({ session });

      await markAuthorizedTabOrdersPaid(payment.tabId, session, now);

      await reopenTabIfSettled(payment.tabId, session);
    }
  );
}

/**
 * Stripe could not authorize the hold (declined card, etc.). Record the failure
 * and let the tab become orderable again. The gated order is left intact so the
 * guest can retry; cancelling it is an explicit attendee action.
 */
export async function handlePaymentFailed(intentId: string, eventId: string) {
  await withProcessedEventGuard(
    eventId,
    "payment_intent.payment_failed",
    async (session) => {
      const payment = await TabPayment.findOne({
        stripePaymentIntentId: intentId,
      }).session(session);
      if (!payment || payment.tabPaymentStatus !== "PENDING") return;

      payment.tabPaymentStatus = "FAILED";
      await payment.save({ session });

      await reopenTabIfSettled(payment.tabId, session);
    }
  );
}
