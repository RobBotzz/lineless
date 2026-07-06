import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export type TabStatus =
  | "PENDING_AUTHORIZATION"
  | "OPEN"
  | "CHECKOUT_PENDING"
  | "PAID"
  | "FAILED";

// Tab lifetime policy, measured from when the tab is opened (createdAt). A tab
// stops accepting new orders first, then is auto-charged a while later — both
// well inside Stripe's ~7-day authorization validity.
export const TAB_ORDER_FREEZE_AFTER_MS = 36 * 60 * 60 * 1000;
export const TAB_AUTO_CHARGE_AFTER_MS = 48 * 60 * 60 * 1000;

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

// The auto-charge sweep queries open tabs by age (status + createdAt).
TabSchema.index({ status: 1, createdAt: 1 });

export const Tab = model<TabDoc>("Tab", TabSchema);
