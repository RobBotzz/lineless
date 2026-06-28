import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";
import { locationSchema, type Location } from "../../shared/location";

export type EventStatus = "DRAFT" | "ACTIVE" | "STOPPED";

// Default authorization hold placed on a new tab and the increment by which a
// tab's authorization is topped up when an order exceeds it (€10.00 in cents).
export const DEFAULT_BASELINE_HOLD_CENTS = 1000;

export function generateOperatorAccessKey(): string {
  return uuidv4();
}

export interface EventBranding {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
}

export interface EventDoc {
  _id: string;
  accountId: string;
  name: string;
  plannedDate?: Date;
  status: EventStatus;
  operatorAccessKey: string;
  ratingsEnabled: boolean;
  cashierEnabled: boolean;
  offlineOrdersEnabled: boolean;
  baselineHoldCents: number;
  branding: EventBranding;
  location: Location;
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
    plannedDate: { type: Date },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "STOPPED"],
      default: "DRAFT",
    },
    operatorAccessKey: {
      type: String,
      required: true,
      index: true,
      default: generateOperatorAccessKey,
    },
    ratingsEnabled: { type: Boolean, default: false },
    cashierEnabled: { type: Boolean, default: true },
    offlineOrdersEnabled: { type: Boolean, default: true },
    baselineHoldCents: {
      type: Number,
      required: true,
      default: DEFAULT_BASELINE_HOLD_CENTS,
    },
    branding: { type: brandingSchema, default: () => ({}) },
    location: { type: locationSchema, default: () => ({}) },
    startedAt: { type: Date },
    stoppedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Event = model<EventDoc>("Event", eventSchema);
