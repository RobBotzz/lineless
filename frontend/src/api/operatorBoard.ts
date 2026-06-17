import { apiFetch } from './client';
import type { OperatorBoard } from '@/types/operatorBoard';

export const OPERATOR_BOARD_STREAM_EVENT = 'board';

export function getOperatorBoard(standId: string): Promise<OperatorBoard> {
  return apiFetch<OperatorBoard>('/operator/board', { auth: 'operator', standId });
}

export function operatorBoardStreamPath(): string {
  return '/operator/board/stream';
}
