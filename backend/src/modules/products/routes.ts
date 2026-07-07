import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { uploadSingleImage } from "../../shared/imageUpload";
import {
  createProduct,
  listProductsForOrganizer,
  listProductsForOperator,
  listProductsForAttendee,
  listEventProductsForOrganizer,
  listEventProductsForOperator,
  getProductForOrganizer,
  updateProduct,
  updateProductStock,
  softDeleteProduct,
  pauseProduct,
  resumeProduct,
  setProductImage,
  getProductImage,
  deleteProductImage,
  toProductResponse,
  type ProductControlAuth,
} from "./service";
import {
  ImageTooLargeError,
  InvalidImageError,
  ProductImageNotFoundError,
  ProductLimitExceededError,
  ProductNotFoundError,
  ProductStateError,
  ProductStockChangedError,
} from "./errors";
import {
  CashierStandProtectedError,
  StandNotFoundError,
} from "../stands/errors";
import { EventNotFoundError, EventStateError } from "../events/errors";
import {
  createProductSchema,
  updateProductSchema,
  updateProductStockSchema,
} from "./types";
import {
  authOrganizer,
  authOrganizerOrOperator,
  authOrganizerOrOperatorOrAttendee,
} from "../../middleware/auth/guards";

function standId(req: Request): string {
  return req.params["standId"] as string;
}

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function productId(req: Request): string {
  return req.params["productId"] as string;
}

// Resolves the authenticated caller into the union the service expects. The
// route is guarded by authOrganizerOrOperator, so exactly one is set.
function controlAuth(req: Request): ProductControlAuth {
  return req.organizer
    ? { type: "organizer", accountId: req.organizer.accountId }
    : { type: "operator", standId: req.operator!.standId };
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof ProductStockChangedError) {
    return res.status(409).json({
      code: "STOCK_CHANGED",
      error: err.message,
      currentProductStock: err.currentProductStock,
      currentStockMode: err.currentStockMode,
    });
  }
  if (err instanceof ProductNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof ProductStateError)
    return res.status(409).json({ error: err.message });
  if (err instanceof ProductLimitExceededError)
    return res.status(409).json({ error: err.message });
  if (err instanceof StandNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventStateError)
    return res.status(409).json({ error: err.message });
  if (err instanceof CashierStandProtectedError)
    return res.status(403).json({ error: err.message });
  if (err instanceof ProductImageNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof InvalidImageError)
    return res.status(400).json({ error: err.message });
  if (err instanceof ImageTooLargeError)
    return res.status(413).json({ error: err.message });
  console.error("Products error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// Accepts a single multipart "image" field; maps multer errors via handleError.
const uploadProductImage = uploadSingleImage("image", handleError);

// =============================================================================
// Stand-scoped product routes — mounted at /stands/:standId/products
// =============================================================================
export const standProductsRouter = Router({ mergeParams: true });

// POST /stands/:standId/products
standProductsRouter.post(
  "/",
  authOrganizer,
  validateBody(createProductSchema, async (req, res, data) => {
    try {
      const product = await createProduct(
        standId(req),
        req.organizer!.accountId,
        data
      );
      res.status(201).json(toProductResponse(product));
    } catch (err) {
      handleError(err, res);
    }
  })
);

// GET /stands/:standId/products — readable by organizer, operator and attendee.
standProductsRouter.get(
  "/",
  authOrganizerOrOperatorOrAttendee,
  async (req: Request, res: Response) => {
    try {
      const products = req.organizer
        ? await listProductsForOrganizer(standId(req), req.organizer.accountId)
        : req.operator
          ? await listProductsForOperator(standId(req), req.operator.standId)
          : await listProductsForAttendee(standId(req), req.attendee!.eventId);
      res.status(200).json(products.map(toProductResponse));
    } catch (err) {
      handleError(err, res);
    }
  }
);

// =============================================================================
// Event-scoped product routes — mounted at /events/:eventId/products
// =============================================================================
export const eventProductsRouter = Router({ mergeParams: true });

// GET /events/:eventId/products — the event-wide LIVE catalog. Used by the
// cashier (operator), whose token is stand-scoped, and the organizer.
eventProductsRouter.get(
  "/",
  authOrganizerOrOperator,
  async (req: Request, res: Response) => {
    try {
      const products = req.organizer
        ? await listEventProductsForOrganizer(
            eventId(req),
            req.organizer.accountId
          )
        : await listEventProductsForOperator(
            eventId(req),
            req.operator!.standId
          );
      res.status(200).json(products.map(toProductResponse));
    } catch (err) {
      handleError(err, res);
    }
  }
);

// =============================================================================
// Product-id routes — mounted at /products/:productId (no standId in the URL)
// =============================================================================
export const productsRouter = Router();

// GET /products/:productId — readable by organizer only.
productsRouter.get(
  "/:productId",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const product = await getProductForOrganizer(
        productId(req),
        req.organizer!.accountId
      );
      res.status(200).json(toProductResponse(product));
    } catch (err) {
      handleError(err, res);
    }
  }
);

