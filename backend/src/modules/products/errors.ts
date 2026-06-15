export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found");
    this.name = "ProductNotFoundError";
  }
}

export class ProductStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductStateError";
  }
}
