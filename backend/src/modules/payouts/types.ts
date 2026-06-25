import type { EventStatus } from "../events/model";

export interface ProductUnitsSold {
  productId: string;
  productName: string;
  unitsSold: number;
  grossRevenueCents: number;
}

// Lightweight per-event row for the payout overview list.
export interface EventPayoutSummary {
  eventId: string;
  eventName: string;
  eventStatus: EventStatus;
  grossRevenueCents: number;
  netPayoutCents: number;
  onHoldCents: number;
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

export interface PayoutOverview {
  iban: string | null;
  ibanHolderName: string | null;
  events: EventPayoutSummary[];
}
