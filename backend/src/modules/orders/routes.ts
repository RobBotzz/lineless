import { Router } from "express";
import { confirmCashPayment, submitOrder } from "./service";
import {
  CashierDisabledError,
  EventNotActiveError,
  OfflineOrdersDisabledError,
  OrderAlreadyPaidError,
  OrderNotFoundError,
  OrderValidationError,
  StandNotFoundError,
} from "./errors";
import { authOrganizerOrOperatorOrAttendee } from "../../middleware/auth/guards";
import { validateBody } from "../../middleware/validate";
import { ConfirmCashPaymentSchema, CreateOrderSchema } from "./types";

const ordersRouter = Router();

ordersRouter.post(
  "/",
  authOrganizerOrOperatorOrAttendee,
  validateBody(CreateOrderSchema, async (req, res, data) => {
    // Attendee orders carry a sessionId; operator (cashier) orders do not.
    const sessionId = req.attendee?.sessionId ?? null;
    try {
      const result = await submitOrder(sessionId, data);

      if (result.status === 402) {
        return res.status(402).json({ clientSecret: result.clientSecret });
      }
      return res.status(201).json({ order: result.order });
    } catch (error) {
      if (error instanceof StandNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof EventNotActiveError) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof OfflineOrdersDisabledError) {
        return res.status(403).json({ error: error.message });
      }
      if (error instanceof OrderValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof CashierDisabledError) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal Server Error" });
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
      if (error instanceof OrderNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof OrderAlreadyPaidError) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof CashierDisabledError) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal Server Error" });
    }
  })
);

export default ordersRouter;
