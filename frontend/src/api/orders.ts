import { apiFetch } from './client';

// Order item state machine: PENDING -> PREPARING -> READY -> FULFILLED, or cancel.
// These transitions are operator-only (authOperator on the backend) and each
// persists server-side; the operator board's SSE stream then re-pushes the
// resulting board, so callers do not merge the response into local state.
type ItemTransition = 'start' | 'ready' | 'fulfill' | 'cancel';

function transitionItem(
  orderId: string,
  itemId: string,
  action: ItemTransition,
  standId: string,
): Promise<void> {
  return apiFetch<void>(`/orders/${orderId}/items/${itemId}/${action}`, {
    method: 'POST',
    auth: 'operator',
    standId,
  });
}

// PENDING -> PREPARING
export function startOrderItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'start', standId);
}

// PREPARING -> READY
export function readyOrderItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'ready', standId);
}

// READY -> FULFILLED (handed to the customer; leaves the board)
export function fulfillOrderItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'fulfill', standId);
}

// Cancel an item in any active state (leaves the board)
export function cancelOrderItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'cancel', standId);
}
