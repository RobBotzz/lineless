import { useMemo, useState } from 'react';

import type { LiveOrder } from '@/api/eventControlCenter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Stand } from '@/types/stand';
import { ChipFilter } from '../components/ChipFilter';
import { LiveOrdersTable } from './LiveOrdersTable';

export function LiveOrdersSection({
  liveOrders,
  onCancelOrder,
  onCancelOrderItems,
  stands,
}: {
  liveOrders: LiveOrder[];
  onCancelOrder: (orderId: string) => Promise<void>;
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
  stands: Stand[];
}) {
  const [liveOrdersStandId, setLiveOrdersStandId] = useState('all');
  const selectedLiveOrdersStand =
    liveOrdersStandId === 'all'
      ? null
      : (stands.find((stand) => stand._id === liveOrdersStandId) ?? null);
  const visibleOrders = useMemo(
    () =>
      liveOrdersStandId === 'all'
        ? liveOrders
        : liveOrders.filter((order) => order.standIds.includes(liveOrdersStandId)),
    [liveOrders, liveOrdersStandId],
  );

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <CardTitle className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            Live Orders {selectedLiveOrdersStand ? `- ${selectedLiveOrdersStand.standName}` : ''}
          </CardTitle>
          <div className="w-full space-y-3 lg:max-w-xl lg:justify-self-end">
            <ChipFilter
              ariaLabel="Live orders stand filter"
              label="Stands"
              options={stands.map((stand) => ({ label: stand.standName, value: stand._id }))}
              resetValue={liveOrdersStandId !== 'all' ? 'all' : undefined}
              selectedValue={liveOrdersStandId}
              onSelect={setLiveOrdersStandId}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <LiveOrdersTable
          orders={visibleOrders}
          pageResetKey={liveOrdersStandId}
          stands={stands}
          onCancelOrder={onCancelOrder}
          onCancelOrderItems={onCancelOrderItems}
        />
      </CardContent>
    </Card>
  );
}
