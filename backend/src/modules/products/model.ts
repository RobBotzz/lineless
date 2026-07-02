import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

export type ProductStatus = "LIVE" | "PAUSED" | "TERMINATED";
export type StockMode = "UNLIMITED" | "TRACKED";

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
  stockMode: StockMode;
  productStock: number;
  productStatus: ProductStatus;
  // Running rating aggregate — atomically $inc'd on each new review so the
  // average never has to be recomputed across all ratings.
  ratingSum: number;
  ratingCount: number;
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
    // Missing legacy values are treated as UNLIMITED throughout the service.
    stockMode: {
      type: String,
      enum: ["UNLIMITED", "TRACKED"],
      default: "UNLIMITED",
    },
    productStock: { type: Number, default: 0, min: 0 },
    productStatus: {
      type: String,
      enum: ["LIVE", "PAUSED", "TERMINATED"],
      default: "LIVE",
    },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Product = model<ProductDoc>("Product", productSchema);
