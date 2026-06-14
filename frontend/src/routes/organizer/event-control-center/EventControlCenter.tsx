import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLoaderData, useParams, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import {
  cancelOrder,
  getEventControlCenter,
  getEventOrders,
  pauseProduct,
  resumeProduct,
  type EventControlCenterData,
  type LiveOrder,
  type RevenuePoint,
  type StandQueueMetric,
  type StandRevenueSeries,
} from '@/api/eventControlCenter';
import { LockIcon, UnlockIcon, WarningTriangleIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { paths } from '@/paths';
import type { Product } from '@/types/product';
import { formatMoney } from '@/types/product';
import type { Stand } from '@/types/stand';
import type { EventControlCenterLoaderData } from './data';

type StandDisplay = Pick<Stand, '_id' | 'standName'>;

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
    stands,
  } = useLoaderData() as EventControlCenterLoaderData;
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [liveOrders, setLiveOrders] = useState(initialLiveOrders);
  const [productsByStand, setProductsByStand] = useState(initialProductsByStand);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const { section } = useParams();
  const [selectedStandId, setSelectedStandId] = useState<string>(() => stands[0]?._id ?? 'all');
  const activeSection = section === 'management' ? 'management' : 'analytics';

  const selectedStand =
    selectedStandId === 'all'
      ? null
      : (stands.find((stand) => stand._id === selectedStandId) ?? null);

  const hasInvalidSection =
    section !== undefined && section !== 'analytics' && section !== 'management';

  useEffect(() => {
    let cancelled = false;

    async function refreshControlCenter() {
      const [nextAnalytics, nextLiveOrders] = await Promise.all([
        getEventControlCenter(event._id),
        getEventOrders(event._id),
      ]);
      if (cancelled) return;
      setAnalytics(nextAnalytics);
      setLiveOrders(nextLiveOrders);
      setLastUpdatedAt(new Date());
    }

    // TODO SSE: replace polling with the shared event-control-center SSE stream.
    const interval = window.setInterval(() => {
      void refreshControlCenter().catch(() => {});
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [event._id]);

  async function refreshSnapshot() {
    const [nextAnalytics, nextLiveOrders] = await Promise.all([
      getEventControlCenter(event._id),
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
                <EventStatusBadge status={event.status} />
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
        <MetricsTab analytics={analytics} stands={stands} />
      ) : (
        <ManagementTab
          liveOrders={liveOrders}
          productsByStand={productsByStand}
          selectedStand={selectedStand}
          selectedStandId={selectedStandId}
          stands={stands}
          onCancelOrder={handleCancelOrder}
          onProductPauseChange={handleProductPauseChange}
          onSelectStand={setSelectedStandId}
        />
      )}
    </div>
  );
}

function EventStatusBadge({ status }: { status: EventControlCenterLoaderData['event']['status'] }) {
  const label =
    status === 'ACTIVE' ? 'Live' : status === 'DRAFT' ? 'Draft event' : 'Completed event';
  const className =
    status === 'ACTIVE'
      ? 'border-success/30 bg-success/10 text-success'
      : status === 'DRAFT'
        ? 'border-border bg-surface-muted text-text-muted'
        : 'border-danger/30 bg-danger/10 text-danger';

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        className,
      ].join(' ')}
    >
      {label}
    </span>
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

function MetricsTab({ analytics, stands }: { analytics: EventControlCenterData; stands: Stand[] }) {
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
              totalRevenueCents={analytics.totalRevenueCents}
              points={analytics.eventRevenue}
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
    </div>
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
  points,
  totalRevenueCents,
}: {
  points: RevenuePoint[];
  totalRevenueCents: number;
}) {
  const hasPoints = points.length > 0;
  const maxMinutes = Math.max(...points.map((point) => point.elapsedMinutes), 90);
  const rawMaxRevenue = Math.max(
    ...points.map((point) => point.revenueCents),
    totalRevenueCents,
    100,
  );
  const maxRevenue = Math.ceil(rawMaxRevenue / 1000) * 1000;
  const plot = {
    left: 44,
    right: 22,
    top: 18,
    bottom: 30,
    width: 294,
    height: 118,
  };
  const pointToCoordinates = (point: RevenuePoint) => {
    const x = plot.left + (point.elapsedMinutes / maxMinutes) * plot.width;
    const y = plot.top + (1 - point.revenueCents / maxRevenue) * plot.height;
    return { x, y };
  };
  const coordinates = points.map(pointToCoordinates);
  const path = createSmoothRevenuePath(coordinates);
  const baselineY = plot.top + plot.height;
  const areaPath =
    hasPoints && coordinates.length > 0
      ? `${path} L ${coordinates.at(-1)!.x.toFixed(1)} ${baselineY} L ${coordinates[0]!.x.toFixed(
          1,
        )} ${baselineY} Z`
      : '';
  const latestPoint = points.at(-1);
  const latestCoordinates = latestPoint ? pointToCoordinates(latestPoint) : null;
  const yTicks = [maxRevenue, Math.round(maxRevenue / 2), 0];

  return (
    <div className="flex min-h-80 flex-col justify-between overflow-hidden rounded-lg border border-border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text">EUR {formatMoney(totalRevenueCents)}</p>
          <p className="mt-1 max-w-xl text-sm text-text-muted">
            {latestPoint
              ? `Cumulative paid revenue after ${latestPoint.elapsedMinutes} minutes.`
              : 'The chart is ready for the first paid order.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text-muted">
            Peak EUR {formatMoney(maxRevenue)}
          </span>
          <ChartPill label={hasPoints ? 'Live' : 'Empty'} />
        </div>
      </div>
      <svg aria-hidden="true" className="mt-6 h-56 w-full" viewBox="0 0 360 176">
        <defs>
          <linearGradient id="eventRevenueArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="emptyChartSurface" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.08" />
            <stop offset="55%" stopColor="var(--color-surface)" stopOpacity="0.72" />
            <stop offset="100%" stopColor="var(--color-surface-muted)" stopOpacity="0.55" />
          </linearGradient>
          <filter id="revenueLineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect fill="url(#emptyChartSurface)" height="146" rx="14" width="336" x="12" y="8" />
        {yTicks.map((tick) => {
          const y = plot.top + (1 - tick / maxRevenue) * plot.height;

          return (
            <g key={tick}>
              <text
                fill="var(--color-text-muted)"
                fontSize="8"
                fontWeight="600"
                textAnchor="end"
                x="36"
                y={y + 3}
              >
                {tick === 0 ? 'EUR 0' : `${Math.round(tick / 100) / 10}k`}
              </text>
              <line
                stroke="var(--color-border)"
                strokeDasharray={tick === 0 ? '0' : '4 7'}
                strokeOpacity={tick === 0 ? '0.9' : '0.62'}
                strokeWidth={tick === 0 ? '1.5' : '1'}
                x1={plot.left}
                x2={plot.left + plot.width}
                y1={y}
                y2={y}
              />
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((position) => {
          const x = plot.left + position * plot.width;

          return (
            <line
              key={position}
              stroke="var(--color-border)"
              strokeOpacity="0.28"
              x1={x}
              x2={x}
              y1={plot.top}
              y2={baselineY}
            />
          );
        })}
        {hasPoints && <path d={areaPath} fill="url(#eventRevenueArea)" />}
        {hasPoints ? (
          <>
            <path
              d={path}
              fill="none"
              filter="url(#revenueLineGlow)"
              opacity="0.24"
              stroke="var(--color-accent)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="8"
            />
            <path
              d={path}
              fill="none"
              stroke="var(--color-accent)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3.5"
            />
            {coordinates.map(({ x, y }, index) => (
              <circle
                cx={x}
                cy={y}
                fill="var(--color-surface)"
                key={`${points[index]!.elapsedMinutes}-${points[index]!.revenueCents}`}
                r={index === coordinates.length - 1 ? '4.8' : '3'}
                stroke="var(--color-accent)"
                strokeWidth={index === coordinates.length - 1 ? '2.5' : '2'}
              />
            ))}
            {latestCoordinates && latestPoint && (
              <g>
                <line
                  stroke="var(--color-accent)"
                  strokeDasharray="3 5"
                  strokeOpacity="0.42"
                  x1={latestCoordinates.x}
                  x2={latestCoordinates.x}
                  y1={plot.top}
                  y2={baselineY}
                />
                <rect
                  fill="var(--color-surface)"
                  height="23"
                  rx="11.5"
                  stroke="var(--color-border)"
                  width="78"
                  x={Math.min(latestCoordinates.x + 8, 260)}
                  y={Math.max(latestCoordinates.y - 34, 12)}
                />
                <text
                  fill="var(--color-text)"
                  fontSize="8"
                  fontWeight="700"
                  x={Math.min(latestCoordinates.x + 47, 299)}
                  y={Math.max(latestCoordinates.y - 19, 27)}
                  textAnchor="middle"
                >
                  EUR {formatMoney(latestPoint.revenueCents)}
                </text>
              </g>
            )}
          </>
        ) : (
          <g>
            <path
              d={`M ${plot.left} ${baselineY} C 120 ${baselineY - 6}, 225 ${baselineY - 6}, ${
                plot.left + plot.width
              } ${baselineY}`}
              fill="none"
              stroke="var(--color-accent)"
              strokeDasharray="5 7"
              strokeLinecap="round"
              strokeOpacity="0.38"
              strokeWidth="2.5"
            />
            <circle
              cx={plot.left + plot.width / 2}
              cy={baselineY - 5}
              fill="var(--color-surface)"
              r="5"
              stroke="var(--color-accent)"
              strokeOpacity="0.55"
              strokeWidth="2"
            />
            <text
              fill="var(--color-text)"
              fontSize="10"
              fontWeight="700"
              textAnchor="middle"
              x="191"
              y="72"
            >
              Awaiting first paid order
            </text>
            <text
              fill="var(--color-text-muted)"
              fontSize="8"
              fontWeight="500"
              textAnchor="middle"
              x="191"
              y="86"
            >
              Revenue will draw in from left to right
            </text>
          </g>
        )}
        <text fill="var(--color-text-muted)" fontSize="8" fontWeight="600" x={plot.left} y="164">
          0m
        </text>
        <text
          fill="var(--color-text-muted)"
          fontSize="8"
          fontWeight="600"
          textAnchor="middle"
          x={plot.left + plot.width / 2}
          y="164"
        >
          {Math.round(maxMinutes / 2)}m
        </text>
        <text
          fill="var(--color-text-muted)"
          fontSize="8"
          fontWeight="600"
          textAnchor="end"
          x={plot.left + plot.width}
          y="164"
        >
          {maxMinutes}m
        </text>
      </svg>
    </div>
  );
}

function createSmoothRevenuePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }

    const previous = points[index - 1]!;
    const controlX = (previous.x + point.x) / 2;

    return `${path} C ${controlX.toFixed(1)} ${previous.y.toFixed(1)}, ${controlX.toFixed(
      1,
    )} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
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

function ManagementTab({
  liveOrders,
  onCancelOrder,
  onProductPauseChange,
  onSelectStand,
  selectedStandId,
  selectedStand,
  productsByStand,
  stands,
}: {
  liveOrders: LiveOrder[];
  onCancelOrder: (orderId: string) => Promise<void>;
  onProductPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
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
            <LiveOrdersTable orders={visibleOrders} onCancelOrder={onCancelOrder} />
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
  onCancelOrder,
}: {
  orders: LiveOrder[];
  onCancelOrder: (orderId: string) => Promise<void>;
}) {
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  async function cancel(orderId: string) {
    setCancellingOrderId(orderId);
    try {
      await onCancelOrder(orderId);
    } finally {
      setCancellingOrderId(null);
    }
  }

  if (orders.length === 0) {
    return (
      <EmptyState title="No live orders" message="Paid orders with open items will appear here." />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[8rem_1fr_8rem_8rem] bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
        <span>Order</span>
        <span>Items</span>
        <span>Status</span>
        <span className="text-right">Action</span>
      </div>
      <div className="divide-y divide-border">
        {orders.map((order) => (
          <div
            className="grid grid-cols-[8rem_1fr_8rem_8rem] items-center gap-4 px-4 py-3"
            key={order._id}
          >
            <div>
              <p className="font-semibold text-text">#{order.orderNumber}</p>
              <p className="text-xs text-text-muted">{order.pickupCode}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-text">
                {order.items.map((item) => item.productName).join(', ')}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                EUR {formatMoney(order.totalPriceIncludingTax)} ·{' '}
                {new Date(order.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
            <div className="text-right">
              <Button
                disabled={cancellingOrderId === order._id}
                onClick={() => void cancel(order._id)}
                size="sm"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
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
  products,
  stand,
}: {
  onProductPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  products: Product[];
  stand: Stand;
}) {
  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-text">{stand.standName}</h3>
          <p className="mt-1 text-xs text-text-muted">
            Station pause requires POST /stands/:standId/pause and /resume.
          </p>
        </div>
        <StandAvailabilityControl standName={stand.standName} />
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

function StandAvailabilityControl({ standName }: { standName: string }) {
  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <button
        aria-label={`${standName} is open and accepting orders.`}
        className="relative h-11 w-full cursor-not-allowed rounded-full border border-border bg-surface p-1 text-sm shadow-sm transition-colors sm:w-64"
        disabled
        type="button"
      >
        <span className="grid h-full grid-cols-2 items-center rounded-full bg-surface-muted">
          <span className="flex items-center justify-center gap-1.5 font-semibold text-accent">
            <UnlockIcon className="h-4 w-4" />
            Open
          </span>
          <span className="flex items-center justify-center gap-1.5 font-semibold text-text-muted">
            <LockIcon className="h-4 w-4" />
            Closed
          </span>
        </span>
        <span className="absolute inset-y-1 left-1 flex w-[calc(50%-0.25rem)] items-center justify-center gap-1.5 rounded-full bg-accent px-3 font-semibold text-[var(--color-button-text)] shadow-sm">
          <UnlockIcon className="h-4 w-4" />
          Open
        </span>
      </button>
      <span className="text-xs text-text-muted">Stand is accepting orders.</span>
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
