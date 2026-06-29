import { loadStripe, type Stripe } from '@stripe/stripe-js';

import { STRIPE_PUBLISHABLE_KEY } from '@/config';

// Load Stripe.js once for the whole app — loadStripe memoizes the script, and a
// single shared promise avoids re-initializing on every checkout mount.
export const stripePromise: Promise<Stripe | null> = loadStripe(STRIPE_PUBLISHABLE_KEY);
