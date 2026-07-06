import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { authAttendee } from "../../middleware/auth/guards";
import { createReview, getMyOrderRatings } from "./service";
import { createRatingSchema } from "./types";
import {
  AlreadyReviewedError,
  NotEligibleForReviewError,
  RatingsDisabledError,
} from "./errors";
import { OrderNotFoundError } from "../orders/errors";
import { ProductNotFoundError } from "../products/errors";

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof OrderNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof ProductNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof AlreadyReviewedError)
    return res.status(409).json({ error: err.message });
  if (err instanceof NotEligibleForReviewError)
    return res.status(403).json({ error: err.message });
  if (err instanceof RatingsDisabledError)
    return res.status(403).json({ error: err.message });
  console.error("Ratings error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// =============================================================================
// Order-scoped self-ratings — mounted at /api/orders/:orderId/ratings
// Returns the ratings this attendee has already submitted for the order.
// =============================================================================
export const orderSelfRatingsRouter = Router({ mergeParams: true });

orderSelfRatingsRouter.get(
  "/",
  authAttendee,
  async (req: Request, res: Response) => {
    try {
      const result = await getMyOrderRatings(
        req.params["orderId"] as string,
        req.attendee!.sessionId
      );
      return res.status(200).json(result);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// =============================================================================
// Order-scoped review submission — mounted at
// /api/orders/:orderId/products/:productId/ratings
// =============================================================================
export const orderRatingsRouter = Router({ mergeParams: true });

// POST — attendee leaves one review per (order, product) once fulfilled.
orderRatingsRouter.post(
  "/",
  authAttendee,
  validateBody(createRatingSchema, async (req, res, data) => {
    try {
      await createReview(
        req.params["orderId"] as string,
        req.params["productId"] as string,
        req.attendee!.sessionId,
        data
      );
      return res.status(201).json({ ok: true });
    } catch (err) {
      return handleError(err, res);
    }
  })
);
