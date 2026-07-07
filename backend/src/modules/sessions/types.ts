import { z } from "zod";

export const createSessionSchema = z.object({
  eventId: z.uuid(),
  email: z.email().optional(),
});

export const setSessionEmailSchema = z.object({
  email: z.email(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SetSessionEmailInput = z.infer<typeof setSessionEmailSchema>;
