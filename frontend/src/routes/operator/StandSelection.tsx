import { useParams } from 'react-router';

import { StandIcon } from '../../components/icons';
import { paths } from '../../paths';
import { ChoiceCard } from './cashier/ChoiceCard';

// Fallback so the flow is reachable even without an event in the URL.
const FALLBACK_EVENT_ID = 'demo-event';

// Operator stand selection. Minimal for now — exposes the Cashier Stand entry.
// Real per-event stands will be listed here once cashier-scoped auth exists.
export default function StandSelection() {
  const { eventId = FALLBACK_EVENT_ID } = useParams();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <ChoiceCard
          to={paths.operator.cashier(eventId)}
          icon={<StandIcon className="h-8 w-8" />}
          title="Cashier Stand"
          description="Take orders and cash payments"
        />
      </div>
    </div>
  );
}
