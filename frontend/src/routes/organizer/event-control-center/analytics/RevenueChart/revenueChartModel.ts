import type { RevenuePoint, StandRevenueSeries } from '@/api/eventControlCenter';
import { formatMoney } from '@/types/product';

export const REVENUE_TIME_RANGE_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
  { label: '6 h', minutes: 360 },
  { label: '12 h', minutes: 720 },
  { label: '24 h', minutes: 1_440 },
] as const;
const REVENUE_BUCKET_COUNT = 30;

const REVENUE_STAND_COLORS = [
  '#020887',
  '#0f766e',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#65a30d',
  '#be123c',
];

export type RevenueTimeRangeMinutes = (typeof REVENUE_TIME_RANGE_OPTIONS)[number]['minutes'];

export type StandRevenueBreakdown = {
  color: string;
  revenueCents: number;
  share: number;
  standId: string;
  standName: string;
};

export type RevenueIntervalPoint = {
  intervalEndAt: Date;
  intervalEndMinutes: number;
  intervalStartAt: Date;
  intervalStartMinutes: number;
  orderCount: number;
  revenueCents: number;
};

export type RevenueStandSeries = {
  color: string;
  data: number[];
  standId: string;
  standName: string;
};

export type RevenueChartModel = {
  eventStartAt: Date;
  points: RevenueIntervalPoint[];
  standSeries: RevenueStandSeries[];
  totalBreakdown: StandRevenueBreakdown[];
};

export function createRevenueChartModel(
  points: RevenuePoint[],
  standRevenue: StandRevenueSeries[],
  standNameById: Map<string, string>,
  eventStartAt: string,
  timeRangeMinutes: RevenueTimeRangeMinutes,
): RevenueChartModel {
  const sortedPoints = [...points].sort(
    (left, right) => left.elapsedMinutes - right.elapsedMinutes,
  );
  const parsedEventStartAt = new Date(eventStartAt);
  const safeEventStartAt = Number.isNaN(parsedEventStartAt.getTime())
    ? new Date()
    : parsedEventStartAt;
  const standRevenueCentsById = new Map(
    standRevenue.map((series) => [series.standId, getStandRevenueCents(series)]),
  );
  const rankedStandEntries = [
    ...Array.from(standNameById.entries()).map(([standId, standName]) => ({
      standId,
      standName,
    })),
    ...standRevenue
      .filter((series) => !standNameById.has(series.standId))
      .map((series) => ({ standId: series.standId, standName: 'Unknown stand' })),
  ].sort(
    (left, right) =>
      (standRevenueCentsById.get(right.standId) ?? 0) -
      (standRevenueCentsById.get(left.standId) ?? 0),
  );
  const maxElapsedMinutes = Math.max(
    ...sortedPoints.map((point) => point.elapsedMinutes),
    ...standRevenue.flatMap((series) => series.points.map((point) => point.elapsedMinutes)),
    0,
  );
  const bucketMinutes = timeRangeMinutes / REVENUE_BUCKET_COUNT;
  const elapsedMinutesUntilNow = Math.max(
    0,
    Math.ceil((Date.now() - safeEventStartAt.getTime()) / 60_000),
  );
  const windowEndMinutes = Math.max(elapsedMinutesUntilNow, maxElapsedMinutes + bucketMinutes);
  const windowStartMinutes = windowEndMinutes - timeRangeMinutes;
  const intervalPoints = createRevenueIntervalPoints(
    sortedPoints,
    safeEventStartAt,
    bucketMinutes,
    windowStartMinutes,
  );
  const standSeries = rankedStandEntries.map((stand, index) => ({
    color: REVENUE_STAND_COLORS[index % REVENUE_STAND_COLORS.length]!,
    data: createStandRevenueData(
      standRevenue.find((series) => series.standId === stand.standId)?.points ?? [],
      bucketMinutes,
      intervalPoints,
    ),
    standId: stand.standId,
    standName: stand.standName,
  }));
  const totalBreakdownInput = rankedStandEntries
    .map((stand, index) => {
      const revenueCents = standRevenueCentsById.get(stand.standId) ?? 0;

      return {
        color: REVENUE_STAND_COLORS[index % REVENUE_STAND_COLORS.length]!,
        revenueCents,
        share: 0,
        standId: stand.standId,
        standName: stand.standName,
      };
    })
    .sort((left, right) => right.revenueCents - left.revenueCents);
  const totalBreakdown = normalizeStandBreakdownShares(totalBreakdownInput);

  return {
    eventStartAt: safeEventStartAt,
    points: intervalPoints,
    standSeries,
    totalBreakdown,
  };
}

