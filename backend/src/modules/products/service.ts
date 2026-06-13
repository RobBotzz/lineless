import { Product, type ProductDoc } from "./model";
import { ProductNotFoundError } from "./errors";
import type { CreateProductInput, UpdateProductInput } from "./types";
import { verifyStandOwnership } from "../stands/ownership";
import { Stand } from "../stands/model";
import { StandNotFoundError } from "../stands/errors";
import { verifyActiveEvent, verifyEventOwnership } from "../events/ownership";

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

export async function listEventProductsForOrganizer(
  eventId: string,
  accountId: string
): Promise<ProductDoc[]> {
  await verifyEventOwnership(eventId, accountId);
  return liveProductsForEvent(eventId);
}

// The operator token is scoped to one stand; allow the event-wide catalog only
// when that stand belongs to the requested (active) event.
export async function listEventProductsForOperator(
  eventId: string,
  operatorStandId: string
): Promise<ProductDoc[]> {
  const stand = await Stand.findOne({
    _id: operatorStandId,
    deletedAt: null,
  }).lean();
  if (!stand || stand.eventId !== eventId) throw new StandNotFoundError();
  await verifyActiveEvent(eventId);
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

export async function verifyProductControlAccess(
  productId: string,
  auth:
    | { type: "organizer"; accountId: string }
    | { type: "operator"; standId: string }
): Promise<void> {
  const product = await getExistingProduct(productId);
  if (auth.type === "organizer") {
    await verifyStandOwnership(product.standId, auth.accountId);
    return;
  }

  await verifyStandAccessForOperator(product.standId, auth.standId);
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
