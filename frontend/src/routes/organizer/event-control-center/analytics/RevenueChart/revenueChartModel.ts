import type { CSSProperties } from 'react';

import type { RevenuePoint, StandRevenueSeries } from '@/api/eventControlCenter';
import { formatMoney } from '@/types/product';

export const REVENUE_CHART_MIN_WIDTH = 720;
export const REVENUE_CHART_HEIGHT = 360;
export const REVENUE_GRANULARITY_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
] as const;

const REVENUE_TOOLTIP_HEIGHT = 118;
const REVENUE_TOOLTIP_MARGIN = 12;
const REVENUE_TOOLTIP_OFFSET = 12;
const REVENUE_TOOLTIP_WIDTH = 224;
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

export type RevenueGranularityMinutes = (typeof REVENUE_GRANULARITY_OPTIONS)[number]['minutes'];

export type StandRevenueBreakdown = {
  color: string;
  revenueCents: number;
  share: number;
  standId: string;
  standName: string;
};

export type RevenueIntervalPoint = {
  elapsedMinutes: number;
  intervalEndAt: Date;
  intervalEndMinutes: number;
  intervalStartAt: Date;
  intervalStartMinutes: number;
  orderCount: number;
  revenueCents: number;
};

export type RevenueChartModel = {
  baselineY: number;
  chartWidth: number;
  coordinates: { x: number; y: number }[];
  eventStartAt: Date;
  lineCoordinates: { x: number; y: number }[];
  maxMinutes: number;
  maxRevenue: number;
  plot: {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
  };
  points: RevenueIntervalPoint[];
  totalBreakdown: StandRevenueBreakdown[];
  xForMinute: (elapsedMinutes: number) => number;
  yForRevenue: (revenueCents: number) => number;
  yTicks: number[];
};

