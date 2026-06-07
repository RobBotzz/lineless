import { Account, type AccountDoc } from "./model";
import {
  AccountAlreadyExistsError,
  AccountInvalidCredentialsError,
  AccountInvalidPasswordError,
  AccountNotFoundError,
} from "./errors";
import { signJwt } from "../../lib/jwt";
import { comparePassword, hashPassword } from "../../lib/password";
import type {
  ChangePasswordInput,
  LoginInput,
  SignupInput,
  UpdateAccountInput,
} from "./types";

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
