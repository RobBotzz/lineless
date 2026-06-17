import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface RatingDoc {
  _id: string;
  orderId: string;
  productId: string;
  // Denormalized for the public list query and the ratingsEnabled gate.
  eventId: string;
  // The owning attendee session — kept for audit, never returned to clients.
  sessionId: string;
  stars: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ratingSchema = new Schema<RatingDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    orderId: { type: String, required: true },
    productId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: null, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// One review per (order, product). Enforced at the DB level so concurrent
// double-submits collapse to a single review (duplicate key -> AlreadyReviewedError).
ratingSchema.index({ orderId: 1, productId: 1 }, { unique: true });

export const Rating = model<RatingDoc>("Rating", ratingSchema);
