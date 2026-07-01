import { Link, Outlet, useLoaderData, useParams, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';

import { AttendeeNavbar } from '@/components/layout/navbars';
import { paths } from '@/paths';
import { eventLogoSrc, type Event } from '@/types/event';
import { BrandingProvider } from '@/features/branding/BrandingContext';
import { BrandLogo } from '@/features/branding/BrandLogo';

import { CartProvider, useCart } from './cart/cart-context';
import { ATTENDEE_WIDTH } from './column';
import type { AttendeeLayoutLoaderData } from './data';
import { CartIcon, HistoryIcon } from '@/components/icons';
import { AttendeeRequireSession } from '@/auth/attendee/AttendeeRequireSession';

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
          <div className="min-h-screen bg-background">
            <AttendeeNavbar
              left={<Logo eventId={eventId} logoSrc={eventLogoSrc(event)} />}
              right={<NavbarActions eventId={eventId} />}
              widthClassName={ATTENDEE_WIDTH}
            />
            <main className={`mx-auto ${ATTENDEE_WIDTH} pb-6 pt-4`}>
              <Outlet />
            </main>
          </div>
        </BrandingProvider>
      </AttendeeRequireSession>
    </CartProvider>
  );
}

function Logo({ eventId, logoSrc }: { eventId?: string; logoSrc: string | null }) {
  return (
    <Link
      className="inline-flex items-center"
      to={eventId ? paths.attendee.event(eventId) : paths.home}
    >
      <BrandLogo logoSrc={logoSrc} />
    </Link>
  );
}

function NavbarActions({ eventId }: { eventId?: string }) {
  const { totalCount } = useCart();

  const iconButton =
    'relative inline-flex h-9 w-9 items-center justify-center rounded-md text-text transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

  return (
    <div className="flex items-center gap-1">
      <Link
        to={eventId ? paths.attendee.orders(eventId) : '#'}
        className={iconButton}
        aria-label="Order history"
      >
        <HistoryIcon className="h-5 w-5" />
      </Link>
      <Link
        to={eventId ? paths.attendee.cart(eventId) : '#'}
        className={iconButton}
        aria-label="Shopping cart"
      >
        <CartIcon className="h-5 w-5" />
        {totalCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-button-text">
            {totalCount}
          </span>
        )}
      </Link>
    </div>
  );
}

function EventGateShell({ event, children }: { event: Event; children: React.ReactNode }) {
  return (
    <BrandingProvider branding={event.branding}>
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className={`w-full ${ATTENDEE_WIDTH} space-y-6 text-center`}>
          <BrandLogo logoSrc={eventLogoSrc(event)} />
          <h1 className="text-2xl font-semibold text-text">{event.name}</h1>
          {children}
        </div>
      </div>
    </BrandingProvider>
  );
}

function EventComingSoonGate({ event }: { event: Event }) {
  return (
    <EventGateShell event={event}>
      <p className="text-text-muted">
        {event.plannedDate
          ? `This event starts on ${new Date(event.plannedDate).toLocaleDateString()}.`
          : 'This event has not started yet.'}
      </p>
      <p className="text-sm text-text-muted">
        Check back once the event is live to place your order.
      </p>
    </EventGateShell>
  );
}

function EventStoppedGate({ event }: { event: Event }) {
  return (
    <EventGateShell event={event}>
      <p className="text-text-muted">This event is not accepting new orders.</p>
      <p className="text-sm text-text-muted">
        Operators are still fulfilling orders that were placed before the event closed.
      </p>
    </EventGateShell>
  );
}

function EventCompletedGate({ event }: { event: Event }) {
  return (
    <EventGateShell event={event}>
      <p className="text-text-muted">This event has ended.</p>
      <p className="text-sm text-text-muted">Thank you for attending!</p>
    </EventGateShell>
  );
}

export function AttendeeLayoutError() {
  const error = useRouteError();
  const message = error instanceof ApiError ? error.message : 'This event could not be loaded.';
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <p className="text-text-muted">{message}</p>
    </div>
  );
}
