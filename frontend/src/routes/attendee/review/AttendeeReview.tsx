import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { getAttendeeOrder } from '@/api/orders';
import { submitRating } from '@/api/ratings';
import { ApiError } from '@/api/client';
import { BackButton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { paths } from '@/paths';

import { ATTENDEE_WIDTH } from '../column';
import { ProductReviewCard } from './ProductReviewCard';

interface RatingState {
  stars: number;
  comment: string;
}

export default function AttendeeReview() {
  const { eventId, orderId } = useParams() as { eventId: string; orderId: string };
  const navigate = useNavigate();

  const [ratings, setRatings] = useState<Record<string, RatingState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const orderQuery = useQuery({
    queryKey: ['attendee', 'order', orderId],
    queryFn: () => getAttendeeOrder(orderId, eventId),
    refetchInterval: 15_000,
  });

  const reviewableProducts = useMemo(() => {
    if (!orderQuery.data) return [];
    const seen = new Set<string>();
    const result: { productId: string; productName: string; standName: string }[] = [];
    for (const item of orderQuery.data.items) {
      if (item.fulfilledAt && !item.cancelledAt && !seen.has(item.productId)) {
        seen.add(item.productId);
        result.push({
          productId: item.productId,
          productName: item.productName,
          standName: item.standName,
        });
      }
    }
    return result;
  }, [orderQuery.data]);

  const allRated =
    reviewableProducts.length > 0 &&
    reviewableProducts.every((p) => (ratings[p.productId]?.stars ?? 0) > 0);

  function setStars(productId: string, stars: number) {
    setRatings((prev) => ({
      ...prev,
      [productId]: { stars, comment: prev[productId]?.comment ?? '' },
    }));
  }

  function setComment(productId: string, comment: string) {
    setRatings((prev) => ({
      ...prev,
      [productId]: { stars: prev[productId]?.stars ?? 0, comment },
    }));
  }

  async function handleSubmit() {
    if (!allRated || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await Promise.all(
        reviewableProducts.map((p) => {
          const state = ratings[p.productId];
          return submitRating(orderId, p.productId, eventId, {
            stars: state.stars,
            comment: state.comment.trim() || null,
          }).catch((err) => {
            // 409 = already reviewed — treat as success for this product
            if (err instanceof ApiError && err.status === 409) return;
            throw err;
          });
        }),
      );
      navigate(paths.attendee.orders(eventId));
    } catch {
      setSubmitError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  const order = orderQuery.data;

  return (
    <div className={`mx-auto ${ATTENDEE_WIDTH} space-y-4`}>
      <BackButton to={paths.attendee.orders(eventId)}>Back</BackButton>

      <div>
        <h1 className="text-lg font-semibold text-text">Rate Products</h1>
        {order && <p className="text-sm text-text-muted">Order {order.orderNumber}</p>}
      </div>

      {orderQuery.isPending && <p className="py-8 text-center text-sm text-text-muted">Loading…</p>}

      {orderQuery.isError && (
        <p className="rounded-xl border border-danger bg-surface px-4 py-3 text-sm text-danger">
          Could not load order. Please go back and try again.
        </p>
      )}

      {order && (
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <p className="font-semibold text-text">Rate each product</p>
            <p className="text-sm text-text-muted">{order.orderNumber}</p>
          </div>

          <div className="space-y-4 p-4">
            {reviewableProducts.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-muted">
                Waiting for your items to be fulfilled…
              </p>
            ) : (
              reviewableProducts.map((p) => (
                <ProductReviewCard
                  key={p.productId}
                  productName={p.productName}
                  standName={p.standName}
                  stars={ratings[p.productId]?.stars ?? 0}
                  comment={ratings[p.productId]?.comment ?? ''}
                  onStarsChange={(stars) => setStars(p.productId, stars)}
                  onCommentChange={(comment) => setComment(p.productId, comment)}
                />
              ))
            )}
          </div>

          {reviewableProducts.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              {submitError && <p className="mb-3 text-sm text-danger">{submitError}</p>}
              <Button
                className="w-full"
                disabled={!allRated || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Submitting…' : 'Submit ratings'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
