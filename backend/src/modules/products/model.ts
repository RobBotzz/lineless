import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

export type ProductStatus = "LIVE" | "PAUSED" | "TERMINATED";

export interface ProductDoc {
  _id: string;
  standId: string;
  productName: string;
  productDescription: string | null;
  priceIncludingTax: number;
  // Tax rate as integer basis points (1/10000) — e.g. 1900 for 19%.
  taxRate: number;
  productImageUrl: string | null;
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
    productDescription: { type: String, default: null, trim: true },
    priceIncludingTax: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, required: true, min: 0, max: 10000 },
    productImageUrl: { type: String, default: null },
    instantProduct: { type: Boolean, default: false },
    productStock: { type: Number, default: 0, min: 0 },
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
