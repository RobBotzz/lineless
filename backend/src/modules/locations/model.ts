import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

export interface LocationDoc {
  _id: string;
  locationName: string | null;
  xCoordinate: number | null;
  yCoordinate: number | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<LocationDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    locationName: { type: String, default: null, trim: true },
    xCoordinate: { type: Number, default: null },
    yCoordinate: { type: Number, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Location = model<LocationDoc>("Location", locationSchema);
