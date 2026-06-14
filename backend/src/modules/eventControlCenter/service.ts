import { AttendeeSession } from "../sessions/model";
import { Event } from "../events/model";
import { EventNotFoundError } from "../events/errors";
import { verifyEventOwnership } from "../events/ownership";
import { Order, type OrderDoc, type OrderItemDoc } from "../orders/model";
import { Product } from "../products/model";
import { StandNotFoundError } from "../stands/errors";
import { Stand } from "../stands/model";
import type {
  EventControlCenterData,
  EventControlCenterQuery,
  LiveOrder,
  LiveOrderItem,
  LiveOrdersQuery,
  RevenuePoint,
  StandQueueMetric,
  StandRevenueSeries,
} from "./types";

function elapsedMinutesSince(baseDate: Date, date: Date): number {
  return Math.max(0, Math.floor((date.getTime() - baseDate.getTime()) / 60000));
}

function addRevenuePoint(
  buckets: Map<number, number>,
  elapsedMinutes: number,
  amount: number
) {
  buckets.set(elapsedMinutes, (buckets.get(elapsedMinutes) ?? 0) + amount);
}

function cumulativePoints(buckets: Map<number, number>): RevenuePoint[] {
  let runningTotal = 0;
  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([elapsedMinutes, amount]) => {
      runningTotal += amount;
      return { elapsedMinutes, revenueCents: runningTotal };
    });
}

function isOpenItem(item: OrderItemDoc): boolean {
  return !item.fulfilledAt && !item.cancelledAt;
}

function paidAtDate(order: OrderDoc): Date | null {
  return order.paidAt ? new Date(order.paidAt) : null;
}

function orderCreatedAtDate(order: OrderDoc): Date {
  return new Date(order.createdAt);
}

function itemStatus(item: OrderItemDoc): LiveOrderItem["status"] {
  if (item.readyAt) return "READY";
  if (item.startedAt) return "PREPARING";
  return "IN_LINE";
}

function orderStatus(items: LiveOrderItem[]): LiveOrder["status"] {
  if (items.every((item) => item.status === "READY")) return "READY";
  if (items.some((item) => item.status === "PREPARING")) return "PREPARING";
  return "IN_LINE";
}

export async function getEventControlCenter(
  eventId: string,
  accountId: string,
  options: EventControlCenterQuery
): Promise<EventControlCenterData> {
  await verifyEventOwnership(eventId, accountId);

  const event = await Event.findOne({ _id: eventId, deletedAt: null }).lean();
  if (!event) throw new EventNotFoundError();

  const [stands, orders, activeGuests] = await Promise.all([
    Stand.find({ eventId, deletedAt: null }).select("_id").lean(),
    Order.find({ eventId }).lean(),
    AttendeeSession.countDocuments({
      eventId,
      status: "active",
      expiresAt: { $gt: new Date() },
    }),
  ]);

  const standIds = stands.map((stand) => stand._id);
  const standIdSet = new Set(standIds);
  const products = await Product.find({
    standId: { $in: standIds },
    deletedAt: null,
  })
    .select("_id standId")
    .lean();
  const productStandById = new Map(
    products
      .filter((product) => standIdSet.has(product.standId))
      .map((product) => [product._id, product.standId])
  );

  const baseDate = event.startedAt
    ? new Date(event.startedAt)
    : new Date(event.createdAt);
  const eventRevenueBuckets = new Map<number, number>();
  const standRevenueBucketsByStand = new Map<string, Map<number, number>>();
  const queueStatsByStand = new Map<
    string,
    { queueLength: number; totalWaitMinutes: number }
  >();

  for (const standId of standIds) {
    standRevenueBucketsByStand.set(standId, new Map());
    queueStatsByStand.set(standId, { queueLength: 0, totalWaitMinutes: 0 });
  }

  const now = new Date();

  for (const order of orders) {
    const paidAt = paidAtDate(order);
    const paidElapsedMinutes = paidAt
      ? elapsedMinutesSince(baseDate, paidAt)
      : null;
    const waitMinutes = elapsedMinutesSince(orderCreatedAtDate(order), now);

    for (const item of order.items) {
      const standId = productStandById.get(item.productId);
      if (!standId) continue;

      if (paidElapsedMinutes !== null && !item.cancelledAt) {
        addRevenuePoint(
          eventRevenueBuckets,
          paidElapsedMinutes,
          item.priceIncludingTaxAtPurchase
        );
        addRevenuePoint(
          standRevenueBucketsByStand.get(standId)!,
          paidElapsedMinutes,
          item.priceIncludingTaxAtPurchase
        );
      }

      if (paidAt && isOpenItem(item)) {
        const stats = queueStatsByStand.get(standId);
        if (!stats) continue;
        stats.queueLength += 1;
        stats.totalWaitMinutes += waitMinutes;
      }
    }
  }

  const standQueues: StandQueueMetric[] = standIds.map((standId) => {
    const stats = queueStatsByStand.get(standId) ?? {
      queueLength: 0,
      totalWaitMinutes: 0,
    };
    const averageWaitMinutes =
      stats.queueLength > 0
        ? Math.round(stats.totalWaitMinutes / stats.queueLength)
        : 0;
    return {
      standId,
      queueLength: stats.queueLength,
      averageWaitMinutes,
      alert:
        stats.queueLength >= options.queueLengthAlertThreshold ||
        averageWaitMinutes >= options.averageWaitAlertThresholdMinutes,
    };
  });

  const maxBottleneckStandId = standQueues.reduce<string | null>(
    (currentStandId, queue) => {
      if (!currentStandId && queue.queueLength === 0) return null;
      if (!currentStandId) return queue.standId;

      const current = standQueues.find(
        (candidate) => candidate.standId === currentStandId
      );
      if (!current) return queue.standId;
      if (queue.queueLength > current.queueLength) return queue.standId;
      if (
        queue.queueLength === current.queueLength &&
        queue.averageWaitMinutes > current.averageWaitMinutes
      ) {
        return queue.standId;
      }
      return currentStandId;
    },
    null
  );

  const eventRevenue = cumulativePoints(eventRevenueBuckets);
  const totalRevenueCents =
    eventRevenue.length > 0
      ? eventRevenue[eventRevenue.length - 1]!.revenueCents
      : 0;
  const standRevenue: StandRevenueSeries[] = standIds.map((standId) => ({
    standId,
    points: cumulativePoints(standRevenueBucketsByStand.get(standId)!),
  }));

  return {
    totalRevenueCents,
    activeGuests,
    maxBottleneckStandId,
    eventRevenue,
    standRevenue,
    standQueues,
  };
}

