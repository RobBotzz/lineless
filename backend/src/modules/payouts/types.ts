import type { EventStatus } from "../events/model";
import type { PayoutStatus } from "./model";

export interface ProductUnitsSold {
  productId: string;
  productName: string;
  unitsSold: number;
  grossRevenueCents: number;
  netRevenueCents: number;
  taxCents: number;
  /** Tax rate in basis points (1900 = 19%), or null when the line mixes rates. */
  taxRateBp: number | null;
}

// Full breakdown for a single event's payout detail view.
//
// Sales are recognized on delivery (READY/FULFILLED, non-cancelled) and are
// method-agnostic, so `grossSalesCents` always equals the items-sold table
// total. The payout (`netPayoutCents`) is the card money the platform actually
// wires out: captured card minus Stripe fees minus the platform fee on every
// charged order (cash orders included — their fee is netted out of the card
// pool, since the platform never custodies the cash itself).
export interface EventPayoutBreakdown {
  eventId: string;
  eventName: string;
  eventStatus: EventStatus;
  /** Orders released to operators (paidAt set) — operational count. */
  paidOrderCount: number;
  /** Orders actually charged (cash collected, or card tab settled) — fee basis. */
  chargedOrderCount: number;
  /** Delivered gross across card + cash; equals the items-sold table total. */
  grossSalesCents: number;
  /** Delivered gross paid in cash (subset of grossSalesCents), informational. */
  cashSalesCents: number;
  /** Tax contained in the delivered gross (organizer liability, not deducted). */
  taxCents: number;
  /** Sum of cash refunds, integer cents (informational). */
  cashRefundCents: number;
  /** Card revenue captured on Stripe, integer cents. */
  capturedCardCents: number;
  /** Total Stripe processing fees on captured card revenue, integer cents. */
  stripeFeeCents: number;
  /** Platform fee: 5 cents per charged order (card + cash), integer cents. */
  platformFeeCents: number;
  /** Card payout to the bank: capturedCard - stripeFee - platformFee. */
  netPayoutCents: number;
  /** Delivered card value on tabs not yet charged ("ready to charge"). */
  onHoldReadyCents: number;
  /** Stripe authorized-but-not-captured holds for the event, integer cents. */
  onHoldAuthorizedCents: number;
  /** Captured funds still settling on Stripe (available_on in future), net cents. */
  inTransitCents: number;
  unitsSold: ProductUnitsSold[];
  computedAt: Date;
}

export interface PayoutRecord {
  id: string;
  amountCents: number;
  ibanHolderName: string;
  iban: string;
  status: PayoutStatus;
  createdAt: Date;
}

export interface PayoutOverview {
  iban: string | null;
  ibanHolderName: string | null;
  /** Net payout across all events, minus in-transit funds and prior payouts. */
  availableCents: number;
  /** Captured funds still settling on Stripe, net cents. */
  inTransitCents: number;
  /** Total already requested/paid out. */
  paidOutCents: number;
  events: EventPayoutBreakdown[];
  payouts: PayoutRecord[];
}
