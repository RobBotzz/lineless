import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { createReview } from '@/api/ratings';
import { ApiError } from '@/api/client';
import { BackButton } from '@/components/shared';
import { StarIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { paths } from '@/paths';

const MAX_COMMENT = 500;

export default function ReviewProduct() {
  const { eventId, orderId, productId } = useParams();
  const navigate = useNavigate();

  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordersPath = eventId ? paths.attendee.orders(eventId) : paths.home;

  async function handleSubmit() {
    if (!eventId || !orderId || !productId || stars === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReview(eventId, orderId, productId, {
        stars,
        comment: comment.trim() || null,
      });
      void navigate(ordersPath);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('You have already reviewed this product for this order.');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('This product cannot be reviewed.');
      } else {
        setError('Could not submit your review. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <BackButton to={ordersPath}>Back</BackButton>

      <h1 className="text-lg font-semibold text-text">Leave a review</h1>

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {Array.from({ length: 5 }, (_, i) => {
          const value = i + 1;
          const active = (hovered || stars) >= value;
          return (
            <button
              key={value}
              type="button"
              aria-label={`${value} star${value > 1 ? 's' : ''}`}
              aria-checked={stars === value}
              role="radio"
              onMouseEnter={() => setHovered(value)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setStars(value)}
              className="text-amber-400"
            >
              <StarIcon filled={active} className="h-8 w-8" />
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={MAX_COMMENT}
          rows={4}
          placeholder="Tell others what you thought (optional)"
          className="w-full rounded-lg border border-border bg-surface p-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <p className="text-right text-xs text-text-muted">
          {comment.length}/{MAX_COMMENT}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        className="w-full"
        disabled={stars === 0 || submitting}
        onClick={() => void handleSubmit()}
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </Button>
    </div>
  );
}
