import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { StarIcon } from '@/components/icons';
import { OrderConfirmation } from '@/features/orders/OrderConfirmation';
import { paths } from '@/paths';
import { computeTotal, type Order, type OrderItemView } from '@/types/order';

interface OrderConfirmedState {
  order: Order;
  items: OrderItemView[];
}

// Order data is passed via navigation state from Cart.tsx — there is no
// attendee-scoped "get order by id" endpoint yet (that lands with the
// separate Detailed Order View ticket), so a direct visit/refresh has nothing
// to hydrate from and bounces back to the cart.
export default function OrderConfirmed() {
  const { eventId } = useParams() as { eventId: string };
  const navigate = useNavigate();
  const { state } = useLocation() as { state: OrderConfirmedState | null };

  // TODO: Replace router state check with actual order.paidAt validation once
  // the backend payment module is fully integrated.
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
      <div className="space-y-2">
        <Button className="w-full" onClick={() => navigate(paths.attendee.orders(eventId))}>
          Track Order
        </Button>
        {/* Temporary dev entry-point — the real navigation comes from the order-history branch */}
        <Link
          to={paths.attendee.review(eventId, state.order._id)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface py-2 text-sm font-medium text-text hover:bg-surface-muted"
        >
          <StarIcon className="h-4 w-4 text-accent" filled />
          Rate your order
        </Link>
      </div>
    </div>
  );
}
