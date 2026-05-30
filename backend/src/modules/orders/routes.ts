import { Router, Request, Response } from "express";
import { submitOrder } from "./service";
import { OrderValidationError } from "./errors";
// import { validateBody } from "../../middleware/validate";
// import { authAccount } from "../../middleware/auth";

type RequestWithUser = Request & { user?: { accountId?: string } };
export const ordersRouter = Router();

// ordersRouter.use(authAccount);

ordersRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as RequestWithUser).user?.accountId || "test-user-id";
    const result = await submitOrder(userId, req.body);
    
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
});