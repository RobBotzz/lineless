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

export class AccountNotFoundError extends Error {
  constructor() {
    super("Account not found");
    this.name = "AccountNotFoundError";
  }
}
