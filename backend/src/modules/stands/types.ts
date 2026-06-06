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

export const operatorLoginSchema = z.object({
  standId: z.string().min(1),
  accessPassword: z.string().min(1),
});

export type CreateStandInput = z.infer<typeof createStandSchema>;
export type UpdateStandInput = z.infer<typeof updateStandSchema>;
export type OperatorLoginInput = z.infer<typeof operatorLoginSchema>;
