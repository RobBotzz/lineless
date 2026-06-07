import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  createProduct,
  listProductsForOrganizer,
  listProductsForOperator,
  listProductsForAttendee,
  getProductForOrganizer,
  updateProduct,
  softDeleteProduct,
  verifyProductControlAccess,
} from "./service";
import { ProductNotFoundError } from "./errors";
import { StandNotFoundError } from "../stands/errors";
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

function productId(req: Request): string {
  return req.params["productId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof ProductNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof StandNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  console.error("Products error:", err);
  return res.status(500).json({ error: "Internal server error" });
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
      res.status(201).json(product);
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
      res.status(200).json(products);
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
      res.status(200).json(product);
    } catch (err) {
      handleError(err, res);
    }
  }
);

// POST /products/:productId/pause — placeholder for the LIVE -> PAUSED
// transition. Status is intentionally NOT settable via PATCH; it gets its own
// endpoint.
// TODO: implement pauseProduct in the service as an explicit, validated state
// transition (mirror the events start/stop pattern with a ProductStateError).
productsRouter.post(
  "/:productId/pause",
  authOrganizerOrOperator,
  async (req: Request, res: Response) => {
    try {
      await verifyProductControlAccess(
        productId(req),
        req.organizer
          ? { type: "organizer", accountId: req.organizer.accountId }
          : { type: "operator", standId: req.operator!.standId }
      );
      res.status(501).json({ error: "Not implemented" });
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
  async (req: Request, res: Response) => {
    try {
      await verifyProductControlAccess(
        productId(req),
        req.organizer
          ? { type: "organizer", accountId: req.organizer.accountId }
          : { type: "operator", standId: req.operator!.standId }
      );
      res.status(501).json({ error: "Not implemented" });
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
      res.status(200).json(product);
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
