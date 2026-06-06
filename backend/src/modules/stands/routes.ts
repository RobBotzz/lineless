import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  createStand,
  listStands,
  listStandsForAttendee,
  getStandForAttendee,
  getStandForOrganizer,
  getStandForOperator,
  updateStand,
  softDeleteStand,
} from "./service";
import { StandNotFoundError } from "./errors";
import { EventNotFoundError } from "../events/errors";
import { createStandSchema, updateStandSchema } from "./types";
import { authOrganizer } from "../../middleware/authOrganizer";
import {
  authOrganizerOrAttendee,
  authOrganizerOrOperatorOrAttendee,
} from "../../middleware/auth/combinations";

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function standId(req: Request): string {
  return req.params["standId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof StandNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  console.error("Stands error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// =============================================================================
// Event-scoped stand routes — mounted at /events/:eventId/stands
// =============================================================================
export const eventStandsRouter = Router({ mergeParams: true });

// POST /events/:eventId/stands
eventStandsRouter.post(
  "/",
  authOrganizer,
  validateBody(createStandSchema, async (req, res, data) => {
    try {
      const stand = await createStand(
        eventId(req),
        req.organizer!.accountId,
        data
      );
      res.status(201).json(stand);
    } catch (err) {
      handleError(err, res);
    }
  })
);

// GET /events/:eventId/stands
eventStandsRouter.get(
  "/",
  authOrganizerOrAttendee,
  async (req: Request, res: Response) => {
    try {
      const stands = req.organizer
        ? await listStands(eventId(req), req.organizer.accountId)
        : await listStandsForAttendee(eventId(req), req.attendee!.eventId);
      res.status(200).json(stands);
    } catch (err) {
      handleError(err, res);
    }
  }
);

// =============================================================================
// Stand-id routes — mounted at /stands/:standId (no eventId in the URL)
// =============================================================================
export const standsRouter = Router();

// GET /stands/:standId — readable by organizer, operator and attendee.
standsRouter.get(
  "/:standId",
  authOrganizerOrOperatorOrAttendee,
  async (req: Request, res: Response) => {
    try {
      const stand = req.organizer
        ? await getStandForOrganizer(standId(req), req.organizer.accountId)
        : req.operator
          ? await getStandForOperator(standId(req), req.operator.standId)
          : await getStandForAttendee(standId(req), req.attendee!.eventId);
      res.status(200).json(stand);
    } catch (err) {
      handleError(err, res);
    }
  }
);

standsRouter.use(authOrganizer);

// PATCH /stands/:standId
standsRouter.patch(
  "/:standId",
  validateBody(updateStandSchema, async (req, res, data) => {
    try {
      const stand = await updateStand(
        standId(req),
        req.organizer!.accountId,
        data
      );
      res.status(200).json(stand);
    } catch (err) {
      handleError(err, res);
    }
  })
);

// DELETE /stands/:standId
standsRouter.delete("/:standId", async (req: Request, res: Response) => {
  try {
    await softDeleteStand(standId(req), req.organizer!.accountId);
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
});
