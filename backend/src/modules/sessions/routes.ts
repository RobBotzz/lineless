import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { authAttendee } from "../../middleware/auth/guards";
import { createAttendeeSession, setAttendeeSessionEmail } from "./service";
import { createSessionSchema, setSessionEmailSchema } from "./types";
import {
  AttendeeSessionInvalidError,
  SessionEventNotFoundError,
} from "./errors";

const sessionsRouter = Router();

function handleError(err: unknown, res: Response): Response {
  if (err instanceof SessionEventNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof AttendeeSessionInvalidError) {
    return res.status(401).json({ error: err.message });
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

sessionsRouter.patch(
  "/email",
  authAttendee,
  validateBody(setSessionEmailSchema, async (req: Request, res, data) => {
    try {
      const result = await setAttendeeSessionEmail(
        req.attendee!.sessionId,
        data
      );
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  })
);

export default sessionsRouter;
