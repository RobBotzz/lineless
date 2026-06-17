import { apiFetch } from './client';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';

export type RevenuePoint = {
  elapsedMinutes: number;
  intervalRevenueCents: number;
  orderCount: number;
  revenueCents: number;
};

export type StandRevenueSeries = {
  standId: string;
  points: RevenuePoint[];
};

export type StandQueueMetric = {
  standId: string;
  queueLength: number;
  averageWaitMinutes: number;
  alert: boolean;
};

export type EventControlCenterData = {
  totalRevenueCents: number;
  activeGuests: number;
  activeAlertCount: number;
  eventRevenue: RevenuePoint[];
  standRevenue: StandRevenueSeries[];
  standQueues: StandQueueMetric[];
};

export type StandAlertThreshold = {
  queueLengthAlertThreshold: number;
  averageWaitAlertThresholdMinutes: number;
};

export type EventControlCenterSettings = {
  standAlertThresholds: Record<string, StandAlertThreshold>;
};

export type LiveOrderStatus = 'IN_LINE' | 'PREPARING' | 'READY';

export type LiveOrderItem = {
  itemId: string;
  productId: string;
  productName: string;
  status: LiveOrderStatus;
  readyAt: string | null;
  customerComment: string | null;
  unitPriceIncludingTax: number;
};

export type LiveOrder = {
  _id: string;
  eventId: string;
  orderNumber: string;
  pickupCode: string;
  customerEmail: string | null;
  status: LiveOrderStatus;
  standIds: string[];
  createdAt: string;
  paidAt: string | null;
  items: LiveOrderItem[];
  totalPriceIncludingTax: number;
};

export const EVENT_CONTROL_CENTER_STREAM_EVENT = 'control-center';
export const EVENT_ORDERS_STREAM_EVENT = 'orders';

function eventControlCenterSettingsParams(settings?: EventControlCenterSettings): string {
  return settings
    ? `?standAlertThresholds=${encodeURIComponent(JSON.stringify(settings.standAlertThresholds))}`
    : '';
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

export function pauseProduct(productId: string): Promise<Product> {
  return apiFetch<Product>(`/products/${productId}/pause`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function resumeProduct(productId: string): Promise<Product> {
  return apiFetch<Product>(`/products/${productId}/resume`, {
    method: 'POST',
    auth: 'organizer',
  });
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
