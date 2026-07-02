import type { ClientSession } from "mongoose";
import { Product } from "../products/model";
import type { OrderItemDoc } from "./model";
import { InsufficientStockError } from "./errors";

export interface RequestedProductQuantity {
  productId: string;
  quantity: number;
}

export function groupRequestedProducts(
  productIds: string[]
): RequestedProductQuantity[] {
  const quantities = new Map<string, number>();
  for (const productId of productIds) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + 1);
  }
  return [...quantities.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((left, right) => left.productId.localeCompare(right.productId));
}

/**
 * Reserves all requested units or throws. The caller owns the transaction, so
 * an error rolls back every earlier decrement in this loop.
 */
export async function reserveProductStock(
  requested: RequestedProductQuantity[],
  session: ClientSession
): Promise<void> {
  const productIds = requested.map(({ productId }) => productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id productStock")
    .session(session)
    .lean();
  const availableById = new Map(
    products.map((product) => [product._id, product.productStock])
  );
  const shortages = requested
    .filter(
      ({ productId, quantity }) =>
        (availableById.get(productId) ?? 0) < quantity
    )
    .map(({ productId, quantity }) => ({
      productId,
      requested: quantity,
      available: availableById.get(productId) ?? 0,
    }));
  if (shortages.length > 0) throw new InsufficientStockError(shortages);

  for (const { productId, quantity } of requested) {
    const result = await Product.updateOne(
      {
        _id: productId,
        deletedAt: null,
        productStatus: "LIVE",
        productStock: { $gte: quantity },
      },
      { $inc: { productStock: -quantity } },
      { session }
    );
    if (result.modifiedCount !== 1) {
      const current = await Product.findById(productId)
        .select("productStock")
        .session(session)
        .lean();
      throw new InsufficientStockError([
        {
          productId,
          requested: quantity,
          available: current?.productStock ?? 0,
        },
      ]);
    }
  }
}

/** Marks still-reserved items released and restores their product quantities. */
export async function releaseReservedStock(
  items: OrderItemDoc[],
  session: ClientSession
): Promise<void> {
  const releasable = items.filter((item) => item.inventoryState === "RESERVED");
  if (releasable.length === 0) return;

  const quantities = groupRequestedProducts(
    releasable.map((item) => item.productId)
  );
  for (const item of releasable) item.inventoryState = "RELEASED";
  for (const { productId, quantity } of quantities) {
    await Product.updateOne(
      { _id: productId },
      { $inc: { productStock: quantity } },
      { session }
    );
  }
}
