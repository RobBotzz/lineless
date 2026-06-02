import { lazy, Suspense, useState } from 'react';
import { useFetcher, useLoaderData, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import { AlertDialog } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import type { Event, UpdateEventInput } from '@/types/event';
import type { Stand } from '@/types/stand';
import { emptyLocation, hasCoordinates, type Location } from '@/types/location';
import { CustomerLinkPanel } from './CustomerLinkPanel';
import { OperatorLinkPanel } from './OperatorLinkPanel';
import { StandDialog } from './StandDialog';
import type { EventActionResult, EventConfigurationLoaderData } from './data';

// Lazy-loaded so Leaflet only ships when the location section is expanded.
const LocationPicker = lazy(() =>
  import('@/components/location/LocationPicker').then((m) => ({ default: m.LocationPicker })),
);

// Rendered as the route's errorElement when the loader throws.
export function EventConfigurationError() {
  const error = useRouteError();
  const message =
    error instanceof ApiError
      ? error.message
      : 'This event could not be loaded. Check whether the backend is running and try again.';
  return (
    <div>
      <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-5 text-sm text-text">
        {message}
      </div>
    </div>
  );
}

type EventForm = {
  name: string;
  plannedDate: string;
  ratingsEnabled: boolean;
  primaryColor: string;
  secondaryColor: string;
  location: Location;
};

// Backend returns ISO timestamps; <input type="date"> needs YYYY-MM-DD.
function toDateInputValue(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toForm(event: Event): EventForm {
  return {
    name: event.name,
    plannedDate: toDateInputValue(event.plannedDate),
    ratingsEnabled: event.ratingsEnabled,
    primaryColor: event.branding.primaryColor,
    secondaryColor: event.branding.secondaryColor,
    location: event.location ?? emptyLocation,
  };
}

export default function EventConfiguration() {
  const { event, stands } = useLoaderData() as EventConfigurationLoaderData;
  const fetcher = useFetcher<EventActionResult>();
  const [form, setForm] = useState<EventForm>(() => toForm(event));
  const [showOperatorLink, setShowOperatorLink] = useState(false);
  const [showCustomerLink, setShowCustomerLink] = useState(false);
  // Track the dismissed error so the dialog derives from fetcher.data (no effect).
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const [isStandDialogOpen, setIsStandDialogOpen] = useState(false);
  const [editingStand, setEditingStand] = useState<Stand | null>(null);

  const actionError = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const visibleError = actionError && actionError !== dismissedError ? actionError : null;

  function updateField<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const busy = fetcher.state !== 'idle';

  function submit(payload: { intent: string; patch?: UpdateEventInput; standId?: string }) {
    void fetcher.submit(payload as unknown as Parameters<typeof fetcher.submit>[0], {
      method: 'post',
      encType: 'application/json',
    });
  }

  function handleDeleteStand(standId: string) {
    if (confirm('Are you sure you want to delete this stand?')) {
      submit({ intent: 'deleteStand', standId });
    }
  }

  function handleSave() {
    const patch: UpdateEventInput = {
      name: form.name,
      // Send undefined rather than an empty string to leave the date unchanged.
      plannedDate: form.plannedDate || undefined,
      ratingsEnabled: form.ratingsEnabled,
      branding: { primaryColor: form.primaryColor, secondaryColor: form.secondaryColor },
      location: form.location,
    };
    submit({ intent: 'save', patch });
  }

  // Lifecycle rules mirror the backend: start only from DRAFT, stop only from ACTIVE.
  const canStart = event.status === 'DRAFT';
  const canStop = event.status === 'ACTIVE';

  return (
    <div className="space-y-6">
      {/* Header — title + lifecycle actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{event.name || 'Untitled Event'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              className="w-full bg-success text-white hover:bg-success/90"
              disabled={!canStart || busy}
              onClick={() => submit({ intent: 'start' })}
              size="lg"
            >
              Start Event
            </Button>
            <Button
              className="w-full"
              disabled={!canStop || busy}
              onClick={() => submit({ intent: 'stop' })}
              size="lg"
              variant="secondary"
            >
              Complete Event
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Links — share targets for operators and attendees */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <LinkIcon />
            Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Grouped so the panel hangs flush off the button, not spaced by the card. */}
          <div>
            <Button
              aria-expanded={showOperatorLink}
              className={['w-full', showOperatorLink ? 'rounded-b-none' : ''].join(' ')}
              onClick={() => setShowOperatorLink((open) => !open)}
              size="lg"
              variant="default"
            >
              <span>Operator Dashboard Link</span>
              <ChevronDownIcon
                className={[
                  'ml-auto transition-transform',
                  showOperatorLink ? 'rotate-180' : '',
                ].join(' ')}
              />
            </Button>
            {showOperatorLink && <OperatorLinkPanel />}
          </div>
          {/* Grouped so the panel hangs flush off the button, not spaced by the card. */}
          <div>
            <Button
              aria-expanded={showCustomerLink}
              className={['w-full', showCustomerLink ? 'rounded-b-none' : ''].join(' ')}
              onClick={() => setShowCustomerLink((open) => !open)}
              size="lg"
              variant="default"
            >
              <span>Customer View QR / Link</span>
              <ChevronDownIcon
                className={[
                  'ml-auto transition-transform',
                  showCustomerLink ? 'rotate-180' : '',
                ].join(' ')}
              />
            </Button>
            {showCustomerLink && <CustomerLinkPanel eventId={event._id} />}
          </div>
          <Button className="w-full" disabled size="lg" variant="secondary">
            Analytics Dashboard
          </Button>
        </CardContent>
      </Card>

      {/* Event settings — core editable fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <TextField
              id="event-name"
              label="Event Name"
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Event name"
              type="text"
              value={form.name}
            />

            <TextField
              id="event-date"
              label="Event Date"
              onChange={(e) => updateField('plannedDate', e.target.value)}
              type="date"
              value={form.plannedDate}
            />

            <EventLocationField
              onChange={(location) => updateField('location', location)}
              value={form.location}
            />

            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <label className="text-sm font-medium" htmlFor="ratings-enabled">
                Optional Product Rating
              </label>
              <Toggle
                checked={form.ratingsEnabled}
                id="ratings-enabled"
                label="Optional Product Rating"
                onChange={(value) => updateField('ratingsEnabled', value)}
              />
            </div>
          </div>

          {/* Branding */}
          <div className="mt-6 space-y-5 border-t pt-6">
            <div>
              <p className="mb-2 block text-sm font-medium">Logo</p>
              <Button disabled variant="outline">
                <UploadIcon /> <span className="ml-2">Upload</span>
              </Button>
            </div>

            <ColorField
              id="primary-color"
              label="Primary Color"
              onChange={(value) => updateField('primaryColor', value)}
              value={form.primaryColor}
            />
            {/* secondaryColor in the backend = the button text color in the UI. */}
            <ColorField
              id="secondary-color"
              label="Button Text Color"
              onChange={(value) => updateField('secondaryColor', value)}
              value={form.secondaryColor}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button className="px-6" disabled={busy} onClick={handleSave} size="lg">
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stands & Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stands &amp; Products</CardTitle>
          <CardAction>
            <Button
              size="sm"
              onClick={() => {
                setEditingStand(null);
                setIsStandDialogOpen(true);
              }}
            >
              + Add Stand
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {stands.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border bg-background px-4 py-10 text-center">
              <p className="text-sm font-medium">No stands configured yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Add stands to this event to allow operators to fulfill orders.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stands.map((stand) => (
                <div key={stand._id} className="rounded-lg border border-border bg-surface">
                  {/* Stand header */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <h3 className="font-medium text-text">{stand.standName}</h3>
                      {stand.location.locationName && (
                        <p className="text-sm text-text-muted mt-0.5 flex items-center gap-1">
                          <SmallPinIcon /> {stand.location.locationName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingStand(stand);
                          setIsStandDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-danger hover:bg-danger/10 hover:border-danger/30 hover:text-danger"
                        onClick={() => handleDeleteStand(stand._id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {/* Products section */}
                  <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-sm text-text-muted">
                      <ProductsIcon />0 Products
                    </span>
                    <Button size="sm" variant="outline" disabled>
                      + Add Product
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <StandDialog
        key={`${editingStand?._id ?? 'new'}-${String(isStandDialogOpen)}`}
        stand={editingStand}
        eventLocation={event.location ?? emptyLocation}
        isOpen={isStandDialogOpen}
        onClose={() => setIsStandDialogOpen(false)}
      />

      <AlertDialog
        message={visibleError}
        onAcknowledge={() => setDismissedError(actionError)}
        title="Something went wrong"
      />
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <input
          aria-label={`${label} swatch`}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-transparent"
          onChange={(e) => onChange(e.target.value)}
          type="color"
          value={value}
        />
        <input
          className="w-full bg-transparent text-sm text-text outline-none"
          id={id}
          onChange={(e) => onChange(e.target.value)}
          type="text"
          value={value}
        />
      </div>
    </div>
  );
}

function EventLocationField({
  value,
  onChange,
}: {
  value: Location;
  onChange: (next: Location) => void;
}) {
  const [open, setOpen] = useState(false);

  const summary = value.locationName
    ? value.locationName
    : hasCoordinates(value)
      ? `${value.yCoordinate}, ${value.xCoordinate}`
      : 'No location selected';

  return (
    <div>
      <p className="mb-2 block text-sm font-medium text-text">Event Location</p>
      <div className="rounded-lg border border-border bg-surface">
        <button
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setOpen((prev) => !prev)}
          type="button"
        >
          <span className="flex items-center gap-2">
            <PinIcon />
            <span>
              <span className="block text-sm font-medium text-text">Location</span>
              <span className="block max-w-xs truncate text-xs text-text-muted">{summary}</span>
            </span>
          </span>
          <ChevronDownIcon
            className={['transition-transform', open ? 'rotate-180' : ''].join(' ')}
          />
        </button>

        {open && (
          <div className="border-t border-border p-4">
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-surface-muted text-sm text-text-muted">
                  Loading map…
                </div>
              }
            >
              <LocationPicker onChange={onChange} value={value} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={['h-4 w-4', className].filter(Boolean).join(' ')}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-accent"
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

function ProductsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function SmallPinIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 text-text-muted"
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

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}
