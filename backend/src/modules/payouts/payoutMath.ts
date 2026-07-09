import type { TabStatus } from "../tabs/model";

// Pure payout arithmetic, split out of the computeEventPayout orchestrator so the
// money rules are testable without a database: every function here takes plain
// data (a structural subset of the lean Mongoose docs) and returns integer cents.

// We take 20 cents per paid order (card or cash), on top of the passed-through
// payment processing fees.
export const PLATFORM_FEE_PER_ORDER_CENTS = 20;

// The fields the payout math reads off an order item. OrderItemDoc is a superset,
// so lean docs pass straight through; tests can build minimal fixtures.
export interface PayoutItem {
  priceIncludingTaxAtPurchase: number;
  taxRateAtPurchase: number;
  readyAt: Date | null;
  fulfilledAt: Date | null;
  cancelledAt: Date | null;
}

export interface PayoutOrder {
  tabId: string | null;
  paidAt: Date | null;
  items: PayoutItem[];
  cashRefunds: { amountCents: number }[];
}

export interface CapturedPayment {
  capturedCentsAmount: number;
  processingFeeCents?: number | null;
  availableOn?: Date | null;
}

export interface AuthorizedPayment {
  authorizedCentsAmount: number;
}

// Tax is contained in the stored tax-inclusive price. Back it out per item and
// keep everything in integer cents.
export function itemTaxCents(item: PayoutItem): number {
  const net = Math.round(
    item.priceIncludingTaxAtPurchase / (1 + item.taxRateAtPurchase / 10000)
  );
  return item.priceIncludingTaxAtPurchase - net;
}

export function isDeliveredItem(item: PayoutItem): boolean {
  return (
    !item.cancelledAt && (item.readyAt !== null || item.fulfilledAt !== null)
  );
}

export function sumItemGross(items: PayoutItem[]): number {
  return items.reduce((sum, i) => sum + i.priceIncludingTaxAtPurchase, 0);
}

export function sumItemTax(items: PayoutItem[]): number {
  return items.reduce((sum, i) => sum + itemTaxCents(i), 0);
}

export function sumCashRefunds(orders: PayoutOrder[]): number {
  return orders.reduce(
    (sum, o) => sum + o.cashRefunds.reduce((s, r) => s + r.amountCents, 0),
    0
  );
}

export interface CardSettlement {
  capturedCardCents: number;
  stripeFeeCents: number;
  inTransitCents: number;
}

// Card money that actually flows through the platform, split into what has
// cleared versus what Stripe still holds.
//
// Fail closed on unknown settlement: a capture with no availableOn (Stripe didn't
// return the balance transaction, or a legacy hold predating these fields) is
// treated as still in transit, never as cleared — otherwise its gross would
// inflate availableCents and let the organizer request money Stripe hasn't
// released. lean() also skips schema defaults, so a missing processingFeeCents
// coalesces to 0 rather than making the sum NaN.
export function summarizeCapturedCard(
  payments: CapturedPayment[],
  now: Date
): CardSettlement {
  const capturedCardCents = payments.reduce(
    (sum, p) => sum + p.capturedCentsAmount,
    0
  );
  const stripeFeeCents = payments.reduce(
    (sum, p) => sum + (p.processingFeeCents ?? 0),
    0
  );
  const inTransitCents = payments
    .filter((p) => p.availableOn == null || p.availableOn > now)
    .reduce(
      (sum, p) => sum + (p.capturedCentsAmount - (p.processingFeeCents ?? 0)),
      0
    );
  return { capturedCardCents, stripeFeeCents, inTransitCents };
}

export function sumAuthorizedHolds(payments: AuthorizedPayment[]): number {
  return payments.reduce((sum, p) => sum + p.authorizedCentsAmount, 0);
}

// "Ready to charge" must mean the whole tab can settle now. Settlement is per-tab
// and all-or-nothing, so a tab with any still-preparing item is NOT chargeable —
// its delivered items count as sold but can't be captured until the rest is ready
// or the event ends. Counting them here would promise a charge that settlement
// then refuses. Gated/unpaid orders are ignored because charging releases them
// first; cash (tabId null) is already collected; already-PAID tabs are done.
export function computeOnHoldReadyCents(
  orders: PayoutOrder[],
  tabStatusById: Map<string, TabStatus>
): number {
  const readyByTab = new Map<string, { ready: number; allReady: boolean }>();
  for (const order of orders) {
    if (order.tabId === null || tabStatusById.get(order.tabId) === "PAID")
      continue;
    if (order.paidAt == null) continue; // gated; released at charge time
    const entry = readyByTab.get(order.tabId) ?? { ready: 0, allReady: true };
    for (const item of order.items) {
      if (item.cancelledAt) continue;
      if (isDeliveredItem(item))
        entry.ready += item.priceIncludingTaxAtPurchase;
      else entry.allReady = false; // a not-ready item blocks the whole tab
    }
    readyByTab.set(order.tabId, entry);
  }
  return [...readyByTab.values()]
    .filter((tab) => tab.allReady)
    .reduce((sum, tab) => sum + tab.ready, 0);
}

export interface OrderCounts {
  paidOrderCount: number;
  soldOrderCount: number;
}

// paidOrderCount: every charged/collected order. soldOrderCount: those that also
// delivered at least one item — the platform fee accrues per sold order.
export function countOrders(orders: PayoutOrder[]): OrderCounts {
  let paidOrderCount = 0;
  let soldOrderCount = 0;
  for (const order of orders) {
    if (order.paidAt == null) continue;
    paidOrderCount += 1;
    if (order.items.some(isDeliveredItem)) soldOrderCount += 1;
  }
  return { paidOrderCount, soldOrderCount };
}

// The payout is card money only; the platform fee for every charged order — cash
// included — is netted out of the card pool here, so a live event can show a
// small negative until the captures catch up (by design).
export function computeNetPayoutCents(figures: {
  capturedCardCents: number;
  stripeFeeCents: number;
  platformFeeCents: number;
}): number {
  return (
    figures.capturedCardCents -
    figures.stripeFeeCents -
    figures.platformFeeCents
  );
}
