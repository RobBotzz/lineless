// Stripe publishable (test) key. Safe to embed in client code; it can only
// create/confirm PaymentIntents, never capture or move money. The matching
// secret key lives in the backend config and never reaches the frontend.
export const STRIPE_PUBLISHABLE_KEY =
  'pk_test_REPLACE_WITH_YOUR_STRIPE_TEST_PUBLISHABLE_KEY';
