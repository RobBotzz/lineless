import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { getEventPublicInfo } from '../../../api/events';
import { CartIcon, CreditCardIcon, InfoIcon, RefundIcon } from '../../../components/icons';
import { BackButton } from '../../../components/shared';
import { paths } from '../../../paths';
import { ChoiceCard } from './ChoiceCard';

// Cashier entry screen: choose between taking a manual order or collecting a
// cash payment for an existing order.
export default function CashierHome() {
  const { eventId } = useParams() as { eventId: string };

  // The "not active" hint only makes sense before the event is started. Once it
  // is ACTIVE the actions work, so hiding the banner avoids contradicting the UI.
  const eventInfoQuery = useQuery({
    queryKey: ['event-public-info', eventId],
    queryFn: () => getEventPublicInfo(eventId),
  });
  const showInactiveHint = eventInfoQuery.data ? eventInfoQuery.data.status !== 'ACTIVE' : false;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.root(eventId)}>Operator Console</BackButton>

      {showInactiveHint && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-text-muted">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Manual orders and cash payments can only be placed while the event is active. If the
            organizer has not started the event yet, these actions will be unavailable.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
        <ChoiceCard
          to={paths.operator.cashierRefund(eventId)}
          icon={<RefundIcon className="h-8 w-8" />}
          title="Cash Refund"
          description="Refund orders paid in cash"
        />
      </div>
    </div>
  );
}
