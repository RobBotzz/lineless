import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

export interface StandDoc {
  _id: string;
  eventId: string;
  standName: string;
  accessPasswordHash: string | null;
  locationName: string | null;
  xCoordinate: number | null;
  yCoordinate: number | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const standSchema = new Schema<StandDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    eventId: { type: String, required: true, index: true },
    standName: { type: String, required: true, trim: true },
    accessPasswordHash: { type: String, default: null },
    locationName: { type: String, default: null },
    xCoordinate: { type: Number, default: null },
    yCoordinate: { type: Number, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
export const Stand = model<StandDoc>("Stand", standSchema);
