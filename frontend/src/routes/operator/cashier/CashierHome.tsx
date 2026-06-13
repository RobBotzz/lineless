import { useParams } from 'react-router';

import { CartIcon, CreditCardIcon } from '../../../components/icons';
import { BackButton } from '../../../components/shared';
import { paths } from '../../../paths';
import { ChoiceCard } from './ChoiceCard';

// Fallback so the flow is reachable even without an event in the URL.
const FALLBACK_EVENT_ID = 'demo-event';

// Cashier entry screen: choose between taking a manual order or collecting a
// cash payment for an existing order.
export default function CashierHome() {
  const { eventId = FALLBACK_EVENT_ID } = useParams();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.root(eventId)}>Stand Selection</BackButton>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <ChoiceCard
          to={paths.operator.cashierOrder(eventId)}
          icon={<CartIcon className="h-8 w-8" />}
          title="Manual Order"
          description="Take order for customers"
        />
        <ChoiceCard
          to={paths.operator.cashierPayment(eventId)}
          icon={<CreditCardIcon className="h-8 w-8" />}
          title="Cash Payment"
          description="Pay existing order"
        />
      </div>
    </div>
  );
}
