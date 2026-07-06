import type { ActionFunctionArgs } from 'react-router';

import { updateOrganizerAccount } from '@/api/account';
import { ApiError } from '@/api/client';
import { chargeAllTabs, getPayoutOverview, requestPayout } from '@/api/payouts';
import type { PayoutOverview } from '@/types/payout';

export type PaymentLoaderData = {
  overview: PayoutOverview;
};

export type PaymentActionResult =
  | { ok: true; intent: 'save-bank' }
  | { ok: true; intent: 'charge-all'; settled: number; skipped: number; failed: number }
  | { ok: true; intent: 'request-payout'; amountCents: number }
  | { ok: false; error: string };

export type PaymentActionBody =
  | { intent: 'save-bank'; iban: string; ibanHolderName: string }
  | { intent: 'charge-all'; eventIds: string[] }
  | { intent: 'request-payout' };

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
        // Settle every event with open tabs. Use allSettled so one failing event
        // doesn't discard the others' results — a rejected event counts as failed.
        const results = await Promise.allSettled(body.eventIds.map((id) => chargeAllTabs(id)));
        let settled = 0;
        let skipped = 0;
        let failed = 0;
        for (const result of results) {
          if (result.status === 'fulfilled') {
            settled += result.value.settled;
            skipped += result.value.skipped;
            failed += result.value.failed;
          } else {
            failed += 1;
          }
        }
        return { ok: true, intent: 'charge-all', settled, skipped, failed };
      }
      case 'request-payout': {
        const payout = await requestPayout();
        return { ok: true, intent: 'request-payout', amountCents: payout.amountCents };
      }
    }
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    return { ok: false, error: message };
  }
}
