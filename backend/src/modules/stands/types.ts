import { z } from "zod";
import { locationInputSchema } from "../../shared/location";

export const createStandSchema = z.object({
  standName: z.string().min(1),
  accessPassword: z.string().min(1).optional(),
  location: locationInputSchema.optional(),
});

export const updateStandSchema = z.object({
  standName: z.string().min(1).optional(),
  accessPassword: z.string().min(1).nullable().optional(),
  location: locationInputSchema.optional(),
});

export type CreateStandInput = z.infer<typeof createStandSchema>;
export type UpdateStandInput = z.infer<typeof updateStandSchema>;
