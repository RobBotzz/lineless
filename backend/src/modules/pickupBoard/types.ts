import type { StandStatus } from "../stands/model";

export type PickupBoardItemState = "PENDING" | "PREPARING" | "READY";

export interface PickupBoardItem {
  orderId: string;
  itemId: string;
  orderNumber: string;
  pickupCode: string;
  productId: string;
  productName: string;
  state: PickupBoardItemState;
  createdAt: Date;
  startedAt: Date | null;
  readyAt: Date | null;
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
