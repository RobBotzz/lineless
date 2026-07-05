import mongoose from "mongoose";
import { Rating, type RatingDoc } from "./model";
import {
  AlreadyReviewedError,
  NotEligibleForReviewError,
  RatingsDisabledError,
} from "./errors";
import type { CreateRatingInput } from "./types";
import { getOrderForAttendee } from "../orders/service";
import { Product } from "../products/model";
import { ProductNotFoundError } from "../products/errors";
import { Event } from "../events/model";

type ReviewResponse = Pick<
  RatingDoc,
  "_id" | "stars" | "comment" | "createdAt"
>;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function isDuplicateKeyError(err: unknown): boolean {
  const code = (err as { code?: number; cause?: { code?: number } } | null)
    ?.code;
  const causeCode = (err as { cause?: { code?: number } } | null)?.cause?.code;
  return code === 11000 || causeCode === 11000;
}

export async function createReview(
  orderId: string,
  productId: string,
  sessionId: string,
  input: CreateRatingInput
): Promise<void> {
  // Ownership: the order must belong to this attendee session (else 404).
  const order = await getOrderForAttendee(orderId, sessionId);

  const event = await Event.findById(order.eventId).lean();
  if (!event?.ratingsEnabled) throw new RatingsDisabledError();

  // Eligibility: at least one item of this product in the order is fulfilled.
  const eligible = order.items.some(
    (i) => i.productId === productId && i.fulfilledAt != null
  );
  if (!eligible) throw new NotEligibleForReviewError();

  const product = await Product.findById(productId).lean();
  if (!product) throw new ProductNotFoundError();

  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      await Rating.create(
        [
          {
            orderId,
            productId,
            eventId: order.eventId,
            sessionId,
            stars: input.stars,
            comment: input.comment,
          },
        ],
        { session: dbSession }
      );
      await Product.updateOne(
        { _id: productId },
        { $inc: { ratingSum: input.stars, ratingCount: 1 } },
        { session: dbSession }
      );
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AlreadyReviewedError();
    throw err;
  } finally {
    await dbSession.endSession();
  }
}

type ExistingRating = Pick<RatingDoc, "productId" | "stars" | "comment">;

export async function getMyOrderRatings(
  orderId: string,
  sessionId: string
): Promise<{ ratings: ExistingRating[] }> {
  // Validates ownership — throws OrderNotFoundError if the order isn't this session's.
  await getOrderForAttendee(orderId, sessionId);
  const ratings = await Rating.find({ orderId, sessionId })
    .select("productId stars comment")
    .lean();
  return { ratings };
}

export async function listReviews(
  productId: string,
  eventId: string,
  limit = DEFAULT_LIMIT,
  skip = 0
): Promise<{ reviews: ReviewResponse[]; total: number }> {
  const product = await Product.findById(productId).lean();
  if (!product) throw new ProductNotFoundError();

  const event = await Event.findById(eventId).lean();
  if (!event?.ratingsEnabled) throw new RatingsDisabledError();

  const cappedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const safeSkip = Math.max(skip, 0);

  const [reviews, total] = await Promise.all([
    Rating.find({ productId, eventId })
      .sort({ createdAt: -1 })
      .skip(safeSkip)
      .limit(cappedLimit)
      .select("stars comment createdAt")
      .lean(),
    Rating.countDocuments({ productId, eventId }),
  ]);

  return { reviews, total };
}
