// Mirrors the backend product module (src/modules/products/model.ts).
export type ProductStatus = 'LIVE' | 'PAUSED' | 'TERMINATED';

export interface Product {
  _id: string;
  standId: string;
  productName: string;
  productDescription: string | null;
  priceIncludingTax: number;
  taxRate: number;
  productImageUrl: string | null;
  instantProduct: boolean;
  productStock: number;
  productStatus: ProductStatus;
  createdAt: string;
  updatedAt: string;
  // TODO: not yet provided by the backend. Once an aggregate product rating
  // exists (0–5), populate this from the API and drop the placeholder below.
  rating?: number;
}

// Integer cents -> "12.50" style string (major units, no currency symbol).
export function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}
