import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useFetcher, useLoaderData, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import { AlertDialog } from '@/components/feedback';
import { BackButton } from '@/components/shared';
import { AccountMenu, LandingPageNavbar } from '@/components/layout/navbars';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  UploadIcon,
} from '@/components/icons';
import { useOrganizerAuth } from '@/auth/organizer/OrganizerAuthContext';
import { paths } from '@/paths';
import type { Event, UpdateEventInput } from '@/types/event';
import type { Stand } from '@/types/stand';
import type { Product } from '@/types/product';
import { emptyLocation, hasCoordinates, type Location } from '@/types/location';
import { CustomerLinkPanel } from './CustomerLinkPanel';
import { OperatorLinkPanel } from './OperatorLinkPanel';
import { StandDialog } from './StandDialog';
import { ProductDialog } from './ProductDialog';
import { ProductRow } from './ProductRow';
import type { EventActionResult, EventConfigurationLoaderData } from './data';

// Cap products per stand to keep the organizer dashboard scannable.
const MAX_PRODUCTS_PER_STAND = 10;

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
  cashierEnabled: boolean;
  // Baseline hold is stored as integer cents on the backend but edited in euros.
  baselineHold: string;
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
    cashierEnabled: event.cashierEnabled,
    baselineHold: String(Math.round(event.baselineHoldCents / 100)),
    primaryColor: event.branding.primaryColor,
    secondaryColor: event.branding.secondaryColor,
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
  const [form, setForm] = useState<EventForm>(() => toForm(event));
  const [showOperatorLink, setShowOperatorLink] = useState(false);
  const [showCustomerLink, setShowCustomerLink] = useState(false);
  const [showHoldInfo, setShowHoldInfo] = useState(false);
  const [showRatingsInfo, setShowRatingsInfo] = useState(false);
  const [showCashierInfo, setShowCashierInfo] = useState(false);
  // Track the dismissed error so the dialog derives from fetcher.data (no effect).
  const [dismissedError, setDismissedError] = useState<string | null>(null);

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
    branding: { primaryColor: form.primaryColor, secondaryColor: form.secondaryColor },
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

  const renderStand = (stand: Stand) => {
    const products = productsByStand[stand._id] ?? [];
    const atProductLimit = products.length >= MAX_PRODUCTS_PER_STAND;
    return (
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
        {products.map((product) => (
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
            {products.length} Products
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={atProductLimit}
            title={
              atProductLimit
                ? `Each stand can have at most ${MAX_PRODUCTS_PER_STAND} products.`
                : undefined
            }
            onClick={() => setProductDialog({ standId: stand._id, product: null })}
          >
            + Add Product
          </Button>
        </div>
      </div>
    );
  };

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
                <div className="space-y-5">
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
              <CardDescription>
                Limit: {MAX_PRODUCTS_PER_STAND} products per stand. This ensures a clean Operator
                Dashboard.
              </CardDescription>
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
