import { z } from "zod";

export const CreateTabSchema = z.object({
  eventId: z.uuid(),
});

export type CreateTabInput = z.infer<typeof CreateTabSchema>;
