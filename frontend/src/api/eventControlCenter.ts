import { apiFetch } from './client';
import type {
  EventControlCenterData,
  EventControlCenterSettings,
  LiveOrder,
} from '@/types/eventControlCenter';

export type {
  EventControlCenterData,
  EventControlCenterSettings,
  LiveOrder,
  LiveOrderItem,
  LiveOrderStatus,
  ProductRating,
  ProductStockAlert,
  RevenuePoint,
  StandAlertThreshold,
  StandQueueMetric,
  StandRevenueSeries,
} from '@/types/eventControlCenter';

export const EVENT_CONTROL_CENTER_STREAM_EVENT = 'control-center';
export const EVENT_ORDERS_STREAM_EVENT = 'orders';

function eventControlCenterSettingsParams(settings?: EventControlCenterSettings): string {
  if (!settings) return '';
  const params = new URLSearchParams({
    standAlertThresholds: stableStandAlertThresholdsParam(settings),
    stockAlertThreshold: String(settings.stockAlertThreshold),
  });
  return `?${params.toString()}`;
}

function stableStandAlertThresholdsParam(settings: EventControlCenterSettings): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(settings.standAlertThresholds)
        .sort(([leftStandId], [rightStandId]) => leftStandId.localeCompare(rightStandId))
        .map(([standId, thresholds]) => [
          standId,
          {
            queueLengthAlertThreshold: thresholds.queueLengthAlertThreshold,
            averageWaitAlertThresholdMinutes: thresholds.averageWaitAlertThresholdMinutes,
          },
        ]),
    ),
  );
}

export function eventControlCenterStreamPath(
  eventId: string,
  settings?: EventControlCenterSettings,
): string {
  return `/events/${eventId}/event-control-center/stream${eventControlCenterSettingsParams(settings)}`;
}

export function eventOrdersStreamPath(eventId: string, standId?: string): string {
  const params = standId ? `?standId=${encodeURIComponent(standId)}` : '';
  return `/events/${eventId}/event-control-center/orders/stream${params}`;
}

export function getEventControlCenter(
  eventId: string,
  settings?: EventControlCenterSettings,
): Promise<EventControlCenterData> {
  return apiFetch<EventControlCenterData>(
    `/events/${eventId}/event-control-center${eventControlCenterSettingsParams(settings)}`,
    {
      auth: 'organizer',
    },
  );
}

export function getEventOrders(eventId: string, standId?: string): Promise<LiveOrder[]> {
  const params = standId ? `?standId=${encodeURIComponent(standId)}` : '';
  return apiFetch<LiveOrder[]>(`/events/${eventId}/event-control-center/orders${params}`, {
    auth: 'organizer',
  });
}
