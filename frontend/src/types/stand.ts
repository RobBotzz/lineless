import type { Location } from './location';

export type StandType = 'PRODUCT' | 'CASHIER';
export type StandStatus = 'LIVE' | 'PAUSED';

export interface Stand {
  _id: string;
  eventId: string;
  standName: string;
  standType: StandType;
  standStatus: StandStatus;
  requiresPassword: boolean;
  location: Location;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStandInput {
  standName: string;
  accessPassword?: string;
  location?: Location;
}

export interface UpdateStandInput {
  standName?: string;
  accessPassword?: string | null;
  location?: Location;
}
