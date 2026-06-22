import { apiFetch } from './client';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';
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
    standAlertThresholds: JSON.stringify(settings.standAlertThresholds),
    stockAlertThreshold: String(settings.stockAlertThreshold),
  });
  return `?${params.toString()}`;
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

export function cancelOrder(eventId: string, orderId: string): Promise<unknown> {
  return apiFetch<unknown>(`/events/${eventId}/event-control-center/orders/${orderId}/cancel`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function cancelOrderItems(
  eventId: string,
  orderId: string,
  itemIds: string[],
): Promise<unknown> {
  return apiFetch<unknown>(
    `/events/${eventId}/event-control-center/orders/${orderId}/items/cancel`,
    {
      method: 'POST',
      auth: 'organizer',
      body: JSON.stringify({ itemIds }),
    },
  );
}

export function pauseProduct(
  eventId: string,
  standId: string,
  productId: string,
): Promise<Product> {
  return apiFetch<Product>(
    `/events/${eventId}/event-control-center/stands/${standId}/products/${productId}/pause`,
    {
      method: 'POST',
      auth: 'organizer',
    },
  );
}

export function resumeProduct(
  eventId: string,
  standId: string,
  productId: string,
): Promise<Product> {
  return apiFetch<Product>(
    `/events/${eventId}/event-control-center/stands/${standId}/products/${productId}/resume`,
    {
      method: 'POST',
      auth: 'organizer',
    },
  );
}

export function updateProductStock(
  eventId: string,
  standId: string,
  productId: string,
  productStock: number,
): Promise<Product> {
  return apiFetch<Product>(
    `/events/${eventId}/event-control-center/stands/${standId}/products/${productId}/stock`,
    {
      method: 'PATCH',
      auth: 'organizer',
      body: JSON.stringify({ productStock }),
    },
  );
}

export function pauseStand(eventId: string, standId: string): Promise<Stand> {
  return apiFetch<Stand>(`/events/${eventId}/event-control-center/stands/${standId}/pause`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function resumeStand(eventId: string, standId: string): Promise<Stand> {
  return apiFetch<Stand>(`/events/${eventId}/event-control-center/stands/${standId}/resume`, {
    method: 'POST',
    auth: 'organizer',
  });
}
