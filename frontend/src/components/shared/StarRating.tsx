import { useState } from 'react';

import { StarIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number; // 0 = unrated, 1–5 = rated
  onChange: (rating: number) => void;
  readOnly?: boolean;
  className?: string;
}

export function StarRating({ value, onChange, readOnly = false, className }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  const effective = hovered > 0 ? hovered : value;

  return (
    <div className={cn('flex gap-1', className)} role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          disabled={readOnly}
          className={cn(
            'text-warning transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
            !readOnly && 'cursor-pointer hover:scale-110',
            readOnly && 'cursor-default',
          )}
          onClick={() => !readOnly && onChange(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
        >
          <StarIcon className="h-7 w-7" filled={star <= effective} />
        </button>
      ))}
    </div>
  );
}
