import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

export type EventStatus = "DRAFT" | "ACTIVE" | "STOPPED";

export interface EventBranding {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
}

export interface EventDoc {
  _id: string;
  accountId: string;
  name: string;
  location?: string;
  plannedDate?: Date;
  status: EventStatus;
  ratingsEnabled: boolean;
  cashierEnabled: boolean;
  offlineOrdersEnabled: boolean;
  branding: EventBranding;
  startedAt?: Date;
  stoppedAt?: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const brandingSchema = new Schema<EventBranding>(
  {
    primaryColor: { type: String, required: true, default: "#020887" },
    secondaryColor: { type: String, required: true, default: "#FFFFFF" },
    logoUrl: { type: String, default: null },
  },
  { _id: false }
);

const eventSchema = new Schema<EventDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    accountId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    plannedDate: { type: Date },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "STOPPED"],
      default: "DRAFT",
    },
    ratingsEnabled: { type: Boolean, default: false },
    cashierEnabled: { type: Boolean, default: true },
    offlineOrdersEnabled: { type: Boolean, default: true },
    branding: { type: brandingSchema, default: () => ({}) },
    startedAt: { type: Date },
    stoppedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Event = model<EventDoc>("Event", eventSchema);
