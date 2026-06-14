import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { authOrganizer } from "../../middleware/auth/guards";
import { EventNotFoundError } from "../events/errors";
import {
  getEventControlCenter,
  listLiveOrdersForEventControlCenter,
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
import {
  pauseProductForEventControlCenter,
  resumeProductForEventControlCenter,
} from "../products/service";
import { ProductNotFoundError, ProductStateError } from "../products/errors";
import { StandNotFoundError } from "../stands/errors";
import {
  cancelOrderItemsSchema,
  eventControlCenterQuerySchema,
  liveOrdersQuerySchema,
} from "./types";

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
// TODO SSE: publish order-list and analytics updates after cancellation.
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
// TODO SSE: publish order-list and analytics updates after partial cancellation.
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

// GET /events/:eventId/event-control-center/orders — live, paid, unfulfilled orders.
// TODO SSE: expose this order list through shared SSE infrastructure once it exists.
eventControlCenterRouter.get(
  "/orders",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const query = liveOrdersQuerySchema.safeParse(req.query);
      if (!query.success) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: query.error.issues });
      }

      const orders = await listLiveOrdersForEventControlCenter(
        eventId(req),
        req.organizer!.accountId,
        query.data
      );
      return res.status(200).json(orders);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /events/:eventId/event-control-center/stands/:standId/products/:productId/pause
// TODO SSE: publish product availability and analytics/order-list updates after pausing.
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

// POST /events/:eventId/event-control-center/stands/:standId/products/:productId/resume
// TODO SSE: publish product availability updates after resuming.
eventControlCenterRouter.post(
  "/stands/:standId/products/:productId/resume",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const product = await resumeProductForEventControlCenter(
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
