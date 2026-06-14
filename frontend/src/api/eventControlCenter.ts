import { apiFetch } from './client';

export type RevenuePoint = {
  elapsedMinutes: number;
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
  maxBottleneckStandId: string | null;
  eventRevenue: RevenuePoint[];
  standRevenue: StandRevenueSeries[];
  standQueues: StandQueueMetric[];
};

export type LiveOrderStatus = 'IN_LINE' | 'PREPARING' | 'READY';

export type LiveOrderItem = {
  itemId: string;
  productId: string;
  productName: string;
  status: LiveOrderStatus;
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

export function getEventControlCenter(eventId: string): Promise<EventControlCenterData> {
  return apiFetch<EventControlCenterData>(`/events/${eventId}/event-control-center`, {
    auth: 'organizer',
  });
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

export function pauseProduct(eventId: string, standId: string, productId: string): Promise<void> {
  return apiFetch<void>(
    `/events/${eventId}/event-control-center/stands/${standId}/products/${productId}/pause`,
    {
      method: 'POST',
      auth: 'organizer',
    },
  );
}

export function resumeProduct(eventId: string, standId: string, productId: string): Promise<void> {
  return apiFetch<void>(
    `/events/${eventId}/event-control-center/stands/${standId}/products/${productId}/resume`,
    {
      method: 'POST',
      auth: 'organizer',
    },
  );
}
