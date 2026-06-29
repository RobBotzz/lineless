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

export function eventControlCenterStreamPath(eventId: string): string {
  return `/events/${eventId}/event-control-center/stream`;
}

export function eventOrdersStreamPath(eventId: string, standId?: string): string {
  const params = standId ? `?standId=${encodeURIComponent(standId)}` : '';
  return `/events/${eventId}/event-control-center/orders/stream${params}`;
}

export function getEventControlCenter(eventId: string): Promise<EventControlCenterData> {
  return apiFetch<EventControlCenterData>(`/events/${eventId}/event-control-center`, {
    auth: 'organizer',
  });
}

export function getEventControlCenterSettings(
  eventId: string,
): Promise<EventControlCenterSettings> {
  return apiFetch<EventControlCenterSettings>(`/events/${eventId}/event-control-center/settings`, {
    auth: 'organizer',
  });
}

export function updateEventControlCenterSettings(
  eventId: string,
  settings: EventControlCenterSettings,
): Promise<EventControlCenterSettings> {
  return apiFetch<EventControlCenterSettings>(`/events/${eventId}/event-control-center/settings`, {
    auth: 'organizer',
    body: JSON.stringify(settings),
    method: 'PUT',
  });
}

export function resetEventControlCenterSettings(
  eventId: string,
): Promise<EventControlCenterSettings> {
  return apiFetch<EventControlCenterSettings>(`/events/${eventId}/event-control-center/settings`, {
    auth: 'organizer',
    method: 'DELETE',
  });
}

export function getEventOrders(eventId: string, standId?: string): Promise<LiveOrder[]> {
  const params = standId ? `?standId=${encodeURIComponent(standId)}` : '';
  return apiFetch<LiveOrder[]>(`/events/${eventId}/event-control-center/orders${params}`, {
    auth: 'organizer',
  });
}
