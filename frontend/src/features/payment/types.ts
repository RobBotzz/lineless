// How the attendee pays for a cart. CARD opens/uses a Stripe tab (authorize-
// then-capture); CASH is settled in person by a cashier.
export type PaymentMethod = 'CARD' | 'CASH';
