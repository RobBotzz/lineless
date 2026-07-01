import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useFetcher, useLoaderData, useRevalidator, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import { deleteEventLogo, uploadEventLogo } from '@/api/events';
import { AlertDialog } from '@/components/feedback';
import { BackButton, ImageDropzone } from '@/components/shared';
import { AccountMenu, LandingPageNavbar } from '@/components/layout/navbars';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  InfoIcon,
  LinkIcon,
  PinIcon,
  ProductsIcon,
  SettingsIcon,
  StandIcon,
} from '@/components/icons';
import { useOrganizerAuth } from '@/auth/organizer/OrganizerAuthContext';
import { resolveBranding } from '@/features/branding/applyBranding';
import { cn } from '@/lib/utils';
import { paths } from '@/paths';
import { eventLogoSrc, type Event, type UpdateEventInput } from '@/types/event';
import type { Stand } from '@/types/stand';
import type { Product } from '@/types/product';
import { emptyLocation, hasCoordinates, type Location } from '@/types/location';
import { CustomerLinkPanel } from './CustomerLinkPanel';
import { OperatorLinkPanel } from './OperatorLinkPanel';
import { StandDialog } from './StandDialog';
import { ProductDialog } from './ProductDialog';
import { ProductRow } from './ProductRow';
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

// Mirrors the backend upload limits (config.upload). The server is the source of
// truth (it also checks the magic bytes); these just give instant feedback.
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type EventForm = {
  name: string;
  plannedDate: string;
  ratingsEnabled: boolean;
  cashierEnabled: boolean;
  // Baseline hold is stored as integer cents on the backend but edited in euros.
  baselineHold: string;
  primaryColor: string;
  secondaryColor: string;
  // null = Auto (derive accent text color from primaryColor).
  accentTextColor: string | null;
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
    cashierEnabled: event.cashierEnabled,
    baselineHold: String(Math.round(event.baselineHoldCents / 100)),
    primaryColor: event.branding.primaryColor,
    secondaryColor: event.branding.secondaryColor,
    accentTextColor: event.branding.accentTextColor,
    location: event.location ?? emptyLocation,
  };
}

