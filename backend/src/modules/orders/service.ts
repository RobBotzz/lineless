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
} from "./errors";
import type { CreateOrderInput } from "./types";

function generatePickupCode(): string {
  return crypto.randomBytes(2).toString("hex").toUpperCase();
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
  sessionId: string | null,
  input: CreateOrderInput
): Promise<OrderDoc> {
  const { eventId, tabId, customerEmail, items } = input;

  const event = await Event.findOne({ _id: eventId, deletedAt: null }).lean();
  if (!event || event.status !== "ACTIVE") throw new EventNotActiveError();

  if (sessionId === null && !event.cashierEnabled)
    throw new CashierDisabledError();
  if (sessionId !== null && !event.offlineOrdersEnabled)
    throw new OfflineOrdersDisabledError();

  const eventStands = await Stand.find({ eventId, deletedAt: null })
    .select("_id")
    .lean();
  const eventStandIds = eventStands.map((s) => s._id);

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await Product.find({
    _id: { $in: productIds },
    standId: { $in: eventStandIds },
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
  const pickupCode = generatePickupCode();

  const order = await Order.create({
    eventId,
    tabId: tabId ?? null,
    sessionId,
    orderNumber,
    pickupCode,
    customerEmail: customerEmail ?? null,
    items: processedItems,
  });

  return order;
}

export interface AttendeeOrderItem extends OrderItemDoc {
  productName: string;
  standName: string;
}

export type AttendeeOrder = Omit<OrderDoc, "items"> & {
  items: AttendeeOrderItem[];
};

// Joins product names and stand names onto an order's items. Used both for
// single-order reads and for the SSE stream where the change stream hands us
// a raw OrderDoc that needs enrichment before being pushed to the client.
export async function enrichOrderForAttendee(
  order: OrderDoc
): Promise<AttendeeOrder> {
  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productById = new Map(products.map((p) => [p._id, p]));

  const standIds = [...new Set(products.map((p) => p.standId))];
  const stands = await Stand.find({ _id: { $in: standIds } }).lean();
  const standNameById = new Map(stands.map((s) => [s._id, s.standName]));

  return {
    ...order,
    items: order.items.map((item) => {
      const product = productById.get(item.productId);
      return {
        ...item,
        productName: product?.productName ?? "",
        standName: product ? (standNameById.get(product.standId) ?? "") : "",
      };
    }),
  };
}

export async function getOrderForAttendee(
  orderId: string,
  sessionId: string
): Promise<AttendeeOrder> {
  const order = await Order.findById(orderId).lean();
  if (!order || order.sessionId !== sessionId) throw new OrderNotFoundError();
  return enrichOrderForAttendee(order);
}

// An attendee's own paid orders — the source for the order-status / review entry
// point. Product names are joined here (one batch query) to avoid frontend N+1.
export async function listOrdersForAttendee(
  sessionId: string
): Promise<AttendeeOrder[]> {
  const orders = await Order.find({ sessionId, paidAt: { $ne: null } })
    .sort({ createdAt: -1 })
    .lean();

  const productIds = [
    ...new Set(orders.flatMap((o) => o.items.map((i) => i.productId))),
  ];
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productById = new Map(products.map((p) => [p._id, p]));

  const standIds = [...new Set(products.map((p) => p.standId))];
  const stands = await Stand.find({ _id: { $in: standIds } }).lean();
  const standNameById = new Map(stands.map((s) => [s._id, s.standName]));

  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => {
      const product = productById.get(item.productId);
      return {
        ...item,
        productName: product?.productName ?? "",
        standName: product ? (standNameById.get(product.standId) ?? "") : "",
      };
    }),
  }));
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
  return Order.find({
    eventId: stand.eventId,
    paidAt: null,
    tabId: null,
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();
}

// Soft-delete an unpaid order. The document stays in MongoDB for analytics;
// deletedAt marks it as removed so it no longer appears in the cashier list.
export async function deleteUnpaidOrder(
  orderId: string,
  operatorStandId: string
): Promise<void> {
  const stand = await assertActiveCashierStand(operatorStandId);
  const order = await Order.findOne({
    _id: orderId,
    eventId: stand.eventId,
    paidAt: null,
    deletedAt: null,
  });
  if (!order) throw new OrderNotFoundError();
  order.deletedAt = new Date();
  await order.save();
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
