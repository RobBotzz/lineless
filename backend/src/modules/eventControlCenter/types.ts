import { z } from "zod";

const alertThreshold = z.coerce.number().int().min(0);

export const eventControlCenterQuerySchema = z.object({
  queueLengthAlertThreshold: alertThreshold.default(10),
  averageWaitAlertThresholdMinutes: alertThreshold.default(15),
});

export const cancelOrderItemsSchema = z.object({
  itemIds: z.array(z.uuid()).min(1),
});

export type EventControlCenterQuery = z.infer<
  typeof eventControlCenterQuerySchema
>;
export type CancelOrderItemsInput = z.infer<typeof cancelOrderItemsSchema>;

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
