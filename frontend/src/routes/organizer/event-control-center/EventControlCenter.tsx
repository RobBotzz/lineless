import { useEffect, useMemo, useState, type PointerEvent } from 'react';
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
      await pauseProduct(event._id, standId, product._id);
    } else {
      await resumeProduct(event._id, standId, product._id);
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
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-2xl font-bold">
                  {event.name || 'Untitled Event'}
                </CardTitle>
              </div>
              <p className="mt-2 text-sm text-text-muted">
                Event Control Center for live metrics and operational controls.
              </p>
            </div>
            <ControlCenterSnapshot
              analytics={analytics}
              lastUpdatedAt={lastUpdatedAt}
              stands={stands}
            />
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

function ControlCenterSnapshot({
  analytics,
  lastUpdatedAt,
  stands,
}: {
  analytics: EventControlCenterData;
  lastUpdatedAt: Date;
  stands: Stand[];
}) {
  const alertCount = analytics.standQueues.filter((queue) => queue.alert).length;

  return (
    <div className="grid min-w-[28rem] grid-cols-4 gap-2 rounded-lg border border-border bg-background p-2 text-xs">
      <SnapshotItem
        label="Updated"
        value={lastUpdatedAt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      />
      <SnapshotItem label="Guests" value={analytics.activeGuests.toString()} />
      <SnapshotItem label="Stands" value={stands.length.toString()} />
      <SnapshotItem label="Alerts" value={alertCount.toString()} alert={alertCount > 0} />
    </div>
  );
}

function SnapshotItem({
  alert = false,
  label,
  value,
}: {
  alert?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-surface px-3 py-2">
      <p className="font-medium text-text-muted">{label}</p>
      <p className={['mt-1 text-sm font-semibold', alert ? 'text-danger' : 'text-text'].join(' ')}>
        {value}
      </p>
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
  const queueByStandId = useMemo(
    () => new Map(analytics.standQueues.map((queue) => [queue.standId, queue])),
    [analytics.standQueues],
  );
  const maxBottleneckName = analytics.maxBottleneckStandId
    ? (standNameById.get(analytics.maxBottleneckStandId) ?? 'Unknown stand')
    : 'None';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Total Revenue"
          value={`EUR ${formatMoney(analytics.totalRevenueCents)}`}
          trend="Cumulative paid revenue"
        />
        <MetricCard
          label="Active Guests"
          value={analytics.activeGuests.toString()}
          trend="Live session count"
        />
        <MetricCard
          label="Max Queue Bottleneck"
          value={maxBottleneckName}
          compact
          trend={
            analytics.maxBottleneckStandId ? 'Needs operational attention' : 'No queue pressure'
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
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
          <CardHeader>
            <CardTitle>Stand Revenue Split</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StandRevenueBars
              series={analytics.standRevenue}
              standNameById={standNameById}
              stands={stands}
            />
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {stands.map((stand) => (
                <StandRevenueSummary
                  key={stand._id}
                  series={analytics.standRevenue.find((series) => series.standId === stand._id)}
                  stand={stand}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(22rem,0.8fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Queue Health</CardTitle>
          </CardHeader>
          <CardContent>
            <QueueHealthChart
              standNameById={standNameById}
              standQueues={analytics.standQueues}
              stands={stands}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stand Performance Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            {stands.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {stands.map((stand) => (
                  <StandPerformanceRow
                    key={stand._id}
                    queue={queueByStandId.get(stand._id)}
                    stand={stand}
                  />
                ))}
              </div>
            ) : (
              <OperationalCanvas
                title="No stands configured"
                message="The matrix is ready and will populate as soon as stands are added."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Operations Model</CardTitle>
        </CardHeader>
        <CardContent>
          <OperationsModel analytics={analytics} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Intelligent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertsSummary standNameById={standNameById} standQueues={analytics.standQueues} />
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

function MetricCard({
  label,
  value,
  compact = false,
  trend,
}: {
  label: string;
  value: string;
  compact?: boolean;
  trend: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-text-muted">{label}</p>
          <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_0_4px_var(--color-accent-soft)]" />
        </div>
        <p
          className={compact ? 'text-base font-semibold text-text' : 'text-3xl font-bold text-text'}
        >
          {value}
        </p>
        <p className="text-xs text-text-muted">{trend}</p>
      </CardContent>
    </Card>
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
  const model = createRevenueChartModel(
    points,
    totalRevenueCents,
    standRevenue,
    standNameById,
    eventStartAt,
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const latestPoint = model.points.at(-1);
  const hasPoints = model.points.length > 0;
  const activeIndex = hoveredIndex;
  const activeCoordinates = activeIndex === null ? null : model.coordinates[activeIndex];
  const stepPath = createStepRevenuePath(model.lineCoordinates);
  const areaPath = createAreaPath(stepPath, model.lineCoordinates, model.baselineY);

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!hasPoints) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * REVENUE_CHART_WIDTH;
    setHoveredIndex(findNearestRevenuePointIndex(model.coordinates, pointerX));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="p-4 pb-0">
          <p className="text-3xl font-bold text-text">EUR {formatMoney(totalRevenueCents)}</p>
          <p className="mt-2 max-w-xl text-sm text-text-muted">
            {latestPoint
              ? `Cumulative paid revenue since ${formatChartTime(model.eventStartAt)}.`
              : 'The chart is ready for the first paid order.'}
          </p>
        </div>
      </div>

      <div className="relative px-2 pt-3">
        <svg
          aria-label="Cumulative event revenue by minute"
          className="h-[22rem] w-full touch-none"
          role="img"
          viewBox={`0 0 ${REVENUE_CHART_WIDTH} ${REVENUE_CHART_HEIGHT}`}
          onPointerLeave={() => setHoveredIndex(null)}
          onPointerMove={handlePointerMove}
        >
          <RevenueChartDefinitions />
          <RevenueChartSurface model={model} />
          {hasPoints ? (
            <>
              <path d={areaPath} fill="url(#eventRevenueArea)" />
              <path
                d={stepPath}
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
                d={stepPath}
                fill="none"
                opacity="0.22"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              {model.coordinates.map((point, index) => (
                <circle
                  cx={point.x}
                  cy={point.y}
                  fill={index === activeIndex ? 'var(--color-accent)' : 'var(--color-surface)'}
                  key={`${model.points[index]!.elapsedMinutes}-${model.points[index]!.revenueCents}`}
                  r={index === activeIndex ? '7' : '4'}
                  stroke="var(--color-accent)"
                  strokeWidth={index === activeIndex ? '3' : '2'}
                />
              ))}
              {activeCoordinates && (
                <g>
                  <line
                    stroke="var(--color-text)"
                    strokeDasharray="5 7"
                    strokeOpacity="0.34"
                    x1={activeCoordinates.x}
                    x2={activeCoordinates.x}
                    y1={model.plot.top}
                    y2={model.baselineY}
                  />
                  <circle
                    cx={activeCoordinates.x}
                    cy={activeCoordinates.y}
                    fill="var(--color-surface)"
                    r="8"
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
      <rect
        fill="var(--color-surface)"
        height={model.plot.height + 38}
        rx="18"
        width={REVENUE_CHART_WIDTH - 28}
        x="14"
        y="12"
      />
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
        d={`M ${model.plot.left} ${model.baselineY} C 120 ${model.baselineY - 6}, 225 ${
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
        x="360"
        y="132"
      >
        Awaiting first paid order
      </text>
      <text
        fill="var(--color-text-muted)"
        fontSize="12"
        fontWeight="500"
        textAnchor="middle"
        x="360"
        y="154"
      >
        Revenue will draw in from left to right
      </text>
    </g>
  );
}

const REVENUE_CHART_WIDTH = 720;
const REVENUE_CHART_HEIGHT = 320;
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

type StandRevenueBreakdown = {
  color: string;
  revenueCents: number;
  share: number;
  standId: string;
  standName: string;
};

type RevenueChartModel = {
  baselineY: number;
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
  points: RevenuePoint[];
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
  const maxMinutes = Math.max(...sortedPoints.map((point) => point.elapsedMinutes), 90);
  const rawMaxRevenue = Math.max(
    ...sortedPoints.map((point) => point.revenueCents),
    totalRevenueCents,
    100,
  );
  const maxRevenue = getNiceRevenueCeiling(rawMaxRevenue);
  const plot = {
    left: 78,
    right: 34,
    top: 34,
    bottom: 52,
    width: 586,
    height: 210,
  };
  const xForMinute = (elapsedMinutes: number) =>
    plot.left + (elapsedMinutes / maxMinutes) * plot.width;
  const yForRevenue = (revenueCents: number) =>
    plot.top + (1 - revenueCents / maxRevenue) * plot.height;
  const coordinates = sortedPoints.map((point) => ({
    x: xForMinute(point.elapsedMinutes),
    y: yForRevenue(point.revenueCents),
  }));
  const linePoints =
    sortedPoints[0]?.elapsedMinutes === 0
      ? sortedPoints
      : [{ elapsedMinutes: 0, revenueCents: 0 }, ...sortedPoints];
  const lineCoordinates = linePoints.map((point) => ({
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
    coordinates,
    eventStartAt: safeEventStartAt,
    lineCoordinates,
    maxMinutes,
    maxRevenue,
    plot,
    points: sortedPoints,
    totalBreakdown,
    xForMinute,
    yForRevenue,
    yTicks: [maxRevenue, Math.round(maxRevenue / 2), 0],
  };
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

function createStepRevenuePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }

    return `${path} H ${point.x.toFixed(1)} V ${point.y.toFixed(1)}`;
  }, '');
}

function StandRevenueSummary({
  stand,
  series,
}: {
  stand: StandDisplay;
  series?: StandRevenueSeries;
}) {
  const totalRevenueCents = series?.points.at(-1)?.revenueCents ?? 0;

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium text-text">{stand.standName}</span>
        <span className="shrink-0 text-text-muted">EUR {formatMoney(totalRevenueCents)}</span>
      </div>
    </div>
  );
}

function StandRevenueBars({
  series,
  standNameById,
  stands,
}: {
  series: StandRevenueSeries[];
  standNameById: Map<string, string>;
  stands: StandDisplay[];
}) {
  const rankedSeries =
    series.length > 0
      ? [...series]
          .map((entry) => ({
            ...entry,
            standName: standNameById.get(entry.standId) ?? 'Unknown stand',
            totalRevenueCents: entry.points.at(-1)?.revenueCents ?? 0,
          }))
          .sort((left, right) => right.totalRevenueCents - left.totalRevenueCents)
      : stands.map((stand) => ({
          standId: stand._id,
          standName: stand.standName,
          points: [],
          totalRevenueCents: 0,
        }));

  const maxRevenue = Math.max(...rankedSeries.map((entry) => entry.totalRevenueCents), 1);

  return (
    <div className="min-h-64 space-y-4 rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">Revenue by stand</p>
          <p className="mt-1 text-xs text-text-muted">Zero bars stay visible until sales arrive.</p>
        </div>
        <ChartPill
          label={rankedSeries.some((entry) => entry.totalRevenueCents > 0) ? 'Live' : 'Empty'}
        />
      </div>
      {rankedSeries.length > 0 ? (
        rankedSeries.map((entry) => (
          <div className="space-y-1.5" key={entry.standId}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-text-muted">{entry.standName}</span>
              <span className="font-semibold text-text">
                EUR {formatMoney(entry.totalRevenueCents)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-muted shadow-inner">
              <div
                className="h-full rounded-full bg-accent"
                style={{
                  opacity: entry.totalRevenueCents > 0 ? 1 : 0.18,
                  width: `${entry.totalRevenueCents > 0 ? Math.max(8, (entry.totalRevenueCents / maxRevenue) * 100) : 2}%`,
                }}
              />
            </div>
          </div>
        ))
      ) : (
        <OperationalCanvas
          title="No stands configured"
          message="Stand revenue lanes will appear here after setup."
        />
      )}
    </div>
  );
}

function QueueHealthChart({
  standNameById,
  standQueues,
  stands,
}: {
  standNameById: Map<string, string>;
  standQueues: StandQueueMetric[];
  stands: StandDisplay[];
}) {
  const visibleQueues =
    standQueues.length > 0
      ? standQueues
      : stands.map((stand) => ({
          standId: stand._id,
          queueLength: 0,
          averageWaitMinutes: 0,
          alert: false,
        }));

  const maxQueueLength = Math.max(...visibleQueues.map((queue) => queue.queueLength), 1);

  return (
    <div className="flex min-h-72 flex-col justify-end rounded-lg border border-border bg-background p-4">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">Queue depth</p>
          <p className="mt-1 text-xs text-text-muted">Open paid items per stand.</p>
        </div>
        <ChartPill
          label={visibleQueues.some((queue) => queue.queueLength > 0) ? 'Live' : 'Empty'}
        />
      </div>
      {visibleQueues.length > 0 ? (
        <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] items-end gap-3">
          {visibleQueues.map((queue) => (
            <div className="flex min-w-0 flex-col items-center gap-2" key={queue.standId}>
              <div className="flex h-40 w-full max-w-16 items-end rounded-md bg-surface-muted p-1 shadow-inner">
                <div
                  className={['w-full rounded-sm', queue.alert ? 'bg-danger' : 'bg-accent'].join(
                    ' ',
                  )}
                  style={{
                    height: `${queue.queueLength > 0 ? Math.max(12, (queue.queueLength / maxQueueLength) * 100) : 3}%`,
                    opacity: queue.queueLength > 0 ? 1 : 0.18,
                  }}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-text">{queue.queueLength}</p>
                <p className="max-w-20 truncate text-xs text-text-muted">
                  {standNameById.get(queue.standId) ?? 'Stand'}
                </p>
                <p className="text-[0.65rem] font-medium text-text-muted">
                  {queue.averageWaitMinutes}m
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <OperationalCanvas
          title="No queue streams"
          message="Queue lanes will appear when stands are configured."
        />
      )}
    </div>
  );
}

function OperationsModel({ analytics }: { analytics: EventControlCenterData }) {
  const queuedItems = analytics.standQueues.reduce((total, queue) => total + queue.queueLength, 0);
  const maxWait = Math.max(...analytics.standQueues.map((queue) => queue.averageWaitMinutes), 0);
  const nodes = [
    { label: 'Guests', metric: analytics.activeGuests, value: analytics.activeGuests.toString() },
    { label: 'Paid Items', metric: queuedItems, value: queuedItems.toString() },
    { label: 'Wait Peak', metric: maxWait, value: `${maxWait}m` },
    {
      label: 'Alerts',
      metric: analytics.standQueues.filter((queue) => queue.alert).length,
      value: analytics.standQueues.filter((queue) => queue.alert).length.toString(),
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background p-4">
      <div className="grid gap-3 md:grid-cols-4">
        {nodes.map((node, index) => (
          <div
            className="relative rounded-lg border border-border bg-surface p-4 shadow-sm"
            key={node.label}
          >
            {index < nodes.length - 1 && (
              <div className="absolute top-1/2 -right-3 hidden h-px w-3 bg-border md:block" />
            )}
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-accent"
                style={{
                  opacity: node.metric > 0 ? 1 : 0.18,
                  width: node.metric > 0 ? '72%' : '8%',
                }}
              />
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {node.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-text">{node.value}</p>
          </div>
        ))}
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

function StandPerformanceRow({ stand, queue }: { stand: StandDisplay; queue?: StandQueueMetric }) {
  const queueLength = queue?.queueLength ?? 0;
  const averageWaitMinutes = queue?.averageWaitMinutes ?? 0;
  const waitWidth = `${Math.min(100, averageWaitMinutes * 5)}%`;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-text">{stand.standName}</h3>
          <p className="mt-1 text-xs text-text-muted">{queueLength} open paid item(s)</p>
        </div>
        <span
          className={[
            'rounded-full border px-2.5 py-1 text-xs font-semibold',
            queue?.alert
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-border bg-surface text-text-muted',
          ].join(' ')}
        >
          Wait {averageWaitMinutes}m
        </span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={['h-full', queue?.alert ? 'bg-danger' : 'bg-success'].join(' ')}
          style={{ width: waitWidth }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
        <WarningTriangleIcon className="h-4 w-4" />
        {queue?.alert ? 'Alert threshold reached.' : 'No active queue alert.'}
      </div>
    </div>
  );
}

function AlertsSummary({
  standNameById,
  standQueues,
}: {
  standNameById: Map<string, string>;
  standQueues: StandQueueMetric[];
}) {
  const alertQueues = standQueues.filter((queue) => queue.alert);

  if (alertQueues.length === 0) {
    return (
      <EmptyState
        icon
        title="No critical queues"
        message="Average wait and queue length are below the configured alert thresholds."
      />
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {alertQueues.map((queue) => (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4" key={queue.standId}>
          <p className="font-semibold text-text">
            {standNameById.get(queue.standId) ?? 'Unknown stand'}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {queue.queueLength} open paid item(s), {queue.averageWaitMinutes}m average wait.
          </p>
        </div>
      ))}
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
