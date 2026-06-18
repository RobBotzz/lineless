import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  advanceOrderItem,
  cancelPendingOrder,
  confirmCashPayment,
  getOrderForAttendee,
  getOrderForCashier,
  getOrderForOrganizer,
  issueCashRefund,
  listOrdersForAttendee,
  listUnpaidOrdersForCashier,
  submitOrder,
} from "./service";
import {
  CashierDisabledError,
  CashPaymentNotFoundError,
  CashRefundExceedsTotalError,
  EventNotActiveError,
  OfflineOrdersDisabledError,
  OrderAlreadyPaidError,
  OrderItemNotFoundError,
  OrderItemStateError,
  OrderNotFoundError,
  OrderValidationError,
  StandNotFoundError,
} from "./errors";
import {
  ConfirmCashPaymentSchema,
  CreateOrderSchema,
  IssueCashRefundSchema,
} from "./types";
import { EventNotFoundError } from "../events/errors";
import {
  authAttendee,
  authOperator,
  authOperatorOrAttendee,
  authOrganizerOrOperator,
  authOrganizerOrOperatorOrAttendee,
} from "../../middleware/auth/guards";

function orderId(req: Request): string {
  return req.params["orderId"] as string;
}

function itemId(req: Request): string {
  return req.params["itemId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof StandNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof OrderNotFoundError)
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
  if (err instanceof OrderAlreadyPaidError)
    return res.status(409).json({ error: err.message });
  if (err instanceof OrderItemStateError)
    return res.status(409).json({ error: err.message });
  if (err instanceof CashPaymentNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof CashRefundExceedsTotalError)
    return res.status(422).json({ error: err.message });
  console.error("Orders error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// =============================================================================
// Orders routes — mounted at /api/orders
// =============================================================================
export const ordersRouter = Router();

// POST /orders — submit an order (attendee or operator/cashier). Tab orders that
// exceed the authorized hold return 402 with a client secret for the new hold.
ordersRouter.post(
  "/",
  authOperatorOrAttendee,
  validateBody(CreateOrderSchema, async (req, res, data) => {
    try {
      const sessionId = req.attendee?.sessionId ?? null;
      const result = await submitOrder(sessionId, data);
      if (result.status === 402) {
        return res
          .status(402)
          .json({ clientSecret: result.clientSecret, orderId: result.orderId });
      }
      return res.status(201).json({ order: result.order });
    } catch (err) {
      return handleError(err, res);
    }
  })
);

// POST /orders/:orderId/cash-payment — operator/cashier confirms cash received.
ordersRouter.post(
  "/:orderId/cash-payment",
  authOrganizerOrOperator,
  validateBody(ConfirmCashPaymentSchema, async (req, res) => {
    try {
      const order = await confirmCashPayment(
        orderId(req),
        req.organizer
          ? { organizerAccountId: req.organizer.accountId }
          : { operatorStandId: req.operator!.standId }
      );
      return res.status(201).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  })
);

// POST /orders/:orderId/cancel — attendee abandons an order still awaiting
// authorization (cancels its gated items and releases any backing hold).
ordersRouter.post(
  "/:orderId/cancel",
  authAttendee,
  async (req: Request, res: Response) => {
    try {
      const order = await cancelPendingOrder(
        orderId(req),
        req.attendee!.sessionId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// GET /orders/cashier — unpaid orders for the cashier's event, derived from the
// operator token. Registered before /:orderId so "cashier" is not read as an id.
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

// GET /orders — an attendee's own paid orders (order-status / review entry point).
ordersRouter.get("/", authAttendee, async (req: Request, res: Response) => {
  try {
    const orders = await listOrdersForAttendee(req.attendee!.sessionId);
    return res.status(200).json(orders);
  } catch (err) {
    return handleError(err, res);
  }
});

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

// Cash refunds are addressed by the embedded cashPayment id, so they live on a
// separate router mounted at /api/cash-payments while sharing the orders logic.
export const cashPaymentsRouter = Router();

cashPaymentsRouter.post(
  "/:cashPaymentId/refund",
  authOrganizerOrOperator,
  validateBody(IssueCashRefundSchema, async (req, res, data) => {
    try {
      const refund = await issueCashRefund(
        req.params["cashPaymentId"] as string,
        data,
        req.organizer
          ? { organizerAccountId: req.organizer.accountId }
          : { operatorStandId: req.operator!.standId }
      );
      return res.status(201).json(refund);
    } catch (err) {
      return handleError(err, res);
    }
  })
);
