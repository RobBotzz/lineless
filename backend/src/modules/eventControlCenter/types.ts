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
