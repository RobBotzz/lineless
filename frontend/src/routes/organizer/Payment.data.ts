import type { ActionFunctionArgs } from 'react-router';

import { updateOrganizerAccount } from '@/api/account';
import { ApiError } from '@/api/client';
import { chargeAllTabs, getPayoutOverview } from '@/api/payouts';
import type { PayoutOverview } from '@/types/payout';

export type PaymentLoaderData = {
  overview: PayoutOverview;
};

export type PaymentActionResult =
  | { ok: true; intent: 'save-bank' }
  | { ok: true; intent: 'charge-all'; settled: number; skipped: number; failed: number }
  | { ok: false; error: string };

export type PaymentActionBody =
  | { intent: 'save-bank'; iban: string; ibanHolderName: string }
  | { intent: 'charge-all'; eventIds: string[] };

// One call returns the bank details plus a full payout breakdown per event.
export async function paymentLoader(): Promise<PaymentLoaderData> {
  return { overview: await getPayoutOverview() };
}

export async function paymentAction({ request }: ActionFunctionArgs): Promise<PaymentActionResult> {
  const body = (await request.json()) as PaymentActionBody;

  try {
    switch (body.intent) {
      case 'save-bank': {
        await updateOrganizerAccount({
          iban: body.iban.trim() || null,
          ibanHolderName: body.ibanHolderName.trim() || null,
        });
        return { ok: true, intent: 'save-bank' };
      }
      case 'charge-all': {
        // Settle every event with open tabs; aggregate the per-event results.
        const results = await Promise.all(body.eventIds.map((id) => chargeAllTabs(id)));
        return {
          ok: true,
          intent: 'charge-all',
          settled: results.reduce((sum, r) => sum + r.settled, 0),
          skipped: results.reduce((sum, r) => sum + r.skipped, 0),
          failed: results.reduce((sum, r) => sum + r.failed, 0),
        };
      }
    }
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    return { ok: false, error: message };
  }
}
