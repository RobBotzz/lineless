import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

import {
  type EventControlCenterData,
  type RevenuePoint,
  type StandQueueMetric,
  type StandRevenueSeries,
} from '@/api/eventControlCenter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/types/product';
import type { Stand } from '@/types/stand';

type StandDisplay = Pick<Stand, '_id' | 'standName'>;

export function EventControlCenterAnalyticsPage({
  analytics,
  eventStartAt,
  stands,
}: {
  analytics: EventControlCenterData;
  eventStartAt: string;
  stands: Stand[];
}) {
  const standNameById = useMemo(
    () => new Map(stands.map((stand) => [stand._id, stand.standName])),
    [stands],
  );
  const maxBottleneckName = analytics.maxBottleneckStandId
    ? (standNameById.get(analytics.maxBottleneckStandId) ?? 'Unknown stand')
    : 'None';
  const maxBottleneckQueue = analytics.maxBottleneckStandId
    ? (analytics.standQueues.find((queue) => queue.standId === analytics.maxBottleneckStandId) ??
      null)
    : null;
  const bottleneckHasAlert = maxBottleneckQueue?.alert ?? false;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <LivePulseMetric
          label="Total Revenue"
          value={`EUR ${formatMoney(analytics.totalRevenueCents)}`}
          tone="success"
          detail="Cumulative paid revenue"
        />
        <LivePulseMetric
          label="Active Guests"
          value={analytics.activeGuests.toString()}
          tone="accent"
          detail="Live session count"
        />
        <LivePulseMetric
          alert={bottleneckHasAlert}
          label="Max Bottleneck"
          value={maxBottleneckName}
          tone={bottleneckHasAlert ? 'danger' : 'neutral'}
          detail={
            maxBottleneckQueue
              ? `${maxBottleneckQueue.queueLength} open item${
                  maxBottleneckQueue.queueLength === 1 ? '' : 's'
                } (${maxBottleneckQueue.averageWaitMinutes}m wait)`
              : 'No queue pressure'
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event-Wide Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart
            eventStartAt={eventStartAt}
            totalRevenueCents={analytics.totalRevenueCents}
            points={analytics.eventRevenue}
            standNameById={standNameById}
            standRevenue={analytics.standRevenue}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Queue & Stand Performance</CardTitle>
            <p className="mt-2 text-sm text-text-muted">
              Queue depth and average wait time by booth.
            </p>
          </div>
          <ChartPill
            label={analytics.standQueues.some((queue) => queue.queueLength > 0) ? 'Live' : 'Empty'}
          />
        </CardHeader>
        <CardContent>
          <QueueStandPerformance
            standNameById={standNameById}
            standQueues={analytics.standQueues}
            stands={stands}
          />
        </CardContent>
      </Card>

      <ProductRatingsSection />
    </div>
  );
}

function ProductRatingsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Ratings</CardTitle>
      </CardHeader>
    </Card>
  );
}

function LivePulseMetric({
  alert = false,
  detail,
  label,
  tone,
  value,
}: {
  alert?: boolean;
  detail: string;
  label: string;
  tone: 'accent' | 'danger' | 'neutral' | 'success';
  value: string;
}) {
  const toneClasses = {
    accent: {
      card: 'border-accent/20 bg-accent/5',
      detail: 'text-accent',
      rail: 'bg-accent',
    },
    danger: {
      card: 'border-danger/30 bg-danger/5',
      detail: 'text-danger',
      rail: 'bg-danger',
    },
    neutral: {
      card: 'border-border bg-background',
      detail: 'text-text-muted',
      rail: 'bg-border',
    },
    success: {
      card: 'border-success/25 bg-success/5',
      detail: 'text-success',
      rail: 'bg-success',
    },
  }[tone];

  return (
    <div
      className={[
        'relative overflow-hidden rounded-lg border px-5 py-4 shadow-sm transition',
        toneClasses.card,
        alert ? 'shadow-[0_14px_30px_color-mix(in_srgb,var(--color-danger)_10%,transparent)]' : '',
      ].join(' ')}
    >
      <span className={['absolute inset-x-0 top-0 h-1', toneClasses.rail].join(' ')} />
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 truncate text-2xl font-bold tabular-nums text-text md:text-3xl">{value}</p>
      <p
        className={['mt-2 truncate text-sm font-semibold tabular-nums', toneClasses.detail].join(
          ' ',
        )}
      >
        {detail}
      </p>
    </div>
  );
}

