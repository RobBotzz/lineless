import { Router } from "express";
import { issueCashRefund } from "../orders/service";
import {
  CashPaymentNotFoundError,
  CashRefundExceedsTotalError,
} from "../orders/errors";
import { authOrganizerOrOperator } from "../../middleware/auth/guards";
import { validateBody } from "../../middleware/validate";
import { IssueCashRefundSchema } from "../orders/types";

const cashPaymentsRouter = Router();

cashPaymentsRouter.use(authOrganizerOrOperator);

cashPaymentsRouter.post(
  "/:cashPaymentId/refund",
  validateBody(IssueCashRefundSchema, async (req, res, data) => {
    try {
      const refund = await issueCashRefund(
        req.params["cashPaymentId"] as string,
        data
      );
      return res.status(201).json(refund);
    } catch (error) {
      if (error instanceof CashPaymentNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof CashRefundExceedsTotalError) {
        return res.status(422).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal Server Error" });
    }
  })
);

export default cashPaymentsRouter;
