import { z } from "zod";

export const createSessionSchema = z.object({
  eventId: z.string().min(1),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
