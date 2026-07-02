import mongoose from "mongoose";
import { Product, type ProductDoc } from "./model";
import { ProductImage, type ProductImageDoc } from "./image.model";
import {
  InvalidImageError,
  ProductImageNotFoundError,
  ProductNotFoundError,
  ProductStateError,
  ProductStockChangedError,
} from "./errors";
import type {
  CreateProductInput,
  UpdateProductInput,
  UpdateProductStockInput,
} from "./types";
import { config } from "../../config/config";
import {
  sniffImageMimeType,
  toNodeBuffer,
  type UploadedImage,
} from "../../shared/imageUpload";
import { verifyStandOwnership } from "../stands/ownership";
import { Stand } from "../stands/model";
import {
  CashierStandProtectedError,
  StandNotFoundError,
} from "../stands/errors";
import {
  verifyActiveEvent,
  verifyEventOwnership,
  verifyOperableEvent,
} from "../events/ownership";
import { Event } from "../events/model";

// The wire shape for a product: hides the raw rating aggregate and exposes the
// computed average (null until the first review). The frontend Product type
// declares `rating` and has no ratingSum/ratingCount.
export function toProductResponse(p: ProductDoc) {
  const { ratingSum, ratingCount, ...rest } = p;
  return {
    ...rest,
    stockMode: p.stockMode ?? "UNLIMITED",
    rating: ratingCount > 0 ? ratingSum / ratingCount : null,
  };
}

async function productsForStand(standId: string): Promise<ProductDoc[]> {
  return Product.find({ standId, deletedAt: null })
    .sort({ createdAt: 1 })
    .lean();
}

