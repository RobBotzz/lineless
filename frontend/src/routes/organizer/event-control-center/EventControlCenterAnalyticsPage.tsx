import { useMemo } from 'react';

import type { EventControlCenterData } from '@/api/eventControlCenter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney, type Product } from '@/types/product';
import type { Stand } from '@/types/stand';
import { QueueStandPerformance } from './analytics/QueueStandPerformance';
import { RevenueChart } from './analytics/RevenueChart/RevenueChart';
import { ProductRatingsSection } from './analytics/ProductRatingsSection';
import { StockAlertsSection } from './analytics/StockAlertsSection';
import { LivePulseMetric } from './components/LivePulseMetric';

export function EventControlCenterAnalyticsPage({
  analytics,
  eventStartAt,
  productsByStand,
  stands,
}: {
  analytics: EventControlCenterData;
  eventStartAt: string;
  productsByStand: Record<string, Product[]>;
  stands: Stand[];
}) {
  const standNameById = useMemo(
    () => new Map(stands.map((stand) => [stand._id, stand.standName])),
    [stands],
  );
  const productStockAlerts = analytics.productStockAlerts ?? [];
  const activeAlertCount =
    analytics.activeAlertCount ??
    analytics.standQueues.filter((queue) => queue.alert).length + productStockAlerts.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <LivePulseMetric
          label="Total Revenue"
          value={`EUR ${formatMoney(analytics.totalRevenueCents)}`}
          tone="success"
          detail="Cumulative paid revenue"
        />
        <LivePulseMetric
          label="Active Guests"
          value={analytics.activeGuests.toString()}
          tone="accent"
          detail="Live session count"
        />
        <LivePulseMetric
          alert={activeAlertCount > 0}
          label="Active Alerts"
          value={activeAlertCount.toString()}
          tone={activeAlertCount > 0 ? 'danger' : 'neutral'}
          detail={
            activeAlertCount === 0
              ? 'No active alerts'
              : activeAlertCount === 1
                ? '1 operational alert needs attention'
                : `${activeAlertCount} operational alerts need attention`
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event-Wide Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart
            eventStartAt={eventStartAt}
            totalRevenueCents={analytics.totalRevenueCents}
            points={analytics.eventRevenue}
            standNameById={standNameById}
            standRevenue={analytics.standRevenue}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Queue & Stand Performance</CardTitle>
            <p className="mt-2 text-sm text-text-muted">
              Queue depth and average wait time by booth.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <QueueStandPerformance
            standNameById={standNameById}
            standQueues={analytics.standQueues}
            stands={stands}
          />
        </CardContent>
      </Card>

      <StockAlertsSection productStockAlerts={productStockAlerts} />

      <ProductRatingsSection
        productsByStand={productsByStand}
        productRatings={analytics.productRatings}
        stands={stands}
      />
    </div>
  );
}
