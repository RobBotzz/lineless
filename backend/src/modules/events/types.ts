import { z } from "zod";

export const createEventSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1),
  location: z.string().optional(),
  startsAt: z.coerce.date().optional(),
  ratingsEnabled: z.boolean().default(false),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  startsAt: z.coerce.date().optional(),
  ratingsEnabled: z.boolean().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
