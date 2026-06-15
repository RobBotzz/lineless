import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { createTab, checkoutTab } from "./service";
import { TabNotFoundError, TabStateError } from "./errors";
import { authAttendee } from "../../middleware/auth/guards";
import { CreateTabSchema } from "./types";

function tabId(req: Request): string {
  return req.params["tabId"] as string;
}

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

tabsRouter.post(
  "/:tabId/checkout",
  authAttendee,
  async (req: Request, res: Response) => {
    try {
      const result = await checkoutTab(tabId(req), req.attendee!.sessionId);
      return res.status(200).json(result);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

export default tabsRouter;
