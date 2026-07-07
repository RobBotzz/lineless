import { z } from "zod";
import { isValidIban, normalizeIban } from "../../shared/iban";

const emailSchema = z.email("Invalid email format");

const passwordSchema = z
  .string()
  .max(128)
  .regex(/^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7E]{8,}$/, "Invalid password format");

const optionalStringField = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: optionalStringField.pipe(z.string().max(100).optional()),
  lastName: optionalStringField.pipe(z.string().max(100).optional()),
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
  .strict()
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
  });

export const updateAccountSchema = z
  .object({
    firstName: optionalStringField.pipe(z.string().max(100).optional()),
    lastName: optionalStringField.pipe(z.string().max(100).optional()),
    // Allow null/empty to clear the IBAN; otherwise enforce the MOD-97 checksum.
    // A blank/whitespace value clears it (null) rather than being stored as an
    // unusable transfer destination; a valid value is canonicalized (no spaces,
    // uppercase). `undefined` is preserved so an omitted field is not a clear.
    iban: z
      .string()
      .nullable()
      .optional()
      .refine(
        (value) => value == null || value.trim() === "" || isValidIban(value),
        {
          message: "Invalid IBAN",
        }
      )
      .transform((value) =>
        value == null
          ? value
          : value.trim() === ""
            ? null
            : normalizeIban(value)
      ),
    // Trim and bound the holder name; a blank/whitespace value clears it (null)
    // rather than being stored as an unusable transfer destination. A non-blank
    // value must read as a name: it has to start with a letter and contain only
    // letters, spaces, and the punctuation banks accept (- . ' , & / ( )) — this
    // rejects digit-only or symbol junk that could never be a transfer holder.
    ibanHolderName: z
      .string()
      .max(140, "Account holder name is too long")
      .nullable()
      .optional()
      .refine(
        (value) =>
          value == null ||
          value.trim() === "" ||
          /^[\p{L}\p{M}][\p{L}\p{M}\s'.,&/()-]*$/u.test(value.trim()),
        { message: "Invalid account holder name" }
      )
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
