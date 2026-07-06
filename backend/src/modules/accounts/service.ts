import { Account, type AccountDoc } from "./model";
import { PasswordResetToken } from "./passwordResetToken.model";
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} from "../auth/refreshToken.service";
import { RefreshTokenInvalidError } from "../auth/errors";
import type { RefreshTokenInput } from "../auth/types";
import {
  AccountAlreadyExistsError,
  AccountInvalidCredentialsError,
  AccountInvalidPasswordError,
  AccountNotFoundError,
  PasswordResetTokenInvalidError,
} from "./errors";
import { signJwt } from "../../lib/jwt";
import { generateOpaqueToken, hashOpaqueToken } from "../../lib/opaqueToken";
import { comparePassword, hashPassword } from "../../lib/password";
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "../../lib/email/mailer";
import { config } from "../../config/config";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  UpdateAccountInput,
} from "./types";

function issueOrganizerToken(accountId: string): string {
  return signJwt(
    { tokenType: "ORGANIZER", sub: accountId },
    { expiresIn: config.auth.organizer.accessTokenExpiresIn }
  );
}

// Every successful authentication hands out a short-lived access JWT plus a
// long-lived, DB-backed refresh token (see refreshToken.service.ts).
async function issueAuthTokens(
  accountId: string
): Promise<{ token: string; refreshToken: string }> {
  return {
    token: issueOrganizerToken(accountId),
    refreshToken: await issueRefreshToken("ORGANIZER", accountId),
  };
}

export interface AuthResult {
  message: string;
  token: string;
  refreshToken: string;
}

export interface UpdateAccountResult {
  account: PublicAccount;
}

export interface ChangePasswordResult {
  message: string;
  token: string;
  refreshToken: string;
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

  try {
    await sendWelcomeEmail({
      to: input.email,
      firstName: input.firstName,
      dashboardUrl: `${config.appBaseUrl}/organizer`,
    });
  } catch (err) {
    // A failed welcome mail must not abort a successful registration.
    console.error("Failed to send welcome email:", err);
  }

  return {
    message: "Account created successfully",
    ...(await issueAuthTokens(account.accountId)),
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
    ...(await issueAuthTokens(account.accountId)),
  };
}

// Trades a valid refresh token for a fresh access JWT. The refresh token is
// rotated on every use — the response carries the replacement, the presented
// token becomes invalid.
export async function refreshSession(
  input: RefreshTokenInput
): Promise<AuthResult> {
  const { subjectId: accountId, refreshToken } = await rotateRefreshToken(
    input.refreshToken,
    "ORGANIZER"
  );

  // Guard against tokens that outlive their account.
  const account = await Account.findOne({ accountId, deletedAt: null }).lean();
  if (!account) {
    await revokeAllRefreshTokens("ORGANIZER", accountId);
    throw new RefreshTokenInvalidError();
  }

  return {
    message: "Token refreshed successfully",
    token: issueOrganizerToken(accountId),
    refreshToken,
  };
}

export async function logout(input: RefreshTokenInput): Promise<void> {
  await revokeRefreshToken(input.refreshToken);
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

  const rawToken = generateOpaqueToken();
  const expiresAt = new Date(
    Date.now() + config.auth.organizer.passwordResetTtlMinutes * 60 * 1000
  );
  await PasswordResetToken.create({
    accountId: account.accountId,
    tokenHash: hashOpaqueToken(rawToken),
    expiresAt,
  });

  const resetUrl = `${config.appBaseUrl}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail({
      to: account.email,
      resetUrl,
      firstName: account.firstName,
      expiresInMinutes: config.auth.organizer.passwordResetTtlMinutes,
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
    tokenHash: hashOpaqueToken(input.token),
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

  // A password reset logs the account out everywhere else.
  await revokeAllRefreshTokens("ORGANIZER", account.accountId);

  return {
    message: "Password reset successfully",
    ...(await issueAuthTokens(account.accountId)),
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
    { returnDocument: "after" }
  ).lean();

  if (!account) {
    throw new AccountNotFoundError();
  }

  await revokeAllRefreshTokens("ORGANIZER", accountId);
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

  // A password change logs the account out everywhere else.
  await revokeAllRefreshTokens("ORGANIZER", account.accountId);

  return {
    message: "Password updated successfully",
    ...(await issueAuthTokens(account.accountId)),
  };
}
