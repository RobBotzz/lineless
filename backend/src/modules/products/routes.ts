import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  softDeleteProduct,
} from "./service";
import { ProductNotFoundError } from "./errors";
import { StandNotFoundError } from "../stands/errors";
import { EventNotFoundError } from "../events/errors";
import { createProductSchema, updateProductSchema } from "./types";
import { authAccount } from "../../middleware/authAccount";
import { authAccountOrSession } from "../../middleware/authAccountOrSession";

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
standProductsRouter.use(authAccount);

// POST /stands/:standId/products
standProductsRouter.post(
  "/",
  validateBody(createProductSchema, async (req, res, data) => {
    try {
      const product = await createProduct(
        standId(req),
        req.user!.accountId,
        data
      );
      res.status(201).json(product);
    } catch (err) {
      handleError(err, res);
    }
  })
);

// GET /stands/:standId/products
standProductsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const products = await listProducts(standId(req), req.user!.accountId);
    res.status(200).json(products);
  } catch (err) {
    handleError(err, res);
  }
});

// =============================================================================
// Product-id routes — mounted at /products/:productId (no standId in the URL)
// =============================================================================
export const productsRouter = Router();

// GET /products/:productId — readable by organizer and attendee (session)
productsRouter.get(
  "/:productId",
  authAccountOrSession,
  async (req: Request, res: Response) => {
    try {
      const product = await getProduct(productId(req));
      res.status(200).json(product);
    } catch (err) {
      handleError(err, res);
    }
  }
);

productsRouter.use(authAccount);

// PATCH /products/:productId
productsRouter.patch(
  "/:productId",
  validateBody(updateProductSchema, async (req, res, data) => {
    try {
      const product = await updateProduct(
        productId(req),
        req.user!.accountId,
        data
      );
      res.status(200).json(product);
    } catch (err) {
      handleError(err, res);
    }
  })
);

// DELETE /products/:productId
productsRouter.delete("/:productId", async (req: Request, res: Response) => {
  try {
    await softDeleteProduct(productId(req), req.user!.accountId);
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
});

// POST /products/:productId/pause — placeholder for the LIVE -> PAUSED
// transition. Status is intentionally NOT settable via PATCH; it gets its own
// endpoint.
// TODO: implement pauseProduct in the service as an explicit, validated state
// transition (mirror the events start/stop pattern with a ProductStateError).
productsRouter.post("/:productId/pause", (_req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented" });
});

// POST /products/:productId/terminate — placeholder for the -> TERMINATED
// transition (terminal state).
// TODO: implement terminateProduct in the service as an explicit, validated
// state transition (mirror the events start/stop pattern with a
// ProductStateError).
productsRouter.post("/:productId/terminate", (_req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented" });
});
