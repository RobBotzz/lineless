import { Product, type ProductDoc } from "./model";
import { ProductNotFoundError, ProductStateError } from "./errors";
import type { CreateProductInput, UpdateProductInput } from "./types";
import { verifyStandOwnership } from "../stands/ownership";
import { Stand } from "../stands/model";
import { StandNotFoundError } from "../stands/errors";
import { verifyActiveEvent } from "../events/ownership";

async function productsForStand(standId: string): Promise<ProductDoc[]> {
  return Product.find({ standId, deletedAt: null })
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
  await verifyActiveEvent(stand.eventId);
}

async function verifyStandAccessForAttendee(
  standId: string,
  eventId: string
): Promise<void> {
  const stand = await Stand.findOne({
    _id: standId,
    eventId,
    deletedAt: null,
  }).lean();
  if (!stand) throw new StandNotFoundError();
  await verifyActiveEvent(eventId);
}

export async function createProduct(
  standId: string,
  accountId: string,
  input: CreateProductInput
): Promise<ProductDoc> {
  await verifyStandOwnership(standId, accountId);
  return Product.create({
    standId,
    productName: input.productName,
    productDescription: input.productDescription,
    priceIncludingTax: input.priceIncludingTax,
    taxRate: input.taxRate,
    productImageUrl: input.productImageUrl,
    instantProduct: input.instantProduct,
    productStock: input.productStock,
  });
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
  await verifyStandAccessForAttendee(standId, eventId);
  return productsForStand(standId);
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
  return product;
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
  return product;
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
  if (patch.productImageUrl !== undefined) {
    product.productImageUrl = patch.productImageUrl;
  }
  if (patch.instantProduct !== undefined) {
    product.instantProduct = patch.instantProduct;
  }
  if (patch.productStock !== undefined)
    product.productStock = patch.productStock;
  await product.save();
  return product;
}

export async function softDeleteProduct(
  productId: string,
  accountId: string
): Promise<void> {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new ProductNotFoundError();
  await verifyStandOwnership(product.standId, accountId);
  product.deletedAt = new Date();
  await product.save();
}
