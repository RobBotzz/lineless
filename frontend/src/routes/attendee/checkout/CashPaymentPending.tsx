import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { CashierLocationAccordion } from '@/features/orders/CashierLocationAccordion';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
import { useSSE } from '@/hooks/useSSE';
import { buildAttendeeOrderViewItems, getAttendeeOrder } from '@/api/orders';
import { getAttendeeStands } from '@/api/stands';
import { paths } from '@/paths';
import { computeTotal, type Order, type OrderItemView } from '@/types/order';

interface CashPaymentPendingState {
  order: Order;
  items: OrderItemView[];
}

// The guest landed here after placing a cash order; the order is unpaid until an
// operator at the cashier collects the money and confirms it. This page never
// confirms anything itself — confirmation is operator-only (POST
// /orders/:id/cash-payment, which sets paidAt). It only *observes*: the attendee
// /orders/stream forwards an order the moment its paidAt is set, so once the
// cashier confirms, the guest is forwarded to order tracking automatically.
export default function CashPaymentPending() {
  const { eventId, orderId } = useParams() as { eventId: string; orderId: string };
  const navigate = useNavigate();
  const { state } = useLocation() as { state: CashPaymentPendingState | null };

  // Live order pushed by the stream once it becomes paid (read-only signal).
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);

  // Hydrate from the server when there is no nav state (refresh / direct visit),
  // so the page no longer bounces to the cart on reload.
  const orderQuery = useQuery({
    queryKey: ['attendee-order', orderId, eventId],
    queryFn: () => getAttendeeOrder(orderId, eventId),
    enabled: !state,
  });

  const standsQuery = useQuery({
    queryKey: ['attendee-stands', eventId],
    queryFn: () => getAttendeeStands(eventId),
    enabled: !state,
    staleTime: 60_000,
  });

  const viewItemsQuery = useQuery({
    queryKey: ['attendee-order-view', orderId, eventId],
    queryFn: () => buildAttendeeOrderViewItems(orderQuery.data!, eventId, standsQuery.data!),
    enabled: !state && !!orderQuery.data && !!standsQuery.data,
    staleTime: 60_000,
  });

  useSSE({
    path: '/orders/stream',
    auth: 'attendee',
    eventId,
    onMessage: ({ event, data }) => {
      // The attendee stream only emits orders that are already paid, so any frame
      // matching this order means the cashier has confirmed payment.
      if (event === 'snapshot') {
        const found = (data as Order[]).find((o) => o._id === orderId);
        if (found) setLiveOrder(found);
      } else if (event === 'order') {
        const updated = data as Order;
        if (updated._id === orderId) setLiveOrder(updated);
      }
    },
  });

  const order: Order | null = liveOrder ?? state?.order ?? orderQuery.data ?? null;
  const isPaid = order?.paidAt != null;

  // Cashier confirmed → hand off to the shared order-tracking page.
  useEffect(() => {
    if (order && isPaid) {
      navigate(paths.attendee.trackOrder(eventId, order._id), { replace: true });
    }
  }, [order, isPaid, eventId, navigate]);

  // No nav state and the order could not be loaded — nothing to show.
  if (!state && (orderQuery.isError || (orderQuery.isSuccess && !orderQuery.data))) {
    return <Navigate to={paths.attendee.cart(eventId)} replace />;
  }

  if (!order) {
    return <p className="mt-10 text-center text-sm text-text-muted">Loading your order…</p>;
  }

  if (isPaid) return null; // redirecting to the tracking page

  const items = state?.items ?? viewItemsQuery.data ?? [];

  return (
    <div className="space-y-6">
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
