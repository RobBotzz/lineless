import type { ProductStatus } from './product';

export type RevenuePoint = {
  elapsedMinutes: number;
  intervalRevenueCents: number;
  orderCount: number;
  revenueCents: number;
};

export type RevenueProductBreakdown = {
  productId: string;
  productName: string;
  quantitySold: number;
  revenueCents: number;
};

export type StandRevenuePoint = RevenuePoint & {
  products: RevenueProductBreakdown[];
};

export type StandRevenueSeries = {
  standId: string;
  points: StandRevenuePoint[];
};

export type StandQueueMetric = {
  standId: string;
  queueLength: number;
  averageWaitMinutes: number;
  alert: boolean;
};

export type ProductRating = {
  _id: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  standId: string;
  standName: string;
  stars: number;
  comment: string | null;
  createdAt: string;
};

export type ProductStockAlert = {
  productId: string;
  productName: string;
  standId: string;
  standName: string;
  productStock: number;
  stockAlertThreshold: number;
  productStatus: Exclude<ProductStatus, 'TERMINATED'>;
};

export type EventControlCenterData = {
  totalRevenueCents: number;
  activeGuests: number;
  activeAlertCount: number;
  eventRevenue: RevenuePoint[];
  standRevenue: StandRevenueSeries[];
  standQueues: StandQueueMetric[];
  productStockAlerts: ProductStockAlert[];
  productRatings: ProductRating[];
};

export type StandAlertThreshold = {
  queueLengthAlertThreshold: number;
  averageWaitAlertThresholdMinutes: number;
};

export type EventControlCenterSettings = {
  standAlertThresholds: Record<string, StandAlertThreshold>;
  stockAlertThreshold: number;
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

export function isEventControlCenterData(value: unknown): value is EventControlCenterData {
  if (!isRecord(value)) return false;

  return (
    typeof value.totalRevenueCents === 'number' &&
    typeof value.activeGuests === 'number' &&
    typeof value.activeAlertCount === 'number' &&
    Array.isArray(value.eventRevenue) &&
    value.eventRevenue.every(isRevenuePoint) &&
    Array.isArray(value.standRevenue) &&
    value.standRevenue.every(isStandRevenueSeries) &&
    Array.isArray(value.standQueues) &&
    Array.isArray(value.productStockAlerts) &&
    Array.isArray(value.productRatings)
  );
}

export function isLiveOrderArray(value: unknown): value is LiveOrder[] {
  return Array.isArray(value) && value.every(isLiveOrder);
}

function isLiveOrder(value: unknown): value is LiveOrder {
  if (!isRecord(value)) return false;

  return (
    typeof value._id === 'string' &&
    typeof value.eventId === 'string' &&
    typeof value.orderNumber === 'string' &&
    typeof value.pickupCode === 'string' &&
    isLiveOrderStatus(value.status) &&
    Array.isArray(value.standIds) &&
    value.standIds.every((standId) => typeof standId === 'string') &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(isLiveOrderItem) &&
    typeof value.totalPriceIncludingTax === 'number'
  );
}

function isLiveOrderItem(value: unknown): value is LiveOrderItem {
  if (!isRecord(value)) return false;

  return (
    typeof value.itemId === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.productName === 'string' &&
    isLiveOrderStatus(value.status) &&
    (typeof value.readyAt === 'string' || value.readyAt === null) &&
    (typeof value.customerComment === 'string' || value.customerComment === null) &&
    typeof value.unitPriceIncludingTax === 'number'
  );
}

function isLiveOrderStatus(value: unknown): value is LiveOrderStatus {
  return value === 'IN_LINE' || value === 'PREPARING' || value === 'READY';
}

function isStandRevenueSeries(value: unknown): value is StandRevenueSeries {
  return (
    isRecord(value) &&
    typeof value.standId === 'string' &&
    Array.isArray(value.points) &&
    value.points.every(isStandRevenuePoint)
  );
}

function isRevenuePoint(value: unknown): value is RevenuePoint {
  return (
    isRecord(value) &&
    typeof value.elapsedMinutes === 'number' &&
    typeof value.revenueCents === 'number' &&
    typeof value.intervalRevenueCents === 'number' &&
    typeof value.orderCount === 'number'
  );
}

function isStandRevenuePoint(value: unknown): value is StandRevenuePoint {
  return (
    isRecord(value) &&
    typeof value.elapsedMinutes === 'number' &&
    typeof value.revenueCents === 'number' &&
    typeof value.intervalRevenueCents === 'number' &&
    typeof value.orderCount === 'number' &&
    Array.isArray(value.products) &&
    value.products.every(isRevenueProductBreakdown)
  );
}

function isRevenueProductBreakdown(value: unknown): value is RevenueProductBreakdown {
  return (
    isRecord(value) &&
    typeof value.productId === 'string' &&
    typeof value.productName === 'string' &&
    typeof value.quantitySold === 'number' &&
    typeof value.revenueCents === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
