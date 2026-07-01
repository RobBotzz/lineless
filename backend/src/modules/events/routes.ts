import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  createEvent,
  listEvents,
  getEventForAttendee,
  getEventForOperatorLink,
  getEventForOrganizer,
  updateEvent,
  startEvent,
  stopEvent,
  rotateOperatorAccessKey,
  softDeleteEvent,
} from "./service";
import { EventNotFoundError, EventStateError } from "./errors";
import { createEventSchema, updateEventSchema } from "./types";
import { checkoutTabsForOrganizerEvent } from "../tabs/service";
import {
  authOrganizer,
  authOrganizerOrAttendeeOrEventLink,
} from "../../middleware/auth/guards";

const eventsRouter = Router();

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof EventNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof EventStateError) {
    return res.status(409).json({ error: err.message });
  }
  console.error("Events error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// GET /events/:eventId — readable by organizer, attendee (session), and
// operator (event-scoped access key, e.g. the cashier).
eventsRouter.get(
  "/:eventId",
  authOrganizerOrAttendeeOrEventLink,
  async (req: Request, res: Response) => {
    try {
      let event;
      if (req.organizer) {
        event = await getEventForOrganizer(
          eventId(req),
          req.organizer.accountId
        );
      } else if (req.attendee) {
        event = await getEventForAttendee(eventId(req), req.attendee.eventId);
      } else {
        event = await getEventForOperatorLink(
          eventId(req),
          req.operatorLink!.eventId
        );
      }
      res.status(200).json(event);
    } catch (err) {
      handleError(err, res);
    }
  }
);

eventsRouter.post(
  "/",
  authOrganizer,
  validateBody(createEventSchema, async (req, res, data) => {
    try {
      const event = await createEvent(req.organizer!.accountId, data);
      res.status(201).json(event);
    } catch (err) {
      handleError(err, res);
    }
  })
);

eventsRouter.get("/", authOrganizer, async (req: Request, res: Response) => {
  try {
    const events = await listEvents(req.organizer!.accountId);
    res.status(200).json(events);
  } catch (err) {
    handleError(err, res);
  }
});

eventsRouter.patch(
  "/:eventId",
  authOrganizer,
  validateBody(updateEventSchema, async (req, res, data) => {
    try {
      const event = await updateEvent(
        eventId(req),
        req.organizer!.accountId,
        data
      );
      res.status(200).json(event);
    } catch (err) {
      handleError(err, res);
    }
  })
);

eventsRouter.post(
  "/:eventId/start",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const event = await startEvent(eventId(req), req.organizer!.accountId);
      res.status(200).json(event);
    } catch (err) {
      handleError(err, res);
    }
  }
);

eventsRouter.post(
  "/:eventId/stop",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const event = await stopEvent(eventId(req), req.organizer!.accountId);
      res.status(200).json(event);
    } catch (err) {
      handleError(err, res);
    }
  }
);

eventsRouter.post(
  "/:eventId/tabs/checkout",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const result = await checkoutTabsForOrganizerEvent(
        eventId(req),
        req.organizer!.accountId
      );
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  }
);

eventsRouter.post(
  "/:eventId/operator-link/rotate",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const result = await rotateOperatorAccessKey(
        eventId(req),
        req.organizer!.accountId
      );
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  }
);

eventsRouter.delete(
  "/:eventId",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      await softDeleteEvent(eventId(req), req.organizer!.accountId);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  }
);

export default eventsRouter;
