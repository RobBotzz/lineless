import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '@/components/ui/button';
import { PasswordTextField } from '@/components/ui/password-text-field';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { emptyLocation, toLatLng, type Location } from '@/types/location';
import type { Stand, CreateStandInput, UpdateStandInput } from '@/types/stand';
import type { EventActionResult } from './data';

const LocationPicker = lazy(() =>
  import('@/components/location/LocationPicker').then((m) => ({ default: m.LocationPicker })),
);

interface StandDialogProps {
  stand: Stand | null; // null means create mode, otherwise edit mode
  eventLocation: Location;
  isOpen: boolean;
  onClose: () => void;
}

export function StandDialog({ stand, eventLocation, isOpen, onClose }: StandDialogProps) {
  const fetcher = useFetcher<EventActionResult>();

  const [standName, setStandName] = useState(stand?.standName ?? '');
  const [accessPassword, setAccessPassword] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [location, setLocation] = useState<Location>(() => stand?.location ?? emptyLocation);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const wasSubmittingRef = useRef(false);
  const isHandlingSubmitRef = useRef(false);

  // Close when fetcher finishes successfully
  useEffect(() => {
    if (fetcher.state === 'submitting') {
      wasSubmittingRef.current = true;
    } else if (fetcher.state === 'idle') {
      isHandlingSubmitRef.current = false;
      if (wasSubmittingRef.current) {
        wasSubmittingRef.current = false;
        if (fetcher.data?.ok) {
          onClose();
        }
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
      if (changePassword) {
        const trimmed = accessPassword.trim();
        patch.accessPassword = trimmed || null;
      }
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40" role="presentation">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <section
          aria-labelledby="stand-dialog-title"
          aria-modal="true"
          className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
          role="dialog"
        >
          <h2 id="stand-dialog-title" className="text-xl font-semibold text-text mb-4">
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

            <div>
              <p className="mb-2 block text-sm font-medium text-text">Location (Optional)</p>
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
