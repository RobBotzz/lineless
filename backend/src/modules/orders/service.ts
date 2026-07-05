import mongoose, { type ClientSession } from "mongoose";
import Stripe from "stripe";
import crypto from "crypto";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import { config } from "../../config/config";
import { Order, type OrderDoc, type OrderItemDoc } from "./model";
import { Tab } from "../tabs/model";
import { TabPayment } from "../payments/model";
import { Product } from "../products/model";
import { Stand } from "../stands/model";
import { Event, DEFAULT_BASELINE_HOLD_CENTS } from "../events/model";
import { AttendeeSession } from "../sessions/model";
import { verifyEventOwnership } from "../events/ownership";
import {
  getActiveTabTotalCents,
  getAuthorizedTabCents,
  markAuthorizedTabOrdersPaid,
} from "./tabAuthorization";
import {
  CashierDisabledError,
  CashPaymentNotFoundError,
  CashRefundExceedsTotalError,
  CashRefundInvalidItemsError,
  EventNotActiveError,
  OrderAlreadyPaidError,
  OrderItemNotFoundError,
  OrderItemStateError,
  OrderNotFoundError,
  OrderRequestCancelledError,
  OrderRequestDeletedError,
  OrderValidationError,
} from "./errors";
import type { CreateOrderInput } from "./types";
import {
  groupRequestedProducts,
  releaseReservedStock,
  reserveProductStock,
} from "./inventory";

const stripe = new Stripe(config.stripe.secretKey);

function generatePickupCode(): string {
  return crypto.randomBytes(2).toString("hex").toUpperCase();
}

// Joins names for user-facing text: "A", "A and B", "A, B and C".
function formatNameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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

interface CashPaymentActor {
  organizerAccountId?: string;
  operatorStandId?: string;
}

function assertItemCancellable(item: OrderItemDoc): void {
  const state = getItemState(item);
  if (state === "READY" || state === "FULFILLED" || state === "CANCELLED") {
    throw new OrderItemStateError(
      `Item cannot be cancelled from ${state} state`
    );
  }
}

type SubmitOrderResult =
  | { status: 201; order: OrderDoc }
  | { status: 402; clientSecret: string; orderId: string };

async function prepareOrderItems(
  input: CreateOrderInput,
  session?: ClientSession
) {
  const standQuery = Stand.find({
    eventId: input.eventId,
    deletedAt: null,
  }).select("_id standStatus");
  if (session) standQuery.session(session);
  const eventStands = await standQuery.lean();
  const standStatusById = new Map(
    eventStands.map((stand) => [stand._id, stand.standStatus ?? "LIVE"])
  );
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const productQuery = Product.find({
    _id: { $in: productIds },
    standId: { $in: eventStands.map((stand) => stand._id) },
    deletedAt: null,
  });
  if (session) productQuery.session(session);
  const products = await productQuery.lean();
  const productById = new Map(
    products.map((product) => [product._id, product])
  );

  // Collect every unavailable item so the attendee can be told exactly which
  // products to remove, rather than failing one at a time.
  const unavailable = input.items
    .filter((item) => {
      const product = productById.get(item.productId);
      return (
        !product ||
        product.productStatus !== "LIVE" ||
        standStatusById.get(product.standId) === "PAUSED"
      );
    })
    .map((item) => productById.get(item.productId)?.productName ?? "a product");

  if (unavailable.length > 0) {
    const names = formatNameList(unavailable);
    const subject =
      unavailable.length === 1
        ? `${names} is currently not available for ordering. It may become available again later`
        : `${names} are currently not available for ordering. They may become available again later`;
    throw new OrderValidationError(
      `${subject} — please remove ${unavailable.length === 1 ? "it" : "them"} from your order before paying. Sorry for the inconvenience.`
    );
  }

  let totalCents = 0;
  const processedItems: OrderItemDoc[] = input.items.map((item) => {
    const product = productById.get(item.productId)!;
    totalCents += product.priceIncludingTax;
    return {
      _id: uuidv4(),
      productId: item.productId,
      customerComment: item.customerComment ?? null,
      priceIncludingTaxAtPurchase: product.priceIncludingTax,
      taxRateAtPurchase: product.taxRate,
      startedAt: null as Date | null,
      readyAt: null as Date | null,
      fulfilledAt: null as Date | null,
      cancelledAt: null as Date | null,
      refundedAt: null as Date | null,
      inventoryState: "RESERVED",
    };
  });
  return {
    processedItems,
    totalCents,
    requestedProducts: groupRequestedProducts(
      input.items.map((item) => item.productId)
    ),
  };
}

