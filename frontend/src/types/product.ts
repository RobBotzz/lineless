// Mirrors the backend product module (src/modules/products/model.ts).
export type ProductStatus = 'LIVE' | 'PAUSED' | 'TERMINATED';

export interface Product {
  _id: string;
  standId: string;
  productName: string;
  productDescription: string | null;
  // Money is integer cents, never float (matches backend). Stored incl. tax.
  priceIncludingTax: number;
  // Tax rate as integer basis points (1/10000) — e.g. 1900 for 19%.
  taxRate: number;
  productImageUrl: string | null;
  instantProduct: boolean;
  productStock: number;
  productStatus: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

// Mirrors createProductSchema. Optional fields fall back to backend defaults.
export interface CreateProductInput {
  productName: string;
  productDescription?: string | null;
  priceIncludingTax: number;
  taxRate: number;
  productImageUrl?: string | null;
  instantProduct?: boolean;
  productStock?: number;
}

// Mirrors updateProductSchema — every field optional.
export interface UpdateProductInput {
  productName?: string;
  productDescription?: string | null;
  priceIncludingTax?: number;
  taxRate?: number;
  productImageUrl?: string | null;
  instantProduct?: boolean;
  productStock?: number;
}

// Price excluding tax, in integer cents — derived from the stored incl.-tax price.
export function priceExclTax(product: Pick<Product, 'priceIncludingTax' | 'taxRate'>): number {
  return Math.round((product.priceIncludingTax * 10000) / (10000 + product.taxRate));
}

// Integer cents -> "12.50" style string (major units, no currency symbol).
export function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}
