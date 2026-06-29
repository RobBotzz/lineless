import { z } from "zod";

export const DEFAULT_STOCK_ALERT_THRESHOLD = 5;
export const DEFAULT_QUEUE_LENGTH_ALERT_THRESHOLD = 10;
export const DEFAULT_AVERAGE_WAIT_ALERT_THRESHOLD_MINUTES = 15;

const alertThreshold = z.number().int().min(0);
const standAlertThresholdSchema = z.object({
  queueLengthAlertThreshold: alertThreshold,
  averageWaitAlertThresholdMinutes: alertThreshold,
});

export const eventControlCenterSettingsSchema = z.object({
  standAlertThresholds: z.record(z.uuid(), standAlertThresholdSchema),
  stockAlertThreshold: alertThreshold,
});

export const liveOrdersQuerySchema = z.object({
  standId: z.uuid().optional(),
});

export type EventControlCenterSettings = z.infer<
  typeof eventControlCenterSettingsSchema
>;
export type StandAlertThreshold =
  EventControlCenterSettings["standAlertThresholds"][string];
export type LiveOrdersQuery = z.infer<typeof liveOrdersQuerySchema>;

export interface EventControlCenterData {
  totalRevenueCents: number;
  activeGuests: number;
  activeAlertCount: number;
  eventRevenue: RevenuePoint[];
  standRevenue: StandRevenueSeries[];
  standQueues: StandQueueMetric[];
  productStockAlerts: ProductStockAlert[];
  productRatings: ProductRating[];
}

export interface ProductStockAlert {
  productId: string;
  productName: string;
  standId: string;
  standName: string;
  productStock: number;
  stockAlertThreshold: number;
  productStatus: "LIVE" | "PAUSED";
}

export interface ProductRating {
  _id: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  standId: string;
  standName: string;
  stars: number;
  comment: string | null;
  createdAt: Date;
}

export interface RevenuePoint {
  elapsedMinutes: number;
  intervalRevenueCents: number;
  orderCount: number;
  revenueCents: number;
}

export interface StandRevenueSeries {
  standId: string;
  standName: string;
  standStatus: "LIVE" | "PAUSED";
  points: RevenuePoint[];
}

export interface StandQueueMetric {
  standId: string;
  standName: string;
  standStatus: "LIVE" | "PAUSED";
  queueLength: number;
  averageWaitMinutes: number;
  alert: boolean;
}

export type LiveOrderStatus = "IN_LINE" | "PREPARING" | "READY";

export interface LiveOrder {
  _id: string;
  eventId: string;
  orderNumber: string;
  pickupCode: string;
  customerEmail: string | null;
  status: LiveOrderStatus;
  standIds: string[];
  createdAt: Date;
  paidAt: Date | null;
  items: LiveOrderItem[];
  totalPriceIncludingTax: number;
}

export interface LiveOrderItem {
  itemId: string;
  productId: string;
  productName: string;
  status: LiveOrderStatus;
  readyAt: Date | null;
  customerComment: string | null;
  unitPriceIncludingTax: number;
}
