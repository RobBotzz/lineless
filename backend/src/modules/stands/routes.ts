import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  createStand,
  listStands,
  getStand,
  updateStand,
  softDeleteStand,
} from "./service";
import { StandNotFoundError } from "./errors";
import { EventNotFoundError } from "../events/errors";
import { createStandSchema, updateStandSchema } from "./types";
import { authAccount } from "../../middleware/authAccount";

// All stand routes are scoped under /events/:eventId/stands
export const eventStandsRouter = Router({ mergeParams: true });
eventStandsRouter.use(authAccount);

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof StandNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  console.error("Stands error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// POST /events/:eventId/stands
eventStandsRouter.post(
  "/",
  validateBody(createStandSchema, async (req, res, data) => {
    try {
      const stand = await createStand(
        req.params["eventId"] as string,
        req.user!.accountId,
        data
      );
      res.status(201).json(stand);
    } catch (err) {
      handleError(err, res);
    }
  })
);

// GET /events/:eventId/stands
eventStandsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const stands = await listStands(
      req.params["eventId"] as string,
      req.user!.accountId
    );
    res.status(200).json(stands);
  } catch (err) {
    handleError(err, res);
  }
});

// GET /events/:eventId/stands/:standId
eventStandsRouter.get("/:standId", async (req: Request, res: Response) => {
  try {
    const stand = await getStand(req.params["standId"] as string);
    res.status(200).json(stand);
  } catch (err) {
    handleError(err, res);
  }
});

// PATCH /events/:eventId/stands/:standId
eventStandsRouter.patch(
  "/:standId",
  validateBody(updateStandSchema, async (req, res, data) => {
    try {
      const stand = await updateStand(
        req.params["standId"] as string,
        req.user!.accountId,
        data
      );
      res.status(200).json(stand);
    } catch (err) {
      handleError(err, res);
    }
  })
);

// DELETE /events/:eventId/stands/:standId
eventStandsRouter.delete("/:standId", async (req: Request, res: Response) => {
  try {
    await softDeleteStand(req.params["standId"] as string, req.user!.accountId);
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
});
