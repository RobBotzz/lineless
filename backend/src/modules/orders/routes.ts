import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  advanceOrderItem,
  getOrderForAttendee,
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
  authOrganizerOrAttendee,
  authOrganizerOrOperator,
  authOperatorOrAttendee,
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

// POST /orders — submit an order (attendee or operator/cashier).
ordersRouter.post(
  "/",
  authOperatorOrAttendee,
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

// GET /orders/:orderId — fetch a single order by ID (organizer or attendee only).
ordersRouter.get(
  "/:orderId",
  authOrganizerOrAttendee,
  async (req: Request, res: Response) => {
    try {
      const order = req.organizer
        ? await getOrderForOrganizer(orderId(req), req.organizer.accountId)
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
