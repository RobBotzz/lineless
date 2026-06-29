// Mirrors TabStatus from backend (modules/tabs/model.ts).
export type TabStatus = 'PENDING_AUTHORIZATION' | 'OPEN' | 'CHECKOUT_PENDING' | 'PAID' | 'FAILED';

// Response of POST /api/tabs — a freshly opened tab plus the Stripe client
// secret the frontend confirms to authorize the baseline card hold.
export interface CreateTabResponse {
  tabId: string;
  stripePaymentIntentId: string;
  clientSecret: string;
}

// Response of GET /api/tabs/:tabId — current status and authorization headroom
// (all amounts are integer cents).
export interface TabView {
  tabId: string;
  status: TabStatus;
  authorizedCents: number;
  consumedCents: number;
  availableCents: number;
}
