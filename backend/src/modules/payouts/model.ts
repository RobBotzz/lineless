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
  /** Delivered gross across card + cash (= items-sold total), integer cents. */
  grossSalesCents: number;
  /** Delivered gross paid in cash (subset of grossSalesCents), integer cents. */
  cashSalesCents: number;
  /** Sum of cash refunds, integer cents. */
  cashRefundCents: number;
  /** Tax contained in the delivered gross (organizer liability, not deducted). */
  taxCents: number;
  /** Card revenue captured on Stripe, integer cents. */
  capturedCardCents: number;
  /** Total Stripe processing fees on captured card revenue, integer cents. */
  stripeFeeCents: number;
  /** Platform fee: 5 cents per charged order (card + cash), integer cents. */
  platformFeeCents: number;
  /** Card payout: capturedCard - stripe - platform, integer cents. */
  netPayoutCents: number;
  /** Delivered (READY/FULFILLED) card value on tabs not yet charged, integer cents. */
  onHoldReadyCents: number;
  /** Stripe authorized-but-not-captured holds for the event, integer cents. */
  onHoldAuthorizedCents: number;
  /** Captured funds still settling on Stripe (available_on in the future), net cents. */
  inTransitCents: number;
  /** Orders released to operators (paidAt set). */
  paidOrderCount: number;
  /** Orders actually charged (cash collected or card tab settled). */
  chargedOrderCount: number;
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EventPayoutSchema = new Schema<EventPayoutDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    eventId: { type: String, required: true, unique: true, index: true },
    accountId: { type: String, required: true, index: true },
    grossSalesCents: { type: Number, default: 0 },
    cashSalesCents: { type: Number, default: 0 },
    cashRefundCents: { type: Number, default: 0 },
    taxCents: { type: Number, default: 0 },
    capturedCardCents: { type: Number, default: 0 },
    stripeFeeCents: { type: Number, default: 0 },
    platformFeeCents: { type: Number, default: 0 },
    netPayoutCents: { type: Number, default: 0 },
    onHoldReadyCents: { type: Number, default: 0 },
    onHoldAuthorizedCents: { type: Number, default: 0 },
    inTransitCents: { type: Number, default: 0 },
    paidOrderCount: { type: Number, default: 0 },
    chargedOrderCount: { type: Number, default: 0 },
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