export async function listLiveOrdersForEventControlCenter(
  eventId: string,
  accountId: string,
  options: LiveOrdersQuery
): Promise<LiveOrder[]> {
  await verifyEventOwnership(eventId, accountId);

  const event = await Event.findOne({ _id: eventId, deletedAt: null }).lean();
  if (!event) throw new EventNotFoundError();

  const stands = await Stand.find({ eventId, deletedAt: null })
    .select("_id")
    .lean();
  const standIds = stands.map((stand) => stand._id);
  const standIdSet = new Set(standIds);

  if (options.standId && !standIdSet.has(options.standId)) {
    throw new StandNotFoundError();
  }

  const products = await Product.find({
    standId: { $in: standIds },
    deletedAt: null,
  })
    .select("_id standId productName")
    .lean();
  const productById = new Map(
    products.map((product) => [product._id, product])
  );

  const orders = await Order.find({ eventId, paidAt: { $ne: null } })
    .sort({ createdAt: 1 })
    .lean();

  return orders
    .map((order): LiveOrder | null => {
      const liveItems = order.items
        .filter((item) => isOpenItem(item))
        .map((item): (LiveOrderItem & { standId: string }) | null => {
          const product = productById.get(item.productId);
          if (!product) return null;
          if (options.standId && product.standId !== options.standId) {
            return null;
          }

          return {
            itemId: item._id,
            productId: item.productId,
            productName: product.productName,
            status: itemStatus(item),
            customerComment: item.customerComment,
            unitPriceIncludingTax: item.priceIncludingTaxAtPurchase,
            standId: product.standId,
          };
        })
        .filter((item): item is LiveOrderItem & { standId: string } =>
          Boolean(item)
        );

      if (liveItems.length === 0) return null;

      const orderStandIds = [...new Set(liveItems.map((item) => item.standId))];
      const items = liveItems.map((item) => ({
        itemId: item.itemId,
        productId: item.productId,
        productName: item.productName,
        status: item.status,
        customerComment: item.customerComment,
        unitPriceIncludingTax: item.unitPriceIncludingTax,
      }));

      return {
        _id: order._id,
        eventId: order.eventId,
        orderNumber: order.orderNumber,
        pickupCode: order.pickupCode,
        customerEmail: order.customerEmail,
        status: orderStatus(items),
        standIds: orderStandIds,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        items,
        totalPriceIncludingTax: items.reduce(
          (total, item) => total + item.unitPriceIncludingTax,
          0
        ),
      };
    })
    .filter((order): order is LiveOrder => Boolean(order));
}