export default function EventConfiguration() {
  const { event, stands, productsByStand } = useLoaderData() as EventConfigurationLoaderData;
  const fetcher = useFetcher<EventActionResult>();
  // Dedicated fetcher for the auto-saving settings form, kept separate from the
  // lifecycle/stand/product actions so its state drives the "saved" indicator.
  const saveFetcher = useFetcher<EventActionResult>();
  const { logout } = useOrganizerAuth();
  const revalidator = useRevalidator();
  const [form, setForm] = useState<EventForm>(() => toForm(event));
  const [showOperatorLink, setShowOperatorLink] = useState(false);
  const [showCustomerLink, setShowCustomerLink] = useState(false);
  const [showHoldInfo, setShowHoldInfo] = useState(false);
  const [showRatingsInfo, setShowRatingsInfo] = useState(false);
  const [showCashierInfo, setShowCashierInfo] = useState(false);
  const [showLogoInfo, setShowLogoInfo] = useState(false);
  // Track the dismissed error so the dialog derives from fetcher.data (no effect).
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // Logo upload is a separate multipart call (like the product image), not part
  // of the JSON settings auto-save. The event already exists, so we upload/delete
  // immediately and revalidate the loader to pick up the new branding.logoUrl.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  // Object URL for the in-flight pick, shown for instant feedback until the
  // revalidated loader serves the persisted logo. Revoked on change / unmount.
  const logoFilePreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : null),
    [logoFile],
  );
  useEffect(() => {
    if (!logoFilePreview) return;
    return () => URL.revokeObjectURL(logoFilePreview);
  }, [logoFilePreview]);
  const logoPreviewUrl = logoFilePreview ?? eventLogoSrc(event);

  function handleSelectLogo(file: File) {
    setLogoError(null);
    setLogoFile(file);
    setLogoBusy(true);
    uploadEventLogo(event._id, file)
      .then(() => revalidator.revalidate())
      .catch((err) =>
        setLogoError(err instanceof ApiError ? err.message : 'Could not upload the logo.'),
      )
      .finally(() => {
        setLogoBusy(false);
        setLogoFile(null);
      });
  }

  function handleRemoveLogo() {
    setLogoError(null);
    setLogoBusy(true);
    deleteEventLogo(event._id)
      .then(() => revalidator.revalidate())
      .catch((err) =>
        setLogoError(err instanceof ApiError ? err.message : 'Could not remove the logo.'),
      )
      .finally(() => setLogoBusy(false));
  }

  const [isStandDialogOpen, setIsStandDialogOpen] = useState(false);
  const [editingStand, setEditingStand] = useState<Stand | null>(null);
  const [pendingDeleteStandId, setPendingDeleteStandId] = useState<string | null>(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(false);
  const [pendingCompleteEvent, setPendingCompleteEvent] = useState(false);

  // Product dialog: track which stand we're adding to / which product we're editing.
  const [productDialog, setProductDialog] = useState<{
    standId: string;
    product: Product | null;
  } | null>(null);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<Product | null>(null);

  const actionError = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const visibleError = actionError && actionError !== dismissedError ? actionError : null;

  // Baseline hold is entered in whole euros (multiples of €1); backend requires
  // at least 100 cents (€1.00).
  const baselineHoldEuros = Number(form.baselineHold);
  const baselineHoldValid = Number.isInteger(baselineHoldEuros) && baselineHoldEuros >= 1;

  function updateField<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const busy = fetcher.state !== 'idle';

  function submit(payload: {
    intent: string;
    patch?: UpdateEventInput;
    standId?: string;
    productId?: string;
  }) {
    void fetcher.submit(payload as unknown as Parameters<typeof fetcher.submit>[0], {
      method: 'post',
      encType: 'application/json',
    });
  }

  function handleDeleteStand(standId: string) {
    setPendingDeleteStandId(standId);
  }

  function confirmDeleteStand() {
    if (pendingDeleteStandId) submit({ intent: 'deleteStand', standId: pendingDeleteStandId });
    setPendingDeleteStandId(null);
  }

  function confirmDeleteProduct() {
    if (pendingDeleteProduct)
      submit({ intent: 'deleteProduct', productId: pendingDeleteProduct._id });
    setPendingDeleteProduct(null);
  }

  function confirmDeleteEvent() {
    submit({ intent: 'deleteEvent' });
    setPendingDeleteEvent(false);
  }

  function confirmCompleteEvent() {
    submit({ intent: 'stop' });
    setPendingCompleteEvent(false);
  }

  const settingsSnapshot = JSON.stringify({
    name: form.name,
    // Send undefined rather than an empty string to leave the date unchanged.
    plannedDate: form.plannedDate || undefined,
    ratingsEnabled: form.ratingsEnabled,
    cashierEnabled: form.cashierEnabled,
    baselineHoldCents: Math.round(baselineHoldEuros * 100),
    branding: {
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      accentTextColor: form.accentTextColor,
    },
    location: form.location,
  });
  // Last successfully-persisted snapshot, kept in state so the render can derive
  // the dirty flag (reading a ref during render is disallowed).
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(settingsSnapshot);
  const pendingSnapshotRef = useRef<string | null>(null);
  // Mirror the latest fetcher into a ref (updated in an effect, never during
  // render) so the debounce effect can call it without depending on its identity.
  const saveFetcherRef = useRef(saveFetcher);
  useEffect(() => {
    saveFetcherRef.current = saveFetcher;
  });

  useEffect(() => {
    if (!baselineHoldValid) return;
    if (settingsSnapshot === lastSavedSnapshot) return;
    const handle = setTimeout(() => {
      pendingSnapshotRef.current = settingsSnapshot;
      saveFetcherRef.current.submit(
        {
          intent: 'save',
          patch: JSON.parse(settingsSnapshot) as UpdateEventInput,
        } as unknown as Parameters<typeof saveFetcherRef.current.submit>[0],
        { method: 'post', encType: 'application/json' },
      );
    }, 800);
    return () => clearTimeout(handle);
  }, [settingsSnapshot, lastSavedSnapshot, baselineHoldValid]);

  // Mark the just-sent snapshot as saved once the request succeeds; on failure
  // it stays "dirty" so the next edit retries.
  useEffect(() => {
    if (
      saveFetcher.state === 'idle' &&
      saveFetcher.data?.ok &&
      pendingSnapshotRef.current !== null
    ) {
      setLastSavedSnapshot(pendingSnapshotRef.current);
      pendingSnapshotRef.current = null;
    }
  }, [saveFetcher]);

  // Colors actually rendered after contrast clamping — shared with the attendee
  // runtime via resolveBranding, so the preview can't drift from what guests see.
  const resolvedBranding = resolveBranding({
    primaryColor: form.primaryColor,
    secondaryColor: form.secondaryColor,
    accentTextColor: form.accentTextColor,
    logoUrl: null,
  });

  const settingsDirty = settingsSnapshot !== lastSavedSnapshot;
  const isSavingSettings = saveFetcher.state !== 'idle';
  const settingsSaveError =
    saveFetcher.data && !saveFetcher.data.ok ? saveFetcher.data.error : null;

  // Lifecycle rules mirror the backend: start only from DRAFT, stop only from ACTIVE.
  const canStart = event.status === 'DRAFT';
  const canStop = event.status === 'ACTIVE';
  const canDelete = event.status === 'DRAFT';

  // Spread stands over two columns by always appending to the currently shorter
  // column (height ≈ product count). This keeps both columns roughly equal so the
  // section's overall height is as small as possible — unlike CSS multi-column,
  // which can't reorder items to balance. Cheap enough to run every render.
  const standColumns: Stand[][] = [[], []];
  const standColumnWeights = [0, 0];
  for (const stand of stands) {
    const weight = 1 + (productsByStand[stand._id]?.length ?? 0);
    const target = standColumnWeights[0] <= standColumnWeights[1] ? 0 : 1;
    standColumns[target].push(stand);
    standColumnWeights[target] += weight;
  }

  const renderStand = (stand: Stand) => (
    <div key={stand._id} className="rounded-lg border border-border bg-surface">
      {/* Stand header — subtly raised (accent tint) so the start of each stand is easy to spot */}
      <div className="flex items-center justify-between rounded-t-lg border-b border-accent/15 bg-accent/10 px-4 py-3">
        <div>
          <h3 className="font-medium text-text">{stand.standName}</h3>
          {stand.location.locationName && (
            <p className="text-sm text-text-muted mt-0.5 flex items-center gap-1">
              <PinIcon className="h-4 w-4 text-text-muted" /> {stand.location.locationName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingStand(stand);
              setIsStandDialogOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-danger hover:bg-danger/10 hover:border-danger/30 hover:text-danger"
            onClick={() => handleDeleteStand(stand._id)}
          >
            Delete
          </Button>
        </div>
      </div>
      {/* Products list */}
      {(productsByStand[stand._id] ?? []).map((product) => (
        <ProductRow
          key={product._id}
          product={product}
          eventId={event.ratingsEnabled ? event._id : undefined}
          onEdit={() => setProductDialog({ standId: stand._id, product })}
          onDelete={() => setPendingDeleteProduct(product)}
        />
      ))}

      {/* Products footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm text-text-muted">
          <ProductsIcon />
          {(productsByStand[stand._id] ?? []).length} Products
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setProductDialog({ standId: stand._id, product: null })}
        >
          + Add Product
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <LandingPageNavbar
        logoTo={paths.organizer.root}
        right={<AccountMenu isAuthenticated={true} onSignOut={() => logout(paths.home)} />}
        widthClassName="w-[calc(100%_-_3rem)] max-w-[calc(80rem-3rem)] lg:w-[calc(100%_-_4rem)] lg:max-w-[calc(80rem-4rem)]"
      />

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <BackButton to={paths.organizer.root} className="mb-6">
          Events Dashboard
        </BackButton>
        <div className="space-y-6">
          {/* Event status + links — side by side across the full width */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="scroll-mt-24" id="status">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircleIcon className="h-5 w-5" />
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                    onClick={() => setPendingCompleteEvent(true)}
                    size="lg"
                    variant="secondary"
                  >
                    Complete Event
                  </Button>
                  {canDelete ? (
                    <Button
                      className="w-full border-danger/40 text-danger hover:bg-danger/5"
                      disabled={busy}
                      onClick={() => setPendingDeleteEvent(true)}
                      size="lg"
                      variant="outline"
                    >
                      Delete Event
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </section>

            <section className="scroll-mt-24" id="links">
              {/* Links — share targets for operators and attendees */}
              <Card className="h-full">
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
                      <span>Operator Link</span>
                      <ChevronDownIcon
                        className={[
                          'ml-auto transition-transform',
                          showOperatorLink ? 'rotate-180' : '',
                        ].join(' ')}
                      />
                    </Button>
                    {showOperatorLink && (
                      <OperatorLinkPanel
                        eventId={event._id}
                        operatorAccessKey={event.operatorAccessKey}
                      />
                    )}
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
                      <span>Customer Link / QR-Code</span>
                      <ChevronDownIcon
                        className={[
                          'ml-auto transition-transform',
                          showCustomerLink ? 'rotate-180' : '',
                        ].join(' ')}
                      />
                    </Button>
                    {showCustomerLink && <CustomerLinkPanel eventId={event._id} />}
                  </div>
                  {/* Navigates away (unlike the expandable buttons above) — the
                      arrow signals a redirect rather than a dropdown. */}
                  <Link
                    className={[buttonVariants({ variant: 'default', size: 'lg' }), 'w-full'].join(
                      ' ',
                    )}
                    to={paths.organizer.eventControlCenterAnalytics(event._id)}
                  >
                    <span>Event Control Center</span>
                    <ArrowRightIcon className="ml-auto h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            </section>
          </div>

          {/* Event settings — core editable fields */}
          <Card className="scroll-mt-24" id="settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <SettingsIcon className="h-5 w-5" />
                Settings
              </CardTitle>
            </CardHeader>
            {/* @container so the fields react to the card's own width (it sits in
                  a variable-width column), pairing up when there's room. */}
            <CardContent className="@container">
              <div className="grid grid-cols-1 gap-x-8 gap-y-6 @2xl:grid-cols-2">
                {/* Core fields */}
                <div className="flex h-full flex-col space-y-5">
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

                  <TextField
                    id="baseline-hold"
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        Card pre-authorization hold (€)
                        <span className="relative inline-flex">
                          <button
                            type="button"
                            aria-label="About the card pre-authorization hold"
                            aria-expanded={showHoldInfo}
                            onClick={(e) => {
                              e.preventDefault();
                              setShowHoldInfo((open) => !open);
                            }}
                            className="text-text-muted transition hover:text-text"
                          >
                            <InfoIcon />
                          </button>
                          {showHoldInfo && (
                            <>
                              <button
                                type="button"
                                aria-hidden="true"
                                tabIndex={-1}
                                className="fixed inset-0 z-40 cursor-default"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setShowHoldInfo(false);
                                }}
                              />
                              <span
                                role="tooltip"
                                className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-xs font-normal leading-relaxed text-text-muted shadow-[0_12px_40px_rgba(31,41,55,0.18)]"
                              >
                                {
                                  "Reserved on each guest's card when they open a tab. They're only charged for what they order, and the remainder is released. A higher hold settles more orders in a single charge, which lowers transaction fees, but reserving a large amount upfront can discourage guests from paying by card. Applies to tabs opened after saving."
                                }
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                    }
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={form.baselineHold}
                    onChange={(e) => updateField('baselineHold', e.target.value)}
                    error={
                      baselineHoldValid ? undefined : 'Enter a whole number of euros (at least €1).'
                    }
                  />

                  <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                    <label
                      className="inline-flex items-center gap-1.5 text-sm font-medium"
                      htmlFor="ratings-enabled"
                    >
                      Customer Product Ratings
                      <span className="relative inline-flex">
                        <button
                          type="button"
                          aria-label="About customer product ratings"
                          aria-expanded={showRatingsInfo}
                          onClick={(e) => {
                            e.preventDefault();
                            setShowRatingsInfo((open) => !open);
                          }}
                          className="text-text-muted transition hover:text-text"
                        >
                          <InfoIcon />
                        </button>
                        {showRatingsInfo && (
                          <>
                            <button
                              type="button"
                              aria-hidden="true"
                              tabIndex={-1}
                              className="fixed inset-0 z-40 cursor-default"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowRatingsInfo(false);
                              }}
                            />
                            <span
                              role="tooltip"
                              className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-xs font-normal leading-relaxed text-text-muted shadow-[0_12px_40px_rgba(31,41,55,0.18)]"
                            >
                              When enabled, guests can rate the products they ordered, and the
                              average rating is shown on each product.
                            </span>
                          </>
                        )}
                      </span>
                    </label>
                    <Toggle
                      checked={form.ratingsEnabled}
                      id="ratings-enabled"
                      label="Customer Product Ratings"
                      onChange={(value) => updateField('ratingsEnabled', value)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                    <label
                      className="inline-flex items-center gap-1.5 text-sm font-medium"
                      htmlFor="cashier-enabled"
                    >
                      Cashier
                      <span className="relative inline-flex">
                        <button
                          type="button"
                          aria-label="About the cashier"
                          aria-expanded={showCashierInfo}
                          onClick={(e) => {
                            e.preventDefault();
                            setShowCashierInfo((open) => !open);
                          }}
                          className="text-text-muted transition hover:text-text"
                        >
                          <InfoIcon />
                        </button>
                        {showCashierInfo && (
                          <>
                            <button
                              type="button"
                              aria-hidden="true"
                              tabIndex={-1}
                              className="fixed inset-0 z-40 cursor-default"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowCashierInfo(false);
                              }}
                            />
                            <span
                              role="tooltip"
                              className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-xs font-normal leading-relaxed text-text-muted shadow-[0_12px_40px_rgba(31,41,55,0.18)]"
                            >
                              When enabled, operators get a cashier station to take manual orders
                              and collect cash payments at the event.
                            </span>
                          </>
                        )}
                      </span>
                    </label>
                    <Toggle
                      checked={form.cashierEnabled}
                      id="cashier-enabled"
                      label="Cashier"
                      onChange={(value) => updateField('cashierEnabled', value)}
                    />
                  </div>
                </div>

                {/* Branding — sits beside the core fields when the card is wide enough */}
                <div className="flex flex-col justify-between space-y-5">
                  <div>
                    <p className="mb-2 block text-sm font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        Logo
                        <span className="relative inline-flex">
                          <button
                            type="button"
                            aria-label="About the event logo"
                            aria-expanded={showLogoInfo}
                            onClick={(e) => {
                              e.preventDefault();
                              setShowLogoInfo((open) => !open);
                            }}
                            className="text-text-muted transition hover:text-text"
                          >
                            <InfoIcon />
                          </button>
                          {showLogoInfo && (
                            <>
                              <button
                                type="button"
                                aria-hidden="true"
                                tabIndex={-1}
                                className="fixed inset-0 z-40 cursor-default"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setShowLogoInfo(false);
                                }}
                              />
                              <span
                                role="tooltip"
                                className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-xs font-normal leading-relaxed text-text-muted shadow-[0_12px_40px_rgba(31,41,55,0.18)]"
                              >
                                Replaces the Lineless logo for attendees. Shown at the size of the
                                current logo — smaller images sit left, larger ones scale down to
                                fit.
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                    </p>
                    <ImageDropzone
                      previewUrl={logoPreviewUrl}
                      onSelect={handleSelectLogo}
                      onRemove={handleRemoveLogo}
                      onError={setLogoError}
                      acceptedTypes={ACCEPTED_IMAGE_TYPES}
                      maxBytes={MAX_IMAGE_BYTES}
                      disabled={logoBusy}
                    />
                    {logoError && <p className="mt-1 text-xs text-danger">{logoError}</p>}
                  </div>

                  {/* Presets — one click fills all three roles with a contrast-safe
                      palette; the organizer can still fine-tune afterwards. Full
                      width below the logo so all six pills get the row. */}
                  <BrandPresetRow
                    current={form}
                    onApply={(preset) =>
                      setForm((prev) => ({
                        ...prev,
                        primaryColor: preset.primaryColor,
                        secondaryColor: preset.secondaryColor,
                        accentTextColor: preset.accentTextColor,
                      }))
                    }
                  />

                  {/* The three color controls share one row: 3-up when wide, then
                      2-up, then stacked. Nested @container keys off the branding
                      half, not the whole card. */}
                  <div className="@container">
                    <div className="grid grid-cols-1 items-stretch gap-4 @sm:grid-cols-2 @lg:grid-cols-3">
                      {/* Role 1 — brand fill (buttons/highlights). */}
                      <BrandColorField
                        id="primary-color"
                        label="Brand"
                        onChange={(value) => updateField('primaryColor', value)}
                        value={form.primaryColor}
                      />
                      {/* Role 3 — accent used as standalone text (links, prices,
                          headings) on the neutral page. null = Auto (derive). */}
                      <BrandColorField
                        id="accent-text-color"
                        label="Brand Text"
                        onChange={(value) => updateField('accentTextColor', value)}
                        value={resolvedBranding.accentText}
                        auto={{
                          active: form.accentTextColor === null,
                          onEnable: () => updateField('accentTextColor', null),
                        }}
                      />
                      {/* Role 2 — text on the brand fill. secondaryColor in the backend. */}
                      <ButtonTextColorField
                        onChange={(value) => updateField('secondaryColor', value)}
                        value={form.secondaryColor}
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-border bg-surface-muted">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Preview
                      </span>
                      <span className="text-xs text-text-muted">As attendees will see it</span>
                    </div>
                    {/* White canvas — matches the attendee page so brand colors read
                        true. Uses the resolved (clamped) colors, so what's shown here
                        is exactly what attendees get. */}
                    <div className="flex items-center gap-8 bg-surface p-4">
                      <Button
                        className="shrink-0"
                        style={{
                          backgroundColor: resolvedBranding.accent,
                          color: resolvedBranding.buttonText,
                        }}
                      >
                        Order Now
                      </Button>
                      <div className="min-w-0 flex-1 space-y-2">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: resolvedBranding.accentText }}
                        >
                          {form.name || 'Lineless Event'}
                        </p>
                        <p className="text-sm text-text">
                          Tonight only —{' '}
                          <span
                            className="font-medium underline underline-offset-2"
                            style={{ color: resolvedBranding.accentText }}
                          >
                            view the menu
                          </span>{' '}
                          and order from{' '}
                          <span
                            className="font-semibold"
                            style={{ color: resolvedBranding.accentText }}
                          >
                            €4.50
                          </span>
                          .
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* No save button — the form auto-saves; this just reflects status. */}
              <div className="mt-6 flex justify-end text-sm" aria-live="polite">
                {!baselineHoldValid && settingsDirty ? (
                  <span className="text-danger">Fix the highlighted field to save.</span>
                ) : settingsSaveError ? (
                  <span className="text-danger">
                    Couldn’t save changes — edit a field to retry.
                  </span>
                ) : isSavingSettings || settingsDirty ? (
                  <span className="text-text-muted">Saving…</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-text-muted">
                    <CheckCircleIcon className="h-4 w-4 text-success" />
                    All changes saved
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stands & Products */}
          <Card className="scroll-mt-24" id="stands-products">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <StandIcon className="h-5 w-5" />
                Stands &amp; Products
              </CardTitle>
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
            <CardContent className="@container">
              {stands.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-border bg-background px-4 py-10 text-center">
                  <p className="text-sm font-medium">No stands configured yet</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Add stands to this event to allow operators to fulfill orders.
                  </p>
                </div>
              ) : (
                // Two height-balanced columns (see standColumns). They stack on a
                // narrow card; empty columns are dropped so a lone stand spans full width.
                <div className="flex flex-col gap-3 @3xl:flex-row @3xl:items-start">
                  {standColumns
                    .filter((column) => column.length > 0)
                    .map((column, index) => (
                      // min-w-0 lets the column shrink below its content's intrinsic
                      // width so the product description can truncate instead of
                      // forcing the whole card to overflow.
                      <div key={index} className="flex min-w-0 flex-1 flex-col gap-3">
                        {column.map(renderStand)}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <StandDialog
          key={`${editingStand?._id ?? 'new'}-${String(isStandDialogOpen)}`}
          stand={editingStand}
          eventLocation={event.location ?? emptyLocation}
          isOpen={isStandDialogOpen}
          onClose={() => setIsStandDialogOpen(false)}
        />

        {productDialog && (
          <ProductDialog
            key={`${productDialog.product?._id ?? 'new'}-${productDialog.standId}`}
            product={productDialog.product}
            standId={productDialog.standId}
            isOpen={true}
            onClose={() => setProductDialog(null)}
          />
        )}

        <AlertDialog
          message={visibleError}
          onAcknowledge={() => setDismissedError(actionError)}
          title="Something went wrong"
        />

        <AlertDialog
          acknowledgeLabel="Delete"
          cancelLabel="Cancel"
          message={
            pendingDeleteEvent
              ? `“${event.name || 'Untitled Event'}” will be deleted and removed from organizer lists.`
              : null
          }
          onAcknowledge={confirmDeleteEvent}
          onCancel={() => setPendingDeleteEvent(false)}
          title="Delete event?"
        />

        <AlertDialog
          acknowledgeLabel="Complete Event"
          cancelLabel="Cancel"
          message={
            pendingCompleteEvent
              ? 'Completing the event closes every open tab and charges each guest for the items they received. Items that are not yet ready or fulfilled will not be charged, and the remaining card holds are released. This cannot be undone.'
              : null
          }
          onAcknowledge={confirmCompleteEvent}
          onCancel={() => setPendingCompleteEvent(false)}
          title="Complete event?"
        />

        <AlertDialog
          acknowledgeLabel="Delete"
          cancelLabel="Cancel"
          message={
            pendingDeleteStandId ? 'This stand will be permanently removed from the event.' : null
          }
          onAcknowledge={confirmDeleteStand}
          onCancel={() => setPendingDeleteStandId(null)}
          title="Delete stand?"
        />

        <AlertDialog
          acknowledgeLabel="Delete"
          cancelLabel="Cancel"
          message={
            pendingDeleteProduct
              ? `“${pendingDeleteProduct.productName}” will be permanently removed.`
              : null
          }
          onAcknowledge={confirmDeleteProduct}
          onCancel={() => setPendingDeleteProduct(null)}
          title="Delete product?"
        />
      </main>
    </div>
  );
}

// Curated, contrast-safe palettes. Each fills all three roles at once so a
// non-designer can start from a good baseline, then tweak. accentTextColor is
// pre-picked to clear AA on the neutral canvas (or null = Auto-derive).
type BrandPreset = {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentTextColor: string | null;
};

const BRAND_PRESETS: readonly BrandPreset[] = [
  { name: 'Midnight', primaryColor: '#020887', secondaryColor: '#ffffff', accentTextColor: null },
  { name: 'Ocean', primaryColor: '#0e7490', secondaryColor: '#ffffff', accentTextColor: '#0e6c84' },
  {
    name: 'Forest',
    primaryColor: '#15803d',
    secondaryColor: '#ffffff',
    accentTextColor: '#15703a',
  },
  {
    name: 'Sunset',
    primaryColor: '#ea580c',
    secondaryColor: '#ffffff',
    accentTextColor: '#b7430a',
  },
  { name: 'Berry', primaryColor: '#be185d', secondaryColor: '#ffffff', accentTextColor: '#be185d' },
  { name: 'Mono', primaryColor: '#1f2937', secondaryColor: '#ffffff', accentTextColor: '#1f2937' },
] as const;

const HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

// Generic brand color picker (swatch + hex input). `auto` adds an Auto chip for
// roles that can derive their value (the live preview shows the result).
function BrandColorField({
  id,
  label,
  value,
  onChange,
  auto,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  auto?: { active: boolean; onEnable: () => void };
}) {
  const [showAutoInfo, setShowAutoInfo] = useState(false);
  const [draft, setDraft] = useState(value);

  // Sync draft when an external change (e.g. preset applied) lands.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
  }, [value]);

  const isValidHex = HEX_RE.test(draft);
  const showError = draft.length > 1 && !isValidHex;

  function handleTextChange(raw: string) {
    let next = raw;
    if (next === '') {
      next = '#';
    } else if (!next.startsWith('#')) {
      next = '#' + next;
    }
    setDraft(next);
    if (HEX_RE.test(next)) onChange(next);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex min-h-7 items-center justify-start gap-2">
        <label className="block text-sm font-medium text-text" htmlFor={id}>
          {label}
        </label>
        {auto && (
          <>
            <button
              aria-pressed={auto.active}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                auto.active
                  ? 'border-accent/30 bg-accent-soft text-accent-contrast'
                  : 'border-border bg-surface text-text-muted hover:text-text',
              )}
              onClick={auto.onEnable}
              type="button"
            >
              Auto
            </button>
            <span className="relative inline-flex">
              <button
                type="button"
                aria-label="About Auto brand text"
                aria-expanded={showAutoInfo}
                onClick={(e) => {
                  e.preventDefault();
                  setShowAutoInfo((open) => !open);
                }}
                className="text-text-muted transition hover:text-text"
              >
                <InfoIcon />
              </button>
              {showAutoInfo && (
                <>
                  <button
                    type="button"
                    aria-hidden="true"
                    tabIndex={-1}
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowAutoInfo(false);
                    }}
                  />
                  <span
                    role="tooltip"
                    className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-xs font-normal leading-relaxed text-text-muted shadow-[0_12px_40px_rgba(31,41,55,0.18)]"
                  >
                    Auto picks the text color for you from your Brand color, darkening it only if
                    needed so it stays easy to read on the page. Click the swatch to choose your own
                    color instead.
                  </span>
                </>
              )}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg border bg-surface px-3 py-2',
            showError ? 'border-danger' : 'border-border',
            auto?.active && 'opacity-60',
          )}
        >
          <input
            aria-label={`${label} swatch`}
            className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-transparent"
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(e.target.value);
            }}
            type="color"
            value={isValidHex ? draft : value}
          />
          <input
            className="w-24 bg-transparent text-center text-sm text-text outline-none"
            id={id}
            maxLength={7}
            onChange={(e) => handleTextChange(e.target.value)}
            type="text"
            value={draft}
          />
        </div>
      </div>
      <p className={cn('mt-1.5 text-xs text-danger', !showError && 'invisible')}>Invalid color</p>
    </div>
  );
}

