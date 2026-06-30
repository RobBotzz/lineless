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

export class ProductImageNotFoundError extends Error {
  constructor() {
    super("Product image not found");
    this.name = "ProductImageNotFoundError";
  }
}

// Image upload errors are shared across modules that store binary images.
export {
  InvalidImageError,
  ImageTooLargeError,
} from "../../shared/imageUpload";
