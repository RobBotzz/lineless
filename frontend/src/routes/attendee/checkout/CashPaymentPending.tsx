import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { CashierLocationAccordion } from '@/features/orders/CashierLocationAccordion';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
import { paths } from '@/paths';
import { computeTotal, type Order, type OrderItemView } from '@/types/order';

interface CashPaymentPendingState {
  order: Order;
  items: OrderItemView[];
}

// Order data is passed via navigation state from Cart.tsx, same as
// OrderConfirmed — there is no attendee-scoped "get order by id" endpoint
// yet, so a direct visit/refresh has nothing to hydrate from and bounces
// back to the cart.
export default function CashPaymentPending() {
  const { eventId } = useParams() as { eventId: string };
  const navigate = useNavigate();
  const { state } = useLocation() as { state: CashPaymentPendingState | null };

  const isPaid = state?.order.paidAt != null;

  // Once the cash payment is fulfilled the order is confirmed — hand off to the
  // shared OrderConfirmed page. This won't fire today (a freshly created cash
  // order is always unpaid and there is no refresh hydration), but the skeleton
  // is ready for the payments ticket that adds order polling.
  useEffect(() => {
    if (state && isPaid) {
      navigate(paths.attendee.trackOrder(eventId, state.order._id), {
        replace: true,
        state,
      });
    }
  }, [state, isPaid, eventId, navigate]);

  if (!state) return <Navigate to={paths.attendee.cart(eventId)} replace />;
  if (isPaid) return null; // redirecting to the confirmed page

  return (
    <div className="space-y-6">
      <BackButton to={paths.attendee.event(eventId)}>Shop</BackButton>
      <OrderConfirmation
        order={state.order}
        items={state.items}
        total={computeTotal(state.order)}
        title="Payment Pending"
        subtitle="Please go to the cashier to pay for your order."
        variant="pending"
        afterMeta={<CashierLocationAccordion eventId={eventId} />}
      />
    </div>
  );
}
