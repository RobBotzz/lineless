import { useEffect, useState } from 'react';

import { getProductReviews } from '@/api/ratings';
import { StarIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { Review } from '@/types/rating';

const PAGE_SIZE = 10;

function StarRow({ stars }: { stars: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400" aria-label={`${stars} stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} filled={i < stars} className="h-3.5 w-3.5" />
      ))}
    </span>
  );
}

// Anonymous, paginated reviews for a product. Fetches the first page on mount and
// appends further pages on demand ("Load more").
export function ProductReviews({ eventId, productId }: { eventId: string; productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const page = await getProductReviews(eventId, productId, { limit: PAGE_SIZE, skip: 0 });
        if (!active) return;
        setReviews(page.reviews);
        setTotal(page.total);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [eventId, productId]);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await getProductReviews(eventId, productId, {
        limit: PAGE_SIZE,
        skip: reviews.length,
      });
      setReviews((prev) => [...prev, ...page.reviews]);
      setTotal(page.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return <p className="mt-4 text-sm text-text-muted">Reviews could not be loaded.</p>;
  }

  if (!loading && reviews.length === 0) {
    return <p className="mt-4 text-sm text-text-muted">No reviews yet.</p>;
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-text">Reviews</h3>
      <ul className="space-y-3">
        {reviews.map((review) => (
          <li key={review._id} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <StarRow stars={review.stars} />
              <span className="text-xs text-text-muted">
                {new Date(review.createdAt).toLocaleDateString()}
              </span>
            </div>
            {review.comment && <p className="text-sm text-text">{review.comment}</p>}
          </li>
        ))}
      </ul>
      {reviews.length < total && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={loading}
          onClick={() => void loadMore()}
        >
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  );
}
