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
  priceInclTaxAtPurchase: number;
  taxRateAtPurchase: number;
}

/** Created when an operator confirms cash was received for the order. */
export interface CashPaymentDoc {
  _id: string;
  createdAt: Date;
}

/** Created when an organizer refunds some or all of a cash payment. */
export interface CashRefundDoc {
  _id: string;
  /** Refund amount in integer cents — never a float. */
  amountCents: number;
  createdAt: Date;
}

export interface OrderDoc {
  _id: string;
  standId: string;
  eventId: string;
  /** Null for cash orders — only set when paying via a Tab (Stripe). */
  tabId: string | null;
  /** Attendee sessionId for guest orders; null for cashier (operator) orders. */
  sessionId: string | null;
  orderNumber: string;
  authCode: string;
  customerEmail: string | null;
  paidAt: Date | null;
  items: OrderItemDoc[];
  cashPayment: CashPaymentDoc | null;
  cashRefunds: CashRefundDoc[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<OrderItemDoc>({
  _id: { type: String, default: () => uuidv4() },
  productId: { type: String, required: true },
  customerComment: { type: String, default: null },
  startedAt: { type: Date, default: null },
  readyAt: { type: Date, default: null },
  fulfilledAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  priceInclTaxAtPurchase: { type: Number, required: true },
  taxRateAtPurchase: { type: Number, required: true },
});

const CashPaymentSchema = new Schema<CashPaymentDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const CashRefundSchema = new Schema<CashRefundDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    amountCents: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const OrderSchema = new Schema<OrderDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    standId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    tabId: { type: String, default: null, index: true },
    sessionId: { type: String, default: null, index: true },
    orderNumber: { type: String, required: true },
    authCode: { type: String, required: true },
    customerEmail: { type: String, default: null },
    paidAt: { type: Date, default: null },
    items: [OrderItemSchema],
    cashPayment: { type: CashPaymentSchema, default: null },
    cashRefunds: { type: [CashRefundSchema], default: [] },
  },
  { timestamps: true }
);

export const Order = model<OrderDoc>("Order", OrderSchema);
