import { Router, type Request } from "express";
import { validateBody, validateQuery } from "../../middleware/validate";
import { authOrganizer } from "../../middleware/auth/guards";
import {
  getEventControlCenter,
  listLiveOrdersForEventControlCenter,
} from "./service";
import {
  cancelOrderForOrganizer,
  cancelOrderItemsForOrganizer,
} from "../orders/service";
import {
  pauseProductForEventControlCenter,
  resumeProductForEventControlCenter,
} from "../products/service";
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

export const eventControlCenterRouter = Router({ mergeParams: true });

// GET /events/:eventId/event-control-center — organizer-only event control center data.
// TODO SSE: expose this snapshot through shared SSE infrastructure once it exists.
eventControlCenterRouter.get(
  "/",
  authOrganizer,
  validateQuery(eventControlCenterQuerySchema, async (req, res, query) => {
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
  async (req, res) => {
    const order = await cancelOrderForOrganizer(
      eventId(req),
      orderId(req),
      accountId(req)
    );
    res.status(200).json(order);
  }
);

// POST /events/:eventId/event-control-center/orders/:orderId/items/cancel
// TODO SSE: publish order-list and analytics updates after partial cancellation.
eventControlCenterRouter.post(
  "/orders/:orderId/items/cancel",
  authOrganizer,
  validateBody(cancelOrderItemsSchema, async (req, res, data) => {
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
  validateQuery(liveOrdersQuerySchema, async (req, res, query) => {
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
  async (req, res) => {
    const product = await pauseProductForEventControlCenter(
      eventId(req),
      standId(req),
      productId(req),
      accountId(req)
    );
    res.status(200).json(product);
  }
);

// POST /events/:eventId/event-control-center/stands/:standId/products/:productId/resume
// TODO SSE: publish product availability updates after resuming.
eventControlCenterRouter.post(
  "/stands/:standId/products/:productId/resume",
  authOrganizer,
  async (req, res) => {
    const product = await resumeProductForEventControlCenter(
      eventId(req),
      standId(req),
      productId(req),
      accountId(req)
    );
    res.status(200).json(product);
  }
);
