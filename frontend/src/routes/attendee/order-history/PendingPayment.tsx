import { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';

import { getAttendeeEvent } from '@/api/events';
import { buildAttendeeOrderViewItems, getAttendeeOrder } from '@/api/orders';
import { getAttendeeStands } from '@/api/stands';
import { BackButton } from '@/components/shared';
import { CashierLocationAccordion } from '@/features/orders/CashierLocationAccordion';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
import { useSSE } from '@/hooks/useSSE';
import { paths } from '@/paths';
import { computeTotal, type Order, type OrderItemView } from '@/types/order';

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
  const { state } = useLocation() as { state: PendingPaymentState | null };

  const [liveOrder, setLiveOrder] = useState<Order | null>(null);

  const orderQuery = useQuery({
    queryKey: ['attendee-order', orderId, eventId],
    queryFn: () => getAttendeeOrder(orderId, eventId),
    initialData: state?.order._id === orderId ? state.order : undefined,
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
  // the shared OrderConfirmed screen (same as the card flow).
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

  const order = liveOrder ?? orderQuery.data ?? null;
  const items = viewItemsQuery.data ?? state?.items ?? [];
  const isPaid = order?.paidAt != null;
  // STOPPED = paused (no new orders/payments, but the event isn't over yet);
  // COMPLETED = ended. Both close the cash window, but the wording differs.
  const eventStatus = eventQuery.data?.status;
  const paymentClosed = eventStatus === 'STOPPED' || eventStatus === 'COMPLETED';

  // Once paid, mirror the card flow: go to the OrderConfirmed "payment completed"
  // screen, from where the user taps "Track Order". We pass the order + items we
  // already have so that page paints without needing its own fetch.
  useEffect(() => {
    if (order && isPaid) {
      navigate(paths.attendee.checkoutConfirmed(eventId, order._id), {
        replace: true,
        state: { order, items },
      });
    }
    // items is derived from the same queries as order; guarding on order/isPaid
    // is enough and avoids re-firing on every view-item refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, isPaid, eventId, navigate]);

  if (orderQuery.isPending || standsQuery.isPending || eventQuery.isPending) {
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

  // The cashier cancelled (soft-deleted) the unpaid order. It can no longer be
  // paid, so we show a terminal cancelled state instead of the pay prompt.
  if (order.deletedAt) {
    return (
      <div className="space-y-4">
        <BackButton to={paths.attendee.orders(eventId)}>Order history</BackButton>
        <OrderConfirmation
          order={order}
          items={items}
          total={computeTotal(order)}
          title="Order Cancelled"
          subtitle="This order was cancelled at the cashier and can no longer be paid."
          variant="cancelled"
        />
      </div>
    );
  }

  if (isPaid) return null; // redirecting to the confirmed page

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
