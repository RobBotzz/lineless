import { z } from "zod";

const emailSchema = z.email("Invalid email format");

const passwordSchema = z
  .string()
  .regex(
    /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/,
    "Invalid password format"
  );

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const accountIdSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
});

export const updateAccountSchema = accountIdSchema.extend({
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  iban: z.string().nullable().optional(),
  ibanHolderName: z.string().nullable().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AccountIdInput = z.infer<typeof accountIdSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
