import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  createStand,
  listStands,
  listStandsForAttendee,
  listStandsForEventLink,
  getStandForAttendee,
  getStandForOrganizer,
  getStandForOperator,
  loginOperator,
  refreshOperatorSession,
  logoutOperator,
  updateStand,
  softDeleteStand,
} from "./service";
import {
  CashierStandDisabledError,
  CashierStandProtectedError,
  OperatorInvalidCredentialsError,
  StandNotFoundError,
} from "./errors";
import { RefreshTokenInvalidError } from "../auth/errors";
import { refreshTokenSchema } from "../auth/types";
import { EventNotFoundError } from "../events/errors";
import {
  createStandSchema,
  operatorLoginSchema,
  updateStandSchema,
} from "./types";
import {
  authOrganizer,
  authOrganizerOrAttendeeOrEventLink,
  authOrganizerOrOperatorOrAttendee,
} from "../../middleware/auth/guards";

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
  if (err instanceof OperatorInvalidCredentialsError)
    return res.status(401).json({ error: err.message });
  if (err instanceof CashierStandDisabledError)
    return res.status(403).json({ error: err.message });
  if (err instanceof CashierStandProtectedError)
    return res.status(403).json({ error: err.message });
  if (err instanceof RefreshTokenInvalidError)
    return res.status(401).json({ error: err.message });
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

// GET /events/:eventId/stands — readable by the organizer (own event), an
// attendee (their session event), or an operator onboarding via the event link
// key. Every stand carries `requiresPassword` so the operator UI can show a
// password field or log in directly.
eventStandsRouter.get(
  "/",
  authOrganizerOrAttendeeOrEventLink,
  async (req: Request, res: Response) => {
    try {
      const stands = req.organizer
        ? await listStands(eventId(req), req.organizer.accountId)
        : req.attendee
          ? await listStandsForAttendee(eventId(req), req.attendee.eventId)
          : await listStandsForEventLink(eventId(req));
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

// POST /stands/:standId/login — operator authenticates against a stand (public).
standsRouter.post(
  "/:standId/login",
  validateBody(operatorLoginSchema, async (req, res, data) => {
    try {
      const result = await loginOperator(standId(req), data);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  })
);

// POST /stands/:standId/refresh — rotates an operator refresh token and
// returns a fresh access/refresh pair (public; the refresh token authenticates).
standsRouter.post(
  "/:standId/refresh",
  validateBody(refreshTokenSchema, async (req, res, data) => {
    try {
      const result = await refreshOperatorSession(standId(req), data);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  })
);

// POST /stands/:standId/logout — revokes the operator refresh token (and its
// whole rotation family). Idempotent.
standsRouter.post(
  "/:standId/logout",
  validateBody(refreshTokenSchema, async (_req, res, data) => {
    try {
      await logoutOperator(data);
      res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
      handleError(err, res);
    }
  })
);

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

// PATCH /stands/:standId
standsRouter.patch(
  "/:standId",
  authOrganizer,
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
standsRouter.delete(
  "/:standId",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      await softDeleteStand(standId(req), req.organizer!.accountId);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  }
);
