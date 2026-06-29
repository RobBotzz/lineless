import { Event } from "../events/model";
import { EventNotFoundError } from "../events/errors";
import { verifyEventOwnership } from "../events/ownership";
import { Order, type OrderItemDoc } from "../orders/model";
import { Tab } from "../tabs/model";
import { TabPayment } from "../payments/model";
import { Product } from "../products/model";
import { Account } from "../accounts/model";
import { EventPayout, Payout } from "./model";
import { MissingBankDetailsError, NoPayoutAvailableError } from "./errors";
import type {
  EventPayoutBreakdown,
  PayoutOverview,
  PayoutRecord,
  ProductUnitsSold,
} from "./types";

// We take 5 cents per paid order (card or cash), on top of the passed-through
// payment processing fees.
const PLATFORM_FEE_PER_ORDER_CENTS = 5;

// Tax is contained in the stored tax-inclusive price. Back it out per item and
// keep everything in integer cents.
function itemTaxCents(item: OrderItemDoc): number {
  const net = Math.round(
    item.priceIncludingTaxAtPurchase / (1 + item.taxRateAtPurchase / 10000)
  );
  return item.priceIncludingTaxAtPurchase - net;
}

function isDeliveredItem(item: OrderItemDoc): boolean {
  return (
    !item.cancelledAt && (item.readyAt !== null || item.fulfilledAt !== null)
  );
}

