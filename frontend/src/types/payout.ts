// Mirrors the backend payouts module. Money is always integer cents.
export type EventStatus = 'DRAFT' | 'ACTIVE' | 'STOPPED';

export interface ProductUnitsSold {
  productId: string;
  productName: string;
  unitsSold: number;
  grossRevenueCents: number;
}

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
  inTransitCents: number;
  unitsSold: ProductUnitsSold[];
  computedAt: string;
}

export type PayoutStatus = 'REQUESTED' | 'PAID';

export interface PayoutRecord {
  id: string;
  amountCents: number;
  ibanHolderName: string;
  iban: string;
  status: PayoutStatus;
  createdAt: string;
}

export interface PayoutOverview {
  iban: string | null;
  ibanHolderName: string | null;
  availableCents: number;
  inTransitCents: number;
  paidOutCents: number;
  events: EventPayoutBreakdown[];
  payouts: PayoutRecord[];
}

// Result of charging all tabs for an event (POST /events/:id/tabs/checkout).
export interface BulkTabCheckoutResult {
  eventId: string;
  processed: number;
  settled: number;
  skipped: number;
  failed: number;
}
