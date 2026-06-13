import { z } from "zod";

// Shared request contract for the refresh/logout endpoints of every identity
// type (organizer, operator). The raw refresh token travels in the body.
export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
