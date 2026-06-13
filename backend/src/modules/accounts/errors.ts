export class AccountAlreadyExistsError extends Error {
  constructor() {
    super("Email already registered");
    this.name = "AccountAlreadyExistsError";
  }
}

export class AccountInvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "AccountInvalidCredentialsError";
  }
}

export class AccountInvalidPasswordError extends Error {
  constructor() {
    super("Invalid current password");
    this.name = "AccountInvalidPasswordError";
  }
}

export class AccountNotFoundError extends Error {
  constructor() {
    super("Account not found");
    this.name = "AccountNotFoundError";
  }
}

export class PasswordResetTokenInvalidError extends Error {
  constructor() {
    super("Invalid or expired password reset token");
    this.name = "PasswordResetTokenInvalidError";
  }
}
