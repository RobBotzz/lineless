import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';

import { buildAttendeeOrderViewItems, getAttendeeOrder } from '@/api/orders';
import { getAttendeeStands } from '@/api/stands';
import { StarIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { StandTrackGroup, type StandItem } from '@/features/orders/StandTrackGroup';
import { useSSE } from '@/hooks/useSSE';
import { getItemStatus } from '@/lib/order-utils';
import { cn } from '@/lib/utils';
import { paths } from '@/paths';
import type { Order, OrderItem } from '@/types/order';
import type { Stand } from '@/types/stand';

// Shown when the stand for a paid item is no longer visible in the attendee
// catalog (e.g. the organizer paused the stand after the order was placed).
// The per-item status badges still work — they read from orderItem, not catalog data.
const UNAVAILABLE_STAND: Stand = {
  _id: '__unavailable__',
  eventId: '',
  standName: 'Stand unavailable',
  standType: 'PRODUCT',
  standStatus: 'PAUSED',
  requiresPassword: false,
  location: { locationName: null, xCoordinate: null, yCoordinate: null },
  createdAt: '',
  updatedAt: '',
};

function buildStandGroups(
  rawItems: OrderItem[],
  viewLookup: Map<string, { productName: string; standId: string; standName: string }>,
  standsById: Map<string, Stand>,
): Array<{ stand: Stand; items: StandItem[] }> {
  const groups = new Map<string, { stand: Stand; items: StandItem[] }>();

  for (const item of rawItems) {
    const info = viewLookup.get(item.productId);
    if (!info) continue;
    const stand = standsById.get(info.standId);
    // info.standId is either a real stand UUID or a synthetic "__paused__:<name>"
    // key, so it is always unique per stand and safe to use as the group key.
    const groupKey = info.standId || UNAVAILABLE_STAND._id;
    const resolvedStand: Stand = stand ?? {
      ...UNAVAILABLE_STAND,
      standName: info.standName ?? 'Stand unavailable',
    };

    const existing = groups.get(groupKey);
    if (existing) {
      existing.items.push({ orderItem: item, productName: info.productName });
    } else {
      groups.set(groupKey, {
        stand: resolvedStand,
        items: [{ orderItem: item, productName: info.productName }],
      });
    }
  }

  return [...groups.values()];
}

function StatusOverview({ items }: { items: OrderItem[] }) {
  const active = items.filter((i) => !i.cancelledAt);
  // readyAt is set once an item is ready, and stays set after it is collected —
  // so it doubles as "has reached the pickup line" for the progress bar.
  const ready = active.filter((i) => i.readyAt !== null);
  const allReady = active.length > 0 && ready.length === active.length;
  const allCollected = active.length > 0 && active.every((i) => i.fulfilledAt !== null);
  const progress = active.length > 0 ? (ready.length / active.length) * 100 : 0;

  if (active.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <p className="font-semibold text-text">Order cancelled</p>
      </div>
    );
  }

  const heading = allCollected
    ? 'Order collected'
    : allReady
      ? 'Ready for pickup!'
      : 'Preparing your order...';
  const isDone = allReady || allCollected;

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 shadow-sm transition-colors',
        isDone ? 'border-success/30 bg-success/10' : 'border-border bg-surface',
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text">{heading}</p>
        </div>
        {!isDone && (
          <p className="shrink-0 text-sm font-semibold tabular-nums text-text-muted">
            {ready.length} / {active.length} ready
          </p>
        )}
      </div>
      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={ready.length}
        aria-valuemin={0}
        aria-valuemax={active.length}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isDone ? 'bg-success' : 'bg-accent',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function TrackOrder() {
  const { eventId, orderId } = useParams() as { eventId: string; orderId: string };
  const navigate = useNavigate();

  const [liveOrder, setLiveOrder] = useState<Order | null>(null);

  const orderQuery = useQuery({
    queryKey: ['attendee-order', orderId, eventId],
    queryFn: () => getAttendeeOrder(orderId, eventId),
  });

  useSSE({
    path: '/orders/stream',
    auth: 'attendee',
    eventId,
    onMessage: ({ event, data }) => {
      if (event === 'snapshot') {
        const found = (data as Order[]).find((o) => o._id === orderId);
        if (found) setLiveOrder(found);
      } else if (event === 'order') {
        const updated = data as Order;
        if (updated._id === orderId) {
          setLiveOrder((prev) =>
            !prev || new Date(updated.updatedAt) >= new Date(prev.updatedAt) ? updated : prev,
          );
        }
      }
    },
  });

  const standsQuery = useQuery({
    queryKey: ['attendee-stands', eventId],
    queryFn: () => getAttendeeStands(eventId),
    staleTime: 60_000,
  });

  const viewItemsQuery = useQuery({
    queryKey: ['attendee-order-view', orderId, eventId],
    queryFn: () => buildAttendeeOrderViewItems(orderQuery.data!, eventId, standsQuery.data!),
    enabled: !!orderQuery.data && !!standsQuery.data,
    staleTime: 60_000,
  });

  if (orderQuery.isPending || standsQuery.isPending) {
    return (
      <div className="space-y-4">
        <BackButton to={paths.attendee.orders(eventId)}>Order history</BackButton>
        <p className="rounded-xl bg-surface-muted p-4 text-center text-sm text-text-muted">
          Loading your order…
        </p>
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data || standsQuery.isError) {
    return (
      <div className="space-y-4">
        <BackButton to={paths.attendee.orders(eventId)}>Order history</BackButton>
        <p className="rounded-xl bg-surface-muted p-4 text-center text-sm text-text-muted">
          Could not load order. Please try again.
        </p>
      </div>
    );
  }

  const order = liveOrder ?? orderQuery.data;
  const stands = standsById(standsQuery.data ?? []);

  let standGroups: Array<{ stand: Stand; items: StandItem[] }> = [];
  if (viewItemsQuery.data) {
    const viewLookup = new Map(
      viewItemsQuery.data.map((v) => [
        v.productId,
        { productName: v.productName, standId: v.standId, standName: v.standName },
      ]),
    );
    standGroups = buildStandGroups(order.items, viewLookup, stands);
  }

  const createdAt = new Date(order.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-4">
      <BackButton to={paths.attendee.orders(eventId)}>Order history</BackButton>

      <p className="text-xs text-text-muted">Placed {createdAt}</p>

      {/* Pickup ticket: order number + authentication code, shown at the stand */}
      <div className="overflow-hidden rounded-2xl bg-accent shadow-sm">
        <div className="flex items-stretch">
          <div className="flex-1 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-button-text/60">
              Order ID
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-button-text">
              {order.orderNumber}
            </p>
          </div>
          {/* Perforated divider for the ticket-stub look */}
          <div className="my-3 w-px shrink-0 border-l border-dashed border-button-text/30" />
          <div className="flex-1 p-4 text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-button-text/60">
              Pickup code
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-button-text">
              {order.pickupCode}
            </p>
          </div>
        </div>
        <p className="bg-accent-raised px-4 py-2 text-center text-xs text-button-text/80">
          Use your <strong>Order ID</strong> to identify your order and show the{' '}
          <strong>Pickup Code</strong> while collecting.
        </p>
      </div>

      <StatusOverview items={order.items} />

      {/* Items grouped by stand */}
      {viewItemsQuery.isFetching && (
        <p className="rounded-xl bg-surface-muted p-4 text-center text-sm text-text-muted">
          Loading stand details…
        </p>
      )}

      {viewItemsQuery.isError && (
        <p className="rounded-xl bg-surface-muted p-4 text-center text-sm text-text-muted">
          Could not load item details.
        </p>
      )}

      {standGroups
        .filter(({ items }) => items.some((si) => getItemStatus(si.orderItem) !== 'CANCELLED'))
        .map(({ stand, items }) => (
          <StandTrackGroup key={stand._id} stand={stand} items={items} />
        ))}

      {/* Reviews require a fulfilled item (backend eligibility) — only surface the
          entry point once at least one item has been collected. */}
      {order.items.some((i) => i.fulfilledAt && !i.cancelledAt) && (
        <Button
          className="w-full gap-2"
          onClick={() => navigate(paths.attendee.reviewOrder(eventId, orderId))}
        >
          <StarIcon className="h-4 w-4" />
          Leave a review
        </Button>
      )}
    </div>
  );
}

function standsById(stands: Stand[]): Map<string, Stand> {
  return new Map(stands.map((s) => [s._id, s]));
}
