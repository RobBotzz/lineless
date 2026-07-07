import { Link } from 'react-router';

import { CartIcon, HistoryIcon } from '@/components/icons';
import { paths } from '@/paths';
import { BrandLogo } from '@/features/branding/BrandLogo';

import { useCart } from './cart/cart-context';

export function Logo({ eventId, logoSrc }: { eventId?: string; logoSrc: string | null }) {
  return (
    <Link
      className="inline-flex items-center"
      to={eventId ? paths.attendee.event(eventId) : paths.home}
    >
      <BrandLogo logoSrc={logoSrc} />
    </Link>
  );
}

export function NavbarActions({ eventId }: { eventId?: string }) {
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
