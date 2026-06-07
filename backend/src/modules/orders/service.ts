import mongoose from "mongoose";
import Stripe from "stripe";
import crypto from "crypto";
import { config } from "../../config/config";
import { Order } from "./model";
import { Tab } from "../tabs/model";
import { TabPayment } from "../payments/model";
import { Product } from "../products/model";
import { Stand } from "../stands/model";
import { Event } from "../events/model";
import {
  CashierDisabledError,
  CashPaymentNotFoundError,
  CashRefundExceedsTotalError,
  EventNotActiveError,
  OfflineOrdersDisabledError,
  OrderAlreadyPaidError,
  OrderNotFoundError,
  StandNotFoundError,
  OrderValidationError,
} from "./errors";
import type { CreateOrderInput, IssueCashRefundInput } from "./types";

const stripe = new Stripe(config.stripe.secretKey);

function generateAuthCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function submitOrder(
  /** Attendee sessionId for guest orders; null for cashier (operator) orders. */
  sessionId: string | null,
  input: CreateOrderInput
) {
  const { standId, tabId, items } = input;

  // Resolve the stand to get the eventId and verify it exists.
  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  const { eventId } = stand;

  // Verify the event is running.
  const event = await Event.findOne({ _id: eventId, deletedAt: null });
  if (!event || event.status !== "ACTIVE") throw new EventNotActiveError();

  // Cash orders require offlineOrdersEnabled when there is no tabId.
  if (!tabId && !event.offlineOrdersEnabled)
    throw new OfflineOrdersDisabledError();

  // Tab orders: verify the tab is OPEN before doing any further work.
  if (tabId) {
    const tab = await Tab.findById(tabId);
    if (!tab || tab.status !== "OPEN") {
      throw new OrderValidationError("Tab is not OPEN or does not exist.");
    }
  }

  // Fetch products and verify they are LIVE and belong to this stand.
  const productIds = items.map((item) => item.productId);
  const products = await Product.find({
    _id: { $in: productIds },
    standId,
    deletedAt: null,
  });
  const productById = new Map(products.map((p) => [p._id, p]));

  let totalCents = 0;
  const processedItems = items.flatMap((item) => {
    const product = productById.get(item.productId);
    if (!product || product.productStatus !== "LIVE") {
      throw new OrderValidationError(
        `Product ${item.productId} is not available for ordering.`
      );
    }
    totalCents += product.priceIncludingTax * item.quantity;
    return Array.from({ length: item.quantity }).map(() => ({
      productId: item.productId,
      customerComment: item.customerComment ?? null,
      priceExclTaxAtPurchase: product.priceIncludingTax,
      taxRateAtPurchase: product.taxRate,
      startedAt: null as Date | null,
    }));
  });

  // orderNumber is the next sequential number scoped to this event.
  const orderCount = await Order.countDocuments({ eventId });
  const orderNumber = orderCount + 1;
  const authCode = generateAuthCode();

  // Cash order: persist immediately; items are gated (startedAt = null) until
  // the operator confirms cash via POST /cash-payments/:cashPaymentId/... .
  // For cashier (operator) orders, cashierEnabled must be on.
  if (!tabId) {
    if (!event.cashierEnabled && sessionId === null) {
      throw new CashierDisabledError();
    }

    const dbSession = await mongoose.startSession();
    let createdOrder;
    await dbSession.withTransaction(async () => {
      const orders = await Order.create(
        [
          {
            standId,
            eventId,
            tabId: null,
            sessionId,
            orderNumber,
            authCode,
            items: processedItems,
          },
        ],
        { session: dbSession }
      );
      createdOrder = orders[0];
    });
    await dbSession.endSession();
    return { status: 201 as const, order: createdOrder };
  }

  // Tab (Stripe) order: check remaining authorization headroom.
  const payments = await TabPayment.find({
    tabId,
    tabPaymentStatus: { $in: ["AUTHORIZED", "CAPTURED"] },
  });
  const authorizedCents = payments.reduce(
    (sum, p) => sum + p.authorizedCentsAmount,
    0
  );

  const existingOrders = await Order.find({ tabId });
  const consumedCents = existingOrders
    .flatMap((o) => o.items)
    .reduce((sum, i) => sum + i.priceExclTaxAtPurchase, 0);

  if (consumedCents + totalCents > authorizedCents) {
    const overage = consumedCents + totalCents - authorizedCents;

    // Stripe call outside the transaction — cannot be rolled back.
    const pi = await stripe.paymentIntents.create({
      amount: overage,
      currency: "eur",
      capture_method: "manual",
      metadata: { tabId },
    });

    const dbSession = await mongoose.startSession();
    await dbSession.withTransaction(async () => {
      await TabPayment.create(
        [
          {
            tabId,
            stripePaymentIntentId: pi.id,
            tabPaymentStatus: "PENDING",
            authorizedCentsAmount: overage,
          },
        ],
        { session: dbSession }
      );
      await Tab.updateOne(
        { _id: tabId },
        { status: "PENDING_AUTHORIZATION" },
        { session: dbSession }
      );
      await Order.create(
        [
          {
            standId,
            eventId,
            tabId,
            sessionId,
            orderNumber,
            authCode,
            items: processedItems,
          },
        ],
        { session: dbSession }
      );
    });
    await dbSession.endSession();

    return { status: 402 as const, clientSecret: pi.client_secret };
  }

  // Under limit: release items to the kitchen immediately.
  processedItems.forEach((i) => (i.startedAt = new Date()));

  const dbSession = await mongoose.startSession();
  let createdOrder;
  await dbSession.withTransaction(async () => {
    const orders = await Order.create(
      [
        {
          standId,
          eventId,
          tabId,
          sessionId,
          orderNumber,
          authCode,
          items: processedItems,
        },
      ],
      { session: dbSession }
    );
    createdOrder = orders[0];
  });
  await dbSession.endSession();

  return { status: 201 as const, order: createdOrder };
}

export async function confirmCashPayment(orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new OrderNotFoundError();
  if (order.paidAt) throw new OrderAlreadyPaidError();

  const event = await Event.findOne({
    _id: order.eventId,
    deletedAt: null,
  });
  if (!event || !event.cashierEnabled) throw new CashierDisabledError();

  const now = new Date();
  order.cashPayment = { _id: crypto.randomUUID(), createdAt: now };
  order.paidAt = now;
  order.items.forEach((item) => {
    if (!item.startedAt) item.startedAt = now;
  });
  await order.save();

  return order;
}

export async function issueCashRefund(
  cashPaymentId: string,
  input: IssueCashRefundInput
) {
  const order = await Order.findOne({ "cashPayment._id": cashPaymentId });
  if (!order?.cashPayment) throw new CashPaymentNotFoundError();

  // Refund must not exceed the order total (sum of all items incl. tax).
  const orderTotal = order.items.reduce(
    (sum, i) =>
      sum + Math.round(i.priceExclTaxAtPurchase * (1 + i.taxRateAtPurchase)),
    0
  );
  const alreadyRefunded = order.cashRefunds.reduce(
    (sum, r) => sum + r.amountCents,
    0
  );
  if (alreadyRefunded + input.amountCents > orderTotal) {
    throw new CashRefundExceedsTotalError();
  }

  order.cashRefunds.push({
    _id: crypto.randomUUID(),
    amountCents: input.amountCents,
    createdAt: new Date(),
  });
  await order.save();

  return order.cashRefunds[order.cashRefunds.length - 1];
}
