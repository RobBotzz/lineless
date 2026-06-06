import { Router, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { OperatorInvalidCredentialsError } from "./errors";
import { loginOperator } from "./service";
import { operatorLoginSchema } from "./types";

const operatorRouter = Router();

function handleError(err: unknown, res: Response): Response {
  if (err instanceof OperatorInvalidCredentialsError) {
    return res.status(401).json({ error: err.message });
  }

  console.error("Operator error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

operatorRouter.post(
  "/login",
  validateBody(operatorLoginSchema, async (_req, res, data) => {
    try {
      const result = await loginOperator(data);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  })
);

export default operatorRouter;
