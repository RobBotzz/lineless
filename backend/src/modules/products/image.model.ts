import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

// Binary store for product images. Kept in its own collection (not embedded in
// Product) so listing products never drags the image bytes along. One image per
// product, enforced by the unique index on productId; uploading again replaces
// the existing document.
export interface ProductImageDoc {
  _id: string;
  productId: string;
  data: Buffer;
  contentType: string;
  byteSize: number;
  createdAt: Date;
  updatedAt: Date;
}

const productImageSchema = new Schema<ProductImageDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    productId: { type: String, required: true, unique: true, index: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    byteSize: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const ProductImage = model<ProductImageDoc>(
  "ProductImage",
  productImageSchema
);
