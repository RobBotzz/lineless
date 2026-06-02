import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '@/components/ui/button';
import { PasswordTextField } from '@/components/ui/password-text-field';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { hasCoordinates, toLatLng, type Location } from '@/types/location';
import type { Stand, CreateStandInput, UpdateStandInput } from '@/types/stand';
import type { EventActionResult } from './data';

const LocationPicker = lazy(() =>
  import('@/components/location/LocationPicker').then((m) => ({ default: m.LocationPicker })),
);

interface StandDialogProps {
  stand: Stand | null; // null = create mode
  eventLocation: Location;
  isOpen: boolean;
  onClose: () => void;
}

export function StandDialog({ stand, eventLocation, isOpen, onClose }: StandDialogProps) {
  const fetcher = useFetcher<EventActionResult>();

  const [standName, setStandName] = useState(stand?.standName ?? '');
  const [accessPassword, setAccessPassword] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [location, setLocation] = useState<Location>(
    () => stand?.location ?? { locationName: null, xCoordinate: null, yCoordinate: null },
  );
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const wasSubmittingRef = useRef(false);
  const isHandlingSubmitRef = useRef(false);

  useEffect(() => {
    if (fetcher.state === 'submitting') {
      wasSubmittingRef.current = true;
    } else if (fetcher.state === 'idle') {
      isHandlingSubmitRef.current = false;
      if (wasSubmittingRef.current) {
        wasSubmittingRef.current = false;
        if (fetcher.data?.ok) onClose();
      }
    }
  }, [fetcher.state, fetcher.data, onClose]);

  if (!isOpen) return null;

  const isEdit = !!stand;
  const busy = fetcher.state !== 'idle';
  const actionError = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isHandlingSubmitRef.current || !standName.trim()) return;

    if (isEdit) {
      const patch: UpdateStandInput = { standName: standName.trim(), location };
      if (changePassword) patch.accessPassword = accessPassword.trim() || null;
      isHandlingSubmitRef.current = true;
      fetcher.submit(
        { intent: 'updateStand', standId: stand._id, patch } as unknown as Parameters<
          typeof fetcher.submit
        >[0],
        { method: 'post', encType: 'application/json' },
      );
    } else {
      if (changePassword && !accessPassword.trim()) return;
      const patch: CreateStandInput = { standName: standName.trim(), location };
      if (changePassword) patch.accessPassword = accessPassword.trim();
      isHandlingSubmitRef.current = true;
      fetcher.submit(
        { intent: 'createStand', patch } as unknown as Parameters<typeof fetcher.submit>[0],
        { method: 'post', encType: 'application/json' },
      );
    }
  }

  const coordSummary = hasCoordinates(location)
    ? `${location.yCoordinate.toFixed(5)}, ${location.xCoordinate.toFixed(5)}`
    : null;

  return (
    // z-[1100] sits above the navbar (z-[1001])
    <div className="fixed inset-0 z-[1100] overflow-y-auto bg-black/40" role="presentation">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <section
          aria-labelledby="stand-dialog-title"
          aria-modal="true"
          className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
          role="dialog"
        >
          <h2 id="stand-dialog-title" className="mb-4 text-xl font-semibold text-text">
            {isEdit ? 'Edit Stand' : 'Add Stand'}
          </h2>

          {actionError && (
            <div className="mb-4 rounded bg-danger/10 p-3 text-sm text-danger">{actionError}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              id="stand-name"
              label="Stand Name *"
              value={standName}
              onChange={(e) => setStandName(e.target.value)}
              placeholder="e.g. Main Bar"
              required
            />

            {/* Location — name field always visible; map expands on demand */}
            {showMap ? (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium text-text">Location (Optional)</p>
                  <button
                    type="button"
                    className="text-xs text-accent hover:underline"
                    onClick={() => setShowMap(false)}
                  >
                    Hide map
                  </button>
                </div>
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
            ) : (
              <div className="space-y-2">
                <TextField
                  id="location-name"
                  label="Location (Optional)"
                  value={location.locationName ?? ''}
                  onChange={(e) =>
                    setLocation((prev) => ({ ...prev, locationName: e.target.value || null }))
                  }
                  placeholder="e.g. Near main entrance"
                />
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                  onClick={() => setShowMap(true)}
                >
                  <PinIcon />
                  {coordSummary
                    ? `Coordinates set: ${coordSummary} — change on map`
                    : 'Pick coordinates on map'}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border bg-surface-muted px-4 py-3">
              <label className="text-sm font-medium" htmlFor="change-password">
                {isEdit ? 'Set or Clear Operator Password' : 'Require Operator Login'}
              </label>
              <Toggle
                checked={changePassword}
                id="change-password"
                label="Change Password"
                onChange={setChangePassword}
              />
            </div>

            {changePassword && (
              <PasswordTextField
                id="access-password"
                label="Access Password"
                value={accessPassword}
                onChange={(e) => setAccessPassword(e.target.value)}
                placeholder={isEdit ? 'Leave empty to remove password' : 'For operator login'}
                required={!isEdit}
              />
            )}

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
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