function requestMatchesOrder(
  order: OrderDoc,
  input: CreateOrderInput
): boolean {
  if (
    order.eventId !== input.eventId ||
    order.tabId !== (input.tabId ?? null)
  ) {
    return false;
  }
  return (
    order.items.length === input.items.length &&
    order.items.every(
      (item, index) =>
        item.productId === input.items[index]?.productId &&
        (item.customerComment ?? undefined) ===
          input.items[index]?.customerComment
    )
  );
}

async function existingSubmission(
  sessionId: string | null,
  input: CreateOrderInput
): Promise<SubmitOrderResult | null> {
  const order = await Order.findOne({ requestId: input.requestId });
  if (!order) return null;
  if (order.sessionId !== sessionId || !requestMatchesOrder(order, input)) {
    throw new OrderValidationError(
      "requestId has already been used for another order"
    );
  }
  // A soft-deleted order remains the idempotency tombstone for this requestId.
  // Replaying it must not report a deleted resource as a fresh successful order.
  if (order.deletedAt) throw new OrderRequestDeletedError();
  if (order.items.length > 0 && order.items.every((item) => item.cancelledAt)) {
    throw new OrderRequestCancelledError();
  }
  if (order.tabId && !order.paidAt) {
    const payment = await TabPayment.findOne({ orderId: order._id }).sort({
      createdAt: -1,
    });
    if (payment && ["PENDING", "FAILED"].includes(payment.tabPaymentStatus)) {
      const intent = await stripe.paymentIntents.retrieve(
        payment.stripePaymentIntentId
      );
      if (intent.client_secret) {
        return {
          status: 402,
          clientSecret: intent.client_secret,
          orderId: order._id,
        };
      }
    }
    if (payment?.tabPaymentStatus === "RELEASED") {
      throw new OrderRequestCancelledError();
    }
  }
  return { status: 201, order };
}

