import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { z } from "zod";
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

function accountId(req: Request): string {
  return req.organizer!.accountId;
}

function route(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      handleError(err, res);
    }
  };
}

function parseQuery<S extends z.ZodType>(
  schema: S,
  req: Request,
  res: Response
): z.infer<S> | null {
  const query = schema.safeParse(req.query);
  if (!query.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: query.error.issues });
    return null;
  }
  return query.data;
}

function validateBodyRoute<S extends z.ZodType>(
  schema: S,
  handler: (req: Request, res: Response, data: z.infer<S>) => Promise<void>
): RequestHandler {
  return validateBody(schema, async (req, res, data) => {
    try {
      await handler(req, res, data);
    } catch (err) {
      handleError(err, res);
    }
  });
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
eventControlCenterRouter.get(
  "/",
  authOrganizer,
  route(async (req, res) => {
    const query = parseQuery(eventControlCenterQuerySchema, req, res);
    if (!query) return;

    const snapshot = await getEventControlCenter(
      eventId(req),
      accountId(req),
      query
    );
    res.status(200).json(snapshot);
  })
);

// POST /events/:eventId/event-control-center/orders/:orderId/cancel
// TODO SSE: publish order-list and analytics updates after cancellation.
eventControlCenterRouter.post(
  "/orders/:orderId/cancel",
  authOrganizer,
  route(async (req, res) => {
    const order = await cancelOrderForOrganizer(
      eventId(req),
      orderId(req),
      accountId(req)
    );
    res.status(200).json(order);
  })
);

// POST /events/:eventId/event-control-center/orders/:orderId/items/cancel
// TODO SSE: publish order-list and analytics updates after partial cancellation.
eventControlCenterRouter.post(
  "/orders/:orderId/items/cancel",
  authOrganizer,
  validateBodyRoute(cancelOrderItemsSchema, async (req, res, data) => {
    const order = await cancelOrderItemsForOrganizer(
      eventId(req),
      orderId(req),
      data.itemIds,
      accountId(req)
    );
    res.status(200).json(order);
  })
);

// GET /events/:eventId/event-control-center/orders — live, paid, unfulfilled orders.
// TODO SSE: expose this order list through shared SSE infrastructure once it exists.
eventControlCenterRouter.get(
  "/orders",
  authOrganizer,
  route(async (req, res) => {
    const query = parseQuery(liveOrdersQuerySchema, req, res);
    if (!query) return;

    const orders = await listLiveOrdersForEventControlCenter(
      eventId(req),
      accountId(req),
      query
    );
    res.status(200).json(orders);
  })
);

// POST /events/:eventId/event-control-center/stands/:standId/products/:productId/pause
// TODO SSE: publish product availability and analytics/order-list updates after pausing.
eventControlCenterRouter.post(
  "/stands/:standId/products/:productId/pause",
  authOrganizer,
  route(async (req, res) => {
    const product = await pauseProductForEventControlCenter(
      eventId(req),
      standId(req),
      productId(req),
      accountId(req)
    );
    res.status(200).json(product);
  })
);

// POST /events/:eventId/event-control-center/stands/:standId/products/:productId/resume
// TODO SSE: publish product availability updates after resuming.
eventControlCenterRouter.post(
  "/stands/:standId/products/:productId/resume",
  authOrganizer,
  route(async (req, res) => {
    const product = await resumeProductForEventControlCenter(
      eventId(req),
      standId(req),
      productId(req),
      accountId(req)
    );
    res.status(200).json(product);
  })
);
