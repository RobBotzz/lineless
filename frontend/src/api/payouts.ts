import { apiFetch } from './client';
import type { BulkTabCheckoutResult, EventPayoutBreakdown, PayoutOverview } from '@/types/payout';

export function getPayoutOverview(): Promise<PayoutOverview> {
  return apiFetch<PayoutOverview>('/payouts', { auth: 'organizer' });
}

export function getEventPayout(eventId: string): Promise<EventPayoutBreakdown> {
  return apiFetch<EventPayoutBreakdown>(`/payouts/${eventId}`, { auth: 'organizer' });
}

// Charges (settles) every ready tab for an event. Tabs with items not yet ready
// are skipped server-side; the result reports how many settled/skipped/failed.
export function chargeAllTabs(eventId: string): Promise<BulkTabCheckoutResult> {
  return apiFetch<BulkTabCheckoutResult>(`/events/${eventId}/tabs/checkout`, {
    method: 'POST',
    auth: 'organizer',
  });
}
