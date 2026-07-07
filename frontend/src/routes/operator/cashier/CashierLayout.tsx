import { Navigate, Outlet, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { getOperatorEvent } from '@/api/events';
import { getOperatorStandToken } from '@/auth/keychain';
import { paths } from '@/paths';
import type { EventStatus } from '@/types/event';
import { operatorCashierStandQueryOptions, operatorQueryKeys } from '../operatorQueries';

// Context handed to every cashier page: the event and the CASHIER stand the
// cashier acts as.
export interface CashierContext {
  eventId: string;
  standId: string;
  ratingsEnabled: boolean;
  // Undefined until the event query resolves. Order/payment pages gate on this
  // (a STOPPED event takes no new orders or payments — only refunds).
  eventStatus: EventStatus | undefined;
}

export default function CashierLayout() {
  const { eventId } = useParams() as { eventId: string };

  const cashierStandQuery = useQuery(operatorCashierStandQueryOptions(eventId));
  const cashierStand = cashierStandQuery.data;

  // Drives whether product ratings are shown in the cashier catalog. Non-blocking:
  // if it hasn't resolved (or fails), ratings stay hidden.
  const eventQuery = useQuery({
    queryKey: [...operatorQueryKeys.all, 'cashier-event', eventId],
    queryFn: () => getOperatorEvent(eventId),
    staleTime: 60_000,
  });

  if (cashierStandQuery.isPending) {
    return <Centered>Opening cashier stand…</Centered>;
  }

  if (cashierStandQuery.isError || !cashierStand) {
    return (
      <Centered>
        Cashier is not available for this event. Reopen the operator link and try again.
      </Centered>
    );
  }

  if (!getOperatorStandToken(cashierStand._id)) {
    return <Navigate to={paths.operator.root(eventId)} replace />;
  }

  return (
    <Outlet
      context={
        {
          eventId,
          standId: cashierStand._id,
          ratingsEnabled: eventQuery.data?.ratingsEnabled ?? false,
          eventStatus: eventQuery.data?.status,
        } satisfies CashierContext
      }
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <p className="mt-10 text-center text-sm text-text-muted">{children}</p>
    </div>
  );
}
