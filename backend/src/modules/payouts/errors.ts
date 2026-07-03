export class MissingBankDetailsError extends Error {
  constructor() {
    super("Bank details are required before requesting a payout");
    this.name = "MissingBankDetailsError";
  }
}

export class NoPayoutAvailableError extends Error {
  constructor() {
    super("No revenue is currently available for payout");
    this.name = "NoPayoutAvailableError";
  }
}