export async function submitOrder(
  /** Attendee sessionId for guest orders; null for cashier (operator) orders. */
  sessionId: string | null,
  input: CreateOrderInput,
  operatorStandId?: string
): Promise<SubmitOrderResult> {
  const existing = await existingSubmission(sessionId, input);
  if (existing) return existing;

  const { eventId, tabId } = input;
  let customerEmail: string | null = null;
  const event = await Event.findOne({ _id: eventId, deletedAt: null }).lean();
  if (!event || event.status !== "ACTIVE") throw new EventNotActiveError();
  if (!tabId && !event.cashierEnabled) throw new CashierDisabledError();

  if (sessionId === null) {
    const cashierStand = await Stand.findOne({
      _id: operatorStandId,
      eventId,
      standType: "CASHIER",
      deletedAt: null,
    }).lean();
    if (!cashierStand) throw new OrderValidationError("Invalid cashier stand");
  }

  if (sessionId !== null) {
    const attendee = await AttendeeSession.findById(sessionId).lean();
    if (!attendee || attendee.eventId !== eventId) {
      throw new OrderValidationError("Session does not belong to this event");
    }
    customerEmail = attendee.email ?? null;
  }
  if (tabId) {
    if (sessionId === null) {
      throw new OrderValidationError(
        "Operators cannot place orders against a customer tab."
      );
    }
    const tab = await Tab.findOne({ _id: tabId, eventId, sessionId }).lean();
    if (!tab || tab.status !== "OPEN") {
      throw new OrderValidationError("Tab is not OPEN or does not exist.");
    }
  }

  const quote = await prepareOrderItems(input);
  const orderCount = await Order.countDocuments({ eventId });
  const letterIndex = Math.floor(orderCount / 1000) % 26;
  const letter = String.fromCharCode(65 + letterIndex);
  const numberPart = (orderCount % 1000).toString().padStart(3, "0");
  const orderNumber = `${letter}${numberPart}`;
  const pickupCode = generatePickupCode();
  // A retried checkout must send identical Stripe parameters for the same
  // idempotency key. Deriving the top-up metadata id from requestId prevents
  // concurrent retries from racing with different random order ids.
  const orderId = uuidv5(input.requestId, uuidv5.URL);

  const createReservedOrder = async (
    dbSession: ClientSession,
    paidAt: Date | null
  ): Promise<OrderDoc> => {
    const prepared = await prepareOrderItems(input, dbSession);
    if (prepared.totalCents !== quote.totalCents) {
      throw new OrderValidationError(
        "Product prices changed during checkout; please retry"
      );
    }
    const trackedProductIds = await reserveProductStock(
      prepared.requestedProducts,
      dbSession
    );
    for (const item of prepared.processedItems) {
      if (!trackedProductIds.has(item.productId)) {
        item.inventoryState = "UNTRACKED";
      }
    }
    const orders = await Order.create(
      [
        {
          _id: orderId,
          eventId,
          tabId: tabId ?? null,
          sessionId,
          requestId: input.requestId,
          orderNumber,
          pickupCode,
          customerEmail,
          paidAt,
          items: prepared.processedItems,
        },
      ],
      { session: dbSession }
    );
    return orders[0]!;
  };

  if (!tabId) {
    const dbSession = await mongoose.startSession();
    let createdOrder: OrderDoc | undefined;
    try {
      await dbSession.withTransaction(async () => {
        createdOrder = await createReservedOrder(dbSession, null);
      });
    } catch (error) {
      const duplicate = await existingSubmission(sessionId, input);
      if (duplicate) return duplicate;
      throw error;
    } finally {
      await dbSession.endSession();
    }
    return { status: 201, order: createdOrder! };
  }

  const authorizedCents = await getAuthorizedTabCents(tabId);
  const consumedCents = await getActiveTabTotalCents(tabId);

  if (consumedCents + quote.totalCents > authorizedCents) {
    // Top up the authorization in whole baseline increments rather than by the
    // exact shortfall, so small follow-up orders reuse the headroom instead of
    // each triggering another authorization round-trip. The unused remainder is
    // released (never captured) at checkout.
    const shortfall = consumedCents + quote.totalCents - authorizedCents;
    const baseline = event.baselineHoldCents ?? DEFAULT_BASELINE_HOLD_CENTS;
    const overage = Math.ceil(shortfall / baseline) * baseline;

    // Pre-generate the order id so the hold can reference the order it funds;
    // the failure/cancel paths rely on that link.
    const pi = await stripe.paymentIntents.create(
      {
        amount: overage,
        currency: "eur",
        capture_method: "manual",
        // Card only — keeps the top-up consistent with the baseline hold (card +
        // Apple Pay / Google Pay wallets, no Link/others).
        payment_method_types: ["card"],
        metadata: { tabId, orderId, requestId: input.requestId },
      },
      { idempotencyKey: `order:${input.requestId}` }
    );

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        await TabPayment.create(
          [
            {
              tabId,
              orderId,
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
        await createReservedOrder(dbSession, null);
      });
    } catch (err) {
      const duplicate = await existingSubmission(sessionId, input);
      if (duplicate) return duplicate;
      // Keep the unconfirmed intent reusable. Stripe replays the original result
      // for this requestId's idempotency key, so cancelling it here would make a
      // safe retry create a TabPayment that points at an already-cancelled intent.
      throw err;
    } finally {
      await dbSession.endSession();
    }

    return {
      status: 402 as const,
      clientSecret: pi.client_secret as string,
      orderId,
    };
  }

  // The existing hold already covers this order, so it is paid immediately. Its
  // items stay PENDING (startedAt null) — they enter the operator board as new
  // work and only move to PREPARING when an operator starts them.
  const now = new Date();

  const dbSession = await mongoose.startSession();
  let createdOrder: OrderDoc | undefined;
  try {
    await dbSession.withTransaction(async () => {
      createdOrder = await createReservedOrder(dbSession, now);
      await markAuthorizedTabOrdersPaid(tabId, dbSession, now);
    });
  } catch (error) {
    const duplicate = await existingSubmission(sessionId, input);
    if (duplicate) return duplicate;
    throw error;
  } finally {
    await dbSession.endSession();
  }

  return { status: 201, order: createdOrder! };
}

