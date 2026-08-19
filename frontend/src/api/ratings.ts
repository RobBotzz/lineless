import { apiFetch } from './client';

export interface RatingInput {
  stars: number;
  comment: string | null;
}

// POST /api/orders/:orderId/products/:productId/ratings
export function submitRating(
  orderId: string,
  productId: string,
  eventId: string,
  input: RatingInput,
): Promise<void> {
  return apiFetch(`/orders/${orderId}/products/${productId}/ratings`, {
    method: 'POST',
    auth: 'attendee',
    eventId,
    body: JSON.stringify(input),
  });
}

export interface ExistingRating {
  productId: string;
  stars: number;
  comment: string | null;
}

// GET /api/orders/:orderId/ratings — ratings this attendee submitted for an order
export function getMyOrderRatings(
  orderId: string,
  eventId: string,
): Promise<{ ratings: ExistingRating[] }> {
  return apiFetch(`/orders/${orderId}/ratings`, { auth: 'attendee', eventId });
}
