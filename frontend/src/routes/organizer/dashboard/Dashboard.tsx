import { useState } from 'react';
import { Link, useFetcher, useLoaderData, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AlertDialog } from '@/components/feedback';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Event } from '@/types/event';
import { hasCoordinates, type Location } from '@/types/location';
import type { DashboardActionResult } from './data';

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

// Rendered as the route's errorElement when the loader throws.
export function DashboardError() {
  const error = useRouteError();
  const message =
    error instanceof ApiError
      ? error.message
      : 'Your events could not be loaded. Check whether the backend is running and try again.';
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-5 text-sm text-text">
      {message}
    </div>
  );
}

export default function Dashboard() {
  const events = useLoaderData() as Event[];
  const { account } = useAuth();
  const firstName = account?.firstName?.trim();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-text">Hello {firstName || 'there'}</h1>
        <p className="mt-2 text-sm text-text-muted">Manage your events and settings</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard event={event} key={event._id} />
        ))}
        <CreateEventTile />
      </div>
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  return (
    <Link className="group" to={`/organizer/events/${event._id}`}>
      <Card className="h-full gap-4 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg group-hover:text-accent">{event.name}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-2">
          <p className="text-text-muted flex items-center gap-2 text-sm">
            <CalendarIcon />
            {formatDate(event.plannedDate)}
          </p>
          <p className="text-text-muted flex items-center gap-2 text-sm">
            <PinIcon />
            <span className="min-w-0 truncate">{formatLocation(event.location)}</span>
          </p>
        </CardContent>

        {/* TODO: Stand/product counts come from a future endpoint — placeholders for now. */}
        <CardFooter className="text-text-muted w-full justify-between border-t text-sm">
          <span>— Stands</span>
          <span>— Products</span>
        </CardFooter>
      </Card>
    </Link>
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
        className="hover:bg-accent-soft flex min-h-44 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-accent/70 bg-background p-6 text-center transition hover:border-accent disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        <div className="bg-accent mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl font-semibold text-white">
          +
        </div>
        <h3 className="text-accent text-lg font-semibold">
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

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect height="18" rx="2" width="18" x="3" y="4" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
