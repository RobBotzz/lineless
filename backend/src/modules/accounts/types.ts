import { z } from "zod";
import { isValidIban } from "../../shared/iban";

const emailSchema = z.email("Invalid email format");

const passwordSchema = z
  .string()
  .max(128)
  .regex(/^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7E]{8,}$/, "Invalid password format");

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

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: passwordSchema,
  })
  .strict();

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
    // Allow null/empty to clear the IBAN; otherwise enforce the MOD-97 checksum.
    iban: z
      .string()
      .nullable()
      .optional()
      .refine(
        (value) => value == null || value.trim() === "" || isValidIban(value),
        {
          message: "Invalid IBAN",
        }
      ),
    // Trim and bound the holder name; a blank/whitespace value clears it (null)
    // rather than being stored as an unusable transfer destination.
    ibanHolderName: z
      .string()
      .max(140, "Account holder name is too long")
      .nullable()
      .optional()
      .transform((value) =>
        value == null ? value : value.trim() === "" ? null : value.trim()
      ),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
