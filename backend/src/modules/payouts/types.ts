import type { EventStatus } from "../events/model";
import type { PayoutStatus } from "./model";

export interface ProductUnitsSold {
  productId: string;
  productName: string;
  unitsSold: number;
  grossRevenueCents: number;
}

// Full breakdown for a single event's payout detail view.
export interface EventPayoutBreakdown {
  eventId: string;
  eventName: string;
  eventStatus: EventStatus;
  paidOrderCount: number;
  grossRevenueCents: number;
  cardRevenueCents: number;
  cashRevenueCents: number;
  cashRefundCents: number;
  taxCents: number;
  stripeFeeCents: number;
  platformFeeCents: number;
  netPayoutCents: number;
  onHoldReadyCents: number;
  onHoldAuthorizedCents: number;
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
  /** Net payout across all events, minus payouts already requested. */
  availableCents: number;
  /** Total already requested/paid out. */
  paidOutCents: number;
  events: EventPayoutBreakdown[];
  payouts: PayoutRecord[];
}
