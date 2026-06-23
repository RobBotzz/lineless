import { z } from "zod";

const alertThreshold = z.coerce.number().int().min(0);
const standAlertThresholdSchema = z.object({
  queueLengthAlertThreshold: alertThreshold.default(10),
  averageWaitAlertThresholdMinutes: alertThreshold.default(15),
});

const standAlertThresholdsQuerySchema = z.preprocess((value) => {
  if (value === undefined) return {};
  if (Array.isArray(value)) value = value[0];
  if (typeof value !== "string") return value;

  try {
    const parsed: unknown = JSON.parse(value);
    return parsed;
  } catch {
    return value;
  }
}, z.record(z.uuid(), standAlertThresholdSchema).default({}));

export const eventControlCenterQuerySchema = z.object({
  standAlertThresholds: standAlertThresholdsQuerySchema,
  stockAlertThreshold: alertThreshold.default(5),
});

export const liveOrdersQuerySchema = z.object({
  standId: z.uuid().optional(),
});

export type EventControlCenterQuery = z.infer<
  typeof eventControlCenterQuerySchema
>;
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
