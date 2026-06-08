import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  advanceOrderItem,
  getOrderByAuthCode,
  getOrderForAttendee,
  getOrderForOperator,
  getOrderForOrganizer,
  listOrdersForStand,
  submitOrder,
} from "./service";
import {
  CashierDisabledError,
  EventNotActiveError,
  OfflineOrdersDisabledError,
  OrderItemNotFoundError,
  OrderItemStateError,
  OrderNotFoundError,
  OrderValidationError,
  StandNotFoundError,
} from "./errors";
import { createOrderSchema } from "./types";
import {
  authOrganizerOrOperator,
  authOrganizerOrOperatorOrAttendee,
} from "../../middleware/auth/guards";

function orderId(req: Request): string {
  return req.params["orderId"] as string;
}

function itemId(req: Request): string {
  return req.params["itemId"] as string;
}

function standId(req: Request): string {
  return req.params["standId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof OrderNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof OrderItemNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof StandNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotActiveError)
    return res.status(409).json({ error: err.message });
  if (err instanceof OrderValidationError)
    return res.status(400).json({ error: err.message });
  if (err instanceof OfflineOrdersDisabledError)
    return res.status(403).json({ error: err.message });
  if (err instanceof CashierDisabledError)
    return res.status(403).json({ error: err.message });
  if (err instanceof OrderItemStateError)
    return res.status(409).json({ error: err.message });
  console.error("Orders error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// =============================================================================
// Orders routes — mounted at /api/orders
// =============================================================================
export const ordersRouter = Router();

// POST /orders — submit an order (attendee, operator/cashier, or organizer).
ordersRouter.post(
  "/",
  authOrganizerOrOperatorOrAttendee,
  validateBody(createOrderSchema, async (req, res, data) => {
    try {
      const sessionId = req.attendee?.sessionId ?? null;
      const order = await submitOrder(sessionId, data);
      return res.status(201).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  })
);

// GET /orders/status?authCode=XXX — public authCode lookup for attendee status page.
// Must be registered before /:orderId to avoid Express matching "status" as an id.
ordersRouter.get("/status", async (req: Request, res: Response) => {
  try {
    const authCode = req.query["authCode"];
    if (typeof authCode !== "string" || authCode.trim() === "") {
      return res
        .status(400)
        .json({ error: "authCode query parameter is required" });
    }
    const order = await getOrderByAuthCode(authCode);
    return res.status(200).json(order);
  } catch (err) {
    return handleError(err, res);
  }
});

// GET /orders/:orderId — fetch a single order by ID.
ordersRouter.get(
  "/:orderId",
  authOrganizerOrOperatorOrAttendee,
  async (req: Request, res: Response) => {
    try {
      const order = req.organizer
        ? await getOrderForOrganizer(orderId(req), req.organizer.accountId)
        : req.operator
          ? await getOrderForOperator(orderId(req), req.operator.standId)
          : await getOrderForAttendee(orderId(req), req.attendee!.sessionId);
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /orders/:orderId/items/:itemId/start — PENDING → PREPARING (operator).
ordersRouter.post(
  "/:orderId/items/:itemId/start",
  authOrganizerOrOperator,
  async (req: Request, res: Response) => {
    try {
      if (!req.operator)
        return res
          .status(403)
          .json({ error: "Operator authentication required" });
      const order = await advanceOrderItem(
        orderId(req),
        itemId(req),
        "start",
        req.operator.standId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /orders/:orderId/items/:itemId/ready — PREPARING → READY (operator).
ordersRouter.post(
  "/:orderId/items/:itemId/ready",
  authOrganizerOrOperator,
  async (req: Request, res: Response) => {
    try {
      if (!req.operator)
        return res
          .status(403)
          .json({ error: "Operator authentication required" });
      const order = await advanceOrderItem(
        orderId(req),
        itemId(req),
        "ready",
        req.operator.standId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /orders/:orderId/items/:itemId/fulfill — READY → FULFILLED (operator).
ordersRouter.post(
  "/:orderId/items/:itemId/fulfill",
  authOrganizerOrOperator,
  async (req: Request, res: Response) => {
    try {
      if (!req.operator)
        return res
          .status(403)
          .json({ error: "Operator authentication required" });
      const order = await advanceOrderItem(
        orderId(req),
        itemId(req),
        "fulfill",
        req.operator.standId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /orders/:orderId/items/:itemId/cancel — cancel item (operator).
ordersRouter.post(
  "/:orderId/items/:itemId/cancel",
  authOrganizerOrOperator,
  async (req: Request, res: Response) => {
    try {
      if (!req.operator)
        return res
          .status(403)
          .json({ error: "Operator authentication required" });
      const order = await advanceOrderItem(
        orderId(req),
        itemId(req),
        "cancel",
        req.operator.standId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// =============================================================================
// Stand-scoped order routes — mounted at /api/stands/:standId/orders
// =============================================================================
export const standOrdersRouter = Router({ mergeParams: true });

// GET /stands/:standId/orders — list orders for the stand (organizer or operator).
standOrdersRouter.get(
  "/",
  authOrganizerOrOperator,
  async (req: Request, res: Response) => {
    try {
      const orders = await listOrdersForStand(
        standId(req),
        req.organizer
          ? { type: "organizer", accountId: req.organizer.accountId }
          : { type: "operator", standId: req.operator!.standId }
      );
      return res.status(200).json(orders);
    } catch (err) {
      return handleError(err, res);
    }
  }
);
