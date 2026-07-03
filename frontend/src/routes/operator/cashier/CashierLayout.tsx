import { Navigate, Outlet, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { getOperatorStandToken } from '@/auth/keychain';
import { paths } from '@/paths';
import { operatorCashierStandQueryOptions } from '../operatorQueries';

// Context handed to every cashier page: the event and the CASHIER stand the
// cashier acts as.
export interface CashierContext {
  eventId: string;
  standId: string;
}

export default function CashierLayout() {
  const { eventId } = useParams() as { eventId: string };

  const cashierStandQuery = useQuery(operatorCashierStandQueryOptions(eventId));
  const cashierStand = cashierStandQuery.data;

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

  return <Outlet context={{ eventId, standId: cashierStand._id } satisfies CashierContext} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <p className="mt-10 text-center text-sm text-text-muted">{children}</p>
    </div>
  );
}
