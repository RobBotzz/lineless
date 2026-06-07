import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export type TabPaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "RELEASED"
  | "FAILED";

export interface TabPaymentDoc {
  _id: string;
  tabId: string;
  stripePaymentIntentId: string;
  /** Stripe event id used as an idempotency key — set once on first webhook. */
  stripeEventId: string | null;
  tabPaymentStatus: TabPaymentStatus;
  /** Amount in integer cents that was authorized by Stripe. */
  authorizedCentsAmount: number;
  /** Amount in integer cents actually captured. Set to authorizedCentsAmount on capture. */
  capturedCentsAmount: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TabPaymentSchema = new Schema<TabPaymentDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    tabId: { type: String, required: true, index: true },
    stripePaymentIntentId: { type: String, required: true },
    stripeEventId: { type: String, default: null },
    tabPaymentStatus: {
      type: String,
      enum: ["PENDING", "AUTHORIZED", "CAPTURED", "RELEASED", "FAILED"],
      required: true,
    },
    authorizedCentsAmount: { type: Number, required: true },
    capturedCentsAmount: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const TabPayment = model<TabPaymentDoc>("TabPayment", TabPaymentSchema);
