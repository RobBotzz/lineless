import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getAttendeeOrder } from '@/api/orders';
import { getAttendeeEvent } from '@/api/events';
import { getMyOrderRatings, submitRating } from '@/api/ratings';
import { ApiError } from '@/api/client';
import { BackButton, PrimaryButton } from '@/components/shared';
import { CheckCircleIcon } from '@/components/icons';
import { ProductReviewCard } from '../review/ProductReviewCard';

interface RatingState {
  stars: number;
  comment: string;
}

export default function ReviewOrder() {
  const { eventId, orderId } = useParams() as { eventId: string; orderId: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [ratings, setRatings] = useState<Record<string, RatingState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);

  const eventQuery = useQuery({
    queryKey: ['attendee', 'event', eventId],
    queryFn: () => getAttendeeEvent(eventId),
  });

  const orderQuery = useQuery({
    queryKey: ['attendee', 'order', orderId],
    queryFn: () => getAttendeeOrder(orderId, eventId),
    refetchInterval: 15_000,
    refetchOnMount: 'always',
  });

  const existingRatingsQuery = useQuery({
    queryKey: ['attendee', 'order', orderId, 'ratings'],
    queryFn: () => getMyOrderRatings(orderId, eventId),
    // Refetch on every visit so already-reviewed products show without a hard reload.
    refetchOnMount: 'always',
  });

  const existingRatings = useMemo(() => {
    const map = new Map<string, { stars: number; comment: string | null }>();
    for (const r of existingRatingsQuery.data?.ratings ?? []) {
      map.set(r.productId, { stars: r.stars, comment: r.comment });
    }
    return map;
  }, [existingRatingsQuery.data]);

  const reviewableProducts = useMemo(() => {
    if (!orderQuery.data) return [];
    const seen = new Set<string>();
    const result: {
      productId: string;
      productName: string;
      standName: string;
      existingRating: { stars: number; comment: string | null } | null;
    }[] = [];
    for (const item of orderQuery.data.items) {
      if (item.fulfilledAt && !item.cancelledAt && !seen.has(item.productId)) {
        seen.add(item.productId);
        result.push({
          productId: item.productId,
          productName: item.productName,
          standName: item.standName,
          existingRating: existingRatings.get(item.productId) ?? null,
        });
      }
    }
    return result;
  }, [orderQuery.data, existingRatings]);

  const allAlreadyReviewed =
    reviewableProducts.length > 0 && reviewableProducts.every((p) => p.existingRating !== null);

  const allRated =
    reviewableProducts.length > 0 &&
    reviewableProducts.every(
      (p) => p.existingRating !== null || (ratings[p.productId]?.stars ?? 0) > 0,
    );

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
      const toSubmit = reviewableProducts.filter((p) => p.existingRating === null);
      const outcomes = await Promise.all(
        toSubmit.map(async (p): Promise<'created' | 'conflict'> => {
          const state = ratings[p.productId];
          try {
            await submitRating(orderId, p.productId, eventId, {
              stars: state.stars,
              comment: state.comment.trim() || null,
            });
            return 'created';
          } catch (err) {
            // 409 = already reviewed concurrently (e.g. another tab) — not a
            // failure, but not a new rating either, so it must not inflate
            // the success count below.
            if (err instanceof ApiError && err.status === 409) return 'conflict';
            throw err;
          }
        }),
      );
      // Refresh the cached ratings so the Track Order button flips from
      // "Leave a review" to "Show review" without a manual reload.
      await queryClient.invalidateQueries({
        queryKey: ['attendee', 'order', orderId, 'ratings'],
      });
      setSubmittedCount(outcomes.filter((o) => o === 'created').length);
      setSubmitted(true);
    } catch {
      setSubmitError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  const order = orderQuery.data;
  const isLoading = eventQuery.isPending || orderQuery.isPending || existingRatingsQuery.isPending;

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-3 text-lg font-semibold text-text">Thanks for your ratings!</h1>
          <p className="mt-1 text-sm text-text-muted">
            You rated {submittedCount} {submittedCount === 1 ? 'product' : 'products'}.
          </p>
          <BackButton className="mt-6 w-full justify-center" onClick={() => navigate(-1)}>
            Track Order
          </BackButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={() => navigate(-1)}>Back</BackButton>

      <div>
        <h1 className="text-lg font-semibold text-text">Share Your Feedback</h1>
        <p className="text-sm text-text-muted">
          Your star rating is visible to all customers. Comments are shared only with the organizer
          to help improve the products.
        </p>
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-text-muted">Loading…</p>}

      {(eventQuery.isError || orderQuery.isError) && (
        <p className="rounded-xl border border-danger bg-surface px-4 py-3 text-sm text-danger">
          Could not load order. Please go back and try again.
        </p>
      )}

      {eventQuery.data && !eventQuery.data.ratingsEnabled && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-muted">
          Ratings are not available for this event.
        </p>
      )}

      {order && eventQuery.data?.ratingsEnabled && (
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <p className="font-semibold text-text">How was your experience?</p>
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
                  stars={p.existingRating?.stars ?? ratings[p.productId]?.stars ?? 0}
                  comment={p.existingRating?.comment ?? ratings[p.productId]?.comment ?? ''}
                  onStarsChange={(stars) => setStars(p.productId, stars)}
                  onCommentChange={(comment) => setComment(p.productId, comment)}
                  disabled={p.existingRating !== null}
                />
              ))
            )}
          </div>

          {reviewableProducts.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              {allAlreadyReviewed ? (
                <>
                  <p className="mb-3 text-center text-sm text-text-muted">
                    You have already reviewed all products in this order.
                  </p>
                  <BackButton onClick={() => navigate(-1)}>Back</BackButton>
                </>
              ) : (
                <>
                  {submitError && <p className="mb-3 text-sm text-danger">{submitError}</p>}
                  <PrimaryButton disabled={!allRated || isSubmitting} onClick={handleSubmit}>
                    {isSubmitting ? 'Submitting…' : 'Submit ratings'}
                  </PrimaryButton>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
