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

export type EventAnalytics = {
  totalRevenueCents: number;
  activeGuests: number;
  maxBottleneckStandId: string | null;
  eventRevenue: RevenuePoint[];
  standRevenue: StandRevenueSeries[];
  standQueues: StandQueueMetric[];
};

export type LiveOrderStatus = 'IN_LINE' | 'PREPARING' | 'READY';

export type LiveOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceIncludingTax: number;
};

export type LiveOrder = {
  _id: string;
  eventId: string;
  standId: string;
  orderNumber: string;
  status: LiveOrderStatus;
  createdAt: string;
  items: LiveOrderItem[];
  totalPriceIncludingTax: number;
};

export type CancellationReasonPreset =
  | 'CUSTOMER_CHANGE_OF_MIND'
  | 'PRODUCT_OUT_OF_STOCK'
  | 'DUPLICATE_ORDER'
  | 'OPERATOR_ERROR'
  | 'OTHER';

export type CancelOrderInput =
  | {
      mode: 'FULL';
      reasonPreset: CancellationReasonPreset;
      customReason?: string;
    }
  | {
      mode: 'PARTIAL';
      itemProductIds: string[];
      reasonPreset: CancellationReasonPreset;
      customReason?: string;
    };

export function getEventAnalytics(eventId: string): Promise<EventAnalytics> {
  // TODO backend: implement GET /events/:eventId/analytics.
  // It must return total revenue, active guests, max bottleneck stand,
  // event revenue timeline, stand revenue timelines, queue lengths,
  // average wait times, and alert states for organizer-owned events.
  return apiFetch<EventAnalytics>(`/events/${eventId}/analytics`, { auth: 'organizer' });
}

export function getEventOrders(eventId: string, standId?: string): Promise<LiveOrder[]> {
  // TODO backend: implement GET /events/:eventId/orders?standId=...
  // It must return active orders grouped/filterable by stand with status,
  // created time, line items, quantities, and prices.
  const params = standId ? `?standId=${encodeURIComponent(standId)}` : '';
  return apiFetch<LiveOrder[]>(`/events/${eventId}/orders${params}`, { auth: 'organizer' });
}

export function cancelOrder(orderId: string, payload: CancelOrderInput): Promise<LiveOrder> {
  // TODO backend: implement POST /orders/:orderId/cancel.
  // It must support full cancellation, partial item cancellation, preset
  // reason, custom reason, and return the updated order state.
  return apiFetch<LiveOrder>(`/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: 'organizer',
  });
}

export function pauseStand(standId: string): Promise<void> {
  // TODO backend: implement POST /stands/:standId/pause.
  // It must block incoming attendee orders for the stand and expose the
  // temporary closed state to attendee menus in real time.
  return apiFetch<void>(`/stands/${standId}/pause`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function resumeStand(standId: string): Promise<void> {
  // TODO backend: implement POST /stands/:standId/resume.
  // It must reopen incoming attendee orders for the stand and clear the
  // temporary closed state from attendee menus.
  return apiFetch<void>(`/stands/${standId}/resume`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function pauseProduct(productId: string): Promise<void> {
  // TODO backend: complete POST /products/:productId/pause.
  // The route exists but currently returns 501. It must transition products
  // from LIVE to PAUSED and hide or disable them in attendee ordering.
  return apiFetch<void>(`/products/${productId}/pause`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function resumeProduct(productId: string): Promise<void> {
  // TODO backend: implement POST /products/:productId/resume.
  // It must transition PAUSED products back to LIVE and make them available
  // in attendee ordering when the parent stand is open.
  return apiFetch<void>(`/products/${productId}/resume`, {
    method: 'POST',
    auth: 'organizer',
  });
}
