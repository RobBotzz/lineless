import type { ProductStatus } from './product';

export type BoardItemState = 'PENDING' | 'PREPARING' | 'READY';

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

export interface BoardProduct {
  productId: string;
  productName: string;
  productDescription: string | null;
  priceIncludingTax: number;
  taxRate: number;
  productImageUrl: string | null;
  instantProduct: boolean;
  productStock: number;
  productStatus: ProductStatus;
  openToDo: number;
}

export interface OperatorBoard {
  standId: string;
  items: BoardItem[];
  products: BoardProduct[];
}
