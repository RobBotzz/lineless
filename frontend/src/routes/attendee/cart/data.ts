import type { LoaderFunctionArgs } from 'react-router';

import { getAttendeeEvent } from '@/api/events';
import { ensureAttendeeSession } from '@/auth/attendee/attendeeSession';

export interface CartLoaderData {
  // Whether the event runs a cashier; mirrors the backend gate in createOrder
  // (`!tabId && !event.cashierEnabled` is rejected). Drives the Cash option.
  cashierEnabled: boolean;
}

export async function cartLoader({ params }: LoaderFunctionArgs): Promise<CartLoaderData> {
  const eventId = params.eventId as string;

  await ensureAttendeeSession(eventId);
  const event = await getAttendeeEvent(eventId);

  return { cashierEnabled: event.cashierEnabled };
}
