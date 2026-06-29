import { Link, Outlet, useLoaderData, useParams } from 'react-router';

import { AttendeeNavbar } from '@/components/layout/navbars';
import { Wordmark } from '@/components/shared';
import { paths } from '@/paths';
import { BrandingProvider } from '@/features/branding/BrandingContext';

import { CartProvider, useCart } from './cart/cart-context';
import { ATTENDEE_WIDTH } from './column';
import type { AttendeeLayoutLoaderData } from './data';
import { CartIcon, HistoryIcon } from '@/components/icons';
import { AttendeeRequireSession } from '@/auth/attendee/AttendeeRequireSession';

export default function AttendeeLayout() {
  const { eventId } = useParams();
  const { event } = useLoaderData() as AttendeeLayoutLoaderData;

  return (
    <CartProvider key={eventId ?? ''} eventId={eventId ?? ''}>
      <AttendeeRequireSession eventId={eventId ?? ''}>
        <BrandingProvider branding={event.branding}>
          <div className="min-h-screen bg-background">
            <AttendeeNavbar
              left={<Logo eventId={eventId} />}
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

function Logo({ eventId }: { eventId?: string }) {
  return (
    <Link
      className="inline-flex items-center"
      to={eventId ? paths.attendee.event(eventId) : paths.home}
    >
      <Wordmark />
    </Link>
  );
}

// Cart (with item-count badge) and order-history shortcuts.
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
