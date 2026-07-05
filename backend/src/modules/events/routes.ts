import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  createEvent,
  listEvents,
  getEventForAttendee,
  getEventForOperatorLink,
  getEventForOrganizer,
  getPublicEventInfo,
  updateEvent,
  startEvent,
  stopEvent,
  completeEvent,
  rotateOperatorAccessKey,
  softDeleteEvent,
  setEventLogo,
  getEventLogo,
  deleteEventLogo,
} from "./service";
import {
  EventLogoNotFoundError,
  EventNotActiveError,
  EventNotFoundError,
  EventStateError,
  ImageTooLargeError,
  InvalidImageError,
} from "./errors";
import { createEventSchema, updateEventSchema } from "./types";
import { checkoutTabsForOrganizerEvent } from "../tabs/service";
import {
  authOrganizer,
  authOrganizerOrAttendeeOrEventLink,
} from "../../middleware/auth/guards";
import { uploadSingleImage } from "../../shared/imageUpload";

const eventsRouter = Router();

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof EventNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof EventNotActiveError) {
    // 409: the event exists but is not shoppable. eventStatus lets the frontend
    // explain whether it has not started yet or has already ended; branding lets
    // it render that screen in the shop's own colors + logo.
    return res.status(409).json({
      error: err.message,
      eventStatus: err.eventStatus,
      branding: err.branding,
    });
  }
  if (err instanceof EventStateError) {
    return res.status(409).json({ error: err.message });
  }
  if (err instanceof EventLogoNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof InvalidImageError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof ImageTooLargeError) {
    return res.status(413).json({ error: err.message });
  }
  console.error("Events error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// Accepts a single multipart "image" field; maps multer errors via handleError.
const uploadEventLogo = uploadSingleImage("image", handleError);

// GET /events/:eventId/public-info — no auth; returns basic event info for gate
// pages (coming soon, closed, finished) before the attendee has a session.
eventsRouter.get(
  "/:eventId/public-info",
  async (req: Request, res: Response) => {
    try {
      const info = await getPublicEventInfo(eventId(req));
      res.status(200).json(info);
    } catch (err) {
      handleError(err, res);
    }
  }
);

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
  "/:eventId/complete",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const event = await completeEvent(eventId(req), req.organizer!.accountId);
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

// PUT /events/:eventId/logo — organizer uploads/replaces the event logo.
// multipart/form-data with a single file field named "image".
eventsRouter.put(
  "/:eventId/logo",
  authOrganizer,
  uploadEventLogo,
  async (req: Request, res: Response) => {
    try {
      if (!req.file) throw new InvalidImageError("No image file provided");
      const event = await setEventLogo(eventId(req), req.organizer!.accountId, {
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });
      res.status(200).json(event);
    } catch (err) {
      handleError(err, res);
    }
  }
);

// GET /events/:eventId/logo — public; serves the raw logo bytes so the frontend
// can use it directly as an <img> src. Cached and ETag'd.
eventsRouter.get("/:eventId/logo", async (req: Request, res: Response) => {
  try {
    const logo = await getEventLogo(eventId(req));
    res.set("Content-Type", logo.contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.set("ETag", `"${logo._id}-${logo.updatedAt.getTime()}"`);
    res.send(logo.data);
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /events/:eventId/logo — organizer removes the uploaded logo.
eventsRouter.delete(
  "/:eventId/logo",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const event = await deleteEventLogo(
        eventId(req),
        req.organizer!.accountId
      );
      res.status(200).json(event);
    } catch (err) {
      handleError(err, res);
    }
  }
);

export default eventsRouter;
