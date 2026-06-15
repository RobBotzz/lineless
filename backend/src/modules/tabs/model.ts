import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export type TabStatus =
  | "PENDING_AUTHORIZATION"
  | "OPEN"
  | "CHECKOUT_PENDING"
  | "PAID"
  | "FAILED";

export interface TabDoc {
  _id: string;
  /** Attendee sessionId that owns this tab. */
  sessionId: string;
  eventId: string;
  status: TabStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TabSchema = new Schema<TabDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    sessionId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: [
        "PENDING_AUTHORIZATION",
        "OPEN",
        "CHECKOUT_PENDING",
        "PAID",
        "FAILED",
      ],
      default: "PENDING_AUTHORIZATION",
    },
  },
  { timestamps: true }
);

export const Tab = model<TabDoc>("Tab", TabSchema);
