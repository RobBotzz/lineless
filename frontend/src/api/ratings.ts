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
