export class OrderValidationError extends Error {
  constructor(message = "Invalid order parameters") {
    super(message);
    this.name = "OrderValidationError";
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found");
    this.name = "OrderNotFoundError";
  }
}

export class OrderAlreadyPaidError extends Error {
  constructor() {
    super("Order has already been paid");
    this.name = "OrderAlreadyPaidError";
  }
}

export class CashierDisabledError extends Error {
  constructor() {
    super("Cash payment is not enabled for this event");
    this.name = "CashierDisabledError";
  }
}

export class CashPaymentNotFoundError extends Error {
  constructor() {
    super("Cash payment not found");
    this.name = "CashPaymentNotFoundError";
  }
}

export class CashRefundExceedsTotalError extends Error {
  constructor() {
    super("Refund amount exceeds the order total");
    this.name = "CashRefundExceedsTotalError";
  }
}
