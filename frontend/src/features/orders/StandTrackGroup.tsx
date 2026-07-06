import { useState } from 'react';

import { ChevronDownIcon, CommentIcon, PinIcon, StandIcon } from '@/components/icons';
import { StaticLocationMap } from '@/components/location/StaticLocationMap';
import { cn } from '@/lib/utils';
import { getItemStatus, type ItemStatus } from '@/lib/order-utils';
import { toLatLng } from '@/types/location';
import type { OrderItem } from '@/types/order';
import type { Stand } from '@/types/stand';

export interface StandItem {
  orderItem: OrderItem;
  productName: string;
}

interface StandTrackGroupProps {
  stand: Stand;
  items: StandItem[];
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  PENDING: 'Pending',
  PREPARING: 'Preparing',
  READY: 'Ready',
  FULFILLED: 'Collected',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

// Display order within a stand: actionable (ready) first, cancelled/refunded last.
const STATUS_ORDER: Record<ItemStatus, number> = {
  READY: 0,
  PREPARING: 1,
  PENDING: 2,
  FULFILLED: 3,
  CANCELLED: 4,
  REFUNDED: 5,
};

// Each status maps to a badge style plus a leading dot color (currentColor).
// REFUNDED shares FULFILLED's muted style — once refunded, nothing is still
// owed, so it no longer reads as an outstanding/alarming state like CANCELLED.
const STATUS_CLASS: Record<ItemStatus, string> = {
  PENDING: 'bg-surface-muted text-text-muted',
  PREPARING: 'bg-warning/10 text-warning',
  READY: 'bg-success/10 text-success',
  FULFILLED: 'bg-surface-muted text-text-muted',
  CANCELLED: 'bg-danger/10 text-danger',
  REFUNDED: 'bg-surface-muted text-text-muted',
};

function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        STATUS_CLASS[status],
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full bg-current',
          status === 'PREPARING' && 'animate-pulse',
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function StandItemRow({ si, idx }: { si: StandItem; idx: number }) {
  const [commentOpen, setCommentOpen] = useState(false);
  const status = getItemStatus(si.orderItem);
  const hasComment = !!si.orderItem.customerComment?.trim();

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 text-xs font-semibold tabular-nums text-text-muted">
            {idx + 1}
          </span>
          <p
            className={cn(
              'min-w-0 text-sm font-medium text-text [overflow-wrap:anywhere]',
              (status === 'CANCELLED' || status === 'REFUNDED') && 'text-text-muted line-through',
            )}
          >
            {si.productName}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      {hasComment && (
        <>
          <button
            type="button"
            onClick={() => setCommentOpen((o) => !o)}
            aria-expanded={commentOpen}
            className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted transition-colors hover:text-text"
          >
            <CommentIcon className="h-4 w-4" />
            <span>Item comment</span>
            <ChevronDownIcon
              className={cn('h-4 w-4 transition-transform', commentOpen && 'rotate-180')}
            />
          </button>
          {commentOpen && (
            <p className="mt-1 rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-muted [overflow-wrap:anywhere]">
              {si.orderItem.customerComment}
            </p>
          )}
        </>
      )}
    </li>
  );
}

export function StandTrackGroup({ stand, items }: StandTrackGroupProps) {
  const [mapOpen, setMapOpen] = useState(false);
  const latLng = toLatLng(stand.location);
  const activeCount = items.filter((si) => {
    const status = getItemStatus(si.orderItem);
    return status !== 'CANCELLED' && status !== 'REFUNDED';
  }).length;
  const sortedItems = [...items].sort(
    (a, b) => STATUS_ORDER[getItemStatus(a.orderItem)] - STATUS_ORDER[getItemStatus(b.orderItem)],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-contrast">
          <StandIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 font-semibold text-text [overflow-wrap:anywhere]">
          {stand.standName}
        </span>
        <span className="shrink-0 text-xs text-text-muted">
          {activeCount === 0 && items.length > 0
            ? 'Cancelled'
            : `${activeCount} ${activeCount === 1 ? 'item' : 'items'}`}
        </span>
      </div>

      {latLng && (
        <div className="border-b border-border">
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-text transition-colors hover:bg-surface-muted"
            onClick={() => setMapOpen((o) => !o)}
            aria-expanded={mapOpen}
            type="button"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <PinIcon className="h-4 w-4 shrink-0 text-accent-contrast" />
              <span className="truncate">{stand.location.locationName || 'View location'}</span>
            </span>
            <ChevronDownIcon
              className={cn('shrink-0 transition-transform duration-200', mapOpen && 'rotate-180')}
            />
          </button>
          {mapOpen && (
            <div className="px-4 pb-4">
              <StaticLocationMap
                lat={latLng[0]}
                lng={latLng[1]}
                className="h-44 w-full overflow-hidden rounded-lg"
              />
            </div>
          )}
        </div>
      )}

      <ul className="divide-y divide-border">
        {sortedItems.map((si, idx) => (
          <StandItemRow key={si.orderItem._id} si={si} idx={idx} />
        ))}
      </ul>
    </div>
  );
}
