import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

const TabPaymentSchema = new Schema({
  _id: { type: String, default: uuidv4 },
  tabId: { type: String, required: true, index: true },
  stripeSessionId: { type: String, default: null },
  stripePaymentIntentId: { type: String, required: true },
  stripeEventId: { type: String, default: null },
  tabPaymentStatus: {
    type: String,
    enum: ["PENDING", "AUTHORIZED", "CAPTURED", "RELEASED", "FAILED"],
    required: true
  },
  authorizedCentsAmount: { type: Number, required: true },
  capturedCentsAmount: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

export const TabPayment = model("TabPayment", TabPaymentSchema);