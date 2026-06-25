import type { ActionFunctionArgs } from 'react-router';

import { updateOrganizerAccount } from '@/api/account';
import { ApiError } from '@/api/client';
import { chargeAllTabs, getPayoutOverview } from '@/api/payouts';
import type { BulkTabCheckoutResult, PayoutOverview } from '@/types/payout';

export type PaymentLoaderData = {
  overview: PayoutOverview;
};

export type PaymentActionResult =
  | { ok: true; intent: 'save-bank' }
  | { ok: true; intent: 'charge-tabs'; result: BulkTabCheckoutResult }
  | { ok: false; error: string };

export type PaymentActionBody =
  | { intent: 'save-bank'; iban: string; ibanHolderName: string }
  | { intent: 'charge-tabs'; eventId: string };

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
      case 'charge-tabs': {
        const result = await chargeAllTabs(body.eventId);
        return { ok: true, intent: 'charge-tabs', result };
      }
    }
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    return { ok: false, error: message };
  }
}
