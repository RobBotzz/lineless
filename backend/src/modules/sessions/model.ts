import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

export type AttendeeSessionStatus = "active" | "expired";

export interface AttendeeSessionDoc {
  _id: string;
  eventId: string;
  status: AttendeeSessionStatus;
  email: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const attendeeSessionSchema = new Schema<AttendeeSessionDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    eventId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
      index: true,
    },
    email: { type: String, default: null },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

export const AttendeeSession = model<AttendeeSessionDoc>(
  "AttendeeSession",
  attendeeSessionSchema
);
