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
});

export const liveOrdersQuerySchema = z.object({
  standId: z.uuid().optional(),
});

export const cancelOrderItemsSchema = z.object({
  itemIds: z.array(z.uuid()).min(1),
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
}

export interface RevenuePoint {
  elapsedMinutes: number;
  intervalRevenueCents: number;
  orderCount: number;
  revenueCents: number;
}

export interface StandRevenueSeries {
  standId: string;
  points: RevenuePoint[];
}

export interface StandQueueMetric {
  standId: string;
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
