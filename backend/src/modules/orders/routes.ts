import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  advanceOrderItem,
  cancelOrderForOrganizer,
  cancelOrderItemsForOrganizer,
  deleteUnpaidOrder,
  getOrderForAttendee,
  getOrderForCashier,
  getOrderForOrganizer,
  listOrdersForAttendee,
  listUnpaidOrdersForCashier,
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
} from "./errors";
import { EventNotFoundError } from "../events/errors";
import { cancelOrderItemsSchema, createOrderSchema } from "./types";
import {
  authAttendee,
  authOrganizer,
  authOperator,
  authOrganizerOrOperatorOrAttendee,
  authOperatorOrAttendee,
} from "../../middleware/auth/guards";

function orderId(req: Request): string {
  return req.params["orderId"] as string;
}

function itemId(req: Request): string {
  return req.params["itemId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof OrderNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof OrderItemNotFoundError)
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

// GET /orders — an attendee's own paid orders (order-status / review entry point).
ordersRouter.get("/", authAttendee, async (req: Request, res: Response) => {
  try {
    const orders = await listOrdersForAttendee(req.attendee!.sessionId);
    return res.status(200).json(orders);
  } catch (err) {
    return handleError(err, res);
  }
});

// GET /orders/cashier — unpaid orders for the cashier's event, derived from the
// operator token (consistent with all other operator routes).
// Must be registered before /:orderId to avoid Express matching "cashier" as an orderId.
ordersRouter.get(
  "/cashier",
  authOperator,
  async (req: Request, res: Response) => {
    try {
      const orders = await listUnpaidOrdersForCashier(req.operator!.standId);
      return res.status(200).json(orders);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// GET /orders/:orderId — fetch a single order by ID (organizer, attendee, or a
// cashier operator collecting a cash payment for an order in its event).
ordersRouter.get(
  "/:orderId",
  authOrganizerOrOperatorOrAttendee,
  async (req: Request, res: Response) => {
    try {
      const order = req.organizer
        ? await getOrderForOrganizer(orderId(req), req.organizer.accountId)
        : req.operator
          ? await getOrderForCashier(orderId(req), req.operator.standId)
          : await getOrderForAttendee(orderId(req), req.attendee!.sessionId);
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /orders/:orderId/cancel — organizer cancels all not-ready order items.
ordersRouter.post(
  "/:orderId/cancel",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const order = await cancelOrderForOrganizer(
        orderId(req),
        req.organizer!.accountId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /orders/:orderId/items/cancel — organizer cancels selected order items.
ordersRouter.post(
  "/:orderId/items/cancel",
  authOrganizer,
  validateBody(cancelOrderItemsSchema, async (req, res, data) => {
    try {
      const order = await cancelOrderItemsForOrganizer(
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

function itemTransition(action: "start" | "ready" | "fulfill" | "cancel") {
  return async (req: Request, res: Response): Promise<unknown> => {
    try {
      const order = await advanceOrderItem(
        orderId(req),
        itemId(req),
        action,
        req.operator!.standId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  };
}

// POST /orders/:orderId/items/:itemId/{start|ready|fulfill|cancel} — operator
// drives the item state machine (PENDING → PREPARING → READY → FULFILLED, or cancel).
ordersRouter.post(
  "/:orderId/items/:itemId/start",
  authOperator,
  itemTransition("start")
);
ordersRouter.post(
  "/:orderId/items/:itemId/ready",
  authOperator,
  itemTransition("ready")
);
ordersRouter.post(
  "/:orderId/items/:itemId/fulfill",
  authOperator,
  itemTransition("fulfill")
);
ordersRouter.post(
  "/:orderId/items/:itemId/cancel",
  authOperator,
  itemTransition("cancel")
);

// DELETE /orders/cashier/:orderId — soft-delete an unpaid cash order.
// Must be registered before /:orderId to avoid Express route shadowing.
ordersRouter.delete(
  "/cashier/:orderId",
  authOperator,
  async (req: Request, res: Response) => {
    try {
      await deleteUnpaidOrder(
        req.params["orderId"] as string,
        req.operator!.standId
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res);
    }
  }
);
