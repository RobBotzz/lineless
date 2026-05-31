import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import { authAccount } from "../../middleware/authAccount";
import {
  createLocation,
  listLocations,
  getLocation,
  updateLocation,
  softDeleteLocation,
} from "./service";
import { LocationNotFoundError } from "./errors";
import { createLocationSchema, updateLocationSchema } from "./types";

const locationsRouter = Router();

function locationId(req: Request): string {
  return req.params["locationId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof LocationNotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  console.error("Locations error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// Public — no auth required to read locations.
locationsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const locations = await listLocations();
    res.status(200).json(locations);
  } catch (err) {
    handleError(err, res);
  }
});

locationsRouter.get("/:locationId", async (req: Request, res: Response) => {
  try {
    const location = await getLocation(locationId(req));
    res.status(200).json(location);
  } catch (err) {
    handleError(err, res);
  }
});

// All routes below require an authenticated organizer.
locationsRouter.use(authAccount);

locationsRouter.post(
  "/",
  validateBody(createLocationSchema, async (_req, res, data) => {
    try {
      const location = await createLocation(data);
      res.status(201).json(location);
    } catch (err) {
      handleError(err, res);
    }
  })
);

locationsRouter.patch(
  "/:locationId",
  validateBody(updateLocationSchema, async (req, res, data) => {
    try {
      const location = await updateLocation(locationId(req), data);
      res.status(200).json(location);
    } catch (err) {
      handleError(err, res);
    }
  })
);

locationsRouter.delete("/:locationId", async (req: Request, res: Response) => {
  try {
    await softDeleteLocation(locationId(req));
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
});

export default locationsRouter;
