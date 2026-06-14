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

type EventControlCenterContext = {
  event: { createdAt: Date; startedAt?: Date };
  standIds: string[];
};

type ProductSnapshot = {
  _id: string;
  standId: string;
  productName: string;
};
type ProductLookup = Map<string, ProductSnapshot>;
type RevenueBucketsByStand = Map<string, Map<number, number>>;
type QueueStatsByStand = Map<
  string,
  { queueLength: number; totalWaitMinutes: number }
>;
type AnalyticsAggregation = {
  eventRevenueBuckets: Map<number, number>;
  standRevenueBucketsByStand: RevenueBucketsByStand;
  queueStatsByStand: QueueStatsByStand;
};

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

async function loadEventControlCenterContext(
  eventId: string,
  accountId: string
): Promise<EventControlCenterContext> {
  await verifyEventOwnership(eventId, accountId);

  const [event, stands] = await Promise.all([
    Event.findOne({ _id: eventId, deletedAt: null })
      .select("createdAt startedAt")
      .lean(),
    Stand.find({ eventId, deletedAt: null }).select("_id").lean(),
  ]);

  if (!event) throw new EventNotFoundError();

  return {
    event,
    standIds: stands.map((stand) => stand._id),
  };
}

async function loadProductsByStand(standIds: string[]): Promise<ProductLookup> {
  const products = await Product.find({
    standId: { $in: standIds },
    deletedAt: null,
  })
    .select("_id standId productName")
    .lean();
  const standIdSet = new Set(standIds);

  return new Map(
    products
      .filter((product) => standIdSet.has(product.standId))
      .map((product) => [product._id, product])
  );
}

function mapByStand<T>(standIds: string[], factory: () => T): Map<string, T> {
  return new Map(standIds.map((standId) => [standId, factory()]));
}

function createAnalyticsAggregation(standIds: string[]): AnalyticsAggregation {
  return {
    eventRevenueBuckets: new Map<number, number>(),
    standRevenueBucketsByStand: mapByStand(
      standIds,
      () => new Map<number, number>()
    ),
    queueStatsByStand: mapByStand(standIds, () => ({
      queueLength: 0,
      totalWaitMinutes: 0,
    })),
  };
}

function buildStandQueueMetrics(
  standIds: string[],
  queueStatsByStand: QueueStatsByStand,
  options: EventControlCenterQuery
): StandQueueMetric[] {
  return standIds.map((standId) => {
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
}

function findMaxBottleneckStandId(
  standQueues: StandQueueMetric[]
): string | null {
  const bottleneck = standQueues
    .filter((queue) => queue.queueLength > 0)
    .sort((left, right) => {
      if (right.queueLength !== left.queueLength) {
        return right.queueLength - left.queueLength;
      }
      return right.averageWaitMinutes - left.averageWaitMinutes;
    })[0];

  return bottleneck?.standId ?? null;
}

function toLiveOrder(
  order: OrderDoc,
  productById: ProductLookup,
  standIdFilter?: string
): LiveOrder | null {
  const liveItems = order.items
    .filter((item) => isOpenItem(item))
    .map((item): (LiveOrderItem & { standId: string }) | null => {
      const product = productById.get(item.productId);
      if (!product) return null;
      if (standIdFilter && product.standId !== standIdFilter) return null;

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

  const standIds = [...new Set(liveItems.map((item) => item.standId))];
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
    standIds,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    items,
    totalPriceIncludingTax: items.reduce(
      (total, item) => total + item.unitPriceIncludingTax,
      0
    ),
  };
}

function collectAnalytics(
  orders: OrderDoc[],
  productById: ProductLookup,
  standIds: string[],
  baseDate: Date
): AnalyticsAggregation {
  const aggregation = createAnalyticsAggregation(standIds);
  const now = new Date();

  for (const order of orders) {
    const paidAt = paidAtDate(order);
    const paidElapsedMinutes = paidAt
      ? elapsedMinutesSince(baseDate, paidAt)
      : null;
    const waitMinutes = elapsedMinutesSince(orderCreatedAtDate(order), now);

    for (const item of order.items) {
      const standId = productById.get(item.productId)?.standId;
      if (!standId) continue;

      if (paidElapsedMinutes !== null && !item.cancelledAt) {
        addRevenuePoint(
          aggregation.eventRevenueBuckets,
          paidElapsedMinutes,
          item.priceIncludingTaxAtPurchase
        );
        addRevenuePoint(
          aggregation.standRevenueBucketsByStand.get(standId)!,
          paidElapsedMinutes,
          item.priceIncludingTaxAtPurchase
        );
      }

      if (paidAt && isOpenItem(item)) {
        const stats = aggregation.queueStatsByStand.get(standId);
        if (!stats) continue;
        stats.queueLength += 1;
        stats.totalWaitMinutes += waitMinutes;
      }
    }
  }

  return aggregation;
}

export async function getEventControlCenter(
  eventId: string,
  accountId: string,
  options: EventControlCenterQuery
): Promise<EventControlCenterData> {
  const { event, standIds } = await loadEventControlCenterContext(
    eventId,
    accountId
  );

  const [orders, activeGuests, productById] = await Promise.all([
    Order.find({ eventId }).lean(),
    AttendeeSession.countDocuments({
      eventId,
      status: "active",
      expiresAt: { $gt: new Date() },
    }),
    loadProductsByStand(standIds),
  ]);

  const baseDate = event.startedAt
    ? new Date(event.startedAt)
    : new Date(event.createdAt);
  const { eventRevenueBuckets, queueStatsByStand, standRevenueBucketsByStand } =
    collectAnalytics(orders, productById, standIds, baseDate);

  const standQueues = buildStandQueueMetrics(
    standIds,
    queueStatsByStand,
    options
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
    maxBottleneckStandId: findMaxBottleneckStandId(standQueues),
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
  const { standIds } = await loadEventControlCenterContext(eventId, accountId);
  const standIdSet = new Set(standIds);

  if (options.standId && !standIdSet.has(options.standId)) {
    throw new StandNotFoundError();
  }

  const [orders, productById] = await Promise.all([
    Order.find({ eventId, paidAt: { $ne: null } })
      .sort({ createdAt: 1 })
      .lean(),
    loadProductsByStand(standIds),
  ]);

  return orders
    .map((order) => toLiveOrder(order, productById, options.standId))
    .filter((order): order is LiveOrder => Boolean(order));
}
