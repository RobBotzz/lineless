import { StarRating } from '@/components/shared';

interface RatingProps {
  value: number | null;
  className?: string;
}

// Shows the star rating, or a muted "no rating yet" state when there is none.
export function Rating({ value, className = '' }: RatingProps) {
  return <StarRating rating={value} className={className} />;
}
