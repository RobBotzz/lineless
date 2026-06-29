import { useParams } from 'react-router';

import { CartIcon, CreditCardIcon, RefundIcon } from '../../../components/icons';
import { BackButton } from '../../../components/shared';
import { paths } from '../../../paths';
import { ChoiceCard } from './ChoiceCard';

// Cashier entry screen: choose between taking a manual order or collecting a
// cash payment for an existing order.
export default function CashierHome() {
  const { eventId } = useParams() as { eventId: string };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.root(eventId)}>Operator Console</BackButton>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <ChoiceCard
          to={paths.operator.cashierOrder(eventId)}
          icon={<CartIcon className="h-8 w-8" />}
          title="Manual Order"
          description="Take orders for customers"
        />
        <ChoiceCard
          to={paths.operator.cashierPayment(eventId)}
          icon={<CreditCardIcon className="h-8 w-8" />}
          title="Cash Payment"
          description="Confirm cash payments for orders"
        />
        {/* Placeholder for an upcoming feature — intentionally not linked. */}
        <ChoiceCard
          icon={<RefundIcon className="h-8 w-8" />}
          title="Cash Refund"
          description="Refund orders paid in cash"
        />
      </div>
    </div>
  );
}
