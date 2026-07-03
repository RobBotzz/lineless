import { useMemo, useState } from 'react';
import { Link, useFetcher, useLoaderData, useRevalidator, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import { useOrganizerAuth } from '@/auth/organizer/OrganizerAuthContext';
import { AlertDialog } from '@/components/feedback';
import { CalendarIcon, PinIcon, ProductsIcon, StandIcon } from '@/components/icons';
import { DeleteIconButton } from '@/components/shared';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Event, EventStatus } from '@/types/event';
import { hasCoordinates, type Location } from '@/types/location';
import type { DashboardActionResult } from './data';

type EventFilter = 'all' | 'draft' | 'active' | 'stopped';

function formatDate(date?: string) {
  if (!date) return 'No date set';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Unspecified';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

// Prefer the display name, fall back to coordinates, then the empty state.
function formatLocation(location: Location | null | undefined) {
  if (!location) return 'No location set';
  if (location.locationName) return location.locationName;
  if (hasCoordinates(location)) return `${location.yCoordinate}, ${location.xCoordinate}`;
  return 'No location set';
}

type StatusDetail = { label: string; className: string };

const statusDetails: Record<EventStatus, StatusDetail> = {
  DRAFT: {
    label: 'Draft',
    className: 'border-accent/30 bg-accent-soft text-accent',
  },
  ACTIVE: {
    label: 'Active',
    className: 'border-success/30 bg-success/10 text-success',
  },
  STOPPED: {
    label: 'Stopped',
    className: 'border-border bg-surface-muted text-text-muted',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'border-border bg-surface-muted text-text-muted',
  },
};

// Fall back gracefully if the backend ever sends a status the frontend doesn't
// know yet — a single unknown value must not take down the whole dashboard.
function statusFor(status: EventStatus): StatusDetail {
  return (
    statusDetails[status] ?? { label: String(status), className: statusDetails.STOPPED.className }
  );
}

// Rendered as the route's errorElement when the loader throws.
export function DashboardError() {
  const error = useRouteError();
  const { revalidate, state } = useRevalidator();
  const message =
    error instanceof ApiError
      ? error.message
      : 'Your events could not be loaded. Check whether the backend is running and try again.';
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-5 text-sm text-text">
      <span>{message}</span>
      <button
        type="button"
        onClick={revalidate}
        disabled={state === 'loading'}
        className="shrink-0 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium hover:bg-danger/10 disabled:opacity-50"
      >
        {state === 'loading' ? 'Loading…' : 'Try again'}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { events, standCounts, productCounts } =
    useLoaderData() as import('./data').DashboardLoaderData;
  const { account } = useOrganizerAuth();
  const fetcher = useFetcher<DashboardActionResult>();
  const [activeFilter, setActiveFilter] = useState<EventFilter>('all');
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<Event | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const firstName = account?.firstName?.trim();

  const visibleEvents = useMemo(() => {
    if (activeFilter === 'draft') return events.filter((event) => event.status === 'DRAFT');
    if (activeFilter === 'active') return events.filter((event) => event.status === 'ACTIVE');
    if (activeFilter === 'stopped') return events.filter((event) => event.status === 'STOPPED');
    return events;
  }, [activeFilter, events]);

  const actionError = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const visibleError = actionError && actionError !== dismissedError ? actionError : null;

  function confirmDeleteEvent() {
    if (!pendingDeleteEvent) return;
    setDismissedError(null);
    void fetcher.submit(
      { intent: 'deleteEvent', eventId: pendingDeleteEvent._id },
      { method: 'post', encType: 'application/json' },
    );
    setPendingDeleteEvent(null);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-text">Hello {firstName || 'there'}</h1>
        <p className="mt-2 text-sm text-text-muted">Manage your events and settings</p>
      </header>

      <EventStatusTabs activeFilter={activeFilter} onChange={setActiveFilter} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CreateEventTile />
        {visibleEvents.map((event) => (
          <EventCard
            event={event}
            key={event._id}
            onRequestDelete={() => setPendingDeleteEvent(event)}
            standCount={standCounts[event._id] ?? 0}
            productCount={productCounts[event._id] ?? 0}
          />
        ))}
      </div>

      <AlertDialog
        acknowledgeLabel="Delete"
        cancelLabel="Cancel"
        message={
          pendingDeleteEvent
            ? `“${pendingDeleteEvent.name || 'Untitled Event'}” will be irreversibly deleted and removed from the organizer dashboard.`
            : null
        }
        onAcknowledge={confirmDeleteEvent}
        onCancel={() => setPendingDeleteEvent(null)}
        title="Delete event?"
      />

      <AlertDialog
        message={visibleError}
        onAcknowledge={() => setDismissedError(actionError)}
        title="Couldn't delete event"
      />
    </div>
  );
}

function EventStatusTabs({
  activeFilter,
  onChange,
}: {
  activeFilter: EventFilter;
  onChange: (filter: EventFilter) => void;
}) {
  const tabs: { id: EventFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Drafts' },
    { id: 'active', label: 'Active Events' },
    { id: 'stopped', label: 'Stopped Events' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-accent bg-accent text-[var(--color-button-text)]'
                : 'border-border bg-surface text-text hover:bg-surface-muted',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function EventCard({
  event,
  standCount,
  productCount,
  onRequestDelete,
}: {
  event: Event;
  standCount: number;
  productCount: number;
  onRequestDelete: () => void;
}) {
  const status = statusFor(event.status);
  const canDelete = event.status === 'DRAFT';

  return (
    <Card className="group h-full gap-3 py-5 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md">
      <CardHeader>
        <Link className="min-w-0" to={`/organizer/events/${event._id}`}>
          <CardTitle className="truncate text-base group-hover:text-accent">{event.name}</CardTitle>
        </Link>
        {canDelete ? (
          <CardAction>
            <DeleteIconButton
              className="shrink-0"
              label={`Delete ${event.name || 'event'}`}
              onClick={onRequestDelete}
            />
          </CardAction>
        ) : null}
      </CardHeader>

      <Link className="block" to={`/organizer/events/${event._id}`}>
        <CardContent className="space-y-2">
          <div className="pb-1">
            <span
              className={[
                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                status.className,
              ].join(' ')}
            >
              {status.label}
            </span>
          </div>
          <p className="text-text-muted flex items-center gap-2 text-sm">
            <CalendarIcon className="h-4 w-4 shrink-0" />
            {formatDate(event.plannedDate)}
          </p>
          <p className="text-text-muted flex items-center gap-2 text-sm">
            <PinIcon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{formatLocation(event.location)}</span>
          </p>
        </CardContent>
      </Link>

      <CardFooter className="text-text-muted w-full items-center justify-between gap-3 border-t text-sm">
        <Link
          className="flex min-w-0 flex-1 justify-between gap-3"
          to={`/organizer/events/${event._id}`}
        >
          <span className="flex items-center gap-1.5">
            <StandIcon className="h-4 w-4 shrink-0" /> {standCount}{' '}
            {standCount === 1 ? 'Stand' : 'Stands'}
          </span>
          <span className="flex items-center gap-1.5">
            <ProductsIcon className="h-4 w-4 shrink-0" /> {productCount}{' '}
            {productCount === 1 ? 'Product' : 'Products'}
          </span>
        </Link>
      </CardFooter>
    </Card>
  );
}

function CreateEventTile() {
  const fetcher = useFetcher<DashboardActionResult>();
  // Derive the error from fetcher.data; `dismissed` hides it after acknowledge.
  const [dismissed, setDismissed] = useState(false);
  const busy = fetcher.state !== 'idle';
  const error = fetcher.data && !fetcher.data.ok && !dismissed ? fetcher.data.error : null;

  return (
    // `contents` keeps the <button> as the grid item, not the form wrapper.
    <fetcher.Form className="contents" method="post" onSubmit={() => setDismissed(false)}>
      <button
        className="hover:bg-accent-soft flex min-h-36 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-accent/70 bg-background p-5 text-center transition hover:border-accent disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        <div className="bg-accent mb-3 flex h-10 w-10 items-center justify-center rounded-full text-xl font-semibold text-white">
          +
        </div>
        <h3 className="text-accent text-base font-semibold">
          {busy ? 'Creating…' : 'Create New Event'}
        </h3>
      </button>

      <AlertDialog
        message={error}
        onAcknowledge={() => setDismissed(true)}
        title="Couldn't create event"
      />
    </fetcher.Form>
  );
}
