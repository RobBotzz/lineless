import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  createEvent,
  listEvents,
  getEvent,
  updateEvent,
  startEvent,
  stopEvent,
  softDeleteEvent,
} from "./service";
import { EventNotFoundError, EventStateError } from "./errors";
import { createEventSchema, updateEventSchema } from "./types";
import { authAccount } from "../../middleware/authAccount";
import eventLocationRouter from "./location.routes";

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

eventsRouter.use("/:eventId/location", eventLocationRouter);

eventsRouter.use(authAccount);

eventsRouter.post(
  "/",
  validateBody(createEventSchema, async (req, res, data) => {
    try {
      const event = await createEvent(req.user!.accountId, data);
      res.status(201).json(event);
    } catch (err) {
      handleError(err, res);
    }
  })
);

eventsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const events = await listEvents(req.user!.accountId);
    res.status(200).json(events);
  } catch (err) {
    handleError(err, res);
  }
});

eventsRouter.get("/:eventId", async (req: Request, res: Response) => {
  try {
    const event = await getEvent(eventId(req), req.user!.accountId);
    res.status(200).json(event);
  } catch (err) {
    handleError(err, res);
  }
});

eventsRouter.patch(
  "/:eventId",
  validateBody(updateEventSchema, async (req, res, data) => {
    try {
      const event = await updateEvent(eventId(req), req.user!.accountId, data);
      res.status(200).json(event);
    } catch (err) {
      handleError(err, res);
    }
  })
);

eventsRouter.post("/:eventId/start", async (req: Request, res: Response) => {
  try {
    const event = await startEvent(eventId(req), req.user!.accountId);
    res.status(200).json(event);
  } catch (err) {
    handleError(err, res);
  }
});

eventsRouter.post("/:eventId/stop", async (req: Request, res: Response) => {
  try {
    const event = await stopEvent(eventId(req), req.user!.accountId);
    res.status(200).json(event);
  } catch (err) {
    handleError(err, res);
  }
});

eventsRouter.delete("/:eventId", async (req: Request, res: Response) => {
  try {
    await softDeleteEvent(eventId(req), req.user!.accountId);
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
});

export default eventsRouter;
