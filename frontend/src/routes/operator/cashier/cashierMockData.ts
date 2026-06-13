// Mock product/stand catalog for the cashier flow.
//
// The cashier spans every stand in an event, but operator auth is currently
// single-stand scoped and the backend products endpoint is per-stand, so the
// catalog is mocked here until cashier-scoped auth exists. These are real
// `Product` records (the same shape the attendee uses) so the cashier can reuse
// the shared cart/catalog primitives. Money is integer cents; photos use
// deterministic placeholders. `Product` has no stand name, so stands are kept in
// a separate list and resolved by id, exactly like the attendee product page.

import type { Product } from '@/types/product';

export interface CashierStand {
  _id: string;
  standName: string;
}

export const cashierStands: CashierStand[] = [
  { _id: 'crepe-stand', standName: 'Crepe Stand' },
  { _id: 'beverage-stand', standName: 'Beverage Stand' },
];

// Deterministic placeholder photo per product (replace with real images later).
function placeholderImage(seed: string): string {
  return `https://picsum.photos/seed/${seed}/640/480`;
}

// High stock so the shared cart's stock cap never blocks the cashier.
const CASHIER_STOCK = 9999;
const SEED_TIME = '2026-01-01T00:00:00.000Z';

export const cashierProducts: Product[] = [
  {
    _id: 'crepe-nutella',
    standId: 'crepe-stand',
    productName: 'Crepe Nutella',
    productDescription: 'Warm crepe with a generous Nutella spread.',
    priceIncludingTax: 450,
    taxRate: 700,
    productImageUrl: placeholderImage('crepe-nutella'),
    instantProduct: false,
    productStock: CASHIER_STOCK,
    productStatus: 'LIVE',
    rating: 4.7,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    _id: 'crepe-cinnamon-sugar',
    standId: 'crepe-stand',
    productName: 'Crepe Cinnamon Sugar',
    productDescription: 'Classic crepe dusted with cinnamon and sugar.',
    priceIncludingTax: 400,
    taxRate: 700,
    productImageUrl: placeholderImage('crepe-cinnamon'),
    instantProduct: false,
    productStock: CASHIER_STOCK,
    productStatus: 'LIVE',
    rating: 4.4,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    _id: 'cola',
    standId: 'beverage-stand',
    productName: 'Cola',
    productDescription: 'Chilled 0.33L cola.',
    priceIncludingTax: 300,
    taxRate: 1900,
    productImageUrl: placeholderImage('cola'),
    instantProduct: true,
    productStock: CASHIER_STOCK,
    productStatus: 'LIVE',
    rating: 4.1,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    _id: 'sparkling-water',
    standId: 'beverage-stand',
    productName: 'Sparkling Water',
    productDescription: 'Refreshing sparkling water, 0.5L.',
    priceIncludingTax: 250,
    taxRate: 1900,
    productImageUrl: placeholderImage('sparkling-water'),
    instantProduct: true,
    productStock: CASHIER_STOCK,
    productStatus: 'LIVE',
    rating: null,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
];
