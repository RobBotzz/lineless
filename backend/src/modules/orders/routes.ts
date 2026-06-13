import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  advanceOrderItem,
  confirmCashPayment,
  getOrderForAttendee,
  getOrderForOrganizer,
  submitOrder,
} from "./service";
import {
  CashierDisabledError,
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
  authOperator,
  authOrganizerOrAttendee,
  authOrganizerOrOperatorOrAttendee,
} from "../../middleware/auth/guards";
import { ConfirmCashPaymentSchema, CreateOrderSchema } from "./types";

function orderId(req: Request): string {
  return req.params["orderId"] as string;
}

function itemId(req: Request): string {
  return req.params["itemId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof StandNotFoundError)
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
  console.error("Orders error:", err);
  return res.status(500).json({ error: "Internal Server Error" });
}

const ordersRouter = Router();

ordersRouter.post(
  "/",
  authOrganizerOrOperatorOrAttendee,
  validateBody(CreateOrderSchema, async (req, res, data) => {
    const sessionId = req.attendee?.sessionId ?? null;
    try {
      const result = await submitOrder(sessionId, data);
      if (result.status === 402) {
        return res.status(402).json({ clientSecret: result.clientSecret });
      }
      return res.status(201).json({ order: result.order });
    } catch (error) {
      return handleError(error, res);
    }
  })
);

ordersRouter.post(
  "/:orderId/cash-payment",
  authOrganizerOrOperatorOrAttendee,
  validateBody(ConfirmCashPaymentSchema, async (req, res) => {
    try {
      const order = await confirmCashPayment(req.params["orderId"] as string);
      return res.status(201).json(order);
    } catch (error) {
      return handleError(error, res);
    }
  })
);

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

export default ordersRouter;
