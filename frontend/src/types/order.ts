// Mirrors the backend orders module (src/modules/orders/model.ts). Dates arrive
// as ISO strings over JSON.
export interface OrderItem {
  _id: string;
  productId: string;
  customerComment: string | null;
  startedAt: string | null;
  readyAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  priceIncludingTaxAtPurchase: number;
  taxRateAtPurchase: number;
}

export interface Order {
  _id: string;
  eventId: string;
  tabId: string | null;
  sessionId: string | null;
  orderNumber: string;
  pickupCode: string;
  customerEmail: string | null;
  paidAt: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}
