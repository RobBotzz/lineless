import { Router, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { createAttendeeSession } from "./service";
import { createSessionSchema } from "./types";
import { SessionEventNotFoundError } from "./errors";

const sessionsRouter = Router();

function handleError(err: unknown, res: Response): Response {
  if (err instanceof SessionEventNotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  console.error("Sessions error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

sessionsRouter.post(
  "/create",
  validateBody(createSessionSchema, async (_req, res, data) => {
    try {
      const session = await createAttendeeSession(data);
      res.status(201).json(session);
    } catch (err) {
      handleError(err, res);
    }
  })
);

export default sessionsRouter;