// All LIVE products across every stand in an event — the cashier's catalog,
// which spans the whole event rather than a single stand.
async function liveProductsForEvent(eventId: string): Promise<ProductDoc[]> {
  const stands = await Stand.find({ eventId, deletedAt: null })
    .select("_id")
    .lean();
  const standIds = stands.map((s) => s._id);
  return Product.find({
    standId: { $in: standIds },
    productStatus: "LIVE",
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .lean();
}

async function getExistingProduct(productId: string): Promise<ProductDoc> {
  const product = await Product.findOne({
    _id: productId,
    deletedAt: null,
  }).lean();
  if (!product) throw new ProductNotFoundError();
  return product;
}

async function verifyStandAccessForOperator(
  standId: string,
  operatorStandId: string
): Promise<void> {
  if (standId !== operatorStandId) {
    throw new StandNotFoundError();
  }

  const stand = await Stand.findOne({ _id: standId, deletedAt: null }).lean();
  if (!stand) throw new StandNotFoundError();
  await verifyOperableEvent(stand.eventId);
}

async function verifyStandAccessForAttendee(
  standId: string,
  eventId: string
): Promise<boolean> {
  const stand = await Stand.findOne({
    _id: standId,
    eventId,
    deletedAt: null,
  }).lean();
  if (!stand) throw new StandNotFoundError();
  await verifyActiveEvent(eventId);
  return (stand.standStatus ?? "LIVE") === "LIVE";
}

export async function createProduct(
  standId: string,
  accountId: string,
  input: CreateProductInput
): Promise<ProductDoc> {
  await verifyStandOwnership(standId, accountId);
  // The cashier stand carries no products of its own; it serves the event-wide
  // catalog. Reject product creation against it.
  const stand = await Stand.findOne({ _id: standId, deletedAt: null })
    .select("standType")
    .lean();
  if (stand?.standType === "CASHIER") {
    throw new CashierStandProtectedError(
      "Products cannot be created for the cashier stand"
    );
  }
  const product = await Product.create({
    standId,
    productName: input.productName,
    productDescription: input.productDescription,
    priceIncludingTax: input.priceIncludingTax,
    taxRate: input.taxRate,
    instantProduct: input.instantProduct,
    stockMode: input.stockMode,
    productStock: input.productStock,
  });
  return product.toObject();
}

export async function listProductsForOrganizer(
  standId: string,
  accountId: string
): Promise<ProductDoc[]> {
  await verifyStandOwnership(standId, accountId);
  return productsForStand(standId);
}

export async function listProductsForOperator(
  standId: string,
  operatorStandId: string
): Promise<ProductDoc[]> {
  await verifyStandAccessForOperator(standId, operatorStandId);
  return productsForStand(standId);
}

export async function listProductsForAttendee(
  standId: string,
  eventId: string
): Promise<ProductDoc[]> {
  const standIsLive = await verifyStandAccessForAttendee(standId, eventId);
  if (!standIsLive) return [];
  return productsForStand(standId);
}

export async function listEventProductsForOrganizer(
  eventId: string,
  accountId: string
): Promise<ProductDoc[]> {
  await verifyEventOwnership(eventId, accountId);
  return liveProductsForEvent(eventId);
}

// The operator token is scoped to one stand; allow the event-wide catalog only
// when that stand belongs to the requested event.
export async function listEventProductsForOperator(
  eventId: string,
  operatorStandId: string
): Promise<ProductDoc[]> {
  const stand = await Stand.findOne({
    _id: operatorStandId,
    deletedAt: null,
  }).lean();
  if (!stand || stand.eventId !== eventId || stand.standType !== "CASHIER")
    throw new StandNotFoundError();
  const event = await Event.findById(eventId).lean();
  if (!event || !event.cashierEnabled) throw new StandNotFoundError();
  return liveProductsForEvent(eventId);
}

export async function getProductForOrganizer(
  productId: string,
  accountId: string
): Promise<ProductDoc> {
  const product = await getExistingProduct(productId);
  await verifyStandOwnership(product.standId, accountId);
  return product;
}

// Both an organizer (owning the stand's event) and a stand-scoped operator may
// control a product. Resolved by the route and threaded into the transitions.
export type ProductControlAuth =
  | { type: "organizer"; accountId: string }
  | { type: "operator"; standId: string };

// Loads the mutable product document and authorizes the caller — the single
// place product-control access lives. Status transitions save the returned doc.
async function findControllableProduct(
  productId: string,
  auth: ProductControlAuth
) {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new ProductNotFoundError();
  if (auth.type === "organizer") {
    await verifyStandOwnership(product.standId, auth.accountId);
  } else {
    await verifyStandAccessForOperator(product.standId, auth.standId);
  }
  return product;
}

// LIVE -> PAUSED. An explicit, validated transition (no going through PATCH):
// TERMINATED is terminal and an already-paused product is a no-op error.
export async function pauseProduct(
  productId: string,
  auth: ProductControlAuth
): Promise<ProductDoc> {
  const product = await findControllableProduct(productId, auth);
  if (product.productStatus === "TERMINATED") {
    throw new ProductStateError("A terminated product cannot be paused");
  }
  if (product.productStatus === "PAUSED") {
    throw new ProductStateError("Product is already paused");
  }
  product.productStatus = "PAUSED";
  await product.save();
  return product.toObject();
}

// PAUSED -> LIVE. Mirror of pauseProduct: TERMINATED is terminal and an
// already-live product is a no-op error.
export async function resumeProduct(
  productId: string,
  auth: ProductControlAuth
): Promise<ProductDoc> {
  const product = await findControllableProduct(productId, auth);
  if (product.productStatus === "TERMINATED") {
    throw new ProductStateError("A terminated product cannot be resumed");
  }
  if (product.productStatus === "LIVE") {
    throw new ProductStateError("Product is already live");
  }
  product.productStatus = "LIVE";
  await product.save();
  return product.toObject();
}

export async function updateProduct(
  productId: string,
  accountId: string,
  patch: UpdateProductInput
): Promise<ProductDoc> {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new ProductNotFoundError();
  await verifyStandOwnership(product.standId, accountId);
  if (patch.productName !== undefined) product.productName = patch.productName;
  if (patch.productDescription !== undefined) {
    product.productDescription = patch.productDescription;
  }
  if (patch.priceIncludingTax !== undefined)
    product.priceIncludingTax = patch.priceIncludingTax;
  if (patch.taxRate !== undefined) product.taxRate = patch.taxRate;
  if (patch.instantProduct !== undefined) {
    product.instantProduct = patch.instantProduct;
  }
  await product.save();
  return product.toObject();
}

export async function updateProductStock(
  productId: string,
  accountId: string,
  input: UpdateProductStockInput
): Promise<ProductDoc> {
  const existing = await Product.findOne({ _id: productId, deletedAt: null })
    .select("standId")
    .lean();
  if (!existing) throw new ProductNotFoundError();
  await verifyStandOwnership(existing.standId, accountId);

  const product = await Product.findOneAndUpdate(
    {
      _id: productId,
      deletedAt: null,
      productStock: input.expectedProductStock,
      ...(input.expectedStockMode === "TRACKED"
        ? { stockMode: "TRACKED" }
        : {
            $or: [
              { stockMode: "UNLIMITED" },
              { stockMode: { $exists: false } },
            ],
          }),
    },
    {
      $set: {
        stockMode: input.stockMode,
        productStock: input.productStock,
      },
    },
    { new: true, runValidators: true }
  ).lean();
  if (product) return product;

  const current = await Product.findOne({ _id: productId, deletedAt: null })
    .select("stockMode productStock")
    .lean();
  if (!current) throw new ProductNotFoundError();
  throw new ProductStockChangedError(
    current.productStock,
    current.stockMode ?? "UNLIMITED"
  );
}

// The URL stored on the product points back at our own serve endpoint, so the
// frontend keeps rendering `productImageUrl` unchanged whether the image is an
// uploaded file or an external link.
function productImageServeUrl(productId: string): string {
  return `/api/products/${productId}/image`;
}

export async function setProductImage(
  productId: string,
  accountId: string,
  file: UploadedImage
): Promise<ProductDoc> {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new ProductNotFoundError();
  await verifyStandOwnership(product.standId, accountId);

  const detectedType = sniffImageMimeType(file.buffer);
  if (
    !detectedType ||
    !config.upload.allowedImageMimeTypes.includes(detectedType)
  ) {
    throw new InvalidImageError();
  }

  // One image per product: upsert replaces any existing image atomically.
  await ProductImage.findOneAndUpdate(
    { productId },
    {
      productId,
      data: file.buffer,
      contentType: detectedType,
      byteSize: file.buffer.length,
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  product.productImageUrl = productImageServeUrl(productId);
  // The serve URL is stable, so on a *replace* productImageUrl doesn't actually
  // change — mark it modified so `updatedAt` still bumps. The frontend uses
  // updatedAt as a cache-busting version (the image URL is otherwise cached), so
  // without this a replaced image keeps showing the stale picture.
  product.markModified("productImageUrl");
  await product.save();
  return product.toObject();
}

export async function getProductImage(
  productId: string
): Promise<
  Pick<ProductImageDoc, "_id" | "data" | "contentType" | "updatedAt">
> {
  const image = await ProductImage.findOne({ productId })
    .select("data contentType updatedAt")
    .lean();
  if (!image) throw new ProductImageNotFoundError();
  return { ...image, data: toNodeBuffer(image.data) };
}

export async function deleteProductImage(
  productId: string,
  accountId: string
): Promise<ProductDoc> {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new ProductNotFoundError();
  await verifyStandOwnership(product.standId, accountId);

  await ProductImage.deleteOne({ productId });
  product.productImageUrl = null;
  await product.save();
  return product.toObject();
}

export async function softDeleteProduct(
  productId: string,
  accountId: string
): Promise<void> {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new ProductNotFoundError();
  await verifyStandOwnership(product.standId, accountId);

  // Soft-deleting the product and dropping its (heavy) image binary must be
  // atomic — otherwise a crash between the two writes leaves either an orphaned
  // ProductImage or a live product pointing at a missing image.
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      product.deletedAt = new Date();
      await product.save({ session: dbSession });
      await ProductImage.deleteOne({ productId }, { session: dbSession });
    });
  } finally {
    await dbSession.endSession();
  }
}
