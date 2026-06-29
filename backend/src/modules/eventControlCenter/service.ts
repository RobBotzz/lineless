import { AttendeeSession } from "../sessions/model";
import { Event } from "../events/model";
import { EventNotFoundError } from "../events/errors";
import { verifyEventOwnership } from "../events/ownership";
import type { PipelineStage } from "mongoose";
import { Order, type OrderDoc, type OrderItemDoc } from "../orders/model";
import { Product } from "../products/model";
import { Rating } from "../ratings/model";
import { StandNotFoundError } from "../stands/errors";
import { Stand, type StandStatus } from "../stands/model";
import { loadEffectiveEventControlCenterSettings } from "./settings.service";
import type {
  EventControlCenterData,
  EventControlCenterSettings,
  LiveOrder,
  LiveOrderItem,
  ProductRating,
  ProductStockAlert,
  LiveOrdersQuery,
  RevenuePoint,
  RevenueProductBreakdown,
  StandQueueMetric,
  StandRevenuePoint,
  StandRevenueSeries,
} from "./types";

type EventControlCenterContext = {
  event: { createdAt: Date; startedAt?: Date };
  stands: StandSnapshot[];
};

type StandSnapshot = {
  _id: string;
  standName: string;
  standStatus: StandStatus;
};
type ProductSnapshot = {
  _id: string;
  standId: string;
  productName: string;
};
type ProductRatingProductSnapshot = ProductSnapshot & {
  productImageUrl: string | null;
};
type ProductStockAlertProductSnapshot = ProductSnapshot & {
  productStock: number;
  productStatus: "LIVE" | "PAUSED";
};
type ProductLookup = Map<string, ProductSnapshot>;
type LiveOrdersProductScope = {
  productById: ProductLookup;
  productIds: string[];
};
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
type ProductRevenueBucketAggregationRow = {
  standId: string;
  productId: string;
  productName: string;
  elapsedMinutes: number;
  quantitySold: number;
  revenueCents: number;
};
type QueueStatsAggregationRow = {
  standId: string;
  queueLength: number;
  readyItemCount: number;
  totalWaitMinutes: number;
};
type EventControlCenterAnalyticsAggregation = {
  eventRevenue: RevenueBucketAggregationRow[];
  productRevenue: ProductRevenueBucketAggregationRow[];
  standRevenue: StandRevenueBucketAggregationRow[];
  queueStats: QueueStatsAggregationRow[];
};

type RevenueBucket = {
  orderCount: number;
  revenueCents: number;
};
type StandRevenueBucket = RevenueBucket & {
  products: RevenueProductBreakdown[];
};
const PRODUCT_RATINGS_LIMIT = 80;
const LIVE_ORDERS_LIMIT = 200;

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

function cumulativeStandRevenuePoints(
  buckets: Map<number, StandRevenueBucket>
): StandRevenuePoint[] {
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
        products: [...bucket.products].sort(
          (left, right) =>
            right.revenueCents - left.revenueCents ||
            right.quantitySold - left.quantitySold ||
            left.productName.localeCompare(right.productName)
        ),
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
    Stand.find({ eventId, deletedAt: null })
      .select("_id standName standStatus")
      .lean<StandSnapshot[]>(),
  ]);

  if (!event) throw new EventNotFoundError();

  return {
    event,
    stands,
  };
}

export async function standBelongsToEvent(
  eventId: string,
  standId: string
): Promise<boolean> {
  const stand = await Stand.exists({ _id: standId, eventId, deletedAt: null });
  return Boolean(stand);
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

async function loadLiveOrdersProductScope(
  standIds: string[],
  standIdFilter?: string
): Promise<LiveOrdersProductScope> {
  const productById = await loadProductsByStand(standIds);
  const productIds = [...productById.values()]
    .filter((product) => !standIdFilter || product.standId === standIdFilter)
    .map((product) => product._id);

  return { productById, productIds };
}

async function loadProductRatingsForEvent(
  eventId: string,
  standIds: string[]
): Promise<ProductRating[]> {
  const ratings = await Rating.find({ eventId })
    .sort({ createdAt: -1 })
    .limit(PRODUCT_RATINGS_LIMIT)
    .select("_id productId stars comment createdAt")
    .lean();

  if (ratings.length === 0) return [];

  const productIds = [...new Set(ratings.map((rating) => rating.productId))];
  const products = await Product.find({
    _id: { $in: productIds },
    standId: { $in: standIds },
    deletedAt: null,
  })
    .select("_id standId productName productImageUrl")
    .lean<ProductRatingProductSnapshot[]>();
  const productById = new Map(
    products.map((product) => [product._id, product])
  );

  const ratingStandIds = [
    ...new Set(products.map((product) => product.standId)),
  ];
  const stands = await Stand.find({
    _id: { $in: ratingStandIds },
    eventId,
    deletedAt: null,
  })
    .select("_id standName")
    .lean();
  const standNameById = new Map(
    stands.map((stand) => [stand._id, stand.standName])
  );

  return ratings
    .map((rating): ProductRating | null => {
      const product = productById.get(rating.productId);
      if (!product) return null;
      const standName = standNameById.get(product.standId);
      if (!standName) return null;

      return {
        _id: rating._id,
        productId: rating.productId,
        productName: product.productName,
        productImageUrl: product.productImageUrl,
        standId: product.standId,
        standName,
        stars: rating.stars,
        comment: rating.comment,
        createdAt: rating.createdAt,
      };
    })
    .filter((rating): rating is ProductRating => Boolean(rating));
}

async function loadProductStockAlertsForEvent(
  eventId: string,
  standIds: string[],
  stockAlertThreshold: number
): Promise<ProductStockAlert[]> {
  const products = await Product.find({
    standId: { $in: standIds },
    productStock: { $lte: stockAlertThreshold },
    productStatus: { $in: ["LIVE", "PAUSED"] },
    deletedAt: null,
  })
    .select("_id standId productName productStock productStatus")
    .lean<ProductStockAlertProductSnapshot[]>();

  if (products.length === 0) return [];

  const stockStandIds = [
    ...new Set(products.map((product) => product.standId)),
  ];
  const stands = await Stand.find({
    _id: { $in: stockStandIds },
    eventId,
    deletedAt: null,
  })
    .select("_id standName")
    .lean();
  const standNameById = new Map(
    stands.map((stand) => [stand._id, stand.standName])
  );

  return products
    .map((product): ProductStockAlert | null => {
      const standName = standNameById.get(product.standId);
      if (!standName) return null;

      return {
        productId: product._id,
        productName: product.productName,
        standId: product.standId,
        standName,
        productStock: product.productStock,
        stockAlertThreshold,
        productStatus: product.productStatus,
      };
    })
    .filter((alert): alert is ProductStockAlert => Boolean(alert))
    .sort((left, right) => {
      if (left.productStock !== right.productStock) {
        return left.productStock - right.productStock;
      }
      const standCompare = left.standName.localeCompare(right.standName);
      if (standCompare !== 0) return standCompare;
      return left.productName.localeCompare(right.productName);
    });
}

function buildStandQueueMetrics(
  stands: StandSnapshot[],
  queueStatsByStand: QueueStatsByStand,
  settings: EventControlCenterSettings
): StandQueueMetric[] {
  return stands.map((stand) => {
    const stats = queueStatsByStand.get(stand._id) ?? {
      queueLength: 0,
      readyItemCount: 0,
      totalWaitMinutes: 0,
    };
    const averageWaitMinutes =
      stats.readyItemCount > 0
        ? Math.round(stats.totalWaitMinutes / stats.readyItemCount)
        : 0;
    const thresholds = settings.standAlertThresholds[stand._id]!;

    return {
      standId: stand._id,
      standName: stand.standName,
      standStatus: stand.standStatus,
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
        productRevenue: [
          {
            $group: {
              _id: {
                standId: "$product.standId",
                productId: "$product._id",
                productName: "$product.productName",
                elapsedMinutes: elapsedPaidMinutesExpression,
              },
              quantitySold: { $sum: 1 },
              revenueCents: { $sum: "$items.priceIncludingTaxAtPurchase" },
            },
          },
          {
            $project: {
              _id: 0,
              standId: "$_id.standId",
              productId: "$_id.productId",
              productName: "$_id.productName",
              elapsedMinutes: "$_id.elapsedMinutes",
              quantitySold: 1,
              revenueCents: 1,
            },
          },
          {
            $sort: {
              standId: 1,
              elapsedMinutes: 1,
              revenueCents: -1,
              productName: 1,
            },
          },
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

  return (
    analytics ?? {
      eventRevenue: [],
      productRevenue: [],
      standRevenue: [],
      queueStats: [],
    }
  );
}

export async function getEventControlCenter(
  eventId: string,
  accountId: string
): Promise<EventControlCenterData> {
  const { event, stands } = await loadEventControlCenterContext(
    eventId,
    accountId
  );
  const standIds = stands.map((stand) => stand._id);
  const settings = await loadEffectiveEventControlCenterSettings(
    eventId,
    standIds
  );

  const baseDate = event.startedAt
    ? new Date(event.startedAt)
    : new Date(event.createdAt);
  const [analytics, activeGuests, productRatings, productStockAlerts] =
    await Promise.all([
      loadEventControlCenterAnalytics(eventId, standIds, baseDate),
      AttendeeSession.countDocuments({
        eventId,
        status: "active",
        expiresAt: { $gt: new Date() },
      }),
      loadProductRatingsForEvent(eventId, standIds),
      loadProductStockAlertsForEvent(
        eventId,
        standIds,
        settings.stockAlertThreshold
      ),
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
    standIds.map((standId) => [standId, new Map<number, StandRevenueBucket>()])
  );
  for (const point of analytics.standRevenue) {
    const standBuckets = standRevenueBucketsByStand.get(point.standId);
    if (!standBuckets) continue;

    const bucket = standBuckets.get(point.elapsedMinutes) ?? {
      orderCount: 0,
      revenueCents: 0,
      products: [],
    };
    bucket.orderCount = point.orderCount;
    bucket.revenueCents = point.revenueCents;
    standBuckets.set(point.elapsedMinutes, bucket);
  }
  for (const point of analytics.productRevenue) {
    const standBuckets = standRevenueBucketsByStand.get(point.standId);
    if (!standBuckets) continue;

    const bucket = standBuckets.get(point.elapsedMinutes) ?? {
      orderCount: 0,
      revenueCents: 0,
      products: [],
    };
    bucket.products.push({
      productId: point.productId,
      productName: point.productName,
      quantitySold: point.quantitySold,
      revenueCents: point.revenueCents,
    });
    standBuckets.set(point.elapsedMinutes, bucket);
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
    stands,
    queueStatsByStand,
    settings
  );
  const eventRevenue = cumulativePoints(eventRevenueBuckets);
  const totalRevenueCents =
    eventRevenue.length > 0
      ? eventRevenue[eventRevenue.length - 1]!.revenueCents
      : 0;
  const standRevenue: StandRevenueSeries[] = stands.map((stand) => ({
    standId: stand._id,
    standName: stand.standName,
    standStatus: stand.standStatus,
    points: cumulativeStandRevenuePoints(
      standRevenueBucketsByStand.get(stand._id) ??
        new Map<number, StandRevenueBucket>()
    ),
  }));

  return {
    totalRevenueCents,
    activeGuests,
    activeAlertCount:
      standQueues.filter((queue) => queue.alert).length +
      productStockAlerts.length,
    eventRevenue,
    standRevenue,
    standQueues,
    productStockAlerts,
    productRatings,
  };
}

export async function listLiveOrdersForEventControlCenter(
  eventId: string,
  accountId: string,
  options: LiveOrdersQuery
): Promise<LiveOrder[]> {
  const { stands } = await loadEventControlCenterContext(eventId, accountId);
  const standIds = stands.map((stand) => stand._id);
  const standIdSet = new Set(standIds);

  if (options.standId && !standIdSet.has(options.standId)) {
    throw new StandNotFoundError();
  }

  const { productById, productIds } = await loadLiveOrdersProductScope(
    standIds,
    options.standId
  );

  if (productIds.length === 0) return [];

  const orders = await Order.find({
    eventId,
    paidAt: { $ne: null },
    items: {
      $elemMatch: {
        productId: { $in: productIds },
        fulfilledAt: null,
        cancelledAt: null,
      },
    },
  })
    .sort({ createdAt: -1 })
    .limit(LIVE_ORDERS_LIMIT)
    .lean();

  return orders
    .map((order) => toLiveOrder(order, productById, options.standId))
    .filter((order): order is LiveOrder => Boolean(order));
}
