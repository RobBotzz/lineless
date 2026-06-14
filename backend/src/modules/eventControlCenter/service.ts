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

export async function verifyStandPausePreconditions(
  eventId: string,
  standId: string,
  accountId: string
): Promise<void> {
  await verifyEventOwnership(eventId, accountId);

  const stand = await Stand.findOne({ _id: standId, eventId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
}
