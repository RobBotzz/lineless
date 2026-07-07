import { Link } from 'react-router';

import { InfoIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import { paths } from '@/paths';

// Shown on the manual-order and cash-payment pages when the event is STOPPED.
// Those actions require an ACTIVE event (the backend rejects them), so we block
// the surface up front and point the operator back to the still-available
// refund flow.
export function CashierEventPausedNotice({ eventId, action }: { eventId: string; action: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.cashier(eventId)}>Cashier Stand</BackButton>

      <section className="mt-6 rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted text-text-muted">
          <InfoIcon className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-text">The event is paused</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
          {action} is unavailable while the event is stopped. No new orders or cash payments can be
          taken. Cash refunds are still available.
        </p>
        <Link
          className={`mt-6 ${buttonVariants({ size: 'lg' })}`}
          to={paths.operator.cashierRefund(eventId)}
        >
          Go to Cash Refund
        </Link>
      </section>
    </div>
  );
}
