import mongoose from "mongoose";
import Stripe from "stripe";
import { config } from "../../config/config";
import { Order } from "./model";
import { Tab } from "../tabs/model";
import { TabPayment } from "../payments/model";
import { OrderValidationError } from "./errors";
import type { CreateOrderInput } from "./types";
import crypto from "crypto";

const stripe = new Stripe(config.stripe.secretKey);

//TODO: Think about using natural word library
function generateAuthCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function submitOrder(userId: string, input: CreateOrderInput) {
  const { tabId, items } = input;

  //TODO: Wie werden Cashpayment orders behandelt?
  // Fast-fail check outside transaction
  const tab = await Tab.findById(tabId);
  if (!tab || tab.status !== "OPEN") {
    throw new OrderValidationError("Tab is not OPEN or does not exist.");
  }

  //TODO: NO HARDCODING
  //Hardcoded as product is not yet implemented
  let totalCents = 0;
  const processedItems = items.flatMap(item => {
    const itemCents = 500; //hardcoded as product is not yet implemented
    totalCents += itemCents * item.quantity;
    return Array.from({ length: item.quantity }).map(() => ({
      productId: item.productId,
      customerComment: item.customerComment || null,
      priceExclTaxAtPurchase: itemCents,
      taxRateAtPurchase: 0.19, //hard coded as product is not yet implemented
      startedAt: null as Date | null
    }));
  });

  const payments = await TabPayment.find({ tabId, tabPaymentStatus: { $in: ["AUTHORIZED", "CAPTURED"] } });
  const authorizedCents = payments.reduce((sum, p) => sum + p.authorizedCentsAmount, 0);

  const existingOrders = await Order.find({ tabId });
  const consumedCents = existingOrders.flatMap(o => o.items).reduce((sum, i) => sum + i.priceExclTaxAtPurchase, 0);

  const orderNumber = existingOrders.length + 1;
  const authCode = generateAuthCode();

  if (consumedCents + totalCents > authorizedCents) {
    const overage = (consumedCents + totalCents) - authorizedCents;

    // Remote call outside transaction
    const pi = await stripe.paymentIntents.create({
      amount: overage,
      currency: "eur",
      capture_method: "manual",
      metadata: { tabId }
    });

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await TabPayment.create([{
        tabId,
        stripePaymentIntentId: pi.id,
        tabPaymentStatus: "PENDING",
        authorizedCentsAmount: overage
      }], { session });

      await Tab.updateOne({ _id: tabId }, { status: "PENDING_AUTHORIZATION" }, { session });

      await Order.create([{
        tabId,
        userId,
        orderNumber,
        authCode,
        items: processedItems // startedAt remains null
      }], { session });
    });
    await session.endSession();

    return { status: 402, clientSecret: pi.client_secret };
  } else {
    // Under limit: immediately authorize
    processedItems.forEach(i => i.startedAt = new Date());

    const session = await mongoose.startSession();
    let createdOrder;
    await session.withTransaction(async () => {
      const orders = await Order.create([{
        tabId,
        userId,
        orderNumber,
        authCode,
        items: processedItems
      }], { session });
      createdOrder = orders[0];
    });
    await session.endSession();

    return { status: 201, order: createdOrder };
  }
}