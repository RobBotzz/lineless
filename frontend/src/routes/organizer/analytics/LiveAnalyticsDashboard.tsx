import { useMemo, useState } from 'react';
import { useLoaderData, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import { WarningTriangleIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { paths } from '@/paths';
import type { Product } from '@/types/product';
import { formatMoney } from '@/types/product';
import type { Stand } from '@/types/stand';
import type { AnalyticsLoaderData } from './data';

type DashboardTab = 'analytics' | 'management';

const BACKEND_PENDING = 'Backend endpoint pending';

export function AnalyticsError() {
  const error = useRouteError();
  const message =
    error instanceof ApiError
      ? error.message
      : 'This analytics dashboard could not be loaded. Check whether the backend is running and try again.';

  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-5 text-sm text-text">
      {message}
    </div>
  );
}

export default function LiveAnalyticsDashboard() {
  const { event, stands, productsByStand } = useLoaderData() as AnalyticsLoaderData;
  const [activeTab, setActiveTab] = useState<DashboardTab>('analytics');
  const [selectedStandId, setSelectedStandId] = useState<string>(() => stands[0]?._id ?? 'all');

  const selectedStand =
    selectedStandId === 'all'
      ? null
      : (stands.find((stand) => stand._id === selectedStandId) ?? null);

  return (
    <div className="space-y-6">
      <BackButton to={paths.organizer.event(event._id)}>Event Configuration</BackButton>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-2xl font-bold">
                  {event.name || 'Untitled Event'}
                </CardTitle>
                <EventStatusBadge status={event.status} />
              </div>
              <p className="mt-2 text-sm text-text-muted">
                Live analytics and operational controls for this event.
              </p>
            </div>

            <TabNavigation activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </CardHeader>
      </Card>

      {activeTab === 'analytics' ? (
        <AnalyticsTab stands={stands} />
      ) : (
        <ManagementTab
          productsByStand={productsByStand}
          selectedStand={selectedStand}
          selectedStandId={selectedStandId}
          stands={stands}
          onSelectStand={setSelectedStandId}
        />
      )}
    </div>
  );
}

function EventStatusBadge({ status }: { status: AnalyticsLoaderData['event']['status'] }) {
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

function TabNavigation({
  activeTab,
  onChange,
}: {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}) {
  const tabs: { id: DashboardTab; label: string }[] = [
    { id: 'analytics', label: 'Analytics' },
    { id: 'management', label: 'Management' },
  ];

  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-surface p-1 shadow-sm sm:w-auto">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            className={[
              'h-9 flex-1 rounded-md px-4 text-sm font-semibold transition-colors sm:flex-none',
              isActive
                ? 'bg-accent text-[var(--color-button-text)]'
                : 'text-text-muted hover:bg-surface-muted hover:text-text',
            ].join(' ')}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function AnalyticsTab({ stands }: { stands: Stand[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total Revenue" value="--" />
        <MetricCard label="Active Guests" value="--" />
        <MetricCard label="Max Queue Bottleneck" value={BACKEND_PENDING} compact />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Event-Wide Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartPendingState
              title="Waiting for GET /events/:eventId/analytics"
              message="The chart will render cumulative event revenue over elapsed event time once the backend returns revenue points."
            />
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
                  <label
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-muted"
                    key={stand._id}
                  >
                    <input checked disabled readOnly type="checkbox" />
                    <span className="min-w-0 truncate">{stand.standName}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-text-muted">No stands configured for this event.</p>
              )}
            </div>
            <ChartPendingState
              title="Stand comparison pending"
              message="Stand-specific revenue series will be shown here after analytics data exists."
              short
            />
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
                <StandPerformanceRow key={stand._id} stand={stand} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No stands configured"
              message="Add stands to the event configuration before analytics can be grouped by station."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Intelligent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon
            title="Alert engine waiting for queue metrics"
            message="Average wait thresholds, flashing stand warnings, and critical queue alerts require GET /events/:eventId/analytics."
          />
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
        <p className="text-xs text-text-muted">Requires analytics backend</p>
      </CardContent>
    </Card>
  );
}

function ChartPendingState({
  title,
  message,
  short = false,
}: {
  title: string;
  message: string;
  short?: boolean;
}) {
  return (
    <div
      className={[
        'flex flex-col justify-between rounded-lg border border-dashed border-border bg-background p-4',
        short ? 'min-h-44' : 'min-h-72',
      ].join(' ')}
    >
      <div>
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="mt-1 max-w-xl text-sm text-text-muted">{message}</p>
      </div>
      <svg
        aria-hidden="true"
        className="mt-6 h-28 w-full text-border"
        preserveAspectRatio="none"
        viewBox="0 0 320 120"
      >
        <path d="M12 12v96h296" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M24 92 C72 72 84 84 124 56 S198 60 236 32 282 36 300 20"
          fill="none"
          stroke="currentColor"
          strokeDasharray="6 6"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}

function StandPerformanceRow({ stand }: { stand: Stand }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-text">{stand.standName}</h3>
          <p className="mt-1 text-xs text-text-muted">{BACKEND_PENDING}</p>
        </div>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text-muted">
          Wait --
        </span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full w-0 bg-success" />
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
        <WarningTriangleIcon className="h-4 w-4" />
        Queue length and alert state require analytics data.
      </div>
    </div>
  );
}

function ManagementTab({
  stands,
  productsByStand,
  selectedStandId,
  selectedStand,
  onSelectStand,
}: {
  stands: Stand[];
  productsByStand: Record<string, Product[]>;
  selectedStandId: string;
  selectedStand: Stand | null;
  onSelectStand: (standId: string) => void;
}) {
  const visibleStands = useMemo(
    () =>
      selectedStandId === 'all' ? stands : stands.filter((stand) => stand._id === selectedStandId),
    [selectedStandId, stands],
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
            <OrdersPendingTable />
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

function OrdersPendingTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[1fr_7rem_8rem] bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
        <span>Order</span>
        <span>Status</span>
        <span className="text-right">Action</span>
      </div>
      <div className="px-4 py-10 text-center">
        <p className="font-semibold text-text">No live orders loaded</p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">
          This table will call GET /events/:eventId/orders when the backend endpoint exists. The
          cancellation workflow is disabled until orders can be returned by the API.
        </p>
        <Button className="mt-4" disabled variant="outline">
          Cancellation endpoint pending
        </Button>
      </div>
    </div>
  );
}

function StandPausePanel({ stand, products }: { stand: Stand; products: Product[] }) {
  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-text">{stand.standName}</h3>
          <p className="mt-1 text-xs text-text-muted">
            Station pause requires POST /stands/:standId/pause and /resume.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-muted">Temporarily Closed</span>
          <Toggle checked={false} disabled label={`Pause ${stand.standName}`} onChange={() => {}} />
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {products.length > 0 ? (
          products.map((product) => <ProductPauseTile key={product._id} product={product} />)
        ) : (
          <p className="text-sm text-text-muted">No products configured for this stand.</p>
        )}
      </div>
    </section>
  );
}

function ProductPauseTile({ product }: { product: Product }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text">{product.productName}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          EUR {formatMoney(product.priceIncludingTax)} · {product.productStatus}
        </p>
      </div>
      <Toggle
        checked={product.productStatus === 'PAUSED'}
        disabled
        label={`Pause ${product.productName}`}
        onChange={() => {}}
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
