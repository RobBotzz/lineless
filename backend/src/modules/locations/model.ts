import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

export interface LocationDoc {
  _id: string;
  eventId: string;
  locationName: string | null;
  xCoordinate: number | null;
  yCoordinate: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<LocationDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    eventId: { type: String, required: true, unique: true, index: true },
    locationName: { type: String, default: null, trim: true },
    xCoordinate: { type: Number, default: null },
    yCoordinate: { type: Number, default: null },
  },
  { timestamps: true }
);

export const Location = model<LocationDoc>("Location", locationSchema);
