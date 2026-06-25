import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

// Persisted snapshot of an event's payout figures, refreshed every time the
// breakdown is computed (organizer opens the payout page or charges tabs). It
// is a denormalized cache for reporting — the orders, tabs and payments remain
// the source of truth.
export interface EventPayoutDoc {
  _id: string;
  eventId: string;
  accountId: string;
  /** Card (captured) + cash revenue, integer cents. */
  grossRevenueCents: number;
  /** Stripe-captured revenue, integer cents. */
  cardRevenueCents: number;
  /** Cash collected minus cash refunds, integer cents. */
  cashRevenueCents: number;
  /** Sum of cash refunds, integer cents. */
  cashRefundCents: number;
  /** Tax contained in the gross revenue (organizer liability, not deducted). */
  taxCents: number;
  /** Total Stripe processing fees, integer cents. */
  stripeFeeCents: number;
  /** Platform fee: 5 cents per paid order, integer cents. */
  platformFeeCents: number;
  /** What is paid out: gross - stripe - platform, integer cents. */
  netPayoutCents: number;
  /** Delivered (READY/FULFILLED) value on tabs not yet charged, integer cents. */
  onHoldReadyCents: number;
  /** Stripe authorized-but-not-captured holds for the event, integer cents. */
  onHoldAuthorizedCents: number;
  paidOrderCount: number;
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EventPayoutSchema = new Schema<EventPayoutDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    eventId: { type: String, required: true, unique: true, index: true },
    accountId: { type: String, required: true, index: true },
    grossRevenueCents: { type: Number, default: 0 },
    cardRevenueCents: { type: Number, default: 0 },
    cashRevenueCents: { type: Number, default: 0 },
    cashRefundCents: { type: Number, default: 0 },
    taxCents: { type: Number, default: 0 },
    stripeFeeCents: { type: Number, default: 0 },
    platformFeeCents: { type: Number, default: 0 },
    netPayoutCents: { type: Number, default: 0 },
    onHoldReadyCents: { type: Number, default: 0 },
    onHoldAuthorizedCents: { type: Number, default: 0 },
    paidOrderCount: { type: Number, default: 0 },
    computedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export const EventPayout = model<EventPayoutDoc>(
  "EventPayout",
  EventPayoutSchema
);

export type PayoutStatus = "REQUESTED" | "PAID";

// Ledger entry for a payout the organizer requested. Payouts are manual bank
// transfers (no real processor), so the amount is frozen here and the bank
// details are snapshotted at request time.
export interface PayoutDoc {
  _id: string;
  accountId: string;
  amountCents: number;
  ibanSnapshot: string;
  ibanHolderSnapshot: string;
  status: PayoutStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutSchema = new Schema<PayoutDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    accountId: { type: String, required: true, index: true },
    amountCents: { type: Number, required: true },
    ibanSnapshot: { type: String, required: true },
    ibanHolderSnapshot: { type: String, required: true },
    status: {
      type: String,
      enum: ["REQUESTED", "PAID"],
      default: "REQUESTED",
    },
  },
  { timestamps: true }
);

export const Payout = model<PayoutDoc>("Payout", PayoutSchema);
