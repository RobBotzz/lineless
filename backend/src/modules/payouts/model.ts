import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export type PayoutStatus = "REQUESTED" | "PAID";

// Ledger entry for a payout the organizer requested. Payouts are manual bank
// transfers (no real processor), so the amount is frozen here and the bank
// details are snapshotted at request time.
export interface PayoutDoc {
  _id: string;
  accountId: string;
  amountCents: number;
  ibanSnapshot: string;
  ibanHolderSnapshot: string;
  status: PayoutStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutSchema = new Schema<PayoutDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    accountId: { type: String, required: true, index: true },
    amountCents: { type: Number, required: true },
    ibanSnapshot: { type: String, required: true },
    ibanHolderSnapshot: { type: String, required: true },
    status: {
      type: String,
      enum: ["REQUESTED", "PAID"],
      default: "REQUESTED",
    },
  },
  { timestamps: true }
);

export const Payout = model<PayoutDoc>("Payout", PayoutSchema);
