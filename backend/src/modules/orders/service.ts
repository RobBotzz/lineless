import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../../config/config";
import { Order } from "./model";
import { Tab } from "../tabs/model";
import { TabPayment } from "../payments/model";
import { Product } from "../products/model";
import { Event } from "../events/model";
import {
  CashierDisabledError,
  CashPaymentNotFoundError,
  CashRefundExceedsTotalError,
  OrderAlreadyPaidError,
  OrderNotFoundError,
  OrderValidationError,
} from "./errors";
import type {
  ConfirmCashPaymentInput,
  CreateOrderInput,
  IssueCashRefundInput,
} from "./types";
import crypto from "crypto";

const stripe = new Stripe(config.stripe.secretKey);

//TODO: Think about using natural word library
function generateAuthCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function submitOrder(userId: string, input: CreateOrderInput) {
  const { tabId, items } = input;

  // Tab orders: verify the tab is OPEN before doing any further work.
  // Cash orders (no tabId) skip the tab check entirely.
  if (tabId) {
    const tab = await Tab.findById(tabId);
    if (!tab || tab.status !== "OPEN") {
      throw new OrderValidationError("Tab is not OPEN or does not exist.");
    }
  }

  // Look up real products so price and tax are snapshotted at purchase time.
  const productIds = items.map((item) => item.productId);
  const products = await Product.find({
    _id: { $in: productIds },
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
      customerComment: item.customerComment || null,
      priceExclTaxAtPurchase: product.priceIncludingTax,
      taxRateAtPurchase: product.taxRate,
      // TODO: instantProduct items should auto-fulfill and bypass the operator
      // state machine (see CLAUDE.md); handle once the operator flow lands.
      startedAt: null as Date | null,
    }));
  });

  // Cash order: persist immediately with items gated (startedAt = null) until
  // the operator confirms cash via POST /orders/:orderId/cash-payment.
  if (!tabId) {
    const session = await mongoose.startSession();
    let createdOrder;
    await session.withTransaction(async () => {
      const orders = await Order.create(
        [
          {
            tabId: null,
            userId,
            orderNumber: 1,
            authCode: generateAuthCode(),
            items: processedItems,
          },
        ],
        { session }
      );
      createdOrder = orders[0];
    });
    await session.endSession();
    return { status: 201, order: createdOrder };
  }

  // Tab (Stripe) order: check authorization threshold.
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

  const orderNumber = existingOrders.length + 1;
  const authCode = generateAuthCode();

  if (consumedCents + totalCents > authorizedCents) {
    const overage = consumedCents + totalCents - authorizedCents;

    // Stripe call outside the transaction — cannot be rolled back.
    const pi = await stripe.paymentIntents.create({
      amount: overage,
      currency: "eur",
      capture_method: "manual",
      metadata: { tabId },
    });

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await TabPayment.create(
        [
          {
            tabId,
            stripePaymentIntentId: pi.id,
            tabPaymentStatus: "PENDING",
            authorizedCentsAmount: overage,
          },
        ],
        { session }
      );
      await Tab.updateOne(
        { _id: tabId },
        { status: "PENDING_AUTHORIZATION" },
        { session }
      );
      await Order.create(
        [{ tabId, userId, orderNumber, authCode, items: processedItems }],
        { session }
      );
    });
    await session.endSession();

    return { status: 402, clientSecret: pi.client_secret };
  } else {
    // Under limit: release items to the kitchen immediately.
    processedItems.forEach((i) => (i.startedAt = new Date()));

    const session = await mongoose.startSession();
    let createdOrder;
    await session.withTransaction(async () => {
      const orders = await Order.create(
        [{ tabId, userId, orderNumber, authCode, items: processedItems }],
        { session }
      );
      createdOrder = orders[0];
    });
    await session.endSession();

    return { status: 201, order: createdOrder };
  }
}

export async function confirmCashPayment(
  orderId: string,
  input: ConfirmCashPaymentInput
) {
  const order = await Order.findById(orderId);
  if (!order) throw new OrderNotFoundError();
  if (order.paidAt) throw new OrderAlreadyPaidError();

  // Enforce the cashierEnabled feature gate on the backend — not just the UI.
  const event = await Event.findOne({ _id: input.eventId, deletedAt: null });
  if (!event || !event.cashierEnabled) throw new CashierDisabledError();

  // Single document update — no transaction needed (atomicity is guaranteed).
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
  // CashPayment is embedded in Order, so find by its nested _id.
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
