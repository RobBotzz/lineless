import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

const OrderItemSchema = new Schema({
  _id: { type: String, default: uuidv4 },
  productId: { type: String, required: true },
  customerComment: { type: String, default: null },
  startedAt: { type: Date, default: null },
  readyAt: { type: Date, default: null },
  fulfilledAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  priceExclTaxAtPurchase: { type: Number, required: true },
  taxRateAtPurchase: { type: Number, required: true }
});

const OrderSchema = new Schema({
  _id: { type: String, default: uuidv4 },
  tabId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  orderNumber: { type: Number, required: true },
  authCode: { type: String, required: true },
  customerEmail: { type: String, default: null },
  paidAt: { type: Date, default: null },
  items: [OrderItemSchema]
}, { timestamps: true });

export const Order = model("Order", OrderSchema);