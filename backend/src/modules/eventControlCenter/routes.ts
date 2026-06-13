import { Router, type Request, type Response } from "express";
import { authOrganizer } from "../../middleware/auth/guards";
import { EventNotFoundError } from "../events/errors";
import { getEventControlCenter } from "./service";

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof EventNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  console.error("Event control center error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

export const eventControlCenterRouter = Router({ mergeParams: true });

// GET /events/:eventId/event-control-center — organizer-only event control center data.
eventControlCenterRouter.get("/", authOrganizer, async (req, res) => {
  try {
    const eventControlCenter = await getEventControlCenter(
      eventId(req),
      req.organizer!.accountId
    );
    res.status(200).json(eventControlCenter);
  } catch (err) {
    handleError(err, res);
  }
});
