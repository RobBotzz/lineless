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
import { createStandSchema, updateStandSchema } from "./types";
import { authAccount } from "../../middleware/authAccount";

// Mounted at /stands — handles /:standId routes
export const standsRouter = Router();
standsRouter.use(authAccount);

// Mounted at /events/:eventId/stands — mergeParams gives us req.params.eventId
export const eventStandsRouter = Router({ mergeParams: true });
eventStandsRouter.use(authAccount);

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof StandNotFoundError)
    return res.status(404).json({ error: err.message });
  console.error("Stands error:", err);
  return res.status(500).json({ error: "Internal server error" });
}
// POST /events/:eventId/stands
eventStandsRouter.post(
  "/",
  validateBody(createStandSchema, async (req, res, data) => {
    try {
      const stand = await createStand(req.params["eventId"] as string, data);
      res.status(201).json(stand);
    } catch (err) {
      handleError(err, res);
    }
  })
);

// GET /events/:eventId/stands
eventStandsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const stands = await listStands(req.params["eventId"] as string);
    res.status(200).json(stands);
  } catch (err) {
    handleError(err, res);
  }
});

// GET /stands/:standId
standsRouter.get("/:standId", async (req: Request, res: Response) => {
  try {
    const stand = await getStand(req.params["standId"] as string);
    res.status(200).json(stand);
  } catch (err) {
    handleError(err, res);
  }
});

// PATCH /stands/:standId
standsRouter.patch(
  "/:standId",
  validateBody(updateStandSchema, async (req, res, data) => {
    try {
      const stand = await updateStand(req.params["standId"] as string, data);
      res.status(200).json(stand);
    } catch (err) {
      handleError(err, res);
    }
  })
);

// DELETE /stands/:standId
standsRouter.delete("/:standId", async (req: Request, res: Response) => {
  try {
    await softDeleteStand(req.params["standId"] as string);
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
});
