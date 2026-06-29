import { apiFetch } from './client';
import type { PickupBoard } from '@/types/pickupBoard';

export const PICKUP_BOARD_EVENT = 'pickup-board';

export function pickupBoardPath(eventId: string): string {
  return `/events/${eventId}/pickup-board`;
}

export function pickupBoardStreamPath(eventId: string): string {
  return `${pickupBoardPath(eventId)}/stream`;
}

export function getPickupBoard(eventId: string): Promise<PickupBoard> {
  return apiFetch<PickupBoard>(pickupBoardPath(eventId), {
    auth: 'operator-link',
  });
}
