import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouteLoaderData, useSearchParams } from 'react-router';

import { buildAttendeeOrderViewItems, getAttendeeOrder } from '@/api/orders';
import { getAttendeeStands } from '@/api/stands';
import { XCircleIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { CashRefundNotice } from '@/features/orders/CashRefundNotice';
import { StandTrackGroup, type StandItem } from '@/features/orders/StandTrackGroup';
import { OrderReviewButton } from './OrderReviewButton';
import { useSSE } from '@/hooks/useSSE';
import { cn } from '@/lib/utils';
import { paths } from '@/paths';
import { computeTotal, type Order, type OrderItem } from '@/types/order';
import { formatMoney } from '@/types/product';
import type { Stand } from '@/types/stand';
import type { AttendeeLayoutLoaderData } from '../data';

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
  standsByName: Map<string, Stand>,
): Array<{ stand: Stand; items: StandItem[] }> {
  const groups = new Map<string, { stand: Stand; items: StandItem[] }>();

  for (const item of rawItems) {
    const info = viewLookup.get(item.productId);
    // buildAttendeeOrderViewItems excludes cancelled items from viewLookup (it
    // only tracks active-item quantities), so fall back to the productName/
    // standName the backend already enriched directly onto the order item, and
    // resolve the stand by name so cancelled items still merge into the same
    // card as that stand's active items.
    const fallbackStand = !info ? standsByName.get(item.standName) : undefined;
    const productName = info?.productName ?? item.productName;
    const standName = info?.standName ?? item.standName;

    const stand = info ? standsById.get(info.standId) : fallbackStand;
    // info.standId is either a real stand UUID or a synthetic "__paused__:<name>"
    // key, so it is always unique per stand and safe to use as the group key.
    const groupKey = info ? info.standId || UNAVAILABLE_STAND._id : (stand?._id ?? standName);
    const resolvedStand: Stand = stand ?? { ...UNAVAILABLE_STAND, standName };

    const existing = groups.get(groupKey);
    if (existing) {
      existing.items.push({ orderItem: item, productName });
    } else {
      groups.set(groupKey, {
        stand: resolvedStand,
        items: [{ orderItem: item, productName }],
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
  const [searchParams] = useSearchParams();
  const fromOrderHistory = searchParams.get('from') === 'orders';
  const backTo = fromOrderHistory ? paths.attendee.orders(eventId) : paths.attendee.event(eventId);
  const backLabel = fromOrderHistory ? 'Order history' : 'Shop';

  const [liveOrder, setLiveOrder] = useState<Order | null>(null);

  const { event } = useRouteLoaderData('attendee-event') as AttendeeLayoutLoaderData;

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
        <BackButton to={backTo}>{backLabel}</BackButton>
        <p className="rounded-xl bg-surface-muted p-4 text-center text-sm text-text-muted">
          Loading your order…
        </p>
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data || standsQuery.isError) {
    return (
      <div className="space-y-4">
        <BackButton to={backTo}>{backLabel}</BackButton>
        <p className="rounded-xl bg-surface-muted p-4 text-center text-sm text-text-muted">
          Could not load order. Please try again.
        </p>
      </div>
    );
  }

  const order = liveOrder ?? orderQuery.data!;
  const stands = standsById(standsQuery.data ?? []);
  const standsByStandName = standsByName(standsQuery.data ?? []);

  let standGroups: Array<{ stand: Stand; items: StandItem[] }> = [];
  if (viewItemsQuery.data) {
    const viewLookup = new Map(
      viewItemsQuery.data.map((v) => [
        v.productId,
        { productName: v.productName, standId: v.standId, standName: v.standName },
      ]),
    );
    standGroups = buildStandGroups(order.items, viewLookup, stands, standsByStandName);
  }

  const createdAt = new Date(order.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Cash orders have no tabId (only card payments run through a Stripe tab) —
  // once cash is paid at pickup, a cancelled item can only be refunded in
  // person at the cashier, so we point attendees back there.
  const isCashOrder = order.tabId === null;
  const hasCancelledItem = order.items.some((item) => item.cancelledAt);
  const showCashRefundNotice = isCashOrder && hasCancelledItem;
  const allItemsCancelled = order.items.length > 0 && order.items.every((item) => item.cancelledAt);

  return (
    <div className="space-y-4 pb-6">
      <BackButton to={backTo}>{backLabel}</BackButton>

      <p className="text-xs text-text-muted">Placed {createdAt}</p>

      {allItemsCancelled && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-danger/40 bg-danger/10 p-8 text-center">
          <XCircleIcon className="h-12 w-12 text-danger" />
          <h2 className="text-xl font-semibold text-text">Order Cancelled</h2>
          <p className="text-sm text-text-muted">All items in this order were cancelled.</p>
        </div>
      )}

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

      {!allItemsCancelled && <StatusOverview items={order.items} />}

      {showCashRefundNotice && <CashRefundNotice eventId={eventId} />}

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

      {standGroups.map(({ stand, items }) => (
        <StandTrackGroup key={stand._id} stand={stand} items={items} />
      ))}

      <div className="rounded-lg bg-surface border border-border p-4">
        <p className="text-sm font-semibold text-text mb-2">Payment Summary</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Total Amount</span>
          <span className="text-base font-bold text-accent-contrast">
            EUR {formatMoney(computeTotal(order))}
          </span>
        </div>
      </div>

      {/* Reviews require a fulfilled item (backend eligibility) — only surface the
          entry point once at least one item has been collected. */}
      {'ratingsEnabled' in event &&
        event.ratingsEnabled &&
        (() => {
          const rateableProductIds = [
            ...new Set(
              order.items.filter((i) => i.fulfilledAt && !i.cancelledAt).map((i) => i.productId),
            ),
          ];
          return rateableProductIds.length > 0 ? (
            <OrderReviewButton
              orderId={orderId}
              eventId={eventId}
              rateableProductIds={rateableProductIds}
            />
          ) : null;
        })()}
    </div>
  );
}

function standsById(stands: Stand[]): Map<string, Stand> {
  return new Map(stands.map((s) => [s._id, s]));
}

function standsByName(stands: Stand[]): Map<string, Stand> {
  return new Map(stands.map((s) => [s.standName, s]));
}
