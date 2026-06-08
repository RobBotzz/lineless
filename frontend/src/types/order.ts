// Order/payment types for the cashier flow. Mirrors the planned backend orders
// module (not implemented yet). Money is integer cents, never float.
export type OrderStatus = 'UNPAID' | 'PAID';

export interface OrderItem {
  productId: string;
  productName: string;
  standId: string;
  standName: string;
  unitPrice: number; // integer cents, incl. tax
  quantity: number;
  // Per-unit notes; index i is the note for unit #(i+1). Length tracks quantity.
  comments?: string[];
}

export interface Order {
  orderId: string; // human-readable, e.g. "LL-001"
  status: OrderStatus;
  items: OrderItem[];
  total: number; // integer cents
  authenticationId: string; // pickup/auth code, e.g. "SE8B"
  createdAt: string; // ISO timestamp
  paidAt: string | null; // ISO timestamp, set once paid
}
