import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { authOrganizer } from "../../middleware/auth/guards";
import { EventNotFoundError } from "../events/errors";
import {
  getEventControlCenter,
  verifyStandPausePreconditions,
} from "./service";
import {
  cancelOrderForOrganizer,
  cancelOrderItemsForOrganizer,
} from "../orders/service";
import {
  OrderItemNotFoundError,
  OrderItemStateError,
  OrderNotFoundError,
} from "../orders/errors";
import { pauseProductForEventControlCenter } from "../products/service";
import { ProductNotFoundError, ProductStateError } from "../products/errors";
import { StandNotFoundError } from "../stands/errors";
import { cancelOrderItemsSchema, eventControlCenterQuerySchema } from "./types";

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function orderId(req: Request): string {
  return req.params["orderId"] as string;
}

function standId(req: Request): string {
  return req.params["standId"] as string;
}

function productId(req: Request): string {
  return req.params["productId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof EventNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof OrderNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof OrderItemNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof ProductNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof StandNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof OrderItemStateError) {
    return res.status(409).json({ error: err.message });
  }
  if (err instanceof ProductStateError) {
    return res.status(409).json({ error: err.message });
  }
  console.error("Event control center error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

export const eventControlCenterRouter = Router({ mergeParams: true });

// GET /events/:eventId/event-control-center — organizer-only event control center data.
// TODO SSE: expose this snapshot through shared SSE infrastructure once it exists.
eventControlCenterRouter.get("/", authOrganizer, async (req, res) => {
  try {
    const query = eventControlCenterQuerySchema.safeParse(req.query);
    if (!query.success) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: query.error.issues });
    }

    const eventControlCenter = await getEventControlCenter(
      eventId(req),
      req.organizer!.accountId,
      query.data
    );
    return res.status(200).json(eventControlCenter);
  } catch (err) {
    return handleError(err, res);
  }
});

// POST /events/:eventId/event-control-center/orders/:orderId/cancel
eventControlCenterRouter.post(
  "/orders/:orderId/cancel",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const order = await cancelOrderForOrganizer(
        eventId(req),
        orderId(req),
        req.organizer!.accountId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /events/:eventId/event-control-center/orders/:orderId/items/cancel
eventControlCenterRouter.post(
  "/orders/:orderId/items/cancel",
  authOrganizer,
  validateBody(cancelOrderItemsSchema, async (req, res, data) => {
    try {
      const order = await cancelOrderItemsForOrganizer(
        eventId(req),
        orderId(req),
        data.itemIds,
        req.organizer!.accountId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  })
);

// POST /events/:eventId/event-control-center/stands/:standId/products/:productId/pause
eventControlCenterRouter.post(
  "/stands/:standId/products/:productId/pause",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const product = await pauseProductForEventControlCenter(
        eventId(req),
        standId(req),
        productId(req),
        req.organizer!.accountId
      );
      return res.status(200).json(product);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /events/:eventId/event-control-center/stands/:standId/pause
eventControlCenterRouter.post(
  "/stands/:standId/pause",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      await verifyStandPausePreconditions(
        eventId(req),
        standId(req),
        req.organizer!.accountId
      );
      // TODO: Stand pause requires Stand pause state support first, e.g.
      // pausedAt, attendee menu exposure, and order-submission blocking for
      // products on paused stands. TODO SSE: publish stand availability after
      // shared SSE infrastructure exists.
      return res.status(501).json({
        error:
          "Stand pause is not implemented until stand pause state support exists",
      });
    } catch (err) {
      return handleError(err, res);
    }
  }
);
