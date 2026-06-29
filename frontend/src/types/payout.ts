// Mirrors the backend payouts module. Money is always integer cents.
export type EventStatus = 'DRAFT' | 'ACTIVE' | 'STOPPED';

export interface ProductUnitsSold {
  productId: string;
  productName: string;
  unitsSold: number;
  grossRevenueCents: number;
  netRevenueCents: number;
  taxCents: number;
  // Tax rate in basis points (1900 = 19%), or null when the line mixes rates.
  taxRateBp: number | null;
}

// Sales are recognized on delivery and method-agnostic, so grossSalesCents
// equals the items-sold table total. netPayoutCents is card money only:
// captured card minus Stripe fees minus the platform fee on every charged
// order (cash included — netted out of the card pool, since cash never flows
// through the platform).
export interface EventPayoutBreakdown {
  eventId: string;
  eventName: string;
  eventStatus: EventStatus;
  paidOrderCount: number;
  soldOrderCount: number;
  grossSalesCents: number;
  cashSalesCents: number;
  pendingSalesCents: number;
  taxCents: number;
  cashRefundCents: number;
  capturedCardCents: number;
  stripeFeeCents: number;
  platformFeeCents: number;
  netPayoutCents: number;
  onHoldReadyCents: number;
  onHoldAuthorizedCents: number;
  inTransitCents: number;
  // Delivered items grouped by product (drive the sales figures).
  unitsSold: ProductUnitsSold[];
  // Ordered, not-yet-ready items grouped by product (the operator pipeline).
  pendingUnits: ProductUnitsSold[];
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
