import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface OrderItemDoc {
  _id: string;
  productId: string;
  customerComment: string | null;
  startedAt: Date | null;
  readyAt: Date | null;
  fulfilledAt: Date | null;
  cancelledAt: Date | null;
  priceIncludingTaxAtPurchase: number;
  taxRateAtPurchase: number;
}

export interface OrderDoc {
  _id: string;
  standId: string;
  eventId: string;
  tabId: string | null;
  sessionId: string | null;
  orderNumber: string;
  pickupCode: string;
  customerEmail: string | null;
  paidAt: Date | null;
  items: OrderItemDoc[];
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<OrderItemDoc>({
  _id: { type: String, default: () => uuidv4() },
  productId: { type: String, required: true },
  customerComment: { type: String, default: null },
  startedAt: { type: Date, default: null },
  readyAt: { type: Date, default: null },
  fulfilledAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  priceIncludingTaxAtPurchase: { type: Number, required: true },
  taxRateAtPurchase: { type: Number, required: true },
});

const orderSchema = new Schema<OrderDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    standId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    tabId: { type: String, default: null, index: true },
    sessionId: { type: String, default: null, index: true },
    orderNumber: { type: String, required: true },
    pickupCode: { type: String, required: true, index: true },
    customerEmail: { type: String, default: null },
    paidAt: { type: Date, default: null },
    items: [orderItemSchema],
  },
  { timestamps: true }
);

export const Order = model<OrderDoc>("Order", orderSchema);
