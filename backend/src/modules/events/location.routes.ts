import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { authAccount } from "../../middleware/authAccount";
import { authAccountOrSession } from "../../middleware/authAccountOrSession";
import { getEventLocation, setEventLocation } from "./service";
import { EventNotFoundError } from "./errors";
import { setLocationSchema } from "./types";

const eventLocationRouter = Router({ mergeParams: true });

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof EventNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  console.error("Location error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

eventLocationRouter.get(
  "/",
  authAccountOrSession,
  async (req: Request, res: Response) => {
    try {
      const location = await getEventLocation(eventId(req));
      res.status(200).json(location);
    } catch (err) {
      handleError(err, res);
    }
  }
);

eventLocationRouter.put(
  "/",
  authAccount,
  validateBody(setLocationSchema, async (req, res, data) => {
    try {
      const location = await setEventLocation(
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

export default eventLocationRouter;
