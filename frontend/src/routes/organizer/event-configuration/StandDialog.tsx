import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '@/components/ui/button';
import { PasswordTextField } from '@/components/ui/password-text-field';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { emptyLocation } from '@/types/location';
import type { Location } from '@/types/location';
import type { Stand, CreateStandInput, UpdateStandInput } from '@/types/stand';
import type { EventActionResult } from './data';

interface StandDialogProps {
  stand: Stand | null; // null = create mode
  eventLocation: Location;
  isOpen: boolean;
  onClose: () => void;
}

export function StandDialog({ stand, isOpen, onClose }: StandDialogProps) {
  const fetcher = useFetcher<EventActionResult>();

  const [standName, setStandName] = useState(stand?.standName ?? '');
  const [accessPassword, setAccessPassword] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [locationName, setLocationName] = useState(stand?.location.locationName ?? '');

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

    const location: Location = {
      ...emptyLocation,
      locationName: locationName.trim() || null,
    };

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

            <TextField
              id="location-name"
              label="Location (Optional)"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Near main entrance"
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
