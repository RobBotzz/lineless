import { z } from "zod";

export const createRatingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(500).nullable().default(null),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;
