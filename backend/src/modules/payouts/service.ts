import { Event } from "../events/model";
import { EventNotFoundError } from "../events/errors";
import { verifyEventOwnership } from "../events/ownership";
import { Order, type OrderItemDoc } from "../orders/model";
import { Tab } from "../tabs/model";
import { TabPayment } from "../payments/model";
import { Product } from "../products/model";
import { Account } from "../accounts/model";
import { EventPayout } from "./model";
import type {
  EventPayoutBreakdown,
  EventPayoutSummary,
  PayoutOverview,
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

function isChargedItem(item: OrderItemDoc): boolean {
  return !item.cancelledAt;
}

function isDeliveredItem(item: OrderItemDoc): boolean {
  return (
    !item.cancelledAt && (item.readyAt !== null || item.fulfilledAt !== null)
  );
}

// Recomputes an event's payout figures from orders, tabs and payments, persists
// the snapshot, and returns the full breakdown. Card revenue is taken from the
// actual Stripe captures (authoritative: settlement only ever captures
// delivered, non-cancelled items); cash revenue is the collected total minus
// refunds, since cash is taken upfront and only refunds return money.
export async function computeEventPayout(
  eventId: string,
  accountId: string
): Promise<EventPayoutBreakdown> {
  await verifyEventOwnership(eventId, accountId);
  const event = await Event.findOne({ _id: eventId, deletedAt: null })
    .select("name status")
    .lean();
  if (!event) throw new EventNotFoundError();

  const paidOrders = await Order.find({
    eventId,
    paidAt: { $ne: null },
    deletedAt: null,
  })
    .select("tabId items cashRefunds")
    .lean();

  const cashOrders = paidOrders.filter((o) => o.tabId === null);

  const cashItemsTotal = cashOrders.reduce(
    (sum, o) =>
      sum + o.items.reduce((s, i) => s + i.priceIncludingTaxAtPurchase, 0),
    0
  );
  const cashRefundCents = cashOrders.reduce(
    (sum, o) => sum + o.cashRefunds.reduce((s, r) => s + r.amountCents, 0),
    0
  );
  const cashRevenueCents = cashItemsTotal - cashRefundCents;

  const tabIds = await Tab.find({ eventId }).distinct("_id");

  const capturedPayments = await TabPayment.find({
    tabId: { $in: tabIds },
    tabPaymentStatus: "CAPTURED",
  })
    .select("capturedCentsAmount processingFeeCents")
    .lean();
  const cardRevenueCents = capturedPayments.reduce(
    (sum, p) => sum + p.capturedCentsAmount,
    0
  );
  const stripeFeeCents = capturedPayments.reduce(
    (sum, p) => sum + p.processingFeeCents,
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

  // Delivered value sitting on tabs that have not yet been charged.
  const unpaidTabIds = await Tab.find({
    eventId,
    status: { $ne: "PAID" },
  }).distinct("_id");
  const unpaidTabOrders = await Order.find({
    tabId: { $in: unpaidTabIds },
    deletedAt: null,
  })
    .select("items")
    .lean();
  const onHoldReadyCents = unpaidTabOrders.reduce(
    (sum, o) =>
      sum +
      o.items
        .filter(isDeliveredItem)
        .reduce((s, i) => s + i.priceIncludingTaxAtPurchase, 0),
    0
  );

  const grossRevenueCents = cardRevenueCents + cashRevenueCents;
  const platformFeeCents = paidOrders.length * PLATFORM_FEE_PER_ORDER_CENTS;
  const netPayoutCents = grossRevenueCents - stripeFeeCents - platformFeeCents;

  // Tax and units sold over charged (non-cancelled) items of paid orders.
  const chargedItems = paidOrders.flatMap((o) => o.items.filter(isChargedItem));
  const taxCents = chargedItems.reduce((sum, i) => sum + itemTaxCents(i), 0);
  const unitsSold = await buildUnitsSold(chargedItems);

  const computedAt = new Date();
  await EventPayout.findOneAndUpdate(
    { eventId },
    {
      $set: {
        accountId,
        grossRevenueCents,
        cardRevenueCents,
        cashRevenueCents,
        cashRefundCents,
        taxCents,
        stripeFeeCents,
        platformFeeCents,
        netPayoutCents,
        onHoldReadyCents,
        onHoldAuthorizedCents,
        paidOrderCount: paidOrders.length,
        computedAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    eventId,
    eventName: event.name,
    eventStatus: event.status,
    paidOrderCount: paidOrders.length,
    grossRevenueCents,
    cardRevenueCents,
    cashRevenueCents,
    cashRefundCents,
    taxCents,
    stripeFeeCents,
    platformFeeCents,
    netPayoutCents,
    onHoldReadyCents,
    onHoldAuthorizedCents,
    unitsSold,
    computedAt,
  };
}

async function buildUnitsSold(
  items: OrderItemDoc[]
): Promise<ProductUnitsSold[]> {
  const byProduct = new Map<string, { units: number; gross: number }>();
  for (const item of items) {
    const entry = byProduct.get(item.productId) ?? { units: 0, gross: 0 };
    entry.units += 1;
    entry.gross += item.priceIncludingTaxAtPurchase;
    byProduct.set(item.productId, entry);
  }

  const products = await Product.find({
    _id: { $in: [...byProduct.keys()] },
  })
    .select("productName")
    .lean();
  const nameById = new Map(products.map((p) => [p._id, p.productName]));

  return [...byProduct.entries()]
    .map(([productId, { units, gross }]) => ({
      productId,
      productName: nameById.get(productId) ?? "Unknown product",
      unitsSold: units,
      grossRevenueCents: gross,
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

  const summaries: EventPayoutSummary[] = [];
  for (const event of events) {
    const breakdown = await computeEventPayout(event._id, accountId);
    summaries.push({
      eventId: breakdown.eventId,
      eventName: breakdown.eventName,
      eventStatus: breakdown.eventStatus,
      grossRevenueCents: breakdown.grossRevenueCents,
      netPayoutCents: breakdown.netPayoutCents,
      onHoldCents: breakdown.onHoldReadyCents,
    });
  }

  return {
    iban: account?.iban ?? null,
    ibanHolderName: account?.ibanHolderName ?? null,
    events: summaries,
  };
}

export async function getEventPayout(
  eventId: string,
  accountId: string
): Promise<EventPayoutBreakdown> {
  return computeEventPayout(eventId, accountId);
}
