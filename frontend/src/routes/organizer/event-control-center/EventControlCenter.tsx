import { useMemo, useState } from 'react';
import { Navigate, useLoaderData, useParams, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import type { EventControlCenterSettings } from '@/api/eventControlCenter';
import { paths } from '@/paths';
import { ControlCenterHeader } from './components/ControlCenterHeader';
import { ControlCenterTabs } from './components/ControlCenterTabs';
import type { EventControlCenterLoaderData } from './data';
import { EventControlCenterAnalyticsPage } from './EventControlCenterAnalyticsPage';
import { EventControlCenterManagementPage } from './EventControlCenterManagementPage';
import { EventControlCenterSettingsPage } from './EventControlCenterSettingsPage';
import {
  createSettingsForStands,
  normalizeControlCenterSettings,
  readControlCenterSettings,
  writeControlCenterSettings,
} from './eventControlCenterSettingsStorage';
import { useEventControlCenterLiveData } from './hooks/useEventControlCenterLiveData';

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
  const [controlCenterSettingsState, setControlCenterSettingsState] = useState<{
    eventId: string;
    settings: EventControlCenterSettings;
  }>(() => ({
    eventId: event._id,
    settings: readControlCenterSettings(event._id),
  }));
  const { section } = useParams();
  const activeSection =
    section === 'management' ? 'management' : section === 'settings' ? 'settings' : 'analytics';

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
        initialStands,
      ),
    [controlCenterSettingsState, event._id, initialStands],
  );

  const liveData = useEventControlCenterLiveData({
    controlCenterSettings,
    eventId: event._id,
    initialAnalytics,
    initialLiveOrders,
    initialProductsByStand,
    initialStands,
  });

  function handleControlCenterSettingsChange(settings: EventControlCenterSettings) {
    const normalizedSettings = createSettingsForStands(
      normalizeControlCenterSettings(settings),
      liveData.stands,
    );
    writeControlCenterSettings(event._id, normalizedSettings);
    setControlCenterSettingsState({ eventId: event._id, settings: normalizedSettings });
  }

  if (hasInvalidSection) {
    return <Navigate replace to={paths.organizer.eventControlCenterAnalytics(event._id)} />;
  }

  return (
    <div className="space-y-6">
      <ControlCenterHeader
        backTo={paths.organizer.event(event._id)}
        eventName={event.name}
        lastUpdatedAt={liveData.lastUpdatedAt}
        streamError={liveData.streamError}
        streamStatus={liveData.streamStatus}
      />

      <ControlCenterTabs eventId={event._id} active={activeSection} />

      {activeSection === 'analytics' ? (
        <EventControlCenterAnalyticsPage
          analytics={liveData.analytics}
          eventStartAt={event.startedAt ?? event.createdAt}
          productsByStand={liveData.productsByStand}
          stands={liveData.stands}
        />
      ) : activeSection === 'settings' ? (
        <EventControlCenterSettingsPage
          key={event._id}
          settings={controlCenterSettings}
          stands={liveData.stands}
          onChange={handleControlCenterSettingsChange}
        />
      ) : (
        <EventControlCenterManagementPage
          liveOrders={liveData.liveOrders}
          mutationError={liveData.mutationError}
          productsByStand={liveData.productsByStand}
          stands={liveData.stands}
          onCancelOrderItems={liveData.handleCancelOrderItems}
          onCancelOrder={liveData.handleCancelOrder}
          onProductPauseChange={liveData.handleProductPauseChange}
          onProductStockChange={liveData.handleProductStockChange}
          onStandPauseChange={liveData.handleStandPauseChange}
        />
      )}
    </div>
  );
}
