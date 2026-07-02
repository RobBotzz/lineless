import { Outlet, useParams } from 'react-router';
import { skipToken, useQuery } from '@tanstack/react-query';

import { loginOperator } from '@/api/stands';
import { getOperatorStandToken } from '@/auth/keychain';
import { operatorCashierStandQueryOptions, operatorQueryKeys } from '../operatorQueries';

// Context handed to every cashier page: the event and the CASHIER stand the
// cashier acts as (its operator token is resolved/ensured here, once).
export interface CashierContext {
  eventId: string;
  standId: string;
}

// Wraps the /cashier routes. The "Cashier" tile only navigates here; this layout
// resolves the event's CASHIER stand via its dedicated endpoint (it's excluded
// from the stand list) and ensures an operator token for it (the stand has no
// password), so child pages can make operator-auth calls.
export default function CashierLayout() {
  const { eventId } = useParams() as { eventId: string };

  const cashierStandQuery = useQuery(operatorCashierStandQueryOptions(eventId));
  const cashierStand = cashierStandQuery.data;

  const sessionQuery = useQuery({
    queryKey: [...operatorQueryKeys.all, 'cashier-session', cashierStand?._id ?? ''],
    queryFn: cashierStand
      ? async () => {
          if (!getOperatorStandToken(cashierStand._id)) await loginOperator(cashierStand._id);
          return cashierStand._id;
        }
      : skipToken,
  });

  if (cashierStandQuery.isPending || (cashierStand && sessionQuery.isPending)) {
    return <Centered>Opening cashier stand…</Centered>;
  }

  if (cashierStandQuery.isError || !cashierStand) {
    return (
      <Centered>
        Cashier is not available for this event. Reopen the operator link and try again.
      </Centered>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return <Centered>Could not open the cashier stand. Please try again.</Centered>;
  }

  return <Outlet context={{ eventId, standId: sessionQuery.data } satisfies CashierContext} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <p className="mt-10 text-center text-sm text-text-muted">{children}</p>
    </div>
  );
}
