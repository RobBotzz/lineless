import { z } from "zod";

export const setLocationSchema = z.object({
  locationName: z.string().min(1).nullable().default(null),
  xCoordinate: z.number().nullable().default(null),
  yCoordinate: z.number().nullable().default(null),
});

export type SetLocationInput = z.infer<typeof setLocationSchema>;
