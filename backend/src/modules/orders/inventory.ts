import type { ClientSession } from "mongoose";
import { Product } from "../products/model";
import {
  DEFAULT_STOCK_MODE,
  nonTrackedStockModeCondition,
  tracksProductStock,
} from "../products/stockMode";
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
): Promise<Set<string>> {
  const productIds = requested.map(({ productId }) => productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id stockMode productStock")
    .session(session)
    .lean();
  const productById = new Map(
    products.map((product) => [product._id, product])
  );
  const trackedProductIds = new Set(
    products.filter(tracksProductStock).map((product) => product._id)
  );
  const shortages = requested
    .filter(
      ({ productId, quantity }) =>
        !productById.has(productId) ||
        (trackedProductIds.has(productId) &&
          (productById.get(productId)?.productStock ?? 0) < quantity)
    )
    .map(({ productId, quantity }) => ({
      productId,
      requested: quantity,
      available: productById.get(productId)?.productStock ?? 0,
    }));
  if (shortages.length > 0) throw new InsufficientStockError(shortages);

  for (const { productId, quantity } of requested) {
    if (!trackedProductIds.has(productId)) {
      // Lazily materialize the legacy default while confirming that the
      // product is still live and unlimited inside the order transaction.
      const result = await Product.updateOne(
        {
          _id: productId,
          deletedAt: null,
          productStatus: "LIVE",
          stockMode: nonTrackedStockModeCondition(),
        },
        { $set: { stockMode: DEFAULT_STOCK_MODE } },
        { session }
      );
      if (result.matchedCount !== 1) {
        throw new InsufficientStockError([
          { productId, requested: quantity, available: 0 },
        ]);
      }
      continue;
    }
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
  return trackedProductIds;
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
