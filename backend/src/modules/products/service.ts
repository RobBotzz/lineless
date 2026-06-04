import { Product, type ProductDoc } from "./model";
import { ProductNotFoundError } from "./errors";
import type { CreateProductInput, UpdateProductInput } from "./types";
import { verifyStandOwnership } from "../stands/ownership";

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

export async function listProducts(
  standId: string,
  accountId: string
): Promise<ProductDoc[]> {
  await verifyStandOwnership(standId, accountId);
  return Product.find({ standId, deletedAt: null })
    .sort({ createdAt: 1 })
    .lean();
}

// Readable by organizer and attendee — no ownership filter, mirrors getStand.
export async function getProduct(productId: string): Promise<ProductDoc> {
  const product = await Product.findOne({
    _id: productId,
    deletedAt: null,
  }).lean();
  if (!product) throw new ProductNotFoundError();
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
