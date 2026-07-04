import { Router, type Request, type Response } from "express";
import { createTab, getTabForAttendee } from "./service";
import { TabNotFoundError, TabStateError } from "./errors";
import { EventNotFoundError } from "../events/errors";
import { authAttendee } from "../../middleware/auth/guards";

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof TabNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof TabStateError)
    return res.status(409).json({ error: err.message });
  console.error("Tabs error:", err);
  return res.status(500).json({ error: "Internal Server Error" });
}

const tabsRouter = Router();

// POST /tabs — the attendee session is bound to exactly one event, so the
// event is derived from the session; no event is taken from the request body.
tabsRouter.post("/", authAttendee, async (req: Request, res: Response) => {
  try {
    const rawFirstOrder = Number(
      (req.body as { firstOrderCents?: unknown })?.firstOrderCents
    );
    const firstOrderCents =
      Number.isFinite(rawFirstOrder) && rawFirstOrder > 0
        ? Math.floor(rawFirstOrder)
        : 0;
    const result = await createTab(
      req.attendee!.sessionId,
      req.attendee!.eventId,
      firstOrderCents
    );
    return res.status(201).json(result);
  } catch (err) {
    return handleError(err, res);
  }
});

// GET /tabs/:tabId — the owning attendee polls tab status (and headroom) while
// waiting for the Stripe authorization webhook to flip the tab to OPEN.
tabsRouter.get("/:tabId", authAttendee, async (req: Request, res: Response) => {
  try {
    const tab = await getTabForAttendee(
      req.params["tabId"] as string,
      req.attendee!.sessionId
    );
    return res.status(200).json(tab);
  } catch (err) {
    return handleError(err, res);
  }
});

export default tabsRouter;
