import mongoose from "mongoose";
import Stripe from "stripe";
import crypto from "crypto";
import { config } from "../../config/config";
import { Order, type OrderDoc, type OrderItemDoc } from "./model";
import { Tab } from "../tabs/model";
import { TabPayment } from "../payments/model";
import { Product } from "../products/model";
import { Stand } from "../stands/model";
import { Event } from "../events/model";
import { verifyEventOwnership } from "../events/ownership";
import {
  CashierDisabledError,
  CashPaymentNotFoundError,
  CashRefundExceedsTotalError,
  EventNotActiveError,
  OfflineOrdersDisabledError,
  OrderAlreadyPaidError,
  OrderItemNotFoundError,
  OrderItemStateError,
  OrderNotFoundError,
  StandNotFoundError,
  OrderValidationError,
} from "./errors";
import type { CreateOrderInput, IssueCashRefundInput } from "./types";

const stripe = new Stripe(config.stripe.secretKey);

function generateAuthCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export type ItemState =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "FULFILLED"
  | "CANCELLED";

export function getItemState(item: OrderItemDoc): ItemState {
  if (item.cancelledAt) return "CANCELLED";
  if (item.fulfilledAt) return "FULFILLED";
  if (item.readyAt) return "READY";
  if (item.startedAt) return "PREPARING";
  return "PENDING";
}

export async function submitOrder(
  /** Attendee sessionId for guest orders; null for cashier (operator) orders. */
  sessionId: string | null,
  input: CreateOrderInput
) {
  const { standId, tabId, items } = input;

  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  const { eventId } = stand;

  const event = await Event.findOne({ _id: eventId, deletedAt: null });
  if (!event || event.status !== "ACTIVE") throw new EventNotActiveError();

  if (!tabId && !event.offlineOrdersEnabled)
    throw new OfflineOrdersDisabledError();

  if (tabId) {
    const tab = await Tab.findById(tabId);
    if (!tab || tab.status !== "OPEN") {
      throw new OrderValidationError("Tab is not OPEN or does not exist.");
    }
  }

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

  const orderCount = await Order.countDocuments({ eventId });
  const orderNumber = String(orderCount + 1);
  const authCode = generateAuthCode();

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

export async function getOrderForAttendee(
  orderId: string,
  sessionId: string
): Promise<OrderDoc> {
  const order = await Order.findById(orderId).lean();
  if (!order || order.sessionId !== sessionId) throw new OrderNotFoundError();
  return order;
}

export async function getOrderForOrganizer(
  orderId: string,
  accountId: string
): Promise<OrderDoc> {
  const order = await Order.findById(orderId).lean();
  if (!order) throw new OrderNotFoundError();
  await verifyEventOwnership(order.eventId, accountId);
  return order;
}

// A cashier operator may read any order in its own event (to collect a cash
// payment). The operator token is stand-scoped, so we resolve the stand's event
// and require the order to belong to it.
// Loads the operator's stand and asserts it is the active CASHIER stand — the
// only operator allowed to read whole orders / unpaid order lists. PRODUCT-stand
// operators act on individual items via advanceOrderItem, not whole orders.
async function assertActiveCashierStand(operatorStandId: string) {
  const stand = await Stand.findOne({
    _id: operatorStandId,
    deletedAt: null,
  }).lean();
  if (!stand || stand.standType !== "CASHIER") throw new OrderNotFoundError();
  const event = await Event.findById(stand.eventId).lean();
  if (!event || event.status !== "ACTIVE" || !event.cashierEnabled)
    throw new CashierDisabledError();
  return stand;
}

// Single order read for the cashier collecting a cash payment — returns the full
// order (every stand's items) for an order in the cashier's event.
export async function getOrderForCashier(
  orderId: string,
  operatorStandId: string
): Promise<OrderDoc> {
  const stand = await assertActiveCashierStand(operatorStandId);
  const order = await Order.findById(orderId).lean();
  if (!order || stand.eventId !== order.eventId) throw new OrderNotFoundError();
  return order;
}

// Unpaid cash orders for the cashier's event (tabId: null = no digital payment tab).
// Excludes in-flight Stripe/digital orders which carry a tabId. Restricted to the dedicated CASHIER stand.
export async function listUnpaidOrdersForCashier(
  operatorStandId: string
): Promise<OrderDoc[]> {
  const stand = await assertActiveCashierStand(operatorStandId);
  return Order.find({ eventId: stand.eventId, paidAt: null, tabId: null })
    .sort({ createdAt: -1 })
    .lean();
}

export async function advanceOrderItem(
  orderId: string,
  itemId: string,
  action: "start" | "ready" | "fulfill" | "cancel",
  operatorStandId: string
): Promise<OrderDoc> {
  const order = await Order.findById(orderId);
  if (!order) throw new OrderNotFoundError();
  if (!order.paidAt) throw new OrderNotFoundError();

  const item = order.items.find((i) => i._id === itemId);
  if (!item) throw new OrderItemNotFoundError();

  const product = await Product.findOne({
    _id: item.productId,
    standId: operatorStandId,
  }).lean();
  if (!product) throw new OrderItemNotFoundError();

  const state = getItemState(item);
  const now = new Date();

  switch (action) {
    case "start":
      if (state !== "PENDING")
        throw new OrderItemStateError("Item must be PENDING to start");
      item.startedAt = now;
      break;
    case "ready":
      if (state !== "PREPARING")
        throw new OrderItemStateError("Item must be PREPARING to mark ready");
      item.readyAt = now;
      break;
    case "fulfill":
      if (state !== "READY")
        throw new OrderItemStateError("Item must be READY to fulfill");
      item.fulfilledAt = now;
      break;
    case "cancel":
      if (state === "FULFILLED" || state === "CANCELLED")
        throw new OrderItemStateError(
          `Item cannot be cancelled from ${state} state`
        );
      item.cancelledAt = now;
      break;
  }

  await order.save();
  return order;
}

export async function releaseInstantItems(orderId: string): Promise<void> {
  const order = await Order.findById(orderId);
  if (!order) throw new OrderNotFoundError();

  const now = new Date();
  let changed = false;

  for (const item of order.items) {
    const product = await Product.findById(item.productId).lean();
    if (product?.instantProduct && !item.startedAt) {
      item.startedAt = now;
      item.readyAt = now;
      changed = true;
    }
  }

  if (changed) await order.save();
}
