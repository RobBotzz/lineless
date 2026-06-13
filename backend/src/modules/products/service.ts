import { Product, type ProductDoc } from "./model";
import { ProductNotFoundError, ProductStateError } from "./errors";
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

function assertProductCanPause(product: ProductDoc): void {
  if (product.productStatus === "TERMINATED") {
    throw new ProductStateError("Terminated products cannot be paused");
  }
}

export async function pauseProduct(
  productId: string,
  auth:
    | { type: "organizer"; accountId: string }
    | { type: "operator"; standId: string }
): Promise<ProductDoc> {
  const product = await Product.findOne({ _id: productId, deletedAt: null });
  if (!product) throw new ProductNotFoundError();

  if (auth.type === "organizer") {
    await verifyStandOwnership(product.standId, auth.accountId);
  } else {
    await verifyStandAccessForOperator(product.standId, auth.standId);
  }

  assertProductCanPause(product);
  product.productStatus = "PAUSED";
  await product.save();
  // TODO SSE: publish product availability after shared SSE infrastructure exists.
  return product;
}

export async function pauseProductForEventControlCenter(
  eventId: string,
  standId: string,
  productId: string,
  accountId: string
): Promise<ProductDoc> {
  await verifyEventOwnership(eventId, accountId);

  const stand = await Stand.findOne({ _id: standId, eventId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();

  const product = await Product.findOne({
    _id: productId,
    standId,
    deletedAt: null,
  });
  if (!product) throw new ProductNotFoundError();

  assertProductCanPause(product);
  product.productStatus = "PAUSED";
  await product.save();
  // TODO SSE: publish product/stand availability after shared SSE infrastructure exists.
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
