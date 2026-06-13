import { apiFetch } from './client';
import type { OperatorBoard } from '../types/operatorBoard';

// Path of the live board SSE stream, consumed via useSSE. The stand is identified
// by the operator token (auth: 'operator' picks it by standId), not by the URL.
export const OPERATOR_BOARD_STREAM_PATH = '/operator/board/stream';

// The board's `board` SSE event name (see SseConnection.send in the backend).
export const OPERATOR_BOARD_EVENT = 'board';

// One-shot board snapshot. The stream delivers the same payload as its first
// frame, so the dashboard relies on the stream; this is for non-streaming reads.
export function getOperatorBoard(standId: string): Promise<OperatorBoard> {
  return apiFetch<OperatorBoard>('/operator/board', { auth: 'operator', standId });
}

// Item state machine: PENDING -> PREPARING -> READY -> FULFILLED, or cancel.
// Each transition persists server-side; the resulting board change streams back
// over the SSE connection, so callers do not merge the response into local state.
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
export function startBoardItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'start', standId);
}

// PREPARING -> READY
export function readyBoardItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'ready', standId);
}

// READY -> FULFILLED (handed to the customer; leaves the board)
export function fulfillBoardItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'fulfill', standId);
}

// Cancel an item in any active state (leaves the board)
export function cancelBoardItem(orderId: string, itemId: string, standId: string): Promise<void> {
  return transitionItem(orderId, itemId, 'cancel', standId);
}