function createRevenueIntervalPoints(
  points: RevenuePoint[],
  eventStartAt: Date,
  bucketMinutes: number,
  windowStartMinutes: number,
): RevenueIntervalPoint[] {
  const bucketByStartMinute = new Map<number, { orderCount: number; revenueCents: number }>();

  for (const point of points) {
    const bucketIndex = Math.floor((point.elapsedMinutes - windowStartMinutes) / bucketMinutes);
    if (bucketIndex < 0 || bucketIndex >= REVENUE_BUCKET_COUNT) continue;

    const bucketStartMinute = windowStartMinutes + bucketIndex * bucketMinutes;
    const bucket = bucketByStartMinute.get(bucketStartMinute) ?? {
      orderCount: 0,
      revenueCents: 0,
    };

    bucket.orderCount += point.orderCount;
    bucket.revenueCents += point.intervalRevenueCents;
    bucketByStartMinute.set(bucketStartMinute, bucket);
  }

  const intervalPoints: RevenueIntervalPoint[] = [];

  for (let index = 0; index < REVENUE_BUCKET_COUNT; index += 1) {
    const intervalStartMinutes = windowStartMinutes + index * bucketMinutes;
    const intervalEndMinutes = intervalStartMinutes + bucketMinutes;
    const bucket = bucketByStartMinute.get(intervalStartMinutes) ?? {
      orderCount: 0,
      revenueCents: 0,
    };

    intervalPoints.push({
      intervalEndAt: addMinutes(eventStartAt, intervalEndMinutes),
      intervalEndMinutes,
      intervalStartAt: addMinutes(eventStartAt, intervalStartMinutes),
      intervalStartMinutes,
      orderCount: bucket.orderCount,
      revenueCents: bucket.revenueCents,
    });
  }

  return intervalPoints;
}

function createStandRevenueData(
  points: RevenuePoint[],
  bucketMinutes: number,
  intervalPoints: RevenueIntervalPoint[],
): number[] {
  const revenueByStartMinute = new Map<number, number>();
  const firstInterval = intervalPoints[0];
  if (!firstInterval) return [];

  const windowStartMinutes = firstInterval.intervalStartMinutes;

  for (const point of points) {
    const bucketIndex = Math.floor((point.elapsedMinutes - windowStartMinutes) / bucketMinutes);
    if (bucketIndex < 0 || bucketIndex >= intervalPoints.length) continue;

    const bucketStartMinute = windowStartMinutes + bucketIndex * bucketMinutes;
    revenueByStartMinute.set(
      bucketStartMinute,
      (revenueByStartMinute.get(bucketStartMinute) ?? 0) + point.intervalRevenueCents,
    );
  }

  return intervalPoints.map(
    (intervalPoint) => revenueByStartMinute.get(intervalPoint.intervalStartMinutes) ?? 0,
  );
}

function getStandRevenueCents(series: StandRevenueSeries): number {
  const intervalRevenueCents = series.points.reduce(
    (total, point) => total + point.intervalRevenueCents,
    0,
  );
  if (intervalRevenueCents > 0) return intervalRevenueCents;

  const sortedPoints = [...series.points].sort(
    (left, right) => left.elapsedMinutes - right.elapsedMinutes,
  );
  return sortedPoints.at(-1)?.revenueCents ?? 0;
}

function normalizeStandBreakdownShares(
  breakdown: StandRevenueBreakdown[],
): StandRevenueBreakdown[] {
  const totalRevenueCents = breakdown.reduce((total, entry) => total + entry.revenueCents, 0);
  if (totalRevenueCents <= 0) return breakdown;

  let assignedShare = 0;
  const lastRevenueIndex = breakdown.findLastIndex((entry) => entry.revenueCents > 0);

  return breakdown.map((entry, index) => {
    if (entry.revenueCents <= 0) return entry;

    const share =
      index === lastRevenueIndex
        ? Math.max(0, 100 - assignedShare)
        : (entry.revenueCents / totalRevenueCents) * 100;
    assignedShare += share;

    return { ...entry, share };
  });
}

export function formatAxisMoney(valueCents: number): string {
  return `EUR ${formatMoney(valueCents)}`;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function formatChartTime(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatIntervalLabel(startAt: Date, endAt: Date): string {
  return `${formatChartTime(startAt)} - ${formatChartTime(endAt)}`;
}

export function formatTimeRangeLabel(minutes: RevenueTimeRangeMinutes): string {
  if (minutes === 30) return 'last 30 min';
  if (minutes === 60) return 'last 1 h';

  return `last ${minutes / 60} h`;
}
