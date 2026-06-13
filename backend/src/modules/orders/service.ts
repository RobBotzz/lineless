import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { Order, type OrderDoc, type OrderItemDoc } from "./model";
import { Product } from "../products/model";
import { Stand } from "../stands/model";
import { Event } from "../events/model";
import { verifyEventOwnership } from "../events/ownership";
import {
  CashierDisabledError,
  EventNotActiveError,
  OfflineOrdersDisabledError,
  OrderItemNotFoundError,
  OrderItemStateError,
  OrderNotFoundError,
  OrderValidationError,
  StandNotFoundError,
} from "./errors";
import type { CreateOrderInput } from "./types";

function generateOrderCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

type ItemState = "PENDING" | "PREPARING" | "READY" | "FULFILLED" | "CANCELLED";

function getItemState(item: OrderItemDoc): ItemState {
  if (item.cancelledAt) return "CANCELLED";
  if (item.fulfilledAt) return "FULFILLED";
  if (item.readyAt) return "READY";
  if (item.startedAt) return "PREPARING";
  return "PENDING";
}

export async function submitOrder(
  sessionId: string | null,
  input: CreateOrderInput
): Promise<OrderDoc> {
  const { standId, tabId, customerEmail, items } = input;

  const stand = await Stand.findOne({ _id: standId, deletedAt: null }).lean();
  if (!stand) throw new StandNotFoundError();
  const { eventId } = stand;

  const event = await Event.findOne({ _id: eventId, deletedAt: null }).lean();
  if (!event || event.status !== "ACTIVE") throw new EventNotActiveError();

  if (sessionId === null && !event.cashierEnabled)
    throw new CashierDisabledError();
  if (sessionId !== null && !event.offlineOrdersEnabled)
    throw new OfflineOrdersDisabledError();

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await Product.find({
    _id: { $in: productIds },
    standId,
    deletedAt: null,
  }).lean();
  const productById = new Map(products.map((p) => [p._id, p]));

  const processedItems = items.map((item) => {
    const product = productById.get(item.productId);
    if (!product || product.productStatus !== "LIVE") {
      throw new OrderValidationError(
        `Product ${item.productId} is not available for ordering`
      );
    }

    return {
      _id: uuidv4(),
      productId: item.productId,
      customerComment: item.customerComment ?? null,
      priceIncludingTaxAtPurchase: product.priceIncludingTax,
      taxRateAtPurchase: product.taxRate,
      startedAt: null,
      readyAt: null,
      fulfilledAt: null,
      cancelledAt: null as Date | null,
    };
  });

  const orderCount = await Order.countDocuments({ eventId });
  const letterIndex = Math.floor(orderCount / 1000) % 26;
  const letter = String.fromCharCode(65 + letterIndex);
  const numberPart = (orderCount % 1000).toString().padStart(3, "0");
  const orderNumber = `${letter}${numberPart}`;
  const orderCode = generateOrderCode();

  const order = await Order.create({
    standId,
    eventId,
    tabId: tabId ?? null,
    sessionId,
    orderNumber,
    orderCode,
    customerEmail: customerEmail ?? null,
    items: processedItems,
  });

  return order;
}

export async function getOrderForAttendee(
  orderId: string,
  sessionId: string
): Promise<OrderDoc> {
  const order = await Order.findById(orderId).lean();
  if (!order || order.sessionId !== sessionId) throw new OrderNotFoundError();
  return order;
}

export async function getOrderByOrderCode(
  orderCode: string
): Promise<OrderDoc> {
  const order = await Order.findOne({
    orderCode: orderCode.toUpperCase(),
  }).lean();
  if (!order) throw new OrderNotFoundError();
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

export async function getOrderForOperator(
  orderId: string,
  operatorStandId: string
): Promise<OrderDoc> {
  const order = await Order.findById(orderId).lean();
  if (!order || order.standId !== operatorStandId)
    throw new OrderNotFoundError();
  return order;
}

export async function listOrdersForStand(
  standId: string,
  auth:
    | { type: "organizer"; accountId: string }
    | { type: "operator"; standId: string }
): Promise<OrderDoc[]> {
  if (auth.type === "organizer") {
    const stand = await Stand.findOne({ _id: standId, deletedAt: null }).lean();
    if (!stand) throw new StandNotFoundError();
    await verifyEventOwnership(stand.eventId, auth.accountId);
  } else {
    if (standId !== auth.standId) throw new StandNotFoundError();
  }

  return Order.find({ standId, paidAt: { $ne: null } })
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
  if (!order || order.standId !== operatorStandId)
    throw new OrderNotFoundError();
  if (!order.paidAt) throw new OrderNotFoundError();

  const item = order.items.find((i) => i._id === itemId);
  if (!item) throw new OrderItemNotFoundError();

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

// Called by the payments module after confirming payment (cash or Stripe).
// Advances all instantProduct items to READY so they bypass the operator queue
// and wait only for customer pickup (fulfilledAt is set via the normal fulfill endpoint).
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
