import { Navigate, useLocation, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { CashierLocationAccordion } from '@/features/orders/CashierLocationAccordion';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
import { paths } from '@/paths';
import { computeTotal, type Order, type OrderItemView } from '@/types/order';

interface PaymentPendingState {
  order: Order;
  items: OrderItemView[];
}

// Order data is passed via navigation state from Cart.tsx, same as
// OrderConfirmed — there is no attendee-scoped "get order by id" endpoint
// yet, so a direct visit/refresh has nothing to hydrate from and bounces
// back to the cart.
export default function PaymentPending() {
  const { eventId } = useParams() as { eventId: string };
  const navigate = useNavigate();
  const { state } = useLocation() as { state: PaymentPendingState | null };

  if (!state) return <Navigate to={paths.attendee.cart(eventId)} replace />;

  const isPaid = state.order.paidAt !== null;

  return (
    <div className="space-y-6">
      <OrderConfirmation
        order={state.order}
        items={state.items}
        total={computeTotal(state.order)}
        title={isPaid ? 'Order Confirmed' : 'Payment Pending'}
        subtitle={
          isPaid ? 'Your order is in progress.' : 'Please go to the cashier to pay for your order.'
        }
        variant={isPaid ? 'success' : 'pending'}
        afterMeta={isPaid ? undefined : <CashierLocationAccordion eventId={eventId} />}
      />
      {isPaid && (
        <Button className="w-full" onClick={() => navigate(paths.attendee.orders(eventId))}>
          Track Order
        </Button>
      )}
    </div>
  );
}
