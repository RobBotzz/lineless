import { useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { paths } from '@/paths';

// TODO: Placeholder for the attendee's order history. Orders are tied to a sessionId
// (httpOnly session cookie via POST /users/session) which is not provided yet,
// so there is no data source to list past orders. Build out once sessions land.
export default function OrderHistory() {
  const { eventId } = useParams();

  return (
    <div className="space-y-4">
      <BackButton to={eventId ? paths.attendee.event(eventId) : paths.home}>Back</BackButton>

      <h1 className="text-lg font-semibold text-text">Order History</h1>

      <p className="rounded-lg bg-surface-muted p-4 text-center text-sm text-text-muted">
        Order history is not available yet — it requires an attendee session, which is not wired up
        at the moment.
      </p>
    </div>
  );
}
