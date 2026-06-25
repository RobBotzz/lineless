import type { EventStatus } from "../events/model";

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

export interface PayoutOverview {
  iban: string | null;
  ibanHolderName: string | null;
  events: EventPayoutBreakdown[];
}
