import { Navigate, useLocation, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
import { paths } from '@/paths';
import { computeTotal, type Order, type OrderItemView } from '@/types/order';

interface OrderConfirmedState {
  order: Order;
  items: OrderItemView[];
}

// Order data is passed via navigation state from Cart.tsx. A direct visit or
// refresh has nothing to hydrate from and bounces back to the cart.
export default function OrderConfirmed() {
  const { eventId } = useParams() as { eventId: string };
  const navigate = useNavigate();
  const { state } = useLocation() as { state: OrderConfirmedState | null };

  if (!state) return <Navigate to={paths.attendee.cart(eventId)} replace />;

  return (
    <div className="space-y-6">
      <OrderConfirmation
        order={state.order}
        items={state.items}
        total={computeTotal(state.order)}
        title="Order Confirmed"
        subtitle="Your order is in progress."
      />
      <Button
        className="w-full"
        onClick={() => navigate(paths.attendee.trackOrder(eventId, state.order._id))}
      >
        Track Order
      </Button>
    </div>
  );
}
