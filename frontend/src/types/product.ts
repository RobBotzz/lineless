// Mirrors the backend product module (src/modules/products/model.ts).
export type ProductStatus = 'LIVE' | 'PAUSED';
export type StockMode = 'UNLIMITED' | 'TRACKED';

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
  stockMode: StockMode;
  productStock: number;
  productStatus: ProductStatus;
  rating?: number | null;
  createdAt: string;
  updatedAt: string;
}

// Mirrors createProductSchema. Optional fields fall back to backend defaults.
export interface CreateProductInput {
  productName: string;
  productDescription?: string | null;
  priceIncludingTax: number;
  taxRate: number;
  instantProduct?: boolean;
  stockMode?: StockMode;
  productStock?: number;
}

// Mirrors updateProductSchema — every field optional.
export interface UpdateProductInput {
  productName?: string;
  productDescription?: string | null;
  priceIncludingTax?: number;
  taxRate?: number;
  instantProduct?: boolean;
}

export function tracksStock(product: Pick<Product, 'stockMode'>): boolean {
  return product.stockMode === 'TRACKED';
}

// Price excluding tax, in integer cents — derived from the stored incl.-tax price.
export function priceExclTax(product: Pick<Product, 'priceIncludingTax' | 'taxRate'>): number {
  return Math.round((product.priceIncludingTax * 10000) / (10000 + product.taxRate));
}

// Integer cents -> "12.50" style string (major units, no currency symbol).
export function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

// The image is served from a stable URL (/api/products/:id/image) with a long
// cache lifetime, so replacing it would otherwise keep showing the stale image.
// Appending the product's updatedAt as a version busts the cache whenever the
// product (and thus its image) changes. Returns null when there is no image.
export function productImageSrc(
  product: Pick<Product, 'productImageUrl' | 'updatedAt'>,
): string | null {
  if (!product.productImageUrl) return null;
  const version = Date.parse(product.updatedAt);
  if (Number.isNaN(version)) return product.productImageUrl;
  // Use & when the URL already has a query string (e.g. a pre-signed external
  // URL) so we don't produce a broken "?a=b?v=…".
  const separator = product.productImageUrl.includes('?') ? '&' : '?';
  return `${product.productImageUrl}${separator}v=${version}`;
}
