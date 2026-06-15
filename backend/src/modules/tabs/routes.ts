import { Router, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { createTab } from "./service";
import { TabNotFoundError, TabStateError } from "./errors";
import { authAttendee } from "../../middleware/auth/guards";
import { CreateTabSchema } from "./types";

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof TabNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof TabStateError)
    return res.status(409).json({ error: err.message });
  console.error("Tabs error:", err);
  return res.status(500).json({ error: "Internal Server Error" });
}

const tabsRouter = Router();

tabsRouter.post(
  "/",
  authAttendee,
  validateBody(CreateTabSchema, async (req, res, data) => {
    try {
      const result = await createTab(req.attendee!.sessionId, data.eventId);
      return res.status(201).json(result);
    } catch (err) {
      return handleError(err, res);
    }
  })
);

export default tabsRouter;
