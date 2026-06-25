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

// The cashier stand is system-managed: created by the backend, never created,
// deleted, or given products by a user. Raised when a request tries to do so.
export class CashierStandProtectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashierStandProtectedError";
  }
}
