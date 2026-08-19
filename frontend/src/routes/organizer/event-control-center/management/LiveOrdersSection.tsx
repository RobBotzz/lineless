import { useMemo, useState } from 'react';

import type { LiveOrder } from '@/api/eventControlCenter';
import { SearchIcon, XIcon } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Stand } from '@/types/stand';
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
  const [search, setSearch] = useState('');
  const searchQuery = search.trim().toLowerCase().replace(/^#/, '');
  const visibleOrders = useMemo(() => {
    if (!searchQuery) return liveOrders;

    return liveOrders.filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(searchQuery) ||
        order.pickupCode.toLowerCase().includes(searchQuery),
    );
  }, [liveOrders, searchQuery]);

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="min-w-0 flex-1 [overflow-wrap:anywhere]">Live Orders</CardTitle>
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              aria-label="Search live orders by order number or pickup code"
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-9 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent [&::-webkit-search-cancel-button]:appearance-none"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order or pickup code"
              type="search"
              value={search}
            />
            {search ? (
              <button
                aria-label="Clear order search"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => setSearch('')}
                type="button"
              >
                <XIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <LiveOrdersTable
          emptyMessage={
            searchQuery
              ? `No live orders match "${search.trim()}".`
              : 'Paid orders with open items will appear here.'
          }
          emptyTitle={searchQuery ? 'No matching orders' : 'No live orders'}
          orders={visibleOrders}
          pageResetKey={searchQuery}
          stands={stands}
          onCancelOrder={onCancelOrder}
          onCancelOrderItems={onCancelOrderItems}
        />
      </CardContent>
    </Card>
  );
}
