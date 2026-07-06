import type { LoaderFunctionArgs } from 'react-router';

import { ApiError } from '@/api/client';
import { getAttendeeEvent } from '@/api/events';
import { ensureAttendeeSession } from '@/auth/attendee/attendeeSession';

export interface CartLoaderData {
  // Whether the event runs a cashier; mirrors the backend gate in createOrder
  // (`!tabId && !event.cashierEnabled` is rejected). Drives the Cash option.
  cashierEnabled: boolean;
}

export async function cartLoader({ params }: LoaderFunctionArgs): Promise<CartLoaderData> {
  const eventId = params.eventId as string;

  // Session creation returns 404 when the event is not ACTIVE. Return empty
  // data so the parent layout gate renders instead of the error boundary.
  try {
    await ensureAttendeeSession(eventId);
    const event = await getAttendeeEvent(eventId);
    return { cashierEnabled: event.cashierEnabled };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { cashierEnabled: false };
    }
    throw err;
  }
}
