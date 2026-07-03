// Tab API for the attendee. A tab is the attendee's Stripe authorize-then-
// capture payment vehicle for one event; all calls use the attendee session.
import { apiFetch } from './client';
import type { CreateTabResponse, TabView } from '../types/tab';

// POST /api/tabs — opens a tab and creates the first card hold. The returned
// clientSecret must be confirmed with Stripe.js to authorize that hold.
// firstOrderCents sizes the hold to cover the first order (rounded up to a
// multiple of the baseline) so the guest needs a single authorization.
export function createTab(eventId: string, firstOrderCents = 0): Promise<CreateTabResponse> {
  return apiFetch<CreateTabResponse>('/tabs', {
    method: 'POST',
    auth: 'attendee',
    eventId,
    body: JSON.stringify({ eventId, firstOrderCents }),
  });
}

// GET /api/tabs/:tabId — current status and remaining authorization headroom.
// Polled after a card confirmation: the tab only flips to OPEN once Stripe's
// authorization webhook lands.
export function getTabStatus(tabId: string, eventId: string): Promise<TabView> {
  return apiFetch<TabView>(`/tabs/${tabId}`, { auth: 'attendee', eventId });
}
