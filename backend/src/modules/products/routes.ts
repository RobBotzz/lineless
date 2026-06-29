import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import multer from "multer";
import { validateBody } from "../../middleware/validate";
import { config } from "../../config/config";
import {
  createProduct,
  listProductsForOrganizer,
  listProductsForOperator,
  listProductsForAttendee,
  listEventProductsForOrganizer,
  listEventProductsForOperator,
  getProductForOrganizer,
  updateProduct,
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
  ProductNotFoundError,
  ProductStateError,
} from "./errors";
import {
  CashierStandProtectedError,
  StandNotFoundError,
} from "../stands/errors";
import { EventNotFoundError } from "../events/errors";
import { createProductSchema, updateProductSchema } from "./types";
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
  if (err instanceof ProductNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof ProductStateError)
    return res.status(409).json({ error: err.message });
  if (err instanceof StandNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof ProductStateError)
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

// Memory-storage upload: the bytes go straight into MongoDB, never to disk. The
// size cap is enforced by multer; the MIME whitelist here is a cheap first pass
// (the real format check happens against the magic bytes in the service).
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxImageBytes },
  fileFilter: (_req, file, cb) => {
    if (config.upload.allowedImageMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new InvalidImageError(`Unsupported image type: ${file.mimetype}`));
    }
  },
});

// Runs the multer middleware and maps its errors onto our domain errors so the
// route's handleError produces consistent JSON status codes.
function uploadProductImage(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  imageUpload.single("image")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        handleError(new ImageTooLargeError(), res);
      } else {
        handleError(new InvalidImageError(err.message), res);
      }
      return;
    }
    if (err) {
      handleError(err, res);
      return;
    }
    next();
  });
}

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

// POST /products/:productId/terminate — placeholder for the -> TERMINATED
// transition (terminal state).
// TODO: implement terminateProduct in the service as an explicit, validated
// state transition (mirror the events start/stop pattern with a
// ProductStateError).
productsRouter.post(
  "/:productId/terminate",
  authOrganizerOrOperator,
  (_req: Request, res: Response) => {
    res.status(501).json({ error: "Not implemented" });
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
