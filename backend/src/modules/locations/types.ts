import { z } from "zod";

export const createLocationSchema = z.object({
  locationName: z.string().min(1).nullable().default(null),
  xCoordinate: z.number().nullable().default(null),
  yCoordinate: z.number().nullable().default(null),
});

export const updateLocationSchema = z.object({
  locationName: z.string().min(1).nullable().optional(),
  xCoordinate: z.number().nullable().optional(),
  yCoordinate: z.number().nullable().optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
