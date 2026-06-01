export interface Stand {
  _id: string;
  eventId: string;
  accountId: string;
  standName: string;
  accessPassword?: string;
  locationName?: string;
  xCoordinate?: number;
  yCoordinate?: number;
  queueStatus: 'ACTIVE' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
}

export interface CreateStandInput {
  standName: string;
  accessPassword?: string;
  locationName?: string | null;
  xCoordinate?: number | null;
  yCoordinate?: number | null;
}

export interface UpdateStandInput {
  standName: string;
  accessPassword?: string | null;
  locationName?: string | null;
  xCoordinate?: number | null;
  yCoordinate?: number | null;
}
