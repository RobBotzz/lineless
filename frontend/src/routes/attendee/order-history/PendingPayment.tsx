import { useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';

import { getAttendeeEvent } from '@/api/events';
import {
  buildAttendeeOrderViewItems,
  getAttendeeOrder,
  groupOrderItemsForView,
} from '@/api/orders';
import { getAttendeeStands } from '@/api/stands';
import { BackButton } from '@/components/shared';
import { CashierLocationAccordion } from '@/features/orders/CashierLocationAccordion';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
import { useSSE } from '@/hooks/useSSE';
import { paths } from '@/paths';
import { computeTotal, isOrderCancelled, type Order, type OrderItemView } from '@/types/order';

// Durable cash-payment page. Unlike the card OrderConfirmed screen it does not
// rely on location.state — it fetches the order by id, so it survives refresh
// and is a valid target for the order-confirmation email. When the incoming
// navigation carries the freshly created order (from Cart) we use it as an
// instant placeholder while the fetch settles.
interface PendingPaymentState {
  order: Order;
  items: OrderItemView[];
}

export default function PendingPayment() {
  const { eventId, orderId } = useParams() as { eventId: string; orderId: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state } = useLocation() as { state: PendingPaymentState | null };

  const orderKey = ['attendee-order', orderId, eventId];

  const orderQuery = useQuery({
    queryKey: orderKey,
    queryFn: () => getAttendeeOrder(orderId, eventId),
    initialData: state?.order?._id === orderId ? state.order : undefined,
    // Poll fallback: if the SSE stream silently stalls (e.g. proxy buffering),
    // the payment/cancellation flip is still picked up. Stops once terminal so
    // it costs nothing after the order is paid or cancelled.
    refetchInterval: (query) => {
      const o = query.state.data as Order | undefined;
      return o && (o.paidAt || isOrderCancelled(o)) ? false : 4000;
    },
  });

  const standsQuery = useQuery({
    queryKey: ['attendee-stands', eventId],
    queryFn: () => getAttendeeStands(eventId),
    staleTime: 60_000,
  });

  // Cash can only be collected while the event is ACTIVE; once it is STOPPED or
  // COMPLETED the cashier can no longer take payment. Poll so the page flips from
  // the pay prompt to a terminal state if the event ends while it is open.
  const eventQuery = useQuery({
    queryKey: ['attendee-event', eventId],
    queryFn: () => getAttendeeEvent(eventId),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const viewItemsQuery = useQuery({
    queryKey: ['attendee-order-view', orderId, eventId],
    queryFn: () => buildAttendeeOrderViewItems(orderQuery.data!, eventId, standsQuery.data!),
    enabled: !!orderQuery.data && !!standsQuery.data,
    staleTime: 60_000,
  });

  // Live-detect the cashier confirming payment: when paidAt flips we hand off to
  // the shared OrderConfirmed screen (same as the card flow). SSE updates and the
  // poll fallback both write into the same query cache, so the freshest wins.
  useSSE({
    path: '/orders/stream',
    auth: 'attendee',
    eventId,
    onMessage: ({ event, data }) => {
      const apply = (updated: Order) => {
        if (updated._id !== orderId) return;
        queryClient.setQueryData<Order>(orderKey, (prev) =>
          !prev || new Date(updated.updatedAt) >= new Date(prev.updatedAt) ? updated : prev,
        );
      };
      if (event === 'snapshot') {
        const found = (data as Order[]).find((o) => o._id === orderId);
        if (found) apply(found);
      } else if (event === 'order') {
        apply(data as Order);
      }
    },
  });

  const order = orderQuery.data ?? null;
  // Prefer the fully-enriched view (live catalog names); fall back to the cart's
  // items, then to a pure grouping from the order's own backend-enriched items so
  // the summary is never empty even if the catalog fetch failed.
  const items = viewItemsQuery.data ?? state?.items ?? (order ? groupOrderItemsForView(order) : []);
  const isPaid = order?.paidAt != null;
  // STOPPED = paused (no new orders/payments, but the event isn't over yet);
  // COMPLETED = ended. Both close the cash window, but the wording differs.
  const eventStatus = eventQuery.data?.status;
  const paymentClosed = eventStatus === 'STOPPED' || eventStatus === 'COMPLETED';

  // Once paid, mirror the card flow: go to the OrderConfirmed "payment completed"
  // screen, from where the user taps "Track Order". OrderConfirmed trusts the
  // items passed in location.state, so we wait until the item view is resolved
  // (query settled, or the cart handed us items) before handing off — otherwise
  // a direct visit that pays before the view loads would show an empty summary.
  const itemsReady =
    viewItemsQuery.isSuccess || viewItemsQuery.isError || standsQuery.isError || !!state?.items;
  useEffect(() => {
    if (!order || !isPaid || !itemsReady) return;
    // A paid order that was then fully refunded has nothing to confirm — send it
    // straight to tracking instead of the "in progress" success screen, which
    // would be actively wrong for an order with nothing left to prepare.
    if (isOrderCancelled(order)) {
      navigate(paths.attendee.trackOrder(eventId, order._id), { replace: true });
      return;
    }
    const handoffItems = viewItemsQuery.data ?? state?.items ?? groupOrderItemsForView(order);
    navigate(paths.attendee.checkoutConfirmed(eventId, order._id), {
      replace: true,
      state: { order, items: handoffItems },
    });
  }, [order, isPaid, itemsReady, viewItemsQuery.data, state?.items, eventId, navigate]);

  // Only block on the initial load when there is no order to show yet. When the
  // cart handed us the order (initialData) it renders instantly — stands and the
  // item view load in the background instead of gating the whole page.
  if (!order && (orderQuery.isPending || standsQuery.isPending || eventQuery.isPending)) {
    return (
      <div className="space-y-4">
        <BackButton to={paths.attendee.orders(eventId)}>Order history</BackButton>
        <p className="rounded-xl bg-surface-muted p-4 text-center text-sm text-text-muted">
          Loading your order…
        </p>
      </div>
    );
  }

  // Not found, or the order belongs to a different attendee session (e.g. the
  // email link opened on another device). Show a graceful dead-end, not a bounce
  // back to the cart.
  if (orderQuery.isError || !order) {
    return (
      <div className="space-y-4">
        <BackButton to={paths.attendee.orders(eventId)}>Order history</BackButton>
        <p className="rounded-xl bg-surface-muted p-4 text-center text-sm text-text-muted">
          We couldn't find this order. It may belong to a different device.
        </p>
      </div>
    );
  }

  if (isPaid) return null; // redirecting to the tracking or confirmed page

  // The order can no longer be paid: the cashier soft-deleted it, or every item
  // was cancelled (e.g. the event was completed). Show a terminal cancelled state
  // instead of the pay prompt — otherwise it would read "Payment Pending" with a
  // €0.00 total for an order there is nothing left to pay for. Checked after
  // isPaid so an already-paid, later fully-refunded order (also caught by
  // isOrderCancelled) never shows "cancelled ... can no longer be paid" — it was
  // paid, and the redirect above sends it to tracking instead.
  if (isOrderCancelled(order)) {
    return (
      <div className="space-y-4">
        <BackButton to={paths.attendee.orders(eventId)}>Order history</BackButton>
        <OrderConfirmation
          order={order}
          items={items}
          total={computeTotal(order)}
          title="Order Cancelled"
          subtitle="This order was cancelled and can no longer be paid."
          variant="cancelled"
        />
      </div>
    );
  }

  // The event ended while the order was still unpaid. The cashier can no longer
  // collect cash (the backend blocks it once the event leaves ACTIVE), and the
  // order is cancelled when the organizer finalizes the event — so show a
  // terminal state instead of a pay prompt that can no longer be fulfilled.
  if (paymentClosed) {
    return (
      <div className="space-y-4">
        <BackButton to={paths.attendee.orders(eventId)}>Order history</BackButton>
        <OrderConfirmation
          order={order}
          items={items}
          total={computeTotal(order)}
          title="Payment No Longer Possible"
          subtitle={
            eventStatus === 'COMPLETED'
              ? 'The event has ended, so this order can no longer be paid at the cashier.'
              : 'The event has stopped, so this order can no longer be paid at the cashier.'
          }
          variant="cancelled"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackButton to={paths.attendee.orders(eventId)}>Order history</BackButton>
      <OrderConfirmation
        order={order}
        items={items}
        total={computeTotal(order)}
        title="Payment Pending"
        subtitle="Please go to the cashier to pay for your order."
        variant="pending"
        afterMeta={<CashierLocationAccordion eventId={eventId} />}
      />
    </div>
  );
}
