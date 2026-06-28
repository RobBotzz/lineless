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

export class OrderItemNotFoundError extends Error {
  constructor() {
    super("Order item not found");
    this.name = "OrderItemNotFoundError";
  }
}

export class OrderItemStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderItemStateError";
  }
}

export class OrderAlreadyPaidError extends Error {
  constructor() {
    super("Order has already been paid");
    this.name = "OrderAlreadyPaidError";
  }
}

export class StandNotFoundError extends Error {
  constructor() {
    super("Stand not found");
    this.name = "StandNotFoundError";
  }
}

export class EventNotActiveError extends Error {
  constructor() {
    super("Event is not active");
    this.name = "EventNotActiveError";
  }
}

export class OfflineOrdersDisabledError extends Error {
  constructor() {
    super("Cash orders are not enabled for this event");
    this.name = "OfflineOrdersDisabledError";
  }
}

export class CashierDisabledError extends Error {
  constructor() {
    super("Cashier mode is not enabled for this event");
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
