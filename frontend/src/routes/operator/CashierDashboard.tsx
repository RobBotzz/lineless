import { useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { CashierIcon } from '@/components/icons';
import { paths } from '@/paths';

export default function CashierDashboard() {
  const { eventId } = useParams();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <BackButton to={eventId ? paths.operator.root(eventId) : paths.operator.index}>
          Back
        </BackButton>

        <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <CashierIcon className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-text">Cashier</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            Cashier access is reserved from the stand selection flow. Manual orders and cash payment
            controls will appear here once the backend cashier endpoints are available.
          </p>
        </section>
      </div>
    </div>
  );
}
