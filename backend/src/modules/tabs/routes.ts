import { Router } from "express";
import { createTab, checkoutTab } from "./service";
import { TabNotFoundError, TabStateError } from "./errors";
import { authAttendee } from "../../middleware/auth/guards";
import { validateBody } from "../../middleware/validate";
import { z } from "zod";

const CreateTabSchema = z.object({
  eventId: z.string().uuid(),
});

const tabsRouter = Router();

tabsRouter.post(
  "/",
  authAttendee,
  validateBody(CreateTabSchema, async (req, res, data) => {
    try {
      const sessionId = req.attendee!.sessionId;
      const result = await createTab(sessionId, data.eventId);
      return res.status(201).json(result);
    } catch {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  })
);

tabsRouter.post("/:tabId/checkout", authAttendee, async (req, res) => {
  try {
    const sessionId = req.attendee!.sessionId;
    const result = await checkoutTab(req.params["tabId"] as string, sessionId);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof TabNotFoundError)
      return res.status(404).json({ error: error.message });
    if (error instanceof TabStateError)
      return res.status(409).json({ error: error.message });
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default tabsRouter;
