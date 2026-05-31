import { z } from "zod";

export const createStandSchema = z.object({
  standName: z.string().min(1),
  accessPassword: z.string().min(1).optional(),
  location: z.string().optional(),
});

export const updateStandSchema = z.object({
  standName: z.string().min(1).optional(),
  accessPassword: z.string().min(1).nullable().optional(),
  location: z.string().optional(),
});

export type CreateStandInput = z.infer<typeof createStandSchema>;
export type UpdateStandInput = z.infer<typeof updateStandSchema>;
