import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

type OrganizerEvent = {
  _id: string;
  name: string;
  location?: string;
  plannedDate?: string;
  status: 'DRAFT' | 'ACTIVE' | 'STOPPED';
  createdAt?: string;
};

type LoadState = 'loading' | 'ready' | 'error';

const statusLabels: Record<OrganizerEvent['status'], string> = {
  ACTIVE: 'Active',
  DRAFT: 'Draft',
  STOPPED: 'Stopped',
};

const statusClasses: Record<OrganizerEvent['status'], string> = {
  ACTIVE: 'bg-success/10 text-success',
  DRAFT: 'bg-accent-soft text-accent',
  STOPPED: 'bg-surface-muted text-text-muted',
};

function formatDate(date?: string) {
  if (!date) return 'No date set';

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return 'No date set';

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
}

export default function OrganizerDashboard() {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    const controller = new AbortController();

    async function loadEvents() {
      try {
        setLoadState('loading');
        const response = await fetch('/events', { signal: controller.signal });
        if (!response.ok) throw new Error(`Failed to load events: ${response.status}`);

        const data = (await response.json()) as OrganizerEvent[];
        setEvents(data);
        setLoadState('ready');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadState('error');
      }
    }

    void loadEvents();

    return () => controller.abort();
  }, []);

  const eventCountText = useMemo(() => {
    if (loadState !== 'ready') return 'Events';
    return `${events.length} ${events.length === 1 ? 'event' : 'events'}`;
  }, [events.length, loadState]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-text">Dashboard</h1>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">{eventCountText}</h2>
            <p className="text-sm text-text-muted">Open an event to continue configuration.</p>
          </div>
        </div>

        {loadState === 'loading' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                className="h-44 animate-pulse rounded-lg border border-border bg-surface-muted"
                key={index}
              />
            ))}
          </div>
        )}

        {loadState === 'error' && (
          <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-5 text-sm text-text">
            Events could not be loaded. Check whether the backend is running and try again.
          </div>
        )}

        {loadState === 'ready' && events.length === 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CreateEventTile />
          </div>
        )}

        {loadState === 'ready' && events.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link
                className="group flex min-h-44 flex-col justify-between rounded-lg border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
                key={event._id}
                to={`/organizer/events/${event._id}`}
              >
                <div>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 text-lg font-semibold text-text group-hover:text-accent">
                      {event.name}
                    </h3>
                    <span
                      className={[
                        'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                        statusClasses[event.status],
                      ].join(' ')}
                    >
                      {statusLabels[event.status]}
                    </span>
                  </div>

                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                        Date
                      </dt>
                      <dd className="mt-1 text-text">{formatDate(event.plannedDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                        Location
                      </dt>
                      <dd className="mt-1 text-text">{event.location || 'No location set'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-5 border-t border-border pt-4 text-sm font-medium text-accent">
                  Open configuration
                </div>
              </Link>
            ))}
            <CreateEventTile />
          </div>
        )}
      </section>
    </div>
  );
}

function CreateEventTile() {
  return (
    // TODO: implement with Backend and functionality
    <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border-2 border-dashed border-accent/70 bg-background p-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-white">
        +
      </div>
      <h3 className="text-lg font-semibold text-accent">Create Event</h3>
    </div>
  );
}
