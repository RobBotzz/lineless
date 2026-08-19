import { Outlet, useLoaderData, useParams } from 'react-router';

import { AttendeeNavbar } from '@/components/layout/navbars';
import { eventLogoSrc } from '@/types/event';
import { BrandingProvider } from '@/features/branding/BrandingContext';

import { CartProvider } from './cart/cart-context';
import { ATTENDEE_WIDTH } from './column';
import type { AttendeeLayoutLoaderData } from './data';
import { AttendeeRequireSession } from '@/auth/attendee/AttendeeRequireSession';
import { Logo, NavbarActions } from './AttendeeNavbarSlots';
import { EventComingSoonGate, EventStoppedGate, EventCompletedGate } from './EventGates';

export default function AttendeeLayout() {
  const { eventId } = useParams();
  const { event, hasSession } = useLoaderData() as AttendeeLayoutLoaderData;

  if (event.status === 'DRAFT') {
    return <EventComingSoonGate event={event} />;
  }

  if (!hasSession) {
    if (event.status === 'STOPPED') {
      return <EventStoppedGate event={event} />;
    }
    if (event.status === 'COMPLETED') {
      return <EventCompletedGate event={event} />;
    }
  }

  return (
    <CartProvider key={eventId ?? ''} eventId={eventId ?? ''}>
      <AttendeeRequireSession eventId={eventId ?? ''}>
        <BrandingProvider branding={event.branding}>
          <div className="flex min-h-screen flex-col bg-background">
            <AttendeeNavbar
              left={<Logo eventId={eventId} logoSrc={eventLogoSrc(event)} />}
              right={<NavbarActions eventId={eventId} />}
              widthClassName={ATTENDEE_WIDTH}
            />
            <main className={`flex flex-1 flex-col mx-auto ${ATTENDEE_WIDTH} pt-4`}>
              <Outlet />
            </main>
          </div>
        </BrandingProvider>
      </AttendeeRequireSession>
    </CartProvider>
  );
}
