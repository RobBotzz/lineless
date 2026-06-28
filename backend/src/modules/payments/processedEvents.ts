import mongoose, { model, Schema, type ClientSession } from "mongoose";

/**
 * One row per Stripe webhook event we have processed. The Stripe event id is the
 * primary key, so it doubles as the idempotency guard: a PaymentIntent receives
 * several distinct events over its life (authorized, failed, canceled), and each
 * carries its own id — which a single field on TabPayment could not track.
 */
export interface ProcessedStripeEventDoc {
  _id: string;
  type: string;
  createdAt: Date;
}

const ProcessedStripeEventSchema = new Schema<ProcessedStripeEventDoc>(
  {
    _id: { type: String },
    type: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ProcessedStripeEvent = model<ProcessedStripeEventDoc>(
  "ProcessedStripeEvent",
  ProcessedStripeEventSchema
);

/**
 * Runs `fn` inside a transaction exactly once per Stripe event id. If the event
 * was already processed, `fn` is skipped. Recording the event and the work share
 * the transaction, so a failure rolls back both — Stripe will redeliver and we
 * retry cleanly.
 */
export async function withProcessedEventGuard(
  eventId: string,
  eventType: string,
  fn: (session: ClientSession) => Promise<void>
): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const seen = await ProcessedStripeEvent.findOne({ _id: eventId }).session(
        session
      );
      if (seen) return;

      await ProcessedStripeEvent.create([{ _id: eventId, type: eventType }], {
        session,
      });
      await fn(session);
    });
  } finally {
    await session.endSession();
  }
}
