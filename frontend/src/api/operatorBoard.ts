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
