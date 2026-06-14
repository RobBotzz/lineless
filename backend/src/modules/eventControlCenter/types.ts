import { z } from "zod";

const alertThreshold = z.coerce.number().int().min(0);

export const eventControlCenterQuerySchema = z.object({
  queueLengthAlertThreshold: alertThreshold.default(10),
  averageWaitAlertThresholdMinutes: alertThreshold.default(15),
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

export interface RevenuePoint {
  elapsedMinutes: number;
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

export interface EventControlCenterData {
  totalRevenueCents: number;
  activeGuests: number;
  maxBottleneckStandId: string | null;
  eventRevenue: RevenuePoint[];
  standRevenue: StandRevenueSeries[];
  standQueues: StandQueueMetric[];
}

export type LiveOrderStatus = "IN_LINE" | "PREPARING" | "READY";

export interface LiveOrderItem {
  itemId: string;
  productId: string;
  productName: string;
  status: LiveOrderStatus;
  customerComment: string | null;
  unitPriceIncludingTax: number;
}

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