function RevenueChart({
  eventStartAt,
  points,
  standNameById,
  standRevenue,
  totalRevenueCents,
}: {
  eventStartAt: string;
  points: RevenuePoint[];
  standNameById: Map<string, string>;
  standRevenue: StandRevenueSeries[];
  totalRevenueCents: number;
}) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState(REVENUE_CHART_MIN_WIDTH);
  const [chartViewportWidth, setChartViewportWidth] = useState(REVENUE_CHART_MIN_WIDTH);
  const [granularityMinutes, setGranularityMinutes] = useState<RevenueGranularityMinutes>(
    REVENUE_GRANULARITY_OPTIONS[0]!.minutes,
  );
  const [tooltipLayout, setTooltipLayout] = useState<CSSProperties | null>(null);
  const model = createRevenueChartModel(
    points,
    totalRevenueCents,
    standRevenue,
    standNameById,
    eventStartAt,
    granularityMinutes,
    chartWidth,
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hasPoints = points.length > 0;
  const activeIndex = hoveredIndex;
  const activeCoordinates = activeIndex === null ? null : model.coordinates[activeIndex];
  const activePoint = activeIndex === null ? null : model.points[activeIndex];
  const linePath = createSmoothRevenuePath(model.lineCoordinates);
  const areaPath = createAreaPath(linePath, model.lineCoordinates, model.baselineY);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const updateChartWidth = () => {
      const nextViewportWidth = Math.round(container.clientWidth);
      setChartViewportWidth(nextViewportWidth);
      setChartWidth(Math.max(REVENUE_CHART_MIN_WIDTH, nextViewportWidth));
    };

    updateChartWidth();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const nextViewportWidth = Math.round(entry.contentRect.width);
      setChartViewportWidth(nextViewportWidth);
      setChartWidth(Math.max(REVENUE_CHART_MIN_WIDTH, nextViewportWidth));
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!hasPoints) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * model.chartWidth;
    const nearestIndex = findNearestRevenuePointIndex(model.coordinates, pointerX);
    const coordinates = model.coordinates[nearestIndex];
    setHoveredIndex(nearestIndex);
    setTooltipLayout(
      coordinates
        ? getRevenueTooltipLayout(
            coordinates,
            chartContainerRef.current,
            chartSvgRef.current,
            model.chartWidth,
            chartViewportWidth,
          )
        : null,
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="px-4 pt-4">
        <RevenueGranularityControl
          selectedMinutes={granularityMinutes}
          onSelect={(minutes) => {
            setGranularityMinutes(minutes);
            setHoveredIndex(null);
            setTooltipLayout(null);
          }}
        />
      </div>

      <div className="relative bg-background pt-3" ref={chartContainerRef}>
        <svg
          aria-label={`Event revenue by ${formatGranularityLabel(granularityMinutes)} interval`}
          className="block h-[22rem] w-full touch-none"
          ref={chartSvgRef}
          role="img"
          viewBox={`0 0 ${model.chartWidth} ${REVENUE_CHART_HEIGHT}`}
          onPointerLeave={() => {
            setHoveredIndex(null);
            setTooltipLayout(null);
          }}
          onPointerMove={handlePointerMove}
        >
          <RevenueChartDefinitions />
          <RevenueChartSurface model={model} />
          {hasPoints ? (
            <>
              <path d={areaPath} fill="url(#eventRevenueArea)" />
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-accent)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="5"
                style={{
                  filter:
                    'drop-shadow(0 10px 18px color-mix(in srgb, var(--color-accent) 22%, transparent))',
                }}
              />
              <path
                d={linePath}
                fill="none"
                opacity="0.22"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              {model.coordinates.map((point, index) => (
                <circle
                  className="transition-all duration-150 ease-out"
                  cx={point.x}
                  cy={point.y}
                  fill={index === activeIndex ? 'var(--color-accent)' : 'var(--color-surface)'}
                  key={`${model.points[index]!.intervalStartMinutes}-${model.points[index]!.intervalEndMinutes}`}
                  r={index === activeIndex ? '6' : '4'}
                  stroke="var(--color-accent)"
                  strokeWidth={index === activeIndex ? '2.5' : '2'}
                />
              ))}
              {activeCoordinates && (
                <g>
                  <line
                    stroke="var(--color-border)"
                    strokeDasharray="4 6"
                    strokeOpacity="0.86"
                    x1={activeCoordinates.x}
                    x2={activeCoordinates.x}
                    y1={model.plot.top}
                    y2={model.baselineY}
                  />
                  <circle
                    cx={activeCoordinates.x}
                    cy={activeCoordinates.y}
                    fill="var(--color-accent)"
                    fillOpacity="0.12"
                    r="13"
                  />
                  <circle
                    cx={activeCoordinates.x}
                    cy={activeCoordinates.y}
                    fill="var(--color-surface)"
                    r="7"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                  />
                </g>
              )}
            </>
          ) : (
            <RevenueEmptyState model={model} />
          )}
          <RevenueXAxis model={model} />
        </svg>
        {tooltipLayout && activePoint && (
          <RevenueTooltip point={activePoint} style={tooltipLayout} />
        )}
      </div>

      <div className="border-t border-border bg-surface/70 p-4">
        {hasPoints ? (
          <RevenueStandMix breakdown={model.totalBreakdown} />
        ) : (
          <p className="text-sm text-text-muted">
            Stand contribution will appear as soon as paid orders arrive.
          </p>
        )}
      </div>
    </div>
  );
}

