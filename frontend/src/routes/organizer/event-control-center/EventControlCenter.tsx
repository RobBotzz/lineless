import { useEffect, useMemo, useState } from 'react';
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
  type EventControlCenterSettings,
} from '@/api/eventControlCenter';
import { BackButton } from '@/components/shared';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { paths } from '@/paths';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';
import { EventControlCenterAnalyticsPage } from './EventControlCenterAnalyticsPage';
import { EventControlCenterManagementPage } from './EventControlCenterManagementPage';
import { EventControlCenterSettingsPage } from './EventControlCenterSettingsPage';
import {
  createSettingsForStands,
  normalizeControlCenterSettings,
  readControlCenterSettings,
  writeControlCenterSettings,
} from './eventControlCenterSettingsStorage';
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
      createSettingsForStands(
        controlCenterSettingsState.eventId === event._id
          ? controlCenterSettingsState.settings
          : readControlCenterSettings(event._id),
        stands,
      ),
    [controlCenterSettingsState, event._id, stands],
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
    const normalizedSettings = createSettingsForStands(
      normalizeControlCenterSettings(settings),
      stands,
    );
    writeControlCenterSettings(event._id, normalizedSettings);
    setControlCenterSettingsState({ eventId: event._id, settings: normalizedSettings });
  }

  async function handleProductPauseChange(standId: string, product: Product, paused: boolean) {
    if (paused) {
      await pauseProduct(product._id);
    } else {
      await resumeProduct(product._id);
    }

    const currentStandProducts = productsByStand[standId] ?? [];
    const nextStandProducts = currentStandProducts.map((candidate) =>
      candidate._id === product._id
        ? { ...candidate, productStatus: paused ? 'PAUSED' : 'LIVE' }
        : candidate,
    );

    if (paused) {
      const hasLiveProducts = nextStandProducts.some(
        (candidate) => candidate.productStatus === 'LIVE',
      );
      const stand = stands.find((candidate) => candidate._id === standId);
      if (!hasLiveProducts && stand?.standStatus === 'LIVE') {
        const updatedStand = await pauseStand(event._id, standId);
        setStands((current) =>
          current.map((candidate) => (candidate._id === standId ? updatedStand : candidate)),
        );
      }
    } else {
      const stand = stands.find((candidate) => candidate._id === standId);
      if (stand?.standStatus === 'PAUSED') {
        const updatedStand = await resumeStand(event._id, standId);
        setStands((current) =>
          current.map((candidate) => (candidate._id === standId ? updatedStand : candidate)),
        );
      }
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
    const standProducts = productsByStand[stand._id] ?? [];
    const productsToSync = standProducts.filter((product) =>
      paused ? product.productStatus === 'LIVE' : product.productStatus === 'PAUSED',
    );

    await Promise.all(
      productsToSync.map((product) =>
        paused ? pauseProduct(product._id) : resumeProduct(product._id),
      ),
    );

    setStands((current) =>
      current.map((candidate) => (candidate._id === stand._id ? updatedStand : candidate)),
    );
    setProductsByStand((current) => ({
      ...current,
      [stand._id]: (current[stand._id] ?? []).map((product) =>
        product.productStatus === 'TERMINATED'
          ? product
          : { ...product, productStatus: paused ? 'PAUSED' : 'LIVE' },
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
        <EventControlCenterAnalyticsPage
          analytics={analytics}
          eventStartAt={event.startedAt ?? event.createdAt}
          stands={stands}
        />
      ) : activeSection === 'settings' ? (
        <EventControlCenterSettingsPage
          key={`${event._id}-${JSON.stringify(controlCenterSettings.standAlertThresholds)}`}
          settings={controlCenterSettings}
          stands={stands}
          onChange={handleControlCenterSettingsChange}
        />
      ) : (
        <EventControlCenterManagementPage
          liveOrders={liveOrders}
          productsByStand={productsByStand}
          selectedStand={selectedStand}
          selectedStandId={selectedStandId}
          stands={stands}
          onCancelOrderItems={handleCancelOrderItems}
          onCancelOrder={handleCancelOrder}
          onProductPauseChange={handleProductPauseChange}
          onStandPauseChange={handleStandPauseChange}
          onSelectStand={setSelectedStandId}
        />
      )}
    </div>
  );
}
