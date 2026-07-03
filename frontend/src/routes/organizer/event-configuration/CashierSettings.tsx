import { lazy, Suspense, useState } from 'react';
import { useRevalidator } from 'react-router';

import { ApiError } from '@/api/client';
import { updateStand } from '@/api/stands';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordTextField } from '@/components/ui/password-text-field';
import { Toggle } from '@/components/ui/toggle';
import { CashierIcon, ChevronDownIcon, PinIcon, WarningTriangleIcon } from '@/components/icons';
import { hasCoordinates, toLatLng, type Location } from '@/types/location';
import type { Stand, UpdateStandInput } from '@/types/stand';

const LocationPicker = lazy(() =>
  import('@/components/location/LocationPicker').then((m) => ({ default: m.LocationPicker })),
);

// Always-visible cashier card. The enable toggle sits in the header (an event
// setting, auto-saved by the parent); switching it on expands the location +
// optional password config, which has its own explicit Save button.
export function CashierSettings({
  enabled,
  onToggleEnabled,
  enableError,
  cashierStand,
  eventLocation,
}: {
  enabled: boolean;
  onToggleEnabled: (value: boolean) => void;
  enableError?: string | null;
  cashierStand: Stand | null;
  eventLocation: Location;
}) {
  return (
    <Card className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CashierIcon className="h-5 w-5" />
          Cashier
        </CardTitle>
        <CardAction>
          <Toggle
            checked={enabled}
            id="cashier-enabled"
            label="Enable cashier"
            onChange={onToggleEnabled}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-muted">
          A cashier station lets operators take manual orders, collect cash payments, and give cash
          refunds at the event.
        </p>

        {enableError && (
          <div className="mt-3 rounded bg-danger/10 p-3 text-sm text-danger">{enableError}</div>
        )}

        {enabled &&
          (cashierStand ? (
            // Keyed by the stand so it re-initialises from fresh data (e.g. after
            // re-enabling a previously configured cashier).
            <CashierConfigForm
              key={cashierStand._id}
              cashierStand={cashierStand}
              eventLocation={eventLocation}
            />
          ) : (
            <p className="mt-4 text-sm text-text-muted">Enabling the cashier…</p>
          ))}
      </CardContent>
    </Card>
  );
}

// The location + password form, mounted only when the cashier stand exists.
function CashierConfigForm({
  cashierStand,
  eventLocation,
}: {
  cashierStand: Stand;
  eventLocation: Location;
}) {
  const revalidator = useRevalidator();
  const [location, setLocation] = useState<Location>(() => cashierStand.location);
  const [locationOpen, setLocationOpen] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const [accessPassword, setAccessPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationSummary = location.locationName
    ? location.locationName
    : hasCoordinates(location)
      ? `${location.yCoordinate}, ${location.xCoordinate}`
      : 'No location selected';

  // Setting or clearing the password revokes operator sessions, so warn once
  // there's actually a change that would log someone out.
  const showPasswordWarning =
    changePassword && (cashierStand.requiresPassword || accessPassword.trim().length > 0);

  async function handleSave() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const patch: UpdateStandInput = { location };
      // Empty while toggled on = remove the password.
      if (changePassword) patch.accessPassword = accessPassword.trim() || null;
      await updateStand(cashierStand._id, patch);
      await revalidator.revalidate();
      setChangePassword(false);
      setAccessPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the cashier settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      {error && <div className="rounded bg-danger/10 p-3 text-sm text-danger">{error}</div>}

      {/* Location — collapsible, mirrors the stand dialog. */}
      <div>
        <p className="mb-2 block text-sm font-medium text-text">Location (Optional)</p>
        <div className="rounded-lg border border-border bg-surface">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setLocationOpen((prev) => !prev)}
          >
            <span className="flex items-center gap-2">
              <PinIcon className="h-5 w-5 text-accent" />
              <span>
                <span className="block text-sm font-medium text-text">Location</span>
                <span className="block max-w-xs truncate text-xs text-text-muted">
                  {locationSummary}
                </span>
              </span>
            </span>
            <ChevronDownIcon
              className={['transition-transform', locationOpen ? 'rotate-180' : ''].join(' ')}
            />
          </button>

          {locationOpen && (
            <div className="border-t border-border p-4">
              <Suspense
                fallback={
                  <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-surface-muted text-sm text-text-muted">
                    Loading map…
                  </div>
                }
              >
                <LocationPicker
                  value={location}
                  onChange={setLocation}
                  defaultCenter={toLatLng(eventLocation) ?? undefined}
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>

      {/* Password — toggle to set/update, mirrors the stand dialog. */}
      <div className="flex items-center justify-between rounded-lg border bg-surface-muted px-4 py-3">
        <label className="text-sm font-medium" htmlFor="cashier-change-password">
          Set or Clear Cashier Password
        </label>
        <Toggle
          checked={changePassword}
          id="cashier-change-password"
          label="Set or Clear Cashier Password"
          onChange={setChangePassword}
        />
      </div>

      {changePassword && (
        <div className="space-y-2">
          <PasswordTextField
            id="cashier-access-password"
            label="Access Password"
            value={accessPassword}
            onChange={(e) => setAccessPassword(e.target.value)}
            placeholder={
              cashierStand.requiresPassword
                ? 'Leave empty to remove the password'
                : 'New cashier password'
            }
          />
          {showPasswordWarning && (
            <div className="flex items-start gap-2 rounded bg-warning/10 p-3 text-sm text-warning">
              <WarningTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Changing the password will log out any operators currently signed in to the cashier.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end border-t border-border pt-4">
        <Button className="px-6" onClick={handleSave} disabled={saving} size="lg">
          {saving ? 'Saving…' : 'Save cashier settings'}
        </Button>
      </div>
    </div>
  );
}