function RevenueGranularityControl({
  onSelect,
  selectedMinutes,
}: {
  onSelect: (minutes: RevenueGranularityMinutes) => void;
  selectedMinutes: RevenueGranularityMinutes;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-semibold text-text">Time granularity</span>
      <div
        aria-label="Revenue chart time granularity"
        className="inline-grid grid-cols-3 rounded-lg border border-border bg-surface-muted p-1"
        role="group"
      >
        {REVENUE_GRANULARITY_OPTIONS.map((option) => (
          <button
            aria-pressed={selectedMinutes === option.minutes}
            className={`min-w-16 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              selectedMinutes === option.minutes
                ? 'bg-background text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
            key={option.minutes}
            type="button"
            onClick={() => onSelect(option.minutes)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RevenueTooltip({ point, style }: { point: RevenueIntervalPoint; style: CSSProperties }) {
  const averageOrderValueCents =
    point.orderCount > 0 ? Math.round(point.revenueCents / point.orderCount) : 0;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-10 w-56 max-w-[calc(100%-1.5rem)] rounded-md border border-border bg-background p-3 text-sm shadow-lg transition-transform"
      style={style}
    >
      <p className="text-xs font-medium tabular-nums text-text-muted">
        {formatIntervalLabel(point.intervalStartAt, point.intervalEndAt)}
      </p>
      <div className="mt-2 space-y-1.5">
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">Revenue</span>
          <span className="font-semibold tabular-nums text-text">
            EUR {formatMoney(point.revenueCents)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">Orders</span>
          <span className="font-semibold tabular-nums text-text">{point.orderCount}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">AOV</span>
          <span className="font-semibold tabular-nums text-text">
            EUR {formatMoney(averageOrderValueCents)}
          </span>
        </div>
      </div>
    </div>
  );
}

function RevenueStandMix({ breakdown }: { breakdown: StandRevenueBreakdown[] }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text">Booth mix across full event</p>
        <p className="text-xs font-medium text-text-muted">Share of total paid revenue</p>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted">
        {breakdown.map((entry) => (
          <div
            className="h-full"
            key={entry.standId}
            style={{
              backgroundColor: entry.color,
              width: `${Math.min(100, entry.share)}%`,
            }}
          />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {breakdown.map((entry) => (
          <div
            className="rounded-md border border-border bg-background px-3 py-2"
            key={entry.standId}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-text">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="truncate">{entry.standName}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-text-muted">
                {Math.round(entry.share)}%
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-text">
              EUR {formatMoney(entry.revenueCents)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueChartDefinitions() {
  return (
    <defs>
      <linearGradient id="eventRevenueArea" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.03" />
      </linearGradient>
    </defs>
  );
}

function RevenueChartSurface({ model }: { model: RevenueChartModel }) {
  return (
    <>
      {model.yTicks.map((tick) => {
        const y = model.yForRevenue(tick);

        return (
          <g key={tick}>
            <text
              fill="var(--color-text-muted)"
              fontSize="8"
              fontWeight="600"
              textAnchor="end"
              x={model.plot.left - 10}
              y={y + 3}
            >
              {formatAxisMoney(tick)}
            </text>
            <line
              stroke="var(--color-border)"
              strokeDasharray={tick === 0 ? '0' : '4 7'}
              strokeOpacity={tick === 0 ? '0.9' : '0.62'}
              strokeWidth={tick === 0 ? '1.5' : '1'}
              x1={model.plot.left}
              x2={model.plot.left + model.plot.width}
              y1={y}
              y2={y}
            />
          </g>
        );
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((position) => {
        const x = model.plot.left + position * model.plot.width;

        return (
          <line
            key={position}
            stroke="var(--color-border)"
            strokeOpacity="0.28"
            x1={x}
            x2={x}
            y1={model.plot.top}
            y2={model.baselineY}
          />
        );
      })}
    </>
  );
}

function RevenueXAxis({ model }: { model: RevenueChartModel }) {
  return (
    <>
      <text
        fill="var(--color-text-muted)"
        fontSize="8"
        fontWeight="600"
        x={model.plot.left}
        y={model.baselineY + 38}
      >
        {formatChartTime(model.eventStartAt)}
      </text>
      <text
        fill="var(--color-text-muted)"
        fontSize="8"
        fontWeight="600"
        textAnchor="middle"
        x={model.plot.left + model.plot.width / 2}
        y={model.baselineY + 38}
      >
        {formatChartTime(addMinutes(model.eventStartAt, model.maxMinutes / 2))}
      </text>
      <text
        fill="var(--color-text-muted)"
        fontSize="8"
        fontWeight="600"
        textAnchor="end"
        x={model.plot.left + model.plot.width}
        y={model.baselineY + 38}
      >
        {formatChartTime(addMinutes(model.eventStartAt, model.maxMinutes))}
      </text>
    </>
  );
}

function RevenueEmptyState({ model }: { model: RevenueChartModel }) {
  return (
    <g>
      <path
        d={`M ${model.plot.left} ${model.baselineY} C ${
          model.plot.left + model.plot.width * 0.25
        } ${model.baselineY - 6}, ${model.plot.left + model.plot.width * 0.55} ${
          model.baselineY - 6
        }, ${model.plot.left + model.plot.width} ${model.baselineY}`}
        fill="none"
        stroke="var(--color-accent)"
        strokeDasharray="5 7"
        strokeLinecap="round"
        strokeOpacity="0.38"
        strokeWidth="2.5"
      />
      <circle
        cx={model.plot.left + model.plot.width / 2}
        cy={model.baselineY - 5}
        fill="var(--color-surface)"
        r="5"
        stroke="var(--color-accent)"
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      <text
        fill="var(--color-text)"
        fontSize="16"
        fontWeight="800"
        textAnchor="middle"
        x={model.chartWidth / 2}
        y="132"
      >
        Awaiting first paid order
      </text>
      <text
        fill="var(--color-text-muted)"
        fontSize="12"
        fontWeight="500"
        textAnchor="middle"
        x={model.chartWidth / 2}
        y="154"
      >
        Revenue will draw in from left to right
      </text>
    </g>
  );
}

const REVENUE_CHART_MIN_WIDTH = 720;
const REVENUE_CHART_HEIGHT = 360;
const REVENUE_TOOLTIP_HEIGHT = 118;
const REVENUE_TOOLTIP_MARGIN = 12;
const REVENUE_TOOLTIP_OFFSET = 12;
const REVENUE_TOOLTIP_WIDTH = 224;
const REVENUE_GRANULARITY_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
] as const;
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

type RevenueGranularityMinutes = (typeof REVENUE_GRANULARITY_OPTIONS)[number]['minutes'];

type StandRevenueBreakdown = {
  color: string;
  revenueCents: number;
  share: number;
  standId: string;
  standName: string;
};

type RevenueIntervalPoint = {
  elapsedMinutes: number;
  intervalEndAt: Date;
  intervalEndMinutes: number;
  intervalStartAt: Date;
  intervalStartMinutes: number;
  orderCount: number;
  revenueCents: number;
};

type RevenueChartModel = {
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

function createRevenueChartModel(
  points: RevenuePoint[],
  totalRevenueCents: number,
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
  const standRevenueById = new Map(standRevenue.map((series) => [series.standId, series]));
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
      (standRevenueById.get(right.standId)?.points.at(-1)?.revenueCents ?? 0) -
      (standRevenueById.get(left.standId)?.points.at(-1)?.revenueCents ?? 0),
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
  const totalBreakdown = rankedStandEntries
    .map((stand, index) => {
      const revenueCents = standRevenueById.get(stand.standId)?.points.at(-1)?.revenueCents ?? 0;

      return {
        color: REVENUE_STAND_COLORS[index % REVENUE_STAND_COLORS.length]!,
        revenueCents,
        share: totalRevenueCents > 0 ? (revenueCents / totalRevenueCents) * 100 : 0,
        standId: stand.standId,
        standName: stand.standName,
      };
    })
    .sort((left, right) => right.revenueCents - left.revenueCents);

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

function formatAxisMoney(valueCents: number): string {
  return `EUR ${formatMoney(valueCents)}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatChartTime(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatIntervalLabel(startAt: Date, endAt: Date): string {
  return `${formatChartTime(startAt)} - ${formatChartTime(endAt)}`;
}

function formatGranularityLabel(minutes: RevenueGranularityMinutes): string {
  return minutes === 60 ? '1 h' : `${minutes} min`;
}

function createAreaPath(
  path: string,
  points: { x: number; y: number }[],
  baselineY: number,
): string {
  if (!path || points.length === 0) return '';

  return `${path} L ${points.at(-1)!.x.toFixed(1)} ${baselineY} L ${points[0]!.x.toFixed(
    1,
  )} ${baselineY} Z`;
}

function findNearestRevenuePointIndex(points: { x: number; y: number }[], pointerX: number) {
  return points.reduce((nearestIndex, point, index) => {
    const nearest = points[nearestIndex]!;

    return Math.abs(point.x - pointerX) < Math.abs(nearest.x - pointerX) ? index : nearestIndex;
  }, 0);
}

function getRevenueTooltipLayout(
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

function createSmoothRevenuePath(points: { x: number; y: number }[]) {
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

type QueueStandPerformanceEntry = StandQueueMetric & {
  standName: string;
};

function QueueStandPerformance({
  standNameById,
  standQueues,
  stands,
}: {
  standNameById: Map<string, string>;
  standQueues: StandQueueMetric[];
  stands: StandDisplay[];
}) {
  const queueByStandId = new Map(standQueues.map((queue) => [queue.standId, queue]));
  const knownStandIds = new Set(stands.map((stand) => stand._id));
  const entries: QueueStandPerformanceEntry[] = [
    ...stands.map((stand) => {
      const queue = queueByStandId.get(stand._id);

      return {
        standId: stand._id,
        standName: stand.standName,
        queueLength: queue?.queueLength ?? 0,
        averageWaitMinutes: queue?.averageWaitMinutes ?? 0,
        alert: queue?.alert ?? false,
      };
    }),
    ...standQueues
      .filter((queue) => !knownStandIds.has(queue.standId))
      .map((queue) => ({
        ...queue,
        standName: standNameById.get(queue.standId) ?? 'Unknown booth',
      })),
  ];
  const visibleEntries = (
    entries.length > 0
      ? entries
      : stands.map((stand) => ({
          standId: stand._id,
          standName: stand.standName,
          queueLength: 0,
          averageWaitMinutes: 0,
          alert: false,
        }))
  ).sort((left, right) => {
    if (right.queueLength !== left.queueLength) {
      return right.queueLength - left.queueLength;
    }
    return right.averageWaitMinutes - left.averageWaitMinutes;
  });
  const maxQueueLength = Math.max(...visibleEntries.map((entry) => entry.queueLength), 1);

  if (visibleEntries.length === 0) {
    return (
      <OperationalCanvas
        title="No stands configured"
        message="Queue and wait metrics will appear as soon as booths are added."
      />
    );
  }

  return (
    <div className="space-y-3">
      {visibleEntries.map((entry) => (
        <QueueStandPerformanceRow
          entry={entry}
          key={entry.standId}
          maxQueueLength={maxQueueLength}
        />
      ))}
    </div>
  );
}

function QueueStandPerformanceRow({
  entry,
  maxQueueLength,
}: {
  entry: QueueStandPerformanceEntry;
  maxQueueLength: number;
}) {
  const queueWidth =
    entry.queueLength > 0 ? Math.max(6, (entry.queueLength / maxQueueLength) * 100) : 2;

  return (
    <div
      className={[
        'grid gap-4 rounded-lg border p-4 transition md:grid-cols-[minmax(10rem,0.8fr)_minmax(16rem,1.5fr)_auto] md:items-center',
        entry.alert ? 'border-danger/30 bg-danger/5' : 'border-border bg-background',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={[
              'h-2.5 w-2.5 shrink-0 rounded-full',
              entry.alert
                ? 'bg-danger shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-danger)_12%,transparent)]'
                : 'bg-success shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-success)_12%,transparent)]',
            ].join(' ')}
          />
          <h3 className="truncate font-semibold text-text">{entry.standName}</h3>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {entry.alert ? 'Alert threshold reached' : 'No active queue alert'}
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-text-muted">Queue depth</span>
          <span className="font-semibold text-text">
            {entry.queueLength} open item{entry.queueLength === 1 ? '' : 's'}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-muted shadow-inner">
          <div
            className={['h-full rounded-full', entry.alert ? 'bg-danger' : 'bg-accent'].join(' ')}
            style={{
              opacity: entry.queueLength > 0 ? 1 : 0.18,
              width: `${queueWidth}%`,
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="text-sm font-medium text-text-muted md:hidden">Avg. Wait Time</span>
        <span
          className={[
            'shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold',
            entry.alert
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-border bg-surface text-text',
          ].join(' ')}
        >
          Avg. Wait Time: {entry.averageWaitMinutes}m
        </span>
      </div>
    </div>
  );
}

function ChartPill({ label }: { label: 'Live' | 'Empty' }) {
  return (
    <span
      className={[
        'w-fit rounded-full border px-2.5 py-1 text-xs font-semibold',
        label === 'Live'
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border bg-surface text-text-muted',
      ].join(' ')}
    >
      {label}
    </span>
  );
}

function OperationalCanvas({ title, message }: { title: string; message: string }) {
  return (
    <div className="relative min-h-48 overflow-hidden rounded-lg border border-dashed border-border bg-surface-muted/40 p-4">
      <div className="absolute inset-0 bg-[linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30" />
      <div className="relative flex h-full min-h-40 flex-col items-center justify-center text-center">
        <p className="font-semibold text-text">{title}</p>
        <p className="mt-2 max-w-md text-sm text-text-muted">{message}</p>
      </div>
    </div>
  );
}
