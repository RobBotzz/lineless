import { Router } from "express";
import { submitOrder } from "./service";
import { OrderValidationError } from "./errors";
import { authAccount } from "../../middleware/authAccount";
import { validateBody } from "../../middleware/validate";
import { CreateOrderSchema } from "./types";

const ordersRouter = Router();

ordersRouter.use(authAccount);

ordersRouter.post(
  "/",
  validateBody(CreateOrderSchema, async (req, res, data) => {
    try {
      const userId = req.user!.accountId;
      const result = await submitOrder(userId, data);

      if (result.status === 402) {
        return res.status(402).json({ clientSecret: result.clientSecret });
      }
      return res.status(201).json({ order: result.order });
    } catch (error) {
      if (error instanceof OrderValidationError) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal Server Error" });
    }
  })
);

export default ordersRouter;