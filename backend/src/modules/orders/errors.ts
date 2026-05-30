export class OrderValidationError extends Error {
  constructor(message = "Invalid order parameters") {
    super(message);
    this.name = "OrderValidationError";
  }
}