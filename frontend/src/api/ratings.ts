import { apiFetch } from './client';
import type { CreateRatingInput, ReviewList } from '../types/rating';

export function getProductReviews(
  eventId: string,
  productId: string,
  { limit = 10, skip = 0 }: { limit?: number; skip?: number } = {},
): Promise<ReviewList> {
  return apiFetch<ReviewList>(`/products/${productId}/ratings?limit=${limit}&skip=${skip}`, {
    auth: 'attendee',
    eventId,
  });
}

export function createReview(
  eventId: string,
  orderId: string,
  productId: string,
  input: CreateRatingInput,
): Promise<void> {
  return apiFetch<void>(`/orders/${orderId}/products/${productId}/ratings`, {
    method: 'POST',
    body: JSON.stringify(input),
    auth: 'attendee',
    eventId,
  });
}
