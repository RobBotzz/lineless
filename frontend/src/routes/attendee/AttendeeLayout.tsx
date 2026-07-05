import type { ComponentType, SVGProps } from 'react';
import { Link, Outlet, useLoaderData, useParams, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import { AttendeeNavbar } from '@/components/layout/navbars';
import { Wordmark } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { paths } from '@/paths';
import { eventLogoSrc } from '@/types/event';
import { BrandingProvider } from '@/features/branding/BrandingContext';
import { BrandLogo } from '@/features/branding/BrandLogo';

import { CartProvider, useCart } from './cart/cart-context';
import { ATTENDEE_WIDTH } from './column';
import type { AttendeeLayoutLoaderData } from './data';
import {
  CartIcon,
  CheckCircleIcon,
  HistoryIcon,
  HourglassCircleIcon,
  RefreshIcon,
  SearchIcon,
  WarningTriangleIcon,
} from '@/components/icons';
import { AttendeeRequireSession } from '@/auth/attendee/AttendeeRequireSession';

export default function AttendeeLayout() {
  const { eventId } = useParams();
  const { event } = useLoaderData() as AttendeeLayoutLoaderData;

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

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Visual tone of a status case, mapped to the shared color tokens. `halo` is the
// faint outer ring behind the icon, `badge` the icon disc, `pill` the label chip.
type Tone = 'accent' | 'success' | 'muted' | 'danger';

const TONE_CLASSES: Record<Tone, { halo: string; badge: string; pill: string }> = {
  accent: {
    halo: 'bg-accent-soft/50',
    badge: 'bg-accent-soft text-accent',
    pill: 'bg-accent-soft text-accent',
  },
  success: {
    halo: 'bg-success/10',
    badge: 'bg-success/15 text-success',
    pill: 'bg-success/10 text-success',
  },
  muted: {
    halo: 'bg-surface-muted',
    badge: 'bg-surface-muted text-text-muted',
    pill: 'bg-surface-muted text-text-muted',
  },
  danger: {
    halo: 'bg-danger/10',
    badge: 'bg-danger/15 text-danger',
    pill: 'bg-danger/10 text-danger',
  },
};

interface StatusContent {
  icon: IconComponent;
  tone: Tone;
  // Short chip above the title (e.g. "Not open yet").
  label: string;
  title: string;
  description: string;
  // Reload as primary when the situation might resolve on retry; otherwise the
  // only action is heading home.
  showRetry: boolean;
}

// Reads the backend's lifecycle hint (see EventNotActiveError -> 409 with
// eventStatus) off the error body, if present.
function readEventStatus(error: unknown): string | null {
  if (!(error instanceof ApiError) || typeof error.data !== 'object' || error.data === null) {
    return null;
  }
  const status = (error.data as { eventStatus?: unknown }).eventStatus;
  return typeof status === 'string' ? status : null;
}

// Maps the loader error to a user-facing explanation. The backend distinguishes
// a not-yet-active event (409 + eventStatus) from an unknown one (404); anything
// else is treated as a transient failure worth retrying.
function resolveStatusContent(error: unknown): StatusContent {
  if (error instanceof ApiError && error.status === 409) {
    const eventStatus = readEventStatus(error);
    if (eventStatus === 'DRAFT') {
      return {
        icon: HourglassCircleIcon,
        tone: 'accent',
        label: 'Not open yet',
        title: "This event hasn't started yet",
        description:
          'Ordering opens once the organizer starts the event. Check back a little later — the link stays the same.',
        showRetry: true,
      };
    }
    // STOPPED / COMPLETED (or any other non-active phase): the event is over.
    return {
      icon: CheckCircleIcon,
      tone: 'success',
      label: 'Event ended',
      title: 'This event has ended',
      description:
        'Ordering is closed for this event. Thanks for taking part — we hope to see you at the next one!',
      showRetry: false,
    };
  }

  if (error instanceof ApiError && error.status === 404) {
    return {
      icon: SearchIcon,
      tone: 'muted',
      label: 'Not found',
      title: 'Event not found',
      description:
        'We couldn’t find this event. The link may be mistyped or incomplete, or the event may have been removed.',
      showRetry: false,
    };
  }

  return {
    icon: WarningTriangleIcon,
    tone: 'danger',
    label: 'Something went wrong',
    title: 'This event couldn’t be loaded',
    description:
      'We couldn’t load this event right now. Please check your connection and try again in a moment.',
    showRetry: true,
  };
}

// Rendered when the layout loader fails. Stands alone (no event branding/cart,
// because the event fetch itself failed) and explains *why* the shop is
// unavailable: not started yet, already ended, unknown link, or a transient
// error. Full-page, centered, responsive down to small phones. The lineless
// wordmark sits centered above the card — no navbar, since there is nothing to
// navigate to from here.
export function AttendeeLayoutError() {
  const error = useRouteError();
  const { icon: Icon, tone, label, title, description, showRetry } = resolveStatusContent(error);
  const toneClasses = TONE_CLASSES[tone];

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-background px-4 py-10">
      <Wordmark className="mb-6 text-3xl" />

      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-sm sm:p-8">
        <span
          className={cn(
            'mx-auto flex h-20 w-20 items-center justify-center rounded-full',
            toneClasses.halo,
          )}
        >
          <span
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full',
              toneClasses.badge,
            )}
          >
            <Icon className="h-7 w-7" aria-hidden="true" />
          </span>
        </span>

        <span
          className={cn(
            'mt-5 inline-block rounded-full px-3 py-1 text-xs font-semibold',
            toneClasses.pill,
          )}
        >
          {label}
        </span>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-text">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
          {description}
        </p>

        <div className="mt-7 flex flex-col gap-2.5">
          {showRetry && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={cn(
                buttonVariants({ variant: 'default', size: 'lg' }),
                'h-12 w-full gap-2 rounded-xl text-base',
              )}
            >
              <RefreshIcon className="h-5 w-5" />
              Try again
            </button>
          )}
          <Link
            to={paths.home}
            className={cn(
              buttonVariants({ variant: showRetry ? 'secondary' : 'default', size: 'lg' }),
              'h-12 w-full rounded-xl text-base',
            )}
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
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