async function verifyCashPaymentActor(
  eventId: string,
  actor: CashPaymentActor,
  options: { requireActiveEvent: boolean }
) {
  if (actor.organizerAccountId) {
    await verifyEventOwnership(eventId, actor.organizerAccountId);
    const event = await Event.findOne({ _id: eventId, deletedAt: null }).lean();
    if (!event?.cashierEnabled) throw new CashierDisabledError();
    if (options.requireActiveEvent && event.status !== "ACTIVE") {
      throw new CashierDisabledError();
    }
    return;
  }

  if (actor.operatorStandId) {
    const stand = await Stand.findOne({
      _id: actor.operatorStandId,
      standType: "CASHIER",
      eventId,
      deletedAt: null,
    }).lean();
    if (!stand) throw new OrderNotFoundError();

    const event = await Event.findOne({ _id: eventId, deletedAt: null }).lean();
    if (!event?.cashierEnabled) throw new CashierDisabledError();
    if (options.requireActiveEvent && event.status !== "ACTIVE") {
      throw new CashierDisabledError();
    }
    return;
  }

  throw new OrderNotFoundError();
}

export async function confirmCashPayment(
  orderId: string,
  actor: CashPaymentActor
) {
  const order = await Order.findById(orderId).lean();
  if (!order) throw new OrderNotFoundError();
  if (order.paidAt) throw new OrderAlreadyPaidError();
  if (order.tabId !== null) {
    throw new OrderValidationError("Only cash orders can be paid in cash");
  }

  await verifyCashPaymentActor(order.eventId, actor, {
    requireActiveEvent: true,
  });

  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const fresh = await Order.findOne({
        _id: orderId,
        paidAt: null,
        deletedAt: null,
      }).session(dbSession);
      if (!fresh) {
        const current = await Order.findById(orderId).session(dbSession).lean();
        if (current?.paidAt) throw new OrderAlreadyPaidError();
        throw new OrderNotFoundError();
      }
      const now = new Date();
      fresh.cashPayment = { _id: crypto.randomUUID(), createdAt: now };
      fresh.paidAt = now;
      await fresh.save({ session: dbSession });
    });
  } finally {
    await dbSession.endSession();
  }
  const updated = await Order.findById(orderId).lean();
  if (!updated) throw new OrderNotFoundError();
  return updated;
}

// An item is refundable only if it was cancelled and has not been refunded yet.
function isRefundableItem(item: OrderItemDoc): boolean {
  return item.cancelledAt != null && item.refundedAt == null;
}

// Item-level cash refund: refunds the given cancelled items in one atomic save,
// stamping refundedAt so the same item can never be refunded twice.
export async function refundCashOrderItems(
  orderId: string,
  itemIds: string[],
  actor: CashPaymentActor
) {
  const order = await Order.findOne({ _id: orderId, deletedAt: null });
  if (!order) throw new OrderNotFoundError();
  if (order.tabId !== null || !order.paidAt)
    throw new CashPaymentNotFoundError();

  await verifyCashPaymentActor(order.eventId, actor, {
    requireActiveEvent: false,
  });

  const requested = new Set(itemIds);
  const items = order.items.filter((i) => requested.has(i._id));
  if (items.length !== requested.size) throw new OrderItemNotFoundError();
  if (!items.every(isRefundableItem)) throw new CashRefundInvalidItemsError();

  const amountCents = items.reduce(
    (sum, i) => sum + i.priceIncludingTaxAtPurchase,
    0
  );

  // Defensive invariant — refundedAt already prevents double refunds, but this
  // keeps the same guard the amount-based refund path enforces.
  const orderTotal = order.items.reduce(
    (sum, i) => sum + i.priceIncludingTaxAtPurchase,
    0
  );
  const alreadyRefunded = order.cashRefunds.reduce(
    (sum, r) => sum + r.amountCents,
    0
  );
  if (alreadyRefunded + amountCents > orderTotal) {
    throw new CashRefundExceedsTotalError();
  }

  const now = new Date();
  for (const item of items) {
    item.refundedAt = now;
  }
  order.cashRefunds.push({
    _id: crypto.randomUUID(),
    amountCents,
    refundedItemIds: items.map((i) => i._id),
    createdAt: now,
  });
  await order.save();

  return order;
}

