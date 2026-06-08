// Cashier order/payment API.
//
// The backend orders/payments modules are not implemented yet, so this module
// is backed by an in-memory mock store (same approach as PickupDashboard). Each
// function documents the real endpoint it should call; once the backend exists,
// swapping to `apiFetch` is a local change here only.
import type { Order, OrderItem } from '../types/order';

// Small artificial latency so the UI exercises its loading states.
const SIMULATED_LATENCY_MS = 150;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), SIMULATED_LATENCY_MS));
}

// Avoid visually ambiguous characters (0/O, 1/I) in human-read auth codes.
const AUTH_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateAuthCode(): string {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += AUTH_CODE_ALPHABET[Math.floor(Math.random() * AUTH_CODE_ALPHABET.length)];
  }
  return code;
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// Seeded unpaid orders so the cash-payment list is populated on first load.
const orders: Order[] = [
  {
    orderId: 'LL-001',
    status: 'UNPAID',
    items: [
      {
        productId: 'crepe-cinnamon-sugar',
        productName: 'Crepe Cinnamon Sugar',
        standId: 'crepe-stand',
        standName: 'Crepe Stand',
        unitPrice: 400,
        quantity: 1,
      },
      {
        productId: 'cola',
        productName: 'Cola',
        standId: 'beverage-stand',
        standName: 'Beverage Stand',
        unitPrice: 300,
        quantity: 1,
      },
    ],
    total: 700,
    authenticationId: 'SE8B',
    createdAt: minutesAgo(8),
    paidAt: null,
  },
  {
    orderId: 'LL-002',
    status: 'UNPAID',
    items: [
      {
        productId: 'crepe-nutella',
        productName: 'Crepe Nutella',
        standId: 'crepe-stand',
        standName: 'Crepe Stand',
        unitPrice: 450,
        quantity: 2,
      },
    ],
    total: 900,
    authenticationId: 'KQ4T',
    createdAt: minutesAgo(3),
    paidAt: null,
  },
];

// Continue the LL-00x sequence after the seeded orders.
let orderSequence = orders.length;

function nextOrderId(): string {
  orderSequence += 1;
  return `LL-${String(orderSequence).padStart(3, '0')}`;
}

// GET /api/stands/{standId}/orders?status=UNPAID (operator auth)
export function getUnpaidOrders(): Promise<Order[]> {
  const unpaid = orders
    .filter((order) => order.status === 'UNPAID')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(unpaid);
}

// GET /api/orders/{orderId} (operator auth). Rejects when not found (used by search).
export function getOrder(orderId: string): Promise<Order> {
  const order = orders.find(
    (candidate) => candidate.orderId.toLowerCase() === orderId.trim().toLowerCase(),
  );
  if (!order) {
    return Promise.reject(new Error(`Order "${orderId}" was not found.`));
  }
  return delay(order);
}

// POST /api/orders with { items: [{ productId, quantity }] } (operator auth).
// The real backend resolves product names/prices; the mock receives already
// resolved line items from the client and just stores them.
export function createManualOrder(input: { items: OrderItem[] }): Promise<Order> {
  const total = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const order: Order = {
    orderId: nextOrderId(),
    status: 'UNPAID',
    items: input.items,
    total,
    authenticationId: generateAuthCode(),
    createdAt: new Date().toISOString(),
    paidAt: null,
  };
  orders.push(order);
  return delay(order);
}

// POST /api/orders/{orderId}/cash-payment (operator auth).
export function confirmCashPayment(orderId: string): Promise<Order> {
  const order = orders.find((candidate) => candidate.orderId === orderId);
  if (!order) {
    return Promise.reject(new Error(`Order "${orderId}" was not found.`));
  }
  order.status = 'PAID';
  order.paidAt = new Date().toISOString();
  return delay(order);
}