// Button labels only ever read well as white or black, so this offers a
// White/Black choice instead of a free picker.
const BUTTON_TEXT_OPTIONS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
] as const;

function ButtonTextColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <span className="mb-2 flex min-h-7 items-center text-sm font-medium text-text">
        Button Text
      </span>
      <div className="flex flex-1 items-center justify-start">
        <div className="flex rounded-lg border border-border bg-surface p-1">
          {BUTTON_TEXT_OPTIONS.map((option) => (
            <button
              key={option.value}
              aria-pressed={value === option.value}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                value === option.value
                  ? 'bg-surface-muted text-text'
                  : 'text-text-muted hover:text-text',
              )}
              onClick={() => onChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p className="invisible mt-1.5 text-xs">.</p>
    </div>
  );
}

// Preset palettes — clicking one fills all three brand roles. The active preset
// (if the current colors match one exactly) is highlighted.
function BrandPresetRow({
  current,
  onApply,
}: {
  current: Pick<EventForm, 'primaryColor' | 'secondaryColor' | 'accentTextColor'>;
  onApply: (preset: BrandPreset) => void;
}) {
  const matches = (p: BrandPreset) =>
    p.primaryColor.toLowerCase() === current.primaryColor.toLowerCase() &&
    p.secondaryColor.toLowerCase() === current.secondaryColor.toLowerCase() &&
    p.accentTextColor === current.accentTextColor;
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-text">Palette</span>
      <div className="flex flex-wrap gap-2">
        {BRAND_PRESETS.map((preset) => {
          const active = matches(preset);
          return (
            <button
              key={preset.name}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-accent/40 bg-accent-soft text-text'
                  : 'border-border bg-surface text-text-muted hover:text-text',
              )}
              onClick={() => onApply(preset)}
              title={`Apply the ${preset.name} palette`}
              type="button"
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-full border border-border"
                style={{ backgroundColor: preset.primaryColor }}
              />
              {preset.name}
            </button>
          );
        })}
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
            <PinIcon className="h-5 w-5 text-accent" />
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
