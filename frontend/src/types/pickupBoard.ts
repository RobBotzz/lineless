import type { StandStatus } from './stand';

export type PickupBoardItemState = 'PENDING' | 'PREPARING' | 'READY';

export interface PickupBoardItem {
  orderId: string;
  itemId: string;
  orderNumber: string;
  pickupCode: string;
  productId: string;
  productName: string;
  state: PickupBoardItemState;
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
}

export interface PickupBoardStand {
  standId: string;
  standName: string;
  standStatus: StandStatus;
  inLine: PickupBoardItem[];
  readyForPickup: PickupBoardItem[];
}

export interface PickupBoard {
  eventId: string;
  stands: PickupBoardStand[];
}

export function isPickupBoard(value: unknown): value is PickupBoard {
  if (typeof value !== 'object' || value === null) return false;
  const board = value as Record<string, unknown>;
  return typeof board.eventId === 'string' && Array.isArray(board.stands);
}