// Recomputes an event's payout figures from orders, tabs and payments, persists
// the snapshot, and returns the full breakdown.
//
// Two clocks are kept deliberately separate. SALES are recognized on delivery
// (READY/FULFILLED, non-cancelled) and are method-agnostic, so grossSalesCents
// always equals the items-sold table. The PAYOUT is card money only: captured
// card minus Stripe fees minus the platform fee on every charged order. Cash is
// collected upfront and never custodied by the platform, so it is reported as
// sales but never added to the payout — its platform fee is netted out of the
// card pool instead.
export async function computeEventPayout(
  eventId: string,
  accountId: string
): Promise<EventPayoutBreakdown> {
  await verifyEventOwnership(eventId, accountId);
  const event = await Event.findOne({ _id: eventId, deletedAt: null })
    .select("name status")
    .lean();
  if (!event) throw new EventNotFoundError();

  // Every live order for the event (card and cash). Sales scan only delivered
  // items off these; undelivered/authorized items are not yet "sold".
  const orders = await Order.find({ eventId, deletedAt: null })
    .select("tabId paidAt items cashRefunds")
    .lean();

  const tabs = await Tab.find({ eventId }).select("_id status").lean();
  const tabStatusById = new Map(tabs.map((t) => [t._id, t.status]));
  const tabIds = tabs.map((t) => t._id);

  // Delivered items drive every sales figure: the table, total sales, and tax.
  const deliveredItems = orders.flatMap((o) => o.items.filter(isDeliveredItem));
  const grossSalesCents = deliveredItems.reduce(
    (sum, i) => sum + i.priceIncludingTaxAtPurchase,
    0
  );
  const taxCents = deliveredItems.reduce((sum, i) => sum + itemTaxCents(i), 0);
  const unitsSold = await buildUnitsSold(deliveredItems);

  // Committed but not-yet-ready items on paid orders — the operator pipeline.
  // Surfaced so the payout view shows everything ordered, not only what was
  // delivered; it is NOT counted as sales until delivered. Gated/unpaid orders
  // are excluded since they are cancelled at settlement.
  const pendingItems = orders
    .filter((o) => o.paidAt != null)
    .flatMap((o) =>
      o.items.filter((i) => !i.cancelledAt && !i.readyAt && !i.fulfilledAt)
    );
  const pendingSalesCents = pendingItems.reduce(
    (sum, i) => sum + i.priceIncludingTaxAtPurchase,
    0
  );
  const pendingUnits = await buildUnitsSold(pendingItems);

  // Cash sales are recognized on delivery like card, for one consistent rule,
  // and reported separately so the organizer sees what is already in hand.
  const cashSalesCents = orders
    .filter((o) => o.tabId === null)
    .flatMap((o) => o.items.filter(isDeliveredItem))
    .reduce((sum, i) => sum + i.priceIncludingTaxAtPurchase, 0);
  const cashRefundCents = orders.reduce(
    (sum, o) => sum + o.cashRefunds.reduce((s, r) => s + r.amountCents, 0),
    0
  );

  // Card money that actually flows through the platform.
  const capturedPayments = await TabPayment.find({
    tabId: { $in: tabIds },
    tabPaymentStatus: "CAPTURED",
  })
    .select("capturedCentsAmount processingFeeCents availableOn")
    .lean();
  const capturedCardCents = capturedPayments.reduce(
    (sum, p) => sum + p.capturedCentsAmount,
    0
  );
  // lean() skips schema defaults, so holds captured before processingFeeCents
  // existed read back undefined — coalesce to 0 so the sum never becomes NaN.
  const stripeFeeCents = capturedPayments.reduce(
    (sum, p) => sum + (p.processingFeeCents ?? 0),
    0
  );
  // Captured funds still held by Stripe (available_on in the future) have not
  // cleared yet, so they count as pending, not available. Use the net amount —
  // what Stripe actually holds in the pending balance.
  const now = new Date();
  const inTransitCents = capturedPayments
    .filter((p) => p.availableOn != null && p.availableOn > now)
    .reduce(
      (sum, p) => sum + (p.capturedCentsAmount - (p.processingFeeCents ?? 0)),
      0
    );

  const authorizedPayments = await TabPayment.find({
    tabId: { $in: tabIds },
    tabPaymentStatus: "AUTHORIZED",
  })
    .select("authorizedCentsAmount")
    .lean();
  const onHoldAuthorizedCents = authorizedPayments.reduce(
    (sum, p) => sum + p.authorizedCentsAmount,
    0
  );

  // "Ready to charge" must mean the whole tab can settle now. Settlement is
  // per-tab and all-or-nothing, so a tab with any still-preparing item is NOT
  // chargeable — its delivered items count as sold (above) but can't be captured
  // until the rest is ready or the event ends. Counting them here would promise
  // a charge that settlement then refuses. Gated/unpaid orders are ignored
  // because charging releases them first; cash (tabId null) is already collected.
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
  const onHoldReadyCents = [...readyByTab.values()]
    .filter((tab) => tab.allReady)
    .reduce((sum, tab) => sum + tab.ready, 0);

  // The platform fee is billed per order that has actually sold something: paid
  // and with at least one delivered item. It accrues as soon as an item is sold,
  // regardless of whether that order's card has been captured yet, so the fee is
  // visible the moment a sale happens. (This still excludes gated/unconfirmed
  // orders and orders that delivered nothing.) The fee is deducted in full from
  // the net payout, so a live event can show a small negative until the captures
  // catch up — by design.
  const paidOrderCount = orders.filter((o) => o.paidAt != null).length;
  const soldOrderCount = orders.filter(
    (o) => o.paidAt != null && o.items.some(isDeliveredItem)
  ).length;
  const platformFeeCents = soldOrderCount * PLATFORM_FEE_PER_ORDER_CENTS;

  // The payout is card money only; the platform fee for every charged order —
  // cash included — is netted out of the card pool here.
  const netPayoutCents = capturedCardCents - stripeFeeCents - platformFeeCents;

  const computedAt = new Date();
  await EventPayout.findOneAndUpdate(
    { eventId },
    {
      $set: {
        accountId,
        grossSalesCents,
        cashSalesCents,
        pendingSalesCents,
        cashRefundCents,
        taxCents,
        capturedCardCents,
        stripeFeeCents,
        platformFeeCents,
        netPayoutCents,
        onHoldReadyCents,
        onHoldAuthorizedCents,
        inTransitCents,
        paidOrderCount,
        soldOrderCount,
        computedAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    eventId,
    eventName: event.name,
    eventStatus: event.status,
    paidOrderCount,
    soldOrderCount,
    grossSalesCents,
    cashSalesCents,
    pendingSalesCents,
    taxCents,
    cashRefundCents,
    capturedCardCents,
    stripeFeeCents,
    platformFeeCents,
    netPayoutCents,
    onHoldReadyCents,
    onHoldAuthorizedCents,
    inTransitCents,
    unitsSold,
    pendingUnits,
    computedAt,
  };
}

async function buildUnitsSold(
  items: OrderItemDoc[]
): Promise<ProductUnitsSold[]> {
  const byProduct = new Map<
    string,
    { units: number; gross: number; tax: number; rates: Set<number> }
  >();
  for (const item of items) {
    const entry = byProduct.get(item.productId) ?? {
      units: 0,
      gross: 0,
      tax: 0,
      rates: new Set<number>(),
    };
    entry.units += 1;
    entry.gross += item.priceIncludingTaxAtPurchase;
    entry.tax += itemTaxCents(item);
    entry.rates.add(item.taxRateAtPurchase);
    byProduct.set(item.productId, entry);
  }

  const products = await Product.find({
    _id: { $in: [...byProduct.keys()] },
  })
    .select("productName")
    .lean();
  const nameById = new Map(products.map((p) => [p._id, p.productName]));

  return [...byProduct.entries()]
    .map(([productId, { units, gross, tax, rates }]) => ({
      productId,
      productName: nameById.get(productId) ?? "Unknown product",
      unitsSold: units,
      grossRevenueCents: gross,
      netRevenueCents: gross - tax,
      taxCents: tax,
      // Only a uniform rate can be shown as "(19%)"; mixed snapshots stay null.
      taxRateBp: rates.size === 1 ? [...rates][0]! : null,
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold);
}

// Overview for the payout page: the organizer's payout bank details plus a
// summary row per event (DRAFT/ACTIVE/STOPPED — active events are included so
// the organizer can close their tabs from this view).
export async function getPayoutOverview(
  accountId: string
): Promise<PayoutOverview> {
  const account = await Account.findOne({ accountId, deletedAt: null })
    .select("iban ibanHolderName")
    .lean();

  const events = await Event.find({ accountId, deletedAt: null })
    .select("_id")
    .sort({ createdAt: -1 })
    .lean();

  const breakdowns: EventPayoutBreakdown[] = [];
  for (const event of events) {
    breakdowns.push(await computeEventPayout(event._id, accountId));
  }

  const totalNetCents = breakdowns.reduce(
    (sum, e) => sum + e.netPayoutCents,
    0
  );
  // Funds still settling on Stripe are not yet payable.
  const inTransitCents = breakdowns.reduce(
    (sum, e) => sum + e.inTransitCents,
    0
  );
  const payouts = await listPayouts(accountId);
  const paidOutCents = payouts.reduce((sum, p) => sum + p.amountCents, 0);

  return {
    iban: account?.iban ?? null,
    ibanHolderName: account?.ibanHolderName ?? null,
    availableCents: Math.max(totalNetCents - inTransitCents - paidOutCents, 0),
    inTransitCents,
    paidOutCents,
    events: breakdowns,
    payouts,
  };
}

export async function getEventPayout(
  eventId: string,
  accountId: string
): Promise<EventPayoutBreakdown> {
  return computeEventPayout(eventId, accountId);
}

export async function listPayouts(accountId: string): Promise<PayoutRecord[]> {
  const payouts = await Payout.find({ accountId })
    .sort({ createdAt: -1 })
    .lean();
  return payouts.map((p) => ({
    id: p._id,
    amountCents: p.amountCents,
    ibanHolderName: p.ibanHolderSnapshot,
    iban: p.ibanSnapshot,
    status: p.status,
    createdAt: p.createdAt,
  }));
}

// Records a payout for the organizer's currently available revenue. Payouts are
// manual bank transfers, so this freezes the amount and bank details and marks
// the entry PAID (the transfer is assumed done out of band).
export async function requestPayout(accountId: string): Promise<PayoutRecord> {
  const account = await Account.findOne({ accountId, deletedAt: null })
    .select("iban ibanHolderName")
    .lean();
  if (!account?.iban || !account.ibanHolderName) {
    throw new MissingBankDetailsError();
  }

  const overview = await getPayoutOverview(accountId);
  if (overview.availableCents <= 0) {
    throw new NoPayoutAvailableError();
  }

  const created = await Payout.create({
    accountId,
    amountCents: overview.availableCents,
    ibanSnapshot: account.iban,
    ibanHolderSnapshot: account.ibanHolderName,
    status: "PAID",
  });

  return {
    id: created._id,
    amountCents: created.amountCents,
    ibanHolderName: created.ibanHolderSnapshot,
    iban: created.ibanSnapshot,
    status: created.status,
    createdAt: created.createdAt,
  };
}
