import type { StockMode } from "./model";

export const DEFAULT_STOCK_MODE: StockMode = "UNLIMITED";

export function effectiveStockMode(product: {
  stockMode?: StockMode | null;
}): StockMode {
  return product.stockMode ?? DEFAULT_STOCK_MODE;
}

export function tracksProductStock(product: {
  stockMode?: StockMode | null;
}): boolean {
  return effectiveStockMode(product) === "TRACKED";
}

export function nonTrackedStockModeCondition() {
  return { $ne: "TRACKED" } as const;
}

export function effectiveUnlimitedStockModeFilter() {
  return {
    $or: [{ stockMode: DEFAULT_STOCK_MODE }, { stockMode: { $exists: false } }],
  };
}