// Cash-paid orders for the event that still have at least one refundable item.
export async function listRefundableCashOrders(
  eventId: string
): Promise<OrderDoc[]> {
  const orders = await Order.find({
    eventId,
    tabId: null,
    paidAt: { $ne: null },
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();
  return orders.filter((o) => o.items.some(isRefundableItem));
}

/**
 * Attendee abandons an order still awaiting authorization. Cancels its gated
 * items, releases any backing Stripe hold, and lets the tab become orderable
 * again. Repeating cleanup for an already fully-cancelled order is safe so a
 * client can recover when the first response was lost.
 */
export async function cancelPendingOrder(
  orderId: string,
  sessionId: string
): Promise<OrderDoc> {
  const order = await Order.findById(orderId);
  if (!order || order.sessionId !== sessionId) throw new OrderNotFoundError();
  if (order.paidAt) throw new OrderAlreadyPaidError();

  const hasGatedItems = order.items.some((i) => !i.startedAt && !i.cancelledAt);
  const isFullyCancelled = order.items.every((i) => i.cancelledAt);
  if (!hasGatedItems && !isFullyCancelled) {
    throw new OrderItemStateError("Order has no pending items to cancel");
  }

  const dbSession = await mongoose.startSession();
  let pendingIntentIds: string[] = [];
  try {
    await dbSession.withTransaction(async () => {
      const fresh = await Order.findOne({
        _id: orderId,
        sessionId,
        paidAt: null,
      }).session(dbSession);
      if (!fresh) {
        const current = await Order.findOne({ _id: orderId, sessionId })
          .select("paidAt")
          .session(dbSession);
        if (current?.paidAt) throw new OrderAlreadyPaidError();
        throw new OrderNotFoundError();
      }

      const now = new Date();
      const cancelledItems = fresh.items.filter(
        (item) => !item.startedAt && !item.cancelledAt
      );
      const isAlreadyCancelled = fresh.items.every((item) => item.cancelledAt);
      if (cancelledItems.length === 0 && !isAlreadyCancelled) {
        throw new OrderItemStateError("Order has no pending items to cancel");
      }

      const holds = await TabPayment.find({
        orderId,
        tabPaymentStatus: { $in: ["PENDING", "FAILED"] },
      }).session(dbSession);
      // withTransaction may retry the callback, so replace instead of append.
      pendingIntentIds = holds
        .filter((hold) => hold.tabPaymentStatus === "PENDING")
        .map((hold) => hold.stripePaymentIntentId);

      await releaseReservedStock(cancelledItems, dbSession);
      cancelledItems.forEach((item) => {
        item.cancelledAt = now;
      });
      await fresh.save({ session: dbSession });

      await TabPayment.updateMany(
        { orderId, tabPaymentStatus: { $in: ["PENDING", "FAILED"] } },
        { tabPaymentStatus: "RELEASED" },
        { session: dbSession }
      );

      if (fresh.tabId) {
        const pending = await TabPayment.countDocuments({
          tabId: fresh.tabId,
          tabPaymentStatus: "PENDING",
        }).session(dbSession);
        if (pending === 0) {
          await Tab.updateOne(
            { _id: fresh.tabId, status: "PENDING_AUTHORIZATION" },
            { status: "OPEN" },
            { session: dbSession }
          );
        }
      }
    });
  } finally {
    await dbSession.endSession();
  }

  // Stripe is external to MongoDB. Cancel only after the transaction has
  // claimed the payment as RELEASED; a concurrent webhook then observes the
  // terminal state and cannot authorize/restock the same order.
  for (const intentId of pendingIntentIds) {
    await stripe.paymentIntents.cancel(intentId).catch(() => undefined);
  }

  const updated = await Order.findById(orderId).lean();
  if (!updated) throw new OrderNotFoundError();
  return updated;
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

// An attendee's own orders — the source for the order-status / review entry
// point. Includes all paid orders plus every cash order (tabId: null) whether
// pending payment or cashier-cancelled (deletedAt), so the pending-payment and
// cancelled states are visible in history. Transient gated card orders (unpaid
// with a tabId) are excluded. Product names are joined here (one batch query)
// to avoid a frontend N+1.
export async function listOrdersForAttendee(
  sessionId: string
): Promise<AttendeeOrder[]> {
  const orders = await Order.find({
    sessionId,
    $or: [{ paidAt: { $ne: null } }, { tabId: null }],
  })
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
// Loads the operator's stand and asserts it is a legitimate CASHIER stand for a
// cashier-enabled event. `requireActiveEvent` gates the actions that must only
// happen while the event is live (new cash payments, manual orders); reads and
// refunds pass `false` so they keep working once the event is STOPPED.
async function assertCashierStand(
  operatorStandId: string,
  options: { requireActiveEvent: boolean }
) {
  const stand = await Stand.findOne({
    _id: operatorStandId,
    standType: "CASHIER",
    deletedAt: null,
  }).lean();
  if (!stand) throw new OrderNotFoundError();

  const event = await Event.findById(stand.eventId).lean();
  // DRAFT: the event hasn't gone live — no legitimate cashier activity yet,
  // refund or otherwise.
  if (!event || !event.cashierEnabled || event.status === "DRAFT") {
    throw new CashierDisabledError();
  }
  if (options.requireActiveEvent && event.status !== "ACTIVE") {
    throw new CashierDisabledError();
  }
  return stand;
}

// Exported so the cashier unpaid-orders stream route can resolve the stand's
// eventId once, for scoping the order.changed subscription.
export async function assertActiveCashierStand(operatorStandId: string) {
  return assertCashierStand(operatorStandId, { requireActiveEvent: true });
}

// Resolves the event a cashier operator token is scoped to. Used by the
// refundable-orders route, which must keep working after the event is STOPPED.
export async function resolveCashierEventId(
  operatorStandId: string
): Promise<string> {
  const stand = await assertCashierStand(operatorStandId, {
    requireActiveEvent: false,
  });
  return stand.eventId;
}

// Single order read for the cashier — used both for collecting a cash payment
// and for viewing/refunding an order, so it must keep working after the event
// is STOPPED. Returns the full order (every stand's items) for an order in the
// cashier's event.
export async function getOrderForCashier(
  orderId: string,
  operatorStandId: string
): Promise<OrderDoc> {
  const stand = await assertCashierStand(operatorStandId, {
    requireActiveEvent: false,
  });
  const order = await Order.findById(orderId).lean();
  if (!order || stand.eventId !== order.eventId) throw new OrderNotFoundError();
  return order;
}

// Unpaid cash orders for an event (tabId: null = no digital payment tab).
// Excludes in-flight Stripe/digital orders which carry a tabId. The caller is
// responsible for having asserted access to the event (the cashier stream
// resolves the stand once and passes its eventId in, avoiding a repeat lookup).
export function listUnpaidCashOrdersForEvent(
  eventId: string
): Promise<OrderDoc[]> {
  return Order.find({
    eventId,
    paidAt: null,
    tabId: null,
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function cancelOrderForOrganizer(
  orderId: string,
  accountId: string
): Promise<OrderDoc> {
  const order = await Order.findById(orderId).lean();
  if (!order) throw new OrderNotFoundError();
  await verifyEventOwnership(order.eventId, accountId);
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const fresh = await Order.findById(orderId).session(dbSession);
      if (!fresh) throw new OrderNotFoundError();
      const items = fresh.items.filter(
        (item) => !item.readyAt && !item.fulfilledAt && !item.cancelledAt
      );
      if (items.length === 0) {
        throw new OrderItemStateError("Order has no cancellable items");
      }
      await releaseReservedStock(items, dbSession);
      const now = new Date();
      for (const item of items) item.cancelledAt = now;
      await fresh.save({ session: dbSession });
    });
  } finally {
    await dbSession.endSession();
  }
  const updated = await Order.findById(orderId).lean();
  if (!updated) throw new OrderNotFoundError();
  return updated;
}

export async function cancelOrderItemsForOrganizer(
  orderId: string,
  itemIds: string[],
  accountId: string
): Promise<OrderDoc> {
  const order = await Order.findById(orderId).lean();
  if (!order) throw new OrderNotFoundError();
  await verifyEventOwnership(order.eventId, accountId);
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const fresh = await Order.findById(orderId).session(dbSession);
      if (!fresh) throw new OrderNotFoundError();
      const itemsById = new Map(fresh.items.map((item) => [item._id, item]));
      const items = itemIds.map((targetItemId) => {
        const item = itemsById.get(targetItemId);
        if (!item) throw new OrderItemNotFoundError();
        return item;
      });
      for (const item of items) assertItemCancellable(item);
      await releaseReservedStock(items, dbSession);
      const now = new Date();
      for (const item of items) item.cancelledAt = now;
      await fresh.save({ session: dbSession });
    });
  } finally {
    await dbSession.endSession();
  }
  const updated = await Order.findById(orderId).lean();
  if (!updated) throw new OrderNotFoundError();
  return updated;
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
  }).lean();
  if (!order) throw new OrderNotFoundError();
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const fresh = await Order.findOne({
        _id: orderId,
        eventId: stand.eventId,
        paidAt: null,
        deletedAt: null,
      }).session(dbSession);
      if (!fresh) throw new OrderNotFoundError();
      const items = fresh.items.filter(
        (item) => !item.startedAt && !item.cancelledAt
      );
      await releaseReservedStock(items, dbSession);
      const now = new Date();
      for (const item of items) item.cancelledAt = now;
      fresh.deletedAt = now;
      await fresh.save({ session: dbSession });
    });
  } finally {
    await dbSession.endSession();
  }
}