// POST /products/:productId/pause — LIVE -> PAUSED. Status is intentionally NOT
// settable via PATCH; it gets its own explicit, validated transition.
productsRouter.post(
  "/:productId/pause",
  authOrganizerOrOperator,
  async (req: Request, res: Response) => {
    try {
      const product = await pauseProduct(productId(req), controlAuth(req));
      res.status(200).json(toProductResponse(product));
    } catch (err) {
      handleError(err, res);
    }
  }
);

// POST /products/:productId/resume — PAUSED -> LIVE. Inverse of pause.
productsRouter.post(
  "/:productId/resume",
  authOrganizerOrOperator,
  async (req: Request, res: Response) => {
    try {
      const product = await resumeProduct(productId(req), controlAuth(req));
      res.status(200).json(toProductResponse(product));
    } catch (err) {
      handleError(err, res);
    }
  }
);

// PATCH /products/:productId
productsRouter.patch(
  "/:productId",
  authOrganizer,
  validateBody(updateProductSchema, async (req, res, data) => {
    try {
      const product = await updateProduct(
        productId(req),
        req.organizer!.accountId,
        data
      );
      res.status(200).json(toProductResponse(product));
    } catch (err) {
      handleError(err, res);
    }
  })
);

// PATCH /products/:productId/stock — compare-and-set prevents an organizer's
// stale absolute value from overwriting order reservations made in parallel.
productsRouter.patch(
  "/:productId/stock",
  authOrganizer,
  validateBody(updateProductStockSchema, async (req, res, data) => {
    try {
      const product = await updateProductStock(
        productId(req),
        req.organizer!.accountId,
        data
      );
      res.status(200).json(toProductResponse(product));
    } catch (err) {
      handleError(err, res);
    }
  })
);

// DELETE /products/:productId
productsRouter.delete(
  "/:productId",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      await softDeleteProduct(productId(req), req.organizer!.accountId);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  }
);

// PUT /products/:productId/image — organizer uploads/replaces the product image.
// multipart/form-data with a single file field named "image".
productsRouter.put(
  "/:productId/image",
  authOrganizer,
  uploadProductImage,
  async (req: Request, res: Response) => {
    try {
      if (!req.file) throw new InvalidImageError("No image file provided");
      const product = await setProductImage(
        productId(req),
        req.organizer!.accountId,
        { buffer: req.file.buffer, mimeType: req.file.mimetype }
      );
      res.status(200).json(toProductResponse(product));
    } catch (err) {
      handleError(err, res);
    }
  }
);

// GET /products/:productId/image — public; serves the raw image bytes so the
// frontend can use it directly as an <img> src. Cached and ETag'd.
productsRouter.get("/:productId/image", async (req: Request, res: Response) => {
  try {
    const image = await getProductImage(productId(req));
    res.set("Content-Type", image.contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.set("ETag", `"${image._id}-${image.updatedAt.getTime()}"`);
    res.send(image.data);
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /products/:productId/image — organizer removes the uploaded image.
productsRouter.delete(
  "/:productId/image",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const product = await deleteProductImage(
        productId(req),
        req.organizer!.accountId
      );
      res.status(200).json(toProductResponse(product));
    } catch (err) {
      handleError(err, res);
    }
  }
);
