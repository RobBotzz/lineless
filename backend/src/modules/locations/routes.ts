import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { authAccount } from "../../middleware/authAccount";
import { authAccountOrSession } from "../../middleware/authAccountOrSession";
import { getLocationByEvent, setLocation } from "./service";
import { EventNotOwnedError } from "./errors";
import { EventNotFoundError } from "../events/errors";
import { setLocationSchema } from "./types";

const locationRouter = Router({ mergeParams: true });

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof EventNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof EventNotOwnedError) {
    return res.status(403).json({ error: err.message });
  }
  console.error("Locations error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

locationRouter.get(
  "/",
  authAccountOrSession,
  async (req: Request, res: Response) => {
    try {
      const location = await getLocationByEvent(eventId(req));
      if (location === null) {
        res.status(204).send();
        return;
      }
      res.status(200).json(location);
    } catch (err) {
      handleError(err, res);
    }
  }
);

locationRouter.put(
  "/",
  authAccount,
  validateBody(setLocationSchema, async (req, res, data) => {
    try {
      const location = await setLocation(
        eventId(req),
        req.user!.accountId,
        data
      );
      res.status(200).json(location);
    } catch (err) {
      handleError(err, res);
    }
  })
);

export default locationRouter;
