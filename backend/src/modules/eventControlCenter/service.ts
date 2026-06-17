import { AttendeeSession } from "../sessions/model";
import { Event } from "../events/model";
import { EventNotFoundError } from "../events/errors";
import { verifyEventOwnership } from "../events/ownership";
import type { PipelineStage } from "mongoose";
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
type QueueStatsByStand = Map<
  string,
  { queueLength: number; readyItemCount: number; totalWaitMinutes: number }
>;
type RevenueBucketAggregationRow = {
  elapsedMinutes: number;
  orderCount: number;
  revenueCents: number;
};
type StandRevenueBucketAggregationRow = RevenueBucketAggregationRow & {
  standId: string;
};
type QueueStatsAggregationRow = {
  standId: string;
  queueLength: number;
  readyItemCount: number;
  totalWaitMinutes: number;
};
type EventControlCenterAnalyticsAggregation = {
  eventRevenue: RevenueBucketAggregationRow[];
  standRevenue: StandRevenueBucketAggregationRow[];
  queueStats: QueueStatsAggregationRow[];
};

type RevenueBucket = {
  orderCount: number;
  revenueCents: number;
};

function cumulativePoints(buckets: Map<number, RevenueBucket>): RevenuePoint[] {
  let runningTotal = 0;
  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([elapsedMinutes, bucket]) => {
      runningTotal += bucket.revenueCents;
      return {
        elapsedMinutes,
        intervalRevenueCents: bucket.revenueCents,
        orderCount: bucket.orderCount,
        revenueCents: runningTotal,
      };
    });
}

function isOpenItem(item: OrderItemDoc): boolean {
  return !item.fulfilledAt && !item.cancelledAt;
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

  return new Map(products.map((product) => [product._id, product]));
}

function buildStandQueueMetrics(
  standIds: string[],
  queueStatsByStand: QueueStatsByStand,
  options: EventControlCenterQuery
): StandQueueMetric[] {
  return standIds.map((standId) => {
    const stats = queueStatsByStand.get(standId) ?? {
      queueLength: 0,
      readyItemCount: 0,
      totalWaitMinutes: 0,
    };
    const averageWaitMinutes =
      stats.readyItemCount > 0
        ? Math.round(stats.totalWaitMinutes / stats.readyItemCount)
        : 0;
    const thresholds = options.standAlertThresholds[standId] ?? {
      queueLengthAlertThreshold: 10,
      averageWaitAlertThresholdMinutes: 15,
    };

    return {
      standId,
      queueLength: stats.queueLength,
      averageWaitMinutes,
      alert:
        stats.queueLength >= thresholds.queueLengthAlertThreshold ||
        averageWaitMinutes >= thresholds.averageWaitAlertThresholdMinutes,
    };
  });
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
        readyAt: item.readyAt,
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
    readyAt: item.readyAt,
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

async function loadEventControlCenterAnalytics(
  eventId: string,
  standIds: string[],
  baseDate: Date
): Promise<EventControlCenterAnalyticsAggregation> {
  const elapsedPaidMinutesExpression = {
    $max: [
      0,
      {
        $floor: {
          $divide: [{ $subtract: ["$paidAt", baseDate] }, 60000],
        },
      },
    ],
  };
  const waitMinutesExpression = {
    $max: [
      0,
      {
        $floor: {
          $divide: [{ $subtract: ["$items.readyAt", "$paidAt"] }, 60000],
        },
      },
    ],
  };
  const pipeline: PipelineStage[] = [
    { $match: { eventId, paidAt: { $ne: null } } },
    { $unwind: "$items" },
    { $match: { "items.cancelledAt": null } },
    {
      $lookup: {
        from: Product.collection.name,
        localField: "items.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $match: {
        "product.deletedAt": null,
        "product.standId": { $in: standIds },
      },
    },
    {
      $facet: {
        eventRevenue: [
          {
            $group: {
              _id: elapsedPaidMinutesExpression,
              orderIds: { $addToSet: "$_id" },
              revenueCents: { $sum: "$items.priceIncludingTaxAtPurchase" },
            },
          },
          {
            $project: {
              _id: 0,
              elapsedMinutes: "$_id",
              orderCount: { $size: "$orderIds" },
              revenueCents: 1,
            },
          },
          { $sort: { elapsedMinutes: 1 } },
        ],
        standRevenue: [
          {
            $group: {
              _id: {
                standId: "$product.standId",
                elapsedMinutes: elapsedPaidMinutesExpression,
              },
              orderIds: { $addToSet: "$_id" },
              revenueCents: { $sum: "$items.priceIncludingTaxAtPurchase" },
            },
          },
          {
            $project: {
              _id: 0,
              standId: "$_id.standId",
              elapsedMinutes: "$_id.elapsedMinutes",
              orderCount: { $size: "$orderIds" },
              revenueCents: 1,
            },
          },
          { $sort: { standId: 1, elapsedMinutes: 1 } },
        ],
        queueStats: [
          {
            $group: {
              _id: "$product.standId",
              queueLength: {
                $sum: {
                  $cond: [{ $eq: ["$items.fulfilledAt", null] }, 1, 0],
                },
              },
              readyItemCount: {
                $sum: {
                  $cond: [{ $ne: ["$items.readyAt", null] }, 1, 0],
                },
              },
              totalWaitMinutes: {
                $sum: {
                  $cond: [
                    { $ne: ["$items.readyAt", null] },
                    waitMinutesExpression,
                    0,
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              standId: "$_id",
              queueLength: 1,
              readyItemCount: 1,
              totalWaitMinutes: 1,
            },
          },
        ],
      },
    },
  ];

  const [analytics] =
    await Order.aggregate<EventControlCenterAnalyticsAggregation>(pipeline);

  return analytics ?? { eventRevenue: [], standRevenue: [], queueStats: [] };
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

  const baseDate = event.startedAt
    ? new Date(event.startedAt)
    : new Date(event.createdAt);
  const [analytics, activeGuests] = await Promise.all([
    loadEventControlCenterAnalytics(eventId, standIds, baseDate),
    AttendeeSession.countDocuments({
      eventId,
      status: "active",
      expiresAt: { $gt: new Date() },
    }),
  ]);

  const eventRevenueBuckets = new Map(
    analytics.eventRevenue.map((point) => [
      point.elapsedMinutes,
      {
        orderCount: point.orderCount,
        revenueCents: point.revenueCents,
      },
    ])
  );
  const standRevenueBucketsByStand = new Map(
    standIds.map((standId) => [standId, new Map<number, RevenueBucket>()])
  );
  for (const point of analytics.standRevenue) {
    standRevenueBucketsByStand.get(point.standId)?.set(point.elapsedMinutes, {
      orderCount: point.orderCount,
      revenueCents: point.revenueCents,
    });
  }
  const queueStatsByStand: QueueStatsByStand = new Map(
    analytics.queueStats.map((stats) => [
      stats.standId,
      {
        queueLength: stats.queueLength,
        readyItemCount: stats.readyItemCount,
        totalWaitMinutes: stats.totalWaitMinutes,
      },
    ])
  );

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
    points: cumulativePoints(
      standRevenueBucketsByStand.get(standId) ??
        new Map<number, RevenueBucket>()
    ),
  }));

  return {
    totalRevenueCents,
    activeGuests,
    activeAlertCount: standQueues.filter((queue) => queue.alert).length,
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
