import { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { config } from "../config/config";

// Shared image-upload plumbing reused by every module that stores a binary image
// in its own collection (products, event logos, …). Keeping the multer config,
// magic-byte sniffing, and Buffer normalization here means the upload contract is
// identical everywhere and only lives in one place.

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

export interface UploadedImage {
  buffer: Buffer;
  mimeType: string;
}

// Memory-storage upload: the bytes go straight into MongoDB, never to disk. The
// size cap is enforced by multer; the MIME whitelist here is a cheap first pass
// (the real format check happens against the magic bytes in the service).
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxImageBytes },
  fileFilter: (_req, file, cb) => {
    if (config.upload.allowedImageMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new InvalidImageError(`Unsupported image type: ${file.mimetype}`));
    }
  },
});

// Builds a route middleware that accepts a single image file under `field` and
// maps multer's errors onto our domain errors via the caller's `handleError`, so
// each module keeps producing consistent JSON status codes.
export function uploadSingleImage(
  field: string,
  handleError: (err: unknown, res: Response) => unknown
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    imageUpload.single(field)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          handleError(new ImageTooLargeError(), res);
        } else {
          handleError(new InvalidImageError(err.message), res);
        }
        return;
      }
      if (err) {
        handleError(err, res);
        return;
      }
      next();
    });
  };
}

// Verifies the bytes really are a supported image rather than trusting the
// client-supplied MIME type, which is trivially spoofable. Returns the detected
// MIME type, or null if the magic bytes match no supported format.
export function sniffImageMimeType(buffer: Buffer): string | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

// lean() returns a Buffer field as a BSON Binary, not a Node Buffer, which
// res.send would JSON-encode instead of streaming as bytes. Normalize to a real
// Buffer so the bytes go out verbatim with the correct Content-Type.
export function toNodeBuffer(value: Buffer): Buffer {
  if (Buffer.isBuffer(value)) return value;
  const binary = value as unknown as { buffer: Uint8Array };
  return Buffer.from(binary.buffer);
}
