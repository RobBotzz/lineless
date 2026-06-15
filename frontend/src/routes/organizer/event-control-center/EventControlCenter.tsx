import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Navigate, useLoaderData, useParams, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import {
  cancelOrder,
  cancelOrderItems,
  getEventControlCenter,
  getEventOrders,
  pauseProduct,
  pauseStand,
  resumeProduct,
  resumeStand,
  type EventControlCenterData,
  type EventControlCenterSettings,
  type LiveOrder,
  type LiveOrderItem,
  type RevenuePoint,
  type StandQueueMetric,
  type StandRevenueSeries,
} from '@/api/eventControlCenter';
import { AlertDialog } from '@/components/feedback';
import { ChevronDownIcon, LockIcon, UnlockIcon, WarningTriangleIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { paths } from '@/paths';
import type { Product } from '@/types/product';
import { formatMoney } from '@/types/product';
import type { Stand } from '@/types/stand';
import type { EventControlCenterLoaderData } from './data';

type StandDisplay = Pick<Stand, '_id' | 'standName'>;
const LIVE_ORDERS_PER_PAGE = 5;

const defaultControlCenterSettings: EventControlCenterSettings = {
  queueLengthAlertThreshold: 10,
  averageWaitAlertThresholdMinutes: 15,
};

function controlCenterSettingsKey(eventId: string): string {
  return `lineless.event-control-center.${eventId}.settings`;
}

function readControlCenterSettings(eventId: string): EventControlCenterSettings {
  if (typeof window === 'undefined') return defaultControlCenterSettings;

  try {
    const raw = window.localStorage.getItem(controlCenterSettingsKey(eventId));
    if (!raw) return defaultControlCenterSettings;
    const parsed = JSON.parse(raw) as Partial<EventControlCenterSettings>;
    return normalizeControlCenterSettings(parsed);
  } catch {
    return defaultControlCenterSettings;
  }
}

function writeControlCenterSettings(eventId: string, settings: EventControlCenterSettings) {
  window.localStorage.setItem(controlCenterSettingsKey(eventId), JSON.stringify(settings));
}

function normalizeControlCenterSettings(
  settings: Partial<EventControlCenterSettings>,
): EventControlCenterSettings {
  return {
    queueLengthAlertThreshold: normalizeThreshold(
      settings.queueLengthAlertThreshold,
      defaultControlCenterSettings.queueLengthAlertThreshold,
    ),
    averageWaitAlertThresholdMinutes: normalizeThreshold(
      settings.averageWaitAlertThresholdMinutes,
      defaultControlCenterSettings.averageWaitAlertThresholdMinutes,
    ),
  };
}

function normalizeThreshold(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.round(numeric));
}

export function EventControlCenterError() {
  const error = useRouteError();
  const message =
    error instanceof ApiError
      ? error.message
      : 'This event control center could not be loaded. Check whether the backend is running and try again.';

  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-5 text-sm text-text">
      {message}
    </div>
  );
}

