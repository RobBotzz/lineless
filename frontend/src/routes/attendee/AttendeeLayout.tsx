import { Link, Outlet, useParams } from 'react-router';

import { AttendeeNavbar } from '@/components/layout/navbars';
import { Wordmark } from '@/components/shared';
import { paths } from '@/paths';

import { CartProvider, useCart } from './cart/cart-context';
import { ATTENDEE_WIDTH } from './column';
import { CartIcon, HistoryIcon } from '@/components/icons';
import { AttendeeRequireSession } from '@/auth/attendee/AttendeeRequireSession';

export default function AttendeeLayout() {
  const { eventId } = useParams();

  return (
    <CartProvider key={eventId ?? ''} eventId={eventId ?? ''}>
      <AttendeeRequireSession eventId={eventId ?? ''}>
        <div className="min-h-screen bg-background">
          <AttendeeNavbar
            left={<Logo eventId={eventId} />}
            right={<NavbarActions eventId={eventId} />}
            widthClassName={ATTENDEE_WIDTH}
          />
          <main className={`mx-auto ${ATTENDEE_WIDTH} pb-28 pt-4`}>
            <Outlet />
          </main>
        </div>
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
        to={eventId ? paths.attendee.cart(eventId) : '#'}
        className={iconButton}
        aria-label="Shopping cart"
      >
        <CartIcon />
        {totalCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-[var(--color-button-text)]">
            {totalCount}
          </span>
        )}
      </Link>
      <Link
        to={eventId ? paths.attendee.orders(eventId) : '#'}
        className={iconButton}
        aria-label="Order history"
      >
        <HistoryIcon />
      </Link>
    </div>
  );
}
