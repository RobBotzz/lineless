import { Router, type Request, type Response } from "express";
import { authOrganizer } from "../../middleware/auth/guards";
import { EventNotFoundError } from "../events/errors";
import { getEventPayout, getPayoutOverview, requestPayout } from "./service";
import { MissingBankDetailsError, NoPayoutAvailableError } from "./errors";

function accountId(req: Request): string {
  return req.organizer!.accountId;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof MissingBankDetailsError)
    return res.status(409).json({ error: err.message });
  if (err instanceof NoPayoutAvailableError)
    return res.status(409).json({ error: err.message });
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

// POST /payouts/request — record a payout for the available revenue.
payoutsRouter.post(
  "/request",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const payout = await requestPayout(accountId(req));
      return res.status(201).json(payout);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

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
