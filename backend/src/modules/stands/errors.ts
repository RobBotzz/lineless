export class StandNotFoundError extends Error {
  constructor() {
    super("Stand not found");
    this.name = "StandNotFoundError";
  }
}

export class OperatorInvalidCredentialsError extends Error {
  constructor() {
    super("Invalid stand credentials");
    this.name = "OperatorInvalidCredentialsError";
  }
}

export class CashierStandDisabledError extends Error {
  constructor() {
    super("The cashier is disabled for this event");
    this.name = "CashierStandDisabledError";
  }
}
