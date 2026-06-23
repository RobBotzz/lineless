import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";
import { locationSchema, type Location } from "../../shared/location";

export type StandType = "PRODUCT" | "CASHIER";

export interface StandDoc {
  _id: string;
  eventId: string;
  standName: string;
  standType: StandType;
  accessPasswordHash: string | null;
  location: Location;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const standSchema = new Schema<StandDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    eventId: { type: String, required: true, index: true },
    standName: { type: String, required: true, trim: true },
    standType: {
      type: String,
      enum: ["PRODUCT", "CASHIER"],
      default: "PRODUCT",
    },
    accessPasswordHash: { type: String, default: null },
    location: { type: locationSchema, default: () => ({}) },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Exactly one cashier stand per event, enforced at the database level. The
// cashier stand is system-managed (created by the backend, never deleted), so a
// partial unique index scoped to the CASHIER type is sufficient.
standSchema.index(
  { eventId: 1 },
  { unique: true, partialFilterExpression: { standType: "CASHIER" } }
);

export const Stand = model<StandDoc>("Stand", standSchema);
