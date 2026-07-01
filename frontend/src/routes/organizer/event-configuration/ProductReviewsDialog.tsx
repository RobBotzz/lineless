import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { listRatings } from '@/api/ratings';
import { StarIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

interface ProductReviewsDialogProps {
  productId: string;
  productName: string;
  eventId: string;
  onClose: () => void;
}

export function ProductReviewsDialog({
  productId,
  productName,
  eventId,
  onClose,
}: ProductReviewsDialogProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const reviewsQuery = useQuery({
    queryKey: ['organizer', 'ratings', productId, eventId],
    queryFn: () => listRatings(productId, eventId, { limit: 50 }),
  });

  const reviews = reviewsQuery.data?.reviews ?? [];
  const total = reviewsQuery.data?.total ?? 0;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-labelledby="reviews-dialog-title"
        aria-modal="true"
        role="dialog"
        className="flex w-full max-w-md flex-col rounded-xl border border-border bg-surface shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <h2
            id="reviews-dialog-title"
            className="text-base font-semibold text-text [overflow-wrap:anywhere]"
          >
            Reviews — {productName}
          </h2>
          {!reviewsQuery.isPending && (
            <p className="mt-0.5 text-sm text-text-muted">
              {total} review{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {reviewsQuery.isPending && (
            <p className="py-8 text-center text-sm text-text-muted">Loading…</p>
          )}

          {reviewsQuery.isError && (
            <p className="px-5 py-4 text-sm text-danger">Could not load reviews.</p>
          )}

          {reviewsQuery.isSuccess && reviews.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">No reviews yet.</p>
          )}

          {reviews.map((review) => (
            <div key={review._id} className="border-b border-border px-5 py-3 last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      className={`h-4 w-4 ${star <= review.stars ? 'text-warning' : 'text-border'}`}
                      filled={star <= review.stars}
                    />
                  ))}
                </span>
                <span className="text-xs text-text-muted">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              {review.comment && <p className="mt-1 text-sm text-text">{review.comment}</p>}
            </div>
          ))}
        </div>

        <div className="border-t border-border px-5 py-4">
          <Button className="w-full" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </section>
    </div>
  );
}
