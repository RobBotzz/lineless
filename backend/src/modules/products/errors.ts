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

// Raised when an upload is missing, of an unsupported type, or its bytes do not
// match a supported image format (the header MIME type can be spoofed).
export class InvalidImageError extends Error {
  constructor(message = "Invalid or unsupported image") {
    super(message);
    this.name = "InvalidImageError";
  }
}

export class ImageTooLargeError extends Error {
  constructor(message = "Image exceeds the maximum allowed size") {
    super(message);
    this.name = "ImageTooLargeError";
  }
}
