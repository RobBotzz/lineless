import { z } from "zod";

export const operatorLoginSchema = z.object({
  standId: z.string().min(1),
  accessPassword: z.string().min(1),
});

export type OperatorLoginInput = z.infer<typeof operatorLoginSchema>;
