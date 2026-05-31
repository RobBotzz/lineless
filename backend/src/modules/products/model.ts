import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

export type ProductStatus = "LIVE" | "PAUSED" | "TERMINATED";

export interface ProductDoc {
  _id: string;
  standId: string;
  productName: string;
  productDescription: string | null;
  /** Price excluding tax, stored as integer cents — never a float. */
  priceExclTax: number;
  /** Tax rate as a decimal fraction, e.g. 0.19 for 19%. */
  taxRate: number;
  productImageUrl: string | null;
  /** Handed over immediately; bypasses the operator state machine. */
  instantProduct: boolean;
  productStock: number;
  productStatus: ProductStatus;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    standId: { type: String, required: true, index: true },
    productName: { type: String, required: true, trim: true },
    productDescription: { type: String, default: null },
    priceExclTax: { type: Number, required: true },
    taxRate: { type: Number, required: true },
    productImageUrl: { type: String, default: null },
    instantProduct: { type: Boolean, default: false },
    productStock: { type: Number, required: true },
    productStatus: {
      type: String,
      enum: ["LIVE", "PAUSED", "TERMINATED"],
      default: "LIVE",
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Product = model<ProductDoc>("Product", productSchema);
