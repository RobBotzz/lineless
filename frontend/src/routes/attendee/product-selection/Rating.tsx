import { StarIcon } from '@/components/icons';

interface RatingProps {
  value: number | null;
  className?: string;
}

// Shows the star rating, or a muted "no rating yet" state when there is none.
export function Rating({ value, className = '' }: RatingProps) {
  if (value === null) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-text-muted ${className}`}>
        <StarIcon filled={false} className="h-3.5 w-3.5" />
        No rating yet
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium text-text ${className}`}>
      <StarIcon className="h-3.5 w-3.5 text-amber-400" />
      {value.toFixed(1)}
    </span>
  );
}
