import { useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { paths } from '@/paths';

//import { useCart } from './cart-context';

export default function Cart() {
  const { eventId } = useParams();
  //const { items, totalCount, totalCents } = useCart();

  return (
    <div className="space-y-4">
      <BackButton to={eventId ? paths.attendee.event(eventId) : paths.home}>Back</BackButton>

      <h1 className="text-lg font-semibold text-text">Shopping Cart</h1>
      <>
        <p className="rounded-lg bg-surface-muted p-3 text-center text-s text-text-muted">
          Checkout & Cart is not implemented yet.
        </p>
      </>
    </div>
  );
}
