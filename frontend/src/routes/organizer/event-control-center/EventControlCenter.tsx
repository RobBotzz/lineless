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
        />
        <MetricCard label="Active Guests" value={analytics.activeGuests.toString()} />
        <MetricCard label="Max Queue Bottleneck" value={maxBottleneckName} compact />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Event-Wide Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart points={analytics.eventRevenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stand Revenue Lines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {stands.length > 0 ? (
                stands.map((stand) => (
                  <StandRevenueSummary
                    key={stand._id}
                    series={analytics.standRevenue.find((series) => series.standId === stand._id)}
                    stand={stand}
                  />
                ))
              ) : (
                <p className="text-sm text-text-muted">No stands configured for this event.</p>
              )}
            </div>
            <StandRevenueList series={analytics.standRevenue} standNameById={standNameById} />
          </CardContent>
        </Card>
      </div>

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
            <EmptyState
              title="No stands configured"
              message="Add stands to the event configuration before metrics can be grouped by station."
            />
          )}
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
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <Card>
      <CardContent className="gap-3">
        <p className="text-sm font-medium text-text-muted">{label}</p>
        <p
          className={compact ? 'text-base font-semibold text-text' : 'text-3xl font-bold text-text'}
        >
          {value}
        </p>
        <p className="text-xs text-text-muted">Live control center snapshot</p>
      </CardContent>
    </Card>
  );
}

function RevenueChart({ points }: { points: RevenuePoint[] }) {
  if (points.length === 0) {
    return (
      <EmptyState
        title="No revenue yet"
        message="Paid, non-cancelled order items will appear here as cumulative event revenue."
      />
    );
  }

  const maxMinutes = Math.max(...points.map((point) => point.elapsedMinutes), 1);
  const maxRevenue = Math.max(...points.map((point) => point.revenueCents), 1);
  const path = points
    .map((point, index) => {
      const x = 12 + (point.elapsedMinutes / maxMinutes) * 296;
      const y = 108 - (point.revenueCents / maxRevenue) * 92;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const latestPoint = points[points.length - 1]!;

  return (
    <div className="flex min-h-72 flex-col justify-between rounded-lg border border-border bg-background p-4">
      <div>
        <p className="text-sm font-semibold text-text">
          EUR {formatMoney(latestPoint.revenueCents)}
        </p>
        <p className="mt-1 max-w-xl text-sm text-text-muted">
          Cumulative paid revenue after {latestPoint.elapsedMinutes} minutes.
        </p>
      </div>
      <svg
        aria-hidden="true"
        className="mt-6 h-36 w-full"
        preserveAspectRatio="none"
        viewBox="0 0 320 120"
      >
        <path d="M12 12v96h296" fill="none" stroke="var(--color-border)" strokeWidth="2" />
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="3" />
      </svg>
    </div>
  );
}

function StandRevenueSummary({ stand, series }: { stand: Stand; series?: StandRevenueSeries }) {
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

function StandRevenueList({
  series,
  standNameById,
}: {
  series: StandRevenueSeries[];
  standNameById: Map<string, string>;
}) {
  const rankedSeries = [...series]
    .map((entry) => ({
      ...entry,
      totalRevenueCents: entry.points.at(-1)?.revenueCents ?? 0,
    }))
    .sort((left, right) => right.totalRevenueCents - left.totalRevenueCents)
    .filter((entry) => entry.totalRevenueCents > 0);

  if (rankedSeries.length === 0) {
    return (
      <EmptyState
        title="No stand revenue yet"
        message="Paid order items are grouped by the product's stand at purchase time."
      />
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      {rankedSeries.map((entry) => (
        <div className="flex items-center justify-between gap-3 text-sm" key={entry.standId}>
          <span className="min-w-0 truncate text-text-muted">
            {standNameById.get(entry.standId) ?? 'Unknown stand'}
          </span>
          <span className="font-semibold text-text">
            EUR {formatMoney(entry.totalRevenueCents)}
          </span>
        </div>
      ))}
    </div>
  );
}

function StandPerformanceRow({ stand, queue }: { stand: Stand; queue?: StandQueueMetric }) {
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
  const isPaused = product.productStatus === 'PAUSED';

  async function handleChange(paused: boolean) {
    setIsSaving(true);
    try {
      await onPauseChange(standId, product, paused);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text">{product.productName}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          EUR {formatMoney(product.priceIncludingTax)} · {product.productStatus}
        </p>
      </div>
      <Toggle
        checked={isPaused}
        disabled={isSaving || product.productStatus === 'TERMINATED'}
        label={`Pause ${product.productName}`}
        onChange={(checked) => void handleChange(checked)}
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
