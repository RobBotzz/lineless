import { useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';

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
  const queryClient = useQueryClient();
  const { state } = useLocation() as { state: PendingPaymentState | null };

  const orderKey = ['attendee-order', orderId, eventId];

  const orderQuery = useQuery({
    queryKey: orderKey,
    queryFn: () => getAttendeeOrder(orderId, eventId),
    initialData: state?.order._id === orderId ? state.order : undefined,
    // Poll fallback: if the SSE stream silently stalls (e.g. proxy buffering),
    // the payment/cancellation flip is still picked up. Stops once terminal so
    // it costs nothing after the order is paid or cancelled.
    refetchInterval: (query) => {
      const o = query.state.data as Order | undefined;
      return o && (o.paidAt || o.deletedAt) ? false : 4000;
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
  const items = viewItemsQuery.data ?? state?.items ?? [];
  const isPaid = order?.paidAt != null;

  // Once paid, mirror the card flow: go to the OrderConfirmed "payment completed"
  // screen, from where the user taps "Track Order". OrderConfirmed trusts the
  // items passed in location.state, so we wait until the item view is resolved
  // (query settled, or the cart handed us items) before handing off — otherwise
  // a direct visit that pays before the view loads would show an empty summary.
  const itemsReady = viewItemsQuery.isSuccess || viewItemsQuery.isError || !!state?.items;
  useEffect(() => {
    if (!order || !isPaid || !itemsReady) return;
    const handoffItems = viewItemsQuery.data ?? state?.items ?? [];
    navigate(paths.attendee.checkoutConfirmed(eventId, order._id), {
      replace: true,
      state: { order, items: handoffItems },
    });
  }, [order, isPaid, itemsReady, viewItemsQuery.data, state?.items, eventId, navigate]);

  // Only block on the initial load when there is no order to show yet. When the
  // cart handed us the order (initialData) it renders instantly — stands and the
  // item view load in the background instead of gating the whole page.
  if (!order && orderQuery.isPending) {
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
