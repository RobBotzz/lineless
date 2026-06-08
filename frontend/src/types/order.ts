// Order/payment types for the cashier flow. Mirrors the planned backend orders
// module (not implemented yet). Money is integer cents, never float.
export type OrderStatus = 'UNPAID' | 'PAID';

export interface OrderItem {
  id: string; // unique per line; the same product can appear as multiple items
  productId: string;
  productName: string;
  standId: string;
  standName: string;
  unitPrice: number; // integer cents, incl. tax
  quantity: number;
  comment?: string; // optional per-item note from the cashier
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
