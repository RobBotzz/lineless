import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { CashierLocationAccordion } from '@/features/orders/CashierLocationAccordion';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
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
// /orders/:id/cash-payment, which sets paidAt). It only *observes*: it polls the
// order until paidAt is set, then forwards the guest to order tracking. (Polling
// rather than the order SSE stream is a deliberate project-wide decision.)
const PAYMENT_POLL_MS = 4000;

export default function CashPaymentPending() {
  const { eventId, orderId } = useParams() as { eventId: string; orderId: string };
  const navigate = useNavigate();
  const { state } = useLocation() as { state: CashPaymentPendingState | null };

  // Source of truth for paidAt. Polls until the cashier confirms, then stops.
  // Always enabled (even with nav state): the handed-over order is always unpaid,
  // so only the server can tell us when it becomes paid. Nav state still renders
  // immediately, so there is no loading flash on the happy path.
  const orderQuery = useQuery({
    queryKey: ['attendee-order', orderId, eventId],
    queryFn: () => getAttendeeOrder(orderId, eventId),
    refetchInterval: (query) => (query.state.data?.paidAt ? false : PAYMENT_POLL_MS),
  });

  // Display items: rebuilt from the server only when there is no nav state
  // (refresh / direct visit); otherwise the nav-state items are used as-is.
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

  const order: Order | null = orderQuery.data ?? state?.order ?? null;
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