export default function EventControlCenter() {
  const {
    analytics: initialAnalytics,
    event,
    liveOrders: initialLiveOrders,
    productsByStand: initialProductsByStand,
    stands: initialStands,
  } = useLoaderData() as EventControlCenterLoaderData;
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [liveOrders, setLiveOrders] = useState(initialLiveOrders);
  const [productsByStand, setProductsByStand] = useState(initialProductsByStand);
  const [stands, setStands] = useState(initialStands);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [controlCenterSettingsState, setControlCenterSettingsState] = useState<{
    eventId: string;
    settings: EventControlCenterSettings;
  }>(() => ({
    eventId: event._id,
    settings: readControlCenterSettings(event._id),
  }));
  const { section } = useParams();
  const [selectedStandId, setSelectedStandId] = useState<string>(
    () => initialStands[0]?._id ?? 'all',
  );
  const activeSection =
    section === 'management' ? 'management' : section === 'settings' ? 'settings' : 'analytics';

  const selectedStand =
    selectedStandId === 'all'
      ? null
      : (stands.find((stand) => stand._id === selectedStandId) ?? null);

  const hasInvalidSection =
    section !== undefined &&
    section !== 'analytics' &&
    section !== 'management' &&
    section !== 'settings';

  const controlCenterSettings = useMemo(
    () =>
      controlCenterSettingsState.eventId === event._id
        ? controlCenterSettingsState.settings
        : readControlCenterSettings(event._id),
    [controlCenterSettingsState, event._id],
  );

  useEffect(() => {
    let cancelled = false;

    async function refreshControlCenter() {
      const [nextAnalytics, nextLiveOrders] = await Promise.all([
        getEventControlCenter(event._id, controlCenterSettings),
        getEventOrders(event._id),
      ]);
      if (cancelled) return;
      setAnalytics(nextAnalytics);
      setLiveOrders(nextLiveOrders);
      setLastUpdatedAt(new Date());
    }

    // TODO SSE: replace polling with the shared event-control-center SSE stream.
    void refreshControlCenter().catch(() => {});
    const interval = window.setInterval(() => {
      void refreshControlCenter().catch(() => {});
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [controlCenterSettings, event._id]);

  async function refreshSnapshot() {
    const [nextAnalytics, nextLiveOrders] = await Promise.all([
      getEventControlCenter(event._id, controlCenterSettings),
      getEventOrders(event._id),
    ]);
    setAnalytics(nextAnalytics);
    setLiveOrders(nextLiveOrders);
    setLastUpdatedAt(new Date());
  }

  async function handleCancelOrder(orderId: string) {
    await cancelOrder(event._id, orderId);
    await refreshSnapshot();
  }

  async function handleCancelOrderItems(orderId: string, itemIds: string[]) {
    await cancelOrderItems(event._id, orderId, itemIds);
    await refreshSnapshot();
  }

  function handleControlCenterSettingsChange(settings: EventControlCenterSettings) {
    const normalizedSettings = normalizeControlCenterSettings(settings);
    writeControlCenterSettings(event._id, normalizedSettings);
    setControlCenterSettingsState({ eventId: event._id, settings: normalizedSettings });
  }

  async function handleProductPauseChange(standId: string, product: Product, paused: boolean) {
    if (paused) {
      await pauseProduct(product._id);
    } else {
      await resumeProduct(product._id);
    }

    setProductsByStand((current) => ({
      ...current,
      [standId]: (current[standId] ?? []).map((candidate) =>
        candidate._id === product._id
          ? { ...candidate, productStatus: paused ? 'PAUSED' : 'LIVE' }
          : candidate,
      ),
    }));
  }

  async function handleStandPauseChange(stand: Stand, paused: boolean) {
    const updatedStand = paused
      ? await pauseStand(event._id, stand._id)
      : await resumeStand(event._id, stand._id);

    setStands((current) =>
      current.map((candidate) => (candidate._id === stand._id ? updatedStand : candidate)),
    );
  }

  if (hasInvalidSection) {
    return <Navigate replace to={paths.organizer.eventControlCenterAnalytics(event._id)} />;
  }

  return (
    <div className="space-y-6">
      <BackButton to={paths.organizer.event(event._id)}>Event Configuration</BackButton>

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="text-2xl font-bold">{event.name || 'Untitled Event'}</CardTitle>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-muted">
              <span className="inline-flex items-center gap-2 font-medium text-success">
                <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-success)_14%,transparent)]" />
                Active
              </span>
              <span className="hidden text-border sm:inline">•</span>
              <span>
                Last updated:{' '}
                <span className="font-medium tabular-nums text-text">
                  {lastUpdatedAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {activeSection === 'analytics' ? (
        <MetricsTab
          analytics={analytics}
          eventStartAt={event.startedAt ?? event.createdAt}
          stands={stands}
        />
      ) : activeSection === 'settings' ? (
        <SettingsTab
          key={`${event._id}-${controlCenterSettings.queueLengthAlertThreshold}-${controlCenterSettings.averageWaitAlertThresholdMinutes}`}
          settings={controlCenterSettings}
          onChange={handleControlCenterSettingsChange}
        />
      ) : (
        <ManagementTab
          liveOrders={liveOrders}
          productsByStand={productsByStand}
          selectedStand={selectedStand}
          selectedStandId={selectedStandId}
          stands={stands}
          onCancelOrder={handleCancelOrder}
          onCancelOrderItems={handleCancelOrderItems}
          onProductPauseChange={handleProductPauseChange}
          onStandPauseChange={handleStandPauseChange}
          onSelectStand={setSelectedStandId}
        />
      )}
    </div>
  );
}

function MetricsTab({
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
  const visibleEntries =
    entries.length > 0
      ? entries
      : stands.map((stand) => ({
          standId: stand._id,
          standName: stand.standName,
          queueLength: 0,
          averageWaitMinutes: 0,
          alert: false,
        }));
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

function SettingsTab({
  onChange,
  settings,
}: {
  onChange: (settings: EventControlCenterSettings) => void;
  settings: EventControlCenterSettings;
}) {
  const [form, setForm] = useState<EventControlCenterSettings>(settings);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const hasChanges =
    form.queueLengthAlertThreshold !== settings.queueLengthAlertThreshold ||
    form.averageWaitAlertThresholdMinutes !== settings.averageWaitAlertThresholdMinutes;

  function updateField<K extends keyof EventControlCenterSettings>(
    key: K,
    value: EventControlCenterSettings[K],
  ) {
    setSavedMessage(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function saveSettings() {
    const normalizedSettings = normalizeControlCenterSettings(form);
    setForm(normalizedSettings);
    onChange(normalizedSettings);
    setSavedMessage('Settings saved. Analytics will refresh with these thresholds.');
  }

  function resetSettings() {
    setForm(defaultControlCenterSettings);
    onChange(defaultControlCenterSettings);
    setSavedMessage('Settings reset to defaults.');
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Alert Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              helperText="A stand is flagged when its open queue reaches this number."
              id="queue-length-alert-threshold"
              label="Queue length"
              min={0}
              onChange={(event) =>
                updateField('queueLengthAlertThreshold', Number(event.target.value))
              }
              step={1}
              type="number"
              value={form.queueLengthAlertThreshold}
            />

            <TextField
              helperText="A stand is flagged when its average open-item wait reaches this duration."
              id="average-wait-alert-threshold"
              label="Average wait in minutes"
              min={0}
              onChange={(event) =>
                updateField('averageWaitAlertThresholdMinutes', Number(event.target.value))
              }
              step={1}
              type="number"
              value={form.averageWaitAlertThresholdMinutes}
            />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={resetSettings} size="sm" variant="secondary">
              Reset defaults
            </Button>
            <Button disabled={!hasChanges} onClick={saveSettings} size="sm">
              Save settings
            </Button>
          </div>

          {savedMessage ? (
            <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success">
              {savedMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ManagementTab({
  liveOrders,
  onCancelOrder,
  onCancelOrderItems,
  onProductPauseChange,
  onStandPauseChange,
  onSelectStand,
  selectedStandId,
  selectedStand,
  productsByStand,
  stands,
}: {
  liveOrders: LiveOrder[];
  onCancelOrder: (orderId: string) => Promise<void>;
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
  onProductPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  onStandPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  onSelectStand: (standId: string) => void;
  stands: Stand[];
  productsByStand: Record<string, Product[]>;
  selectedStandId: string;
  selectedStand: Stand | null;
}) {
  const visibleStands = useMemo(
    () =>
      selectedStandId === 'all' ? stands : stands.filter((stand) => stand._id === selectedStandId),
    [selectedStandId, stands],
  );
  const visibleOrders = useMemo(
    () =>
      selectedStandId === 'all'
        ? liveOrders
        : liveOrders.filter((order) => order.standIds.includes(selectedStandId)),
    [liveOrders, selectedStandId],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Stand Filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft lg:hidden"
              onChange={(event) => onSelectStand(event.target.value)}
              value={selectedStandId}
            >
              <option value="all">All stands</option>
              {stands.map((stand) => (
                <option key={stand._id} value={stand._id}>
                  {stand.standName}
                </option>
              ))}
            </select>

            <div className="hidden space-y-2 lg:block">
              <StandFilterButton
                active={selectedStandId === 'all'}
                label="All stands"
                onClick={() => onSelectStand('all')}
              />
              {stands.map((stand) => (
                <StandFilterButton
                  active={selectedStandId === stand._id}
                  key={stand._id}
                  label={stand.standName}
                  onClick={() => onSelectStand(stand._id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Orders {selectedStand ? `- ${selectedStand.standName}` : ''}</CardTitle>
          </CardHeader>
          <CardContent>
            <LiveOrdersTable
              orders={visibleOrders}
              stands={stands}
              onCancelOrder={onCancelOrder}
              onCancelOrderItems={onCancelOrderItems}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Pausing</CardTitle>
          </CardHeader>
          <CardContent>
            {visibleStands.length > 0 ? (
              <div className="space-y-4">
                {visibleStands.map((stand) => (
                  <StandPausePanel
                    key={stand._id}
                    onProductPauseChange={onProductPauseChange}
                    onStandPauseChange={onStandPauseChange}
                    products={productsByStand[stand._id] ?? []}
                    stand={stand}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No stands configured"
                message="Create stands before station or product pausing can be managed."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StandFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        'w-full truncate rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-[var(--color-button-text)]'
          : 'text-text-muted hover:bg-surface-muted hover:text-text',
      ].join(' ')}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function LiveOrdersTable({
  orders,
  stands,
  onCancelOrder,
  onCancelOrderItems,
}: {
  orders: LiveOrder[];
  stands: Stand[];
  onCancelOrder: (orderId: string) => Promise<void>;
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
}) {
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(() => new Set());
  const [selectedItemIdsByOrder, setSelectedItemIdsByOrder] = useState<Record<string, string[]>>(
    {},
  );
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancellingItemOrderId, setCancellingItemOrderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingCancellation, setPendingCancellation] = useState<
    | { type: 'order'; order: LiveOrder }
    | { type: 'items'; order: LiveOrder; itemIds: string[] }
    | null
  >(null);
  const standNameById = useMemo(
    () => new Map(stands.map((stand) => [stand._id, stand.standName])),
    [stands],
  );
  const totalPages = Math.max(1, Math.ceil(orders.length / LIVE_ORDERS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageOrders = orders.slice(
    (safeCurrentPage - 1) * LIVE_ORDERS_PER_PAGE,
    safeCurrentPage * LIVE_ORDERS_PER_PAGE,
  );

  function toggleExpanded(orderId: string) {
    const willCollapse = expandedOrderIds.has(orderId);
    setExpandedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });

    if (willCollapse) {
      setSelectedItemIdsByOrder((selected) => {
        const next = { ...selected };
        delete next[orderId];
        return next;
      });
    }
  }

  function toggleItemSelection(orderId: string, itemId: string) {
    setSelectedItemIdsByOrder((current) => {
      const selected = current[orderId] ?? [];
      const nextSelected = selected.includes(itemId)
        ? selected.filter((selectedItemId) => selectedItemId !== itemId)
        : [...selected, itemId];

      return {
        ...current,
        [orderId]: nextSelected,
      };
    });
  }

  function toggleAllItems(order: LiveOrder, checked: boolean) {
    setSelectedItemIdsByOrder((current) => ({
      ...current,
      [order._id]: checked ? order.items.map((item) => item.itemId) : [],
    }));
  }

  async function confirmCancellation() {
    const cancellation = pendingCancellation;
    if (!cancellation) return;

    setPendingCancellation(null);
    if (cancellation.type === 'order') {
      setCancellingOrderId(cancellation.order._id);
      try {
        await onCancelOrder(cancellation.order._id);
      } finally {
        setCancellingOrderId(null);
      }
      return;
    }

    setCancellingItemOrderId(cancellation.order._id);
    try {
      await onCancelOrderItems(cancellation.order._id, cancellation.itemIds);
      setSelectedItemIdsByOrder((current) => ({
        ...current,
        [cancellation.order._id]: [],
      }));
    } finally {
      setCancellingItemOrderId(null);
    }
  }

  if (orders.length === 0) {
    return (
      <EmptyState title="No live orders" message="Paid orders with open items will appear here." />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[8rem_minmax(0,1fr)_8rem_8rem_2rem] gap-4 bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted md:grid">
          <span>Order</span>
          <span>Stands</span>
          <span>Status</span>
          <span>Total</span>
          <span className="sr-only">Details</span>
        </div>
        {pageOrders.map((order) => (
          <LiveOrderRow
            cancellingItemOrderId={cancellingItemOrderId}
            cancellingOrderId={cancellingOrderId}
            expanded={expandedOrderIds.has(order._id)}
            key={order._id}
            onCancelItems={(itemIds) => setPendingCancellation({ type: 'items', order, itemIds })}
            onCancelOrder={() => setPendingCancellation({ type: 'order', order })}
            onToggleAllItems={(checked) => toggleAllItems(order, checked)}
            onToggleExpanded={() => toggleExpanded(order._id)}
            onToggleItem={(itemId) => toggleItemSelection(order._id, itemId)}
            order={order}
            selectedItemIds={selectedItemIdsByOrder[order._id] ?? []}
            standNameById={standNameById}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => {
            const isActive = page === safeCurrentPage;

            return (
              <button
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'h-8 min-w-8 rounded-md border px-3 text-sm font-semibold transition-colors',
                  isActive
                    ? 'border-accent bg-accent text-[var(--color-button-text)]'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-muted hover:text-text',
                ].join(' ')}
                key={page}
                onClick={() => setCurrentPage(page)}
                type="button"
              >
                {page}
              </button>
            );
          })}
        </div>
      )}

      <AlertDialog
        acknowledgeLabel="Cancel order"
        cancelLabel="Keep order"
        message={
          pendingCancellation?.type === 'order'
            ? `All open items in order #${pendingCancellation.order.orderNumber} will be cancelled.`
            : null
        }
        onAcknowledge={() => void confirmCancellation()}
        onCancel={() => setPendingCancellation(null)}
        title="Cancel order?"
      />

      <AlertDialog
        acknowledgeLabel="Cancel items"
        cancelLabel="Keep items"
        message={
          pendingCancellation?.type === 'items'
            ? `${pendingCancellation.itemIds.length} selected item${
                pendingCancellation.itemIds.length === 1 ? '' : 's'
              } in order #${pendingCancellation.order.orderNumber} will be cancelled.`
            : null
        }
        onAcknowledge={() => void confirmCancellation()}
        onCancel={() => setPendingCancellation(null)}
        title="Cancel selected items?"
      />
    </>
  );
}

function LiveOrderRow({
  cancellingItemOrderId,
  cancellingOrderId,
  expanded,
  onCancelItems,
  onCancelOrder,
  onToggleAllItems,
  onToggleExpanded,
  onToggleItem,
  order,
  selectedItemIds,
  standNameById,
}: {
  cancellingItemOrderId: string | null;
  cancellingOrderId: string | null;
  expanded: boolean;
  onCancelItems: (itemIds: string[]) => void;
  onCancelOrder: () => void;
  onToggleAllItems: (checked: boolean) => void;
  onToggleExpanded: () => void;
  onToggleItem: (itemId: string) => void;
  order: LiveOrder;
  selectedItemIds: string[];
  standNameById: Map<string, string>;
}) {
  const allItemsSelected = order.items.length > 0 && selectedItemIds.length === order.items.length;
  const someItemsSelected = selectedItemIds.length > 0;
  const standNames = order.standIds.map((standId) => standNameById.get(standId) ?? 'Unknown stand');
  const standSummary = standNames.join(', ');

  return (
    <div className="border-t border-border first:border-t-0">
      <button
        aria-expanded={expanded}
        className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted/50 md:grid-cols-[8rem_minmax(0,1fr)_8rem_8rem_2rem] md:items-center md:gap-4"
        onClick={onToggleExpanded}
        type="button"
      >
        <span>
          <span className="block font-semibold text-text">#{order.orderNumber}</span>
          <span className="block text-xs text-text-muted">{order.pickupCode}</span>
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm text-text">{standSummary}</span>
          <span className="mt-1 block text-xs text-text-muted">
            {order.items.length} item{order.items.length === 1 ? '' : 's'} across{' '}
            {standNames.length} stand{standNames.length === 1 ? '' : 's'} ·{' '}
            {new Date(order.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </span>
        <OrderStatusBadge status={order.status} />
        <span className="text-sm font-medium text-text">
          EUR {formatMoney(order.totalPriceIncludingTax)}
        </span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted md:justify-self-end">
          <ChevronDownIcon
            className={['transition-transform', expanded ? 'rotate-180' : ''].join(' ')}
          />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border bg-surface-muted/40 px-4 py-4">
          <div className="divide-y divide-border rounded-md border border-border bg-surface">
            <div className="flex flex-col gap-3 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text">
                <input
                  checked={allItemsSelected}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  onChange={(event) => onToggleAllItems(event.target.checked)}
                  type="checkbox"
                />
                Select all visible items
              </label>
              <Button
                className="w-full whitespace-nowrap border-danger/30 text-danger hover:bg-danger/10 hover:text-danger sm:w-auto"
                disabled={
                  someItemsSelected
                    ? cancellingItemOrderId === order._id
                    : cancellingOrderId === order._id
                }
                onClick={() => {
                  if (someItemsSelected) onCancelItems(selectedItemIds);
                  else onCancelOrder();
                }}
                size="sm"
                variant="outline"
              >
                {someItemsSelected
                  ? `Cancel selected items (${selectedItemIds.length})`
                  : 'Cancel order'}
              </Button>
            </div>
            {order.items.map((item) => (
              <LiveOrderItemRow
                checked={selectedItemIds.includes(item.itemId)}
                item={item}
                key={item.itemId}
                onToggle={() => onToggleItem(item.itemId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveOrderItemRow({
  checked,
  item,
  onToggle,
}: {
  checked: boolean;
  item: LiveOrderItem;
  onToggle: () => void;
}) {
  return (
    <label className="grid cursor-pointer gap-3 px-3 py-3 hover:bg-surface-muted sm:grid-cols-[1.5rem_minmax(0,1fr)_7rem_6rem] sm:items-center">
      <input
        checked={checked}
        className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
        onChange={onToggle}
        type="checkbox"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text">{item.productName}</p>
        {item.customerComment && (
          <p className="mt-1 truncate text-xs text-text-muted">{item.customerComment}</p>
        )}
      </div>
      <OrderStatusBadge status={item.status} />
      <p className="text-sm font-medium text-text sm:text-right">
        EUR {formatMoney(item.unitPriceIncludingTax)}
      </p>
    </label>
  );
}

function OrderStatusBadge({ status }: { status: LiveOrder['status'] }) {
  const label = status === 'READY' ? 'Ready' : status === 'PREPARING' ? 'Preparing' : 'In line';
  const className =
    status === 'READY'
      ? 'border-success/30 bg-success/10 text-success'
      : status === 'PREPARING'
        ? 'border-accent/30 bg-accent-soft text-accent'
        : 'border-border bg-surface text-text-muted';

  return (
    <span
      className={[
        'inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold',
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

function StandPausePanel({
  onProductPauseChange,
  onStandPauseChange,
  products,
  stand,
}: {
  onProductPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  onStandPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  products: Product[];
  stand: Stand;
}) {
  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-text">{stand.standName}</h3>
          <p className="mt-1 text-xs text-text-muted">
            Stand pause blocks new orders while existing orders stay visible.
          </p>
        </div>
        <StandAvailabilityControl onPauseChange={onStandPauseChange} stand={stand} />
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {products.length > 0 ? (
          products.map((product) => (
            <ProductPauseTile
              key={product._id}
              product={product}
              standId={stand._id}
              onPauseChange={onProductPauseChange}
            />
          ))
        ) : (
          <p className="text-sm text-text-muted">No products configured for this stand.</p>
        )}
      </div>
    </section>
  );
}

function StandAvailabilityControl({
  onPauseChange,
  stand,
}: {
  onPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  stand: Stand;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const isLive = stand.standStatus === 'LIVE';

  async function handleToggle() {
    setIsSaving(true);
    try {
      await onPauseChange(stand, isLive);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <button
        aria-label={`${stand.standName} is ${isLive ? 'open and accepting new orders' : 'paused for new orders'}.`}
        className={[
          'relative h-11 w-full rounded-full border border-border bg-surface p-1 text-sm shadow-sm transition-colors sm:w-64',
          isSaving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
        ].join(' ')}
        disabled={isSaving}
        onClick={() => void handleToggle()}
        type="button"
      >
        <span className="grid h-full grid-cols-2 items-center rounded-full bg-surface-muted">
          <span
            className={[
              'flex items-center justify-center gap-1.5 font-semibold',
              isLive ? 'text-accent' : 'text-text-muted',
            ].join(' ')}
          >
            <UnlockIcon className="h-4 w-4" />
            Open
          </span>
          <span
            className={[
              'flex items-center justify-center gap-1.5 font-semibold',
              isLive ? 'text-text-muted' : 'text-danger',
            ].join(' ')}
          >
            <LockIcon className="h-4 w-4" />
            Paused
          </span>
        </span>
        <span
          className={[
            'absolute inset-y-1 flex w-[calc(50%-0.25rem)] items-center justify-center gap-1.5 rounded-full px-3 font-semibold text-[var(--color-button-text)] shadow-sm transition-[left,right,background-color]',
            isLive ? 'left-1 bg-accent' : 'right-1 bg-danger',
          ].join(' ')}
        >
          {isLive ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
          {isLive ? 'Open' : 'Paused'}
        </span>
      </button>
      <span className="text-xs text-text-muted">
        {isLive ? 'Stand is accepting new orders.' : 'Stand is paused for new orders.'}
      </span>
    </div>
  );
}

function ProductPauseTile({
  onPauseChange,
  product,
  standId,
}: {
  onPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  product: Product;
  standId: string;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const isLive = product.productStatus === 'LIVE';
  const isPaused = product.productStatus === 'PAUSED';
  const isTerminated = product.productStatus === 'TERMINATED';
  const availabilityText = isTerminated
    ? 'terminated product'
    : isPaused
      ? 'hidden from new orders'
      : 'available for new orders';

  async function handleAvailabilityChange(checked: boolean) {
    if (isTerminated) return;
    setIsSaving(true);
    try {
      await onPauseChange(standId, product, !checked);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className={[
        'flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-3',
        isTerminated ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text">{product.productName}</p>
        <p className="mt-1 text-xs text-text-muted">
          EUR {formatMoney(product.priceIncludingTax)} · {availabilityText}
        </p>
      </div>
      <Toggle
        checked={isLive}
        disabled={isSaving || isTerminated}
        label={`${product.productName} available for orders`}
        onChange={(checked) => void handleAvailabilityChange(checked)}
      />
    </div>
  );
}

function EmptyState({
  title,
  message,
  icon = false,
}: {
  title: string;
  message: string;
  icon?: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center">
      {icon && <WarningTriangleIcon className="mx-auto mb-3 h-7 w-7 text-text-muted" />}
      <p className="font-semibold text-text">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">{message}</p>
    </div>
  );
}
