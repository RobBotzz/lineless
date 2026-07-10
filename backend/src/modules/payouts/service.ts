import mongoose from "mongoose";
import { Event } from "../events/model";
import { EventNotFoundError } from "../events/errors";
import { verifyEventOwnership } from "../events/ownership";
import { Order, type OrderItemDoc } from "../orders/model";
import { Tab } from "../tabs/model";
import { TabPayment } from "../payments/model";
import { Product } from "../products/model";
import { Account } from "../accounts/model";
import { Payout } from "./model";
import { MissingBankDetailsError, NoPayoutAvailableError } from "./errors";
import type {
  EventPayoutBreakdown,
  PayoutOverview,
  PayoutRecord,
  ProductUnitsSold,
} from "./types";
import {
  PLATFORM_FEE_PER_ORDER_CENTS,
  computeNetPayoutCents,
  computeOnHoldReadyCents,
  countOrders,
  isDeliveredItem,
  itemTaxCents,
  sumAuthorizedHolds,
  sumCashRefunds,
  sumItemGross,
  sumItemTax,
  summarizeCapturedCard,
} from "./payoutMath";

// Recomputes an event's payout figures from orders, tabs and payments and
// returns the full breakdown. Pure read: the orders, tabs and payments are the
// source of truth, so nothing is persisted here.
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
  const grossSalesCents = sumItemGross(deliveredItems);
  const taxCents = sumItemTax(deliveredItems);
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
  const pendingSalesCents = sumItemGross(pendingItems);
  const pendingUnits = await buildUnitsSold(pendingItems);

  // Cash sales are recognized on delivery like card, for one consistent rule,
  // and reported separately so the organizer sees what is already in hand.
  const cashSalesCents = sumItemGross(
    orders
      .filter((o) => o.tabId === null)
      .flatMap((o) => o.items.filter(isDeliveredItem))
  );
  const cashRefundCents = sumCashRefunds(orders);

  // Card money that actually flows through the platform: what has cleared vs.
  // what Stripe still holds (in transit).
  const capturedPayments = await TabPayment.find({
    tabId: { $in: tabIds },
    tabPaymentStatus: "CAPTURED",
  })
    .select("capturedCentsAmount processingFeeCents availableOn")
    .lean();
  const { capturedCardCents, stripeFeeCents, inTransitCents } =
    summarizeCapturedCard(capturedPayments, new Date());

  const authorizedPayments = await TabPayment.find({
    tabId: { $in: tabIds },
    tabPaymentStatus: "AUTHORIZED",
  })
    .select("authorizedCentsAmount")
    .lean();
  const onHoldAuthorizedCents = sumAuthorizedHolds(authorizedPayments);

  const onHoldReadyCents = computeOnHoldReadyCents(orders, tabStatusById);

  // The platform fee is billed per order that has actually sold something: paid
  // and with at least one delivered item. It accrues as soon as an item is sold,
  // regardless of whether that order's card has been captured yet, so the fee is
  // visible the moment a sale happens. The fee is deducted in full from the net
  // payout, so a live event can show a small negative until captures catch up.
  const { paidOrderCount, soldOrderCount } = countOrders(orders);
  const platformFeeCents = soldOrderCount * PLATFORM_FEE_PER_ORDER_CENTS;
  const netPayoutCents = computeNetPayoutCents({
    capturedCardCents,
    stripeFeeCents,
    platformFeeCents,
  });

  const computedAt = new Date();

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

// Records a payout request for the organizer's currently available revenue.
// Payouts are manual bank transfers, so this freezes the amount and bank details
// and records the entry as REQUESTED — the actual transfer happens out of band
// and is marked PAID by a later completion step. We deliberately do NOT mark it
// PAID here: no money has moved yet, and claiming otherwise would misreport a
// completed transfer.
//
// Concurrency: the entitlement (net revenue minus in-transit funds) is computed
// once up front, then the amount is finalized inside a transaction that bumps
// `Account.payoutLockVersion`. Two concurrent requests both write that same
// account document, so Mongo aborts one with a write conflict; withTransaction
// retries it, and on retry the prior payout is committed — so the recomputed
// amount is 0 and the duplicate is rejected. This prevents double payouts.
export async function requestPayout(accountId: string): Promise<PayoutRecord> {
  const account = await Account.findOne({ accountId, deletedAt: null })
    .select("iban ibanHolderName")
    .lean();
  if (!account?.iban || !account.ibanHolderName) {
    throw new MissingBankDetailsError();
  }
  // Trim defends against whitespace-only values (direct API clients, legacy
  // rows): a blank IBAN or holder name is not a usable transfer destination.
  // Locals also keep the non-null narrowing alive inside the closure below.
  const iban = account.iban.trim();
  const ibanHolderName = account.ibanHolderName.trim();
  if (!iban || !ibanHolderName) {
    throw new MissingBankDetailsError();
  }

  const overview = await getPayoutOverview(accountId);
  if (overview.availableCents <= 0) {
    throw new NoPayoutAvailableError();
  }
  // What the organizer is entitled to in total, independent of prior payouts:
  // available = max(entitlement - paidOut, 0), and available > 0 here.
  const entitlementCents = overview.availableCents + overview.paidOutCents;

  const dbSession = await mongoose.startSession();
  try {
    let created: Awaited<ReturnType<typeof Payout.create>>[number] | undefined;
    await dbSession.withTransaction(async () => {
      // Serialization point: forces concurrent payout requests for this account
      // to conflict so only one can commit per recomputed entitlement.
      await Account.updateOne(
        { accountId },
        { $inc: { payoutLockVersion: 1 } },
        { session: dbSession }
      );

      const priorPayouts = await Payout.find({ accountId })
        .select("amountCents")
        .session(dbSession);
      const paidOutCents = priorPayouts.reduce(
        (sum, p) => sum + p.amountCents,
        0
      );
      const amountCents = entitlementCents - paidOutCents;
      if (amountCents <= 0) {
        throw new NoPayoutAvailableError();
      }

      const docs = await Payout.create(
        [
          {
            accountId,
            amountCents,
            ibanSnapshot: iban,
            ibanHolderSnapshot: ibanHolderName,
            status: "REQUESTED",
          },
        ],
        { session: dbSession }
      );
      created = docs[0];
    });

    // created is always set when the transaction commits without throwing.
    const payout = created!;
    return {
      id: payout._id,
      amountCents: payout.amountCents,
      ibanHolderName: payout.ibanHolderSnapshot,
      iban: payout.ibanSnapshot,
      status: payout.status,
      createdAt: payout.createdAt,
    };
  } finally {
    await dbSession.endSession();
  }
}
