// Mock product/stand catalog for the cashier flow.
//
// The cashier spans every stand in an event, but operator auth is currently
// single-stand scoped and the backend products endpoint is per-stand, so the
// catalog is mocked here until cashier-scoped auth exists. Money is integer
// cents. Product photos use deterministic placeholder images; swap for real
// product images once available.

export interface CashierStand {
  id: string;
  name: string;
}

export interface CashierProduct {
  id: string;
  name: string;
  priceIncludingTax: number; // integer cents
  imageUrl: string;
  standId: string;
  standName: string;
}

export const cashierStands: CashierStand[] = [
  { id: 'crepe-stand', name: 'Crepe Stand' },
  { id: 'beverage-stand', name: 'Beverage Stand' },
];

// Deterministic placeholder photo per product (replace with real images later).
function placeholderImage(seed: string): string {
  return `https://picsum.photos/seed/${seed}/640/480`;
}

export const cashierProducts: CashierProduct[] = [
  {
    id: 'crepe-nutella',
    name: 'Crepe Nutella',
    priceIncludingTax: 450,
    imageUrl: placeholderImage('crepe-nutella'),
    standId: 'crepe-stand',
    standName: 'Crepe Stand',
  },
  {
    id: 'crepe-cinnamon-sugar',
    name: 'Crepe Cinnamon Sugar',
    priceIncludingTax: 400,
    imageUrl: placeholderImage('crepe-cinnamon'),
    standId: 'crepe-stand',
    standName: 'Crepe Stand',
  },
  {
    id: 'cola',
    name: 'Cola',
    priceIncludingTax: 300,
    imageUrl: placeholderImage('cola'),
    standId: 'beverage-stand',
    standName: 'Beverage Stand',
  },
  {
    id: 'sparkling-water',
    name: 'Sparkling Water',
    priceIncludingTax: 250,
    imageUrl: placeholderImage('sparkling-water'),
    standId: 'beverage-stand',
    standName: 'Beverage Stand',
  },
];
