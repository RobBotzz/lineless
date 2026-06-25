import { Router, type Request, type Response } from "express";
import { authOrganizer } from "../../middleware/auth/guards";
import { EventNotFoundError } from "../events/errors";
import { getEventPayout, getPayoutOverview } from "./service";

function accountId(req: Request): string {
  return req.organizer!.accountId;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  console.error("Payouts error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

const payoutsRouter = Router();

// GET /payouts — organizer payout details plus a summary per event.
payoutsRouter.get("/", authOrganizer, async (req: Request, res: Response) => {
  try {
    const overview = await getPayoutOverview(accountId(req));
    return res.status(200).json(overview);
  } catch (err) {
    return handleError(err, res);
  }
});

// GET /payouts/:eventId — full payout breakdown for one event.
payoutsRouter.get(
  "/:eventId",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const breakdown = await getEventPayout(
        req.params["eventId"] as string,
        accountId(req)
      );
      return res.status(200).json(breakdown);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

export default payoutsRouter;
