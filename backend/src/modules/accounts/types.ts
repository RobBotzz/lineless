import { z } from "zod";

const emailSchema = z.email("Invalid email format");

const passwordSchema = z
  .string()
  .regex(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, "Invalid password format");

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

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })
  .strict();

export const updateAccountSchema = z
  .object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    iban: z.string().nullable().optional(),
    ibanHolderName: z.string().nullable().optional(),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