export function createRevenueChartModel(
  points: RevenuePoint[],
  standRevenue: StandRevenueSeries[],
  standNameById: Map<string, string>,
  eventStartAt: string,
  granularityMinutes: RevenueGranularityMinutes,
  chartWidth: number,
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
  const intervalPoints = createRevenueIntervalPoints(
    sortedPoints,
    safeEventStartAt,
    granularityMinutes,
  );
  const maxMinutes = Math.max(
    ...intervalPoints.map((point) => point.intervalEndMinutes),
    granularityMinutes * 3,
    90,
  );
  const rawMaxRevenue = Math.max(...intervalPoints.map((point) => point.revenueCents), 100);
  const maxRevenue = getNiceRevenueCeiling(rawMaxRevenue);
  const plot = {
    left: 78,
    right: 34,
    top: 42,
    bottom: 52,
    width: Math.max(320, chartWidth - 78 - 34),
    height: 266,
  };
  const xForMinute = (elapsedMinutes: number) =>
    plot.left + (elapsedMinutes / maxMinutes) * plot.width;
  const yForRevenue = (revenueCents: number) =>
    plot.top + (1 - revenueCents / maxRevenue) * plot.height;
  const coordinates = intervalPoints.map((point) => ({
    x: xForMinute(point.elapsedMinutes),
    y: yForRevenue(point.revenueCents),
  }));
  const lineCoordinates = intervalPoints.map((point) => ({
    x: xForMinute(point.elapsedMinutes),
    y: yForRevenue(point.revenueCents),
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
    baselineY: plot.top + plot.height,
    chartWidth,
    coordinates,
    eventStartAt: safeEventStartAt,
    lineCoordinates,
    maxMinutes,
    maxRevenue,
    plot,
    points: intervalPoints,
    totalBreakdown,
    xForMinute,
    yForRevenue,
    yTicks: [maxRevenue, Math.round(maxRevenue / 2), 0],
  };
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

function createRevenueIntervalPoints(
  points: RevenuePoint[],
  eventStartAt: Date,
  granularityMinutes: RevenueGranularityMinutes,
): RevenueIntervalPoint[] {
  if (points.length === 0) return [];

  const bucketByStartMinute = new Map<number, { orderCount: number; revenueCents: number }>();
  let previousRevenueCents = 0;

  for (const point of points) {
    const intervalRevenueCents =
      point.intervalRevenueCents ?? Math.max(0, point.revenueCents - previousRevenueCents);
    previousRevenueCents = point.revenueCents;

    const bucketStartMinute =
      Math.floor(point.elapsedMinutes / granularityMinutes) * granularityMinutes;
    const bucket = bucketByStartMinute.get(bucketStartMinute) ?? {
      orderCount: 0,
      revenueCents: 0,
    };

    bucket.orderCount += point.orderCount ?? (intervalRevenueCents > 0 ? 1 : 0);
    bucket.revenueCents += intervalRevenueCents;
    bucketByStartMinute.set(bucketStartMinute, bucket);
  }

  const maxElapsedMinutes = Math.max(...points.map((point) => point.elapsedMinutes));
  const maxIntervalEndMinutes = Math.max(
    Math.ceil((maxElapsedMinutes + 1) / granularityMinutes) * granularityMinutes,
    granularityMinutes,
  );

  const intervalPoints: RevenueIntervalPoint[] = [];
  for (
    let intervalStartMinutes = 0;
    intervalStartMinutes < maxIntervalEndMinutes;
    intervalStartMinutes += granularityMinutes
  ) {
    const intervalEndMinutes = intervalStartMinutes + granularityMinutes;
    const bucket = bucketByStartMinute.get(intervalStartMinutes) ?? {
      orderCount: 0,
      revenueCents: 0,
    };

    intervalPoints.push({
      elapsedMinutes: intervalStartMinutes + granularityMinutes / 2,
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

function getNiceRevenueCeiling(value: number): number {
  if (value <= 0) return 100;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceMultiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return niceMultiplier * magnitude;
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

export function formatGranularityLabel(minutes: RevenueGranularityMinutes): string {
  return minutes === 60 ? '1 h' : `${minutes} min`;
}

export function createAreaPath(
  path: string,
  points: { x: number; y: number }[],
  baselineY: number,
): string {
  if (!path || points.length === 0) return '';

  return `${path} L ${points.at(-1)!.x.toFixed(1)} ${baselineY} L ${points[0]!.x.toFixed(
    1,
  )} ${baselineY} Z`;
}

export function findNearestRevenuePointIndex(points: { x: number; y: number }[], pointerX: number) {
  return points.reduce((nearestIndex, point, index) => {
    const nearest = points[nearestIndex]!;

    return Math.abs(point.x - pointerX) < Math.abs(nearest.x - pointerX) ? index : nearestIndex;
  }, 0);
}

export function getRevenueTooltipLayout(
  anchor: { x: number; y: number },
  container: HTMLDivElement | null,
  svg: SVGSVGElement | null,
  chartWidth: number,
  viewportWidth: number,
): CSSProperties {
  const safeViewportWidth = Math.max(1, container?.clientWidth ?? viewportWidth);
  const safeViewportHeight = Math.max(1, container?.clientHeight ?? REVENUE_CHART_HEIGHT);
  let renderedAnchorX: number;
  let renderedAnchorY: number;

  const svgMatrix = svg?.getScreenCTM();
  const containerBounds = container?.getBoundingClientRect();
  if (svg && svgMatrix && containerBounds) {
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = anchor.x;
    svgPoint.y = anchor.y;
    const screenPoint = svgPoint.matrixTransform(svgMatrix);
    renderedAnchorX = screenPoint.x - containerBounds.left;
    renderedAnchorY = screenPoint.y - containerBounds.top;
  } else {
    const scale = safeViewportWidth / chartWidth;
    renderedAnchorX = anchor.x * scale;
    renderedAnchorY = anchor.y * scale;
  }

  const shouldAnchorLeft =
    renderedAnchorX + REVENUE_TOOLTIP_WIDTH / 2 + REVENUE_TOOLTIP_MARGIN > safeViewportWidth;
  const shouldAnchorRight =
    renderedAnchorX - REVENUE_TOOLTIP_WIDTH / 2 - REVENUE_TOOLTIP_MARGIN < 0;
  const preferredLeft = shouldAnchorLeft
    ? renderedAnchorX - REVENUE_TOOLTIP_WIDTH - REVENUE_TOOLTIP_OFFSET
    : shouldAnchorRight
      ? renderedAnchorX + REVENUE_TOOLTIP_OFFSET
      : renderedAnchorX - REVENUE_TOOLTIP_WIDTH / 2;
  const maxLeft = Math.max(
    REVENUE_TOOLTIP_MARGIN,
    safeViewportWidth - REVENUE_TOOLTIP_WIDTH - REVENUE_TOOLTIP_MARGIN,
  );
  const left = Math.min(Math.max(preferredLeft, REVENUE_TOOLTIP_MARGIN), maxLeft);
  const aboveTop = renderedAnchorY - REVENUE_TOOLTIP_HEIGHT - REVENUE_TOOLTIP_OFFSET;
  const belowTop = renderedAnchorY + REVENUE_TOOLTIP_OFFSET;
  const preferredTop = aboveTop >= REVENUE_TOOLTIP_MARGIN ? aboveTop : belowTop;
  const maxTop = Math.max(
    REVENUE_TOOLTIP_MARGIN,
    safeViewportHeight - REVENUE_TOOLTIP_HEIGHT - REVENUE_TOOLTIP_MARGIN,
  );
  const top = Math.min(Math.max(preferredTop, REVENUE_TOOLTIP_MARGIN), maxTop);

  return {
    transform: `translate3d(${left}px, ${top}px, 0)`,
    transition: 'transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1)',
  };
}

export function createSmoothRevenuePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;

    const previous = points[index - 1]!;
    const controlDistance = (point.x - previous.x) / 2;
    const controlPointOne = {
      x: previous.x + controlDistance,
      y: previous.y,
    };
    const controlPointTwo = {
      x: point.x - controlDistance,
      y: point.y,
    };

    return `${path} C ${controlPointOne.x.toFixed(1)} ${controlPointOne.y.toFixed(
      1,
    )}, ${controlPointTwo.x.toFixed(1)} ${controlPointTwo.y.toFixed(1)}, ${point.x.toFixed(
      1,
    )} ${point.y.toFixed(1)}`;
  }, '');
}
