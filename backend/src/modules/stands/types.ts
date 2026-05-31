import { z } from "zod";

export const createStandSchema = z.object({
  standName: z.string().min(1),
  accessPassword: z.string().min(1).optional(),
  locationName: z.string().min(1).nullable().optional(),
  xCoordinate: z.number().nullable().optional(),
  yCoordinate: z.number().nullable().optional(),
});

export const updateStandSchema = z.object({
  standName: z.string().min(1).optional(),
  accessPassword: z.string().min(1).nullable().optional(),
  locationName: z.string().min(1).nullable().optional(),
  xCoordinate: z.number().nullable().optional(),
  yCoordinate: z.number().nullable().optional(),
});

export type CreateStandInput = z.infer<typeof createStandSchema>;
export type UpdateStandInput = z.infer<typeof updateStandSchema>;
