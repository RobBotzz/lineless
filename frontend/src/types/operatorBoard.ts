// Mirrors the backend operator board contract (src/modules/operator/board.ts).
// Dates are ISO strings over the wire (Mongoose Dates serialize to JSON strings).

import type { ProductStatus, StockMode } from './product';

// An item's position in the preparation flow: To Do -> In Progress -> Ready.
// FULFILLED and CANCELLED items leave the board, so they never reach the frontend.
export type BoardItemState = 'PENDING' | 'PREPARING' | 'READY';

// A single ordered unit of a product — the card the operator advances.
export interface BoardItem {
  orderId: string;
  itemId: string;
  orderNumber: string;
  pickupCode: string;
  productId: string;
  productName: string;
  state: BoardItemState;
  customerComment: string | null;
  startedAt: string | null;
  readyAt: string | null;
  createdAt: string;
}

// Full per-product entry shown in the products overview lane. Mirrors every
// product attribute the dashboard renders, plus live stock, status and the open
// To-Do count. `productStatus` replaces the former `paused` flag (LIVE = orderable,
// PAUSED = temporarily off).
export interface BoardProduct {
  productId: string;
  productName: string;
  productDescription: string | null;
  priceIncludingTax: number;
  taxRate: number;
  productImageUrl: string | null;
  instantProduct: boolean;
  stockMode: StockMode;
  productStock: number;
  productStatus: ProductStatus;
  openToDo: number;
}

// The full live board for one stand — the payload of every `board` SSE frame and
// of the GET /operator/board snapshot.
export interface OperatorBoard {
  standId: string;
  items: BoardItem[];
  products: BoardProduct[];
}

// Runtime guard for the SSE/HTTP payload (which arrives as `unknown`). Validates
// the board's top-level shape so a malformed, partial, or error frame can't be
// stored as a board and crash a later `board.items` access. Item/product entries
// are not deep-checked — the component reads them defensively (optional chaining).
export function isOperatorBoard(value: unknown): value is OperatorBoard {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.standId === 'string' && Array.isArray(v.items) && Array.isArray(v.products);
}
