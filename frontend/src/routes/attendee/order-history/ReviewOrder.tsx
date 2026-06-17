import { useParams } from 'react-router';

import { StarIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { paths } from '@/paths';

export default function ReviewOrder() {
  const { eventId, orderId } = useParams() as { eventId: string; orderId: string };

  return (
    <div className="space-y-4">
      <BackButton to={paths.attendee.trackOrder(eventId, orderId)}>Back</BackButton>

      <div className="flex items-center gap-2">
        <StarIcon className="h-5 w-5 text-amber-400" />
        <h1 className="text-lg font-semibold text-text">Leave a review</h1>
      </div>

      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-text-muted shadow-sm">
        Rating your items will be available here soon.
      </p>
    </div>
  );
}
