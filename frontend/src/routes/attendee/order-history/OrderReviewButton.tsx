import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { getMyOrderRatings } from '@/api/ratings';
import { StarIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { paths } from '@/paths';

interface Props {
  orderId: string;
  eventId: string;
  rateableProductIds: string[];
}

export function OrderReviewButton({ orderId, eventId, rateableProductIds }: Props) {
  const { data } = useQuery({
    queryKey: ['attendee', 'order', orderId, 'ratings'],
    queryFn: () => getMyOrderRatings(orderId, eventId),
    enabled: rateableProductIds.length > 0,
  });

  const ratedIds = new Set(data?.ratings.map((r) => r.productId) ?? []);
  const allRated =
    rateableProductIds.length > 0 && rateableProductIds.every((id) => ratedIds.has(id));

  return (
    <Link to={paths.attendee.reviewOrder(eventId, orderId)} className="mt-2 block">
      <Button
        variant="default"
        className="w-full h-12 rounded-xl gap-2 shadow-[0_8px_24px_rgba(2,8,135,0.25)]"
      >
        <StarIcon className="h-4 w-4" />
        {allRated ? 'Show review' : 'Leave a review'}
      </Button>
    </Link>
  );
}
