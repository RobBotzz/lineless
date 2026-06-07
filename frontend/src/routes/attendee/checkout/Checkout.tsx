import { useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { paths } from '@/paths';

// Placeholder: payment method selection and order placement land here next.
export default function Checkout() {
  const { eventId } = useParams();

  return (
    <div className="space-y-4">
      <BackButton to={eventId ? paths.attendee.cart(eventId) : paths.home}>Back</BackButton>

      <h1 className="text-lg font-semibold text-text">Checkout</h1>
      <p className="rounded-lg bg-surface-muted p-3 text-center text-sm text-text-muted">
        Payment method selection is not implemented yet.
      </p>
    </div>
  );
}
