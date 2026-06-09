import { createHmac, randomBytes } from "node:crypto";
import { Account, type AccountDoc } from "./model";
import { PasswordResetToken } from "./passwordResetToken.model";
import {
  AccountAlreadyExistsError,
  AccountInvalidCredentialsError,
  AccountInvalidPasswordError,
  AccountNotFoundError,
  PasswordResetTokenInvalidError,
} from "./errors";
import { signJwt } from "../../lib/jwt";
import { comparePassword, hashPassword } from "../../lib/password";
import { sendPasswordResetEmail } from "../../lib/email/mailer";
import { config } from "../../config/config";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  UpdateAccountInput,
} from "./types";

function hashResetToken(rawToken: string): string {
  return createHmac("sha256", config.jwt.secret).update(rawToken).digest("hex");
}

function issueOrganizerToken(accountId: string): string {
  return signJwt({ tokenType: "ORGANIZER", sub: accountId });
}

export interface AuthResult {
  message: string;
  token: string;
}

export interface UpdateAccountResult {
  account: PublicAccount;
}

export interface ChangePasswordResult {
  message: string;
  token: string;
}

export type PublicAccount = Omit<AccountDoc, "passwordHash">;

export async function signup(input: SignupInput): Promise<AuthResult> {
  const existingAccount = await Account.findOne({
    email: input.email,
    deletedAt: null,
  }).lean();
  if (existingAccount) {
    throw new AccountAlreadyExistsError();
  }

  const passwordHash = await hashPassword(input.password);
  const account = await Account.create({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
  });

  return {
    message: "Account created successfully",
    token: issueOrganizerToken(account.accountId),
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const account = await Account.findOne({
    email: input.email,
    deletedAt: null,
  }).lean();
  if (!account?.passwordHash) {
    throw new AccountInvalidCredentialsError();
  }

  const isPasswordValid = await comparePassword(
    input.password,
    account.passwordHash
  );
  if (!isPasswordValid) {
    throw new AccountInvalidCredentialsError();
  }

  return {
    message: "Login successful",
    token: issueOrganizerToken(account.accountId),
  };
}

export async function requestPasswordReset(
  input: ForgotPasswordInput
): Promise<void> {
  const account = await Account.findOne({
    email: input.email,
    deletedAt: null,
  }).lean();

  if (!account?.email) {
    return;
  }

  // Only one reset link should be live at a time: drop any earlier tokens.
  await PasswordResetToken.deleteMany({ accountId: account.accountId });

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + config.passwordReset.tokenTtlMinutes * 60 * 1000
  );
  await PasswordResetToken.create({
    accountId: account.accountId,
    tokenHash: hashResetToken(rawToken),
    expiresAt,
  });

  const resetUrl = `${config.appBaseUrl}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail({
      to: account.email,
      resetUrl,
      firstName: account.firstName,
    });
  } catch (err) {
    // Swallow delivery failures: surfacing them would both leak account
    // existence and turn a transient mail outage into a 500.
    console.error("Failed to send password reset email:", err);
  }
}

export async function resetPassword(
  input: ResetPasswordInput
): Promise<AuthResult> {
  // TTL purges expired tokens, but its sweep is not instant — guard expiry here
  // too so a just-expired token is never accepted.
  const tokenDoc = await PasswordResetToken.findOne({
    tokenHash: hashResetToken(input.token),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!tokenDoc) {
    throw new PasswordResetTokenInvalidError();
  }

  const account = await Account.findOne({
    accountId: tokenDoc.accountId,
    deletedAt: null,
  });
  if (!account) {
    throw new PasswordResetTokenInvalidError();
  }

  account.passwordHash = await hashPassword(input.newPassword);
  await account.save();

  // Single-use: invalidate every reset token for this account, not just this one.
  await PasswordResetToken.deleteMany({ accountId: account.accountId });

  return {
    message: "Password reset successfully",
    token: issueOrganizerToken(account.accountId),
  };
}

export async function deleteAccount(accountId: string): Promise<void> {
  const account = await Account.findOneAndUpdate(
    { accountId, deletedAt: null },
    {
      $set: {
        deletedAt: new Date(),
        email: `deleted:${accountId}`,
      },
      $unset: {
        passwordHash: 1,
        firstName: 1,
        lastName: 1,
        iban: 1,
        ibanHolderName: 1,
      },
    },
    { new: true }
  ).lean();

  if (!account) {
    throw new AccountNotFoundError();
  }
}

export async function getAccountInfo(
  accountId: string
): Promise<PublicAccount> {
  const account = await Account.findOne({
    accountId,
    deletedAt: null,
  })
    .select("-passwordHash")
    .lean();

  if (!account) {
    throw new AccountNotFoundError();
  }

  return account;
}

export async function updateAccountInfo(
  accountId: string,
  input: UpdateAccountInput
): Promise<UpdateAccountResult> {
  const account = await Account.findOne({
    accountId,
    deletedAt: null,
  });
  if (!account) {
    throw new AccountNotFoundError();
  }

  if (input.firstName !== undefined) account.firstName = input.firstName;
  if (input.lastName !== undefined) account.lastName = input.lastName;
  if (input.iban !== undefined) account.iban = input.iban;
  if (input.ibanHolderName !== undefined) {
    account.ibanHolderName = input.ibanHolderName;
  }

  await account.save();

  const updatedAccount = await getAccountInfo(accountId);
  return {
    account: updatedAccount,
  };
}

export async function changePassword(
  accountId: string,
  input: ChangePasswordInput
): Promise<ChangePasswordResult> {
  const account = await Account.findOne({
    accountId,
    deletedAt: null,
  });
  if (!account) {
    throw new AccountNotFoundError();
  }
  if (!account.passwordHash) {
    throw new AccountInvalidPasswordError();
  }

  const isCurrentPasswordValid = await comparePassword(
    input.currentPassword,
    account.passwordHash
  );
  if (!isCurrentPasswordValid) {
    throw new AccountInvalidPasswordError();
  }

  account.passwordHash = await hashPassword(input.newPassword);
  await account.save();

  return {
    message: "Password updated successfully",
    token: issueOrganizerToken(account.accountId),
  };
}