export async function advanceOrderItem(
  orderId: string,
  itemId: string,
  action: "start" | "ready" | "fulfill" | "cancel",
  operatorStandId: string
): Promise<OrderDoc> {
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const order = await Order.findById(orderId).session(dbSession);
      if (!order || !order.paidAt) throw new OrderNotFoundError();
      const item = order.items.find((candidate) => candidate._id === itemId);
      if (!item) throw new OrderItemNotFoundError();
      const product = await Product.findOne({
        _id: item.productId,
        standId: operatorStandId,
      })
        .session(dbSession)
        .lean();
      if (!product) throw new OrderItemNotFoundError();

      const state = getItemState(item);
      const now = new Date();
      switch (action) {
        case "start":
          if (state !== "PENDING") {
            throw new OrderItemStateError("Item must be PENDING to start");
          }
          item.startedAt = now;
          if (item.inventoryState === "RESERVED") {
            item.inventoryState = "CONSUMED";
          }
          if (product.instantProduct) item.readyAt = now;
          break;
        case "ready":
          if (state !== "PREPARING") {
            throw new OrderItemStateError(
              "Item must be PREPARING to mark ready"
            );
          }
          item.readyAt = now;
          break;
        case "fulfill":
          if (state !== "READY") {
            throw new OrderItemStateError("Item must be READY to fulfill");
          }
          item.fulfilledAt = now;
          break;
        case "cancel":
          assertItemCancellable(item);
          await releaseReservedStock([item], dbSession);
          item.cancelledAt = now;
          break;
      }
      await order.save({ session: dbSession });
    });
  } finally {
    await dbSession.endSession();
  }
  const updated = await Order.findById(orderId).lean();
  if (!updated) throw new OrderNotFoundError();
  return updated;
}

// Called by the payments module after confirming payment (cash or Stripe).
// Advances all instantProduct items to READY so they bypass the operator queue
// and wait only for customer pickup (fulfilledAt is set via the normal fulfill endpoint).
export async function releaseInstantItems(orderId: string): Promise<void> {
  const order = await Order.findById(orderId);
  if (!order) throw new OrderNotFoundError();

  const productIds = order.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productById = new Map(products.map((p) => [p._id, p]));

  const now = new Date();
  let changed = false;

  for (const item of order.items) {
    const product = productById.get(item.productId);
    if (product?.instantProduct && !item.startedAt) {
      item.startedAt = now;
      item.readyAt = now;
      if (item.inventoryState === "RESERVED") {
        item.inventoryState = "CONSUMED";
      }
      changed = true;
    }
  }

  if (changed) await order.save();
}
