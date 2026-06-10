import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import { getOperatorStands, loginOperator } from '@/api/stands';
import { clearOperatorCredential, getCredential } from '@/auth/keychain';
import { Button } from '@/components/ui/button';
import { PasswordTextField } from '@/components/ui/password-text-field';
import { CashierIcon, LockIcon, PickupIcon, PinIcon, StandIcon } from '@/components/icons';
import { paths } from '@/paths';
import type { Stand } from '@/types/stand';

// TODO: Replace with cashierEnabled from operator bootstrap endpoint.
const CASHIER_ENABLED_PLACEHOLDER = true;
const LINK_EXPIRED_MESSAGE = 'Link expired. Please reopen the operator link.';
const LOGIN_FAILED_MESSAGE = 'Login failed. Please try again.';
const WRONG_PASSWORD_OR_LINK_MESSAGE = 'Wrong password or invalid link.';

type LoadState = 'loading' | 'ready' | 'invalid' | 'error';
type StandFetchState = {
  requestKey: string | null;
  status: Exclude<LoadState, 'loading'> | 'idle';
  stands: Stand[];
};

export default function StandSelection() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const operatorSession = getCredential('operator');
  const hasSessionForEvent = !!eventId && operatorSession?.eventId === eventId;
  const loggedInStands = hasSessionForEvent ? operatorSession.stands : {};
  const fetchRequestKey =
    eventId && hasSessionForEvent ? `${eventId}:${operatorSession.operatorAccessKey}` : null;

  const [standFetchState, setStandFetchState] = useState<StandFetchState>({
    requestKey: null,
    status: 'idle',
    stands: [],
  });
  const [selectedStand, setSelectedStand] = useState<Stand | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [invalidLinkMessage, setInvalidLinkMessage] = useState<string | null>(null);
  const [loggingInStandId, setLoggingInStandId] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !hasSessionForEvent || !fetchRequestKey) return;

    let cancelled = false;

    getOperatorStands(eventId)
      .then((nextStands) => {
        if (cancelled) return;
        setInvalidLinkMessage(null);
        setStandFetchState({
          requestKey: fetchRequestKey,
          status: 'ready',
          stands: nextStands,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
          setInvalidLinkMessage(null);
          setStandFetchState({
            requestKey: fetchRequestKey,
            status: 'invalid',
            stands: [],
          });
          return;
        }
        setStandFetchState({
          requestKey: fetchRequestKey,
          status: 'error',
          stands: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, fetchRequestKey, hasSessionForEvent]);

  const loadState: LoadState = !eventId
    ? 'invalid'
    : !hasSessionForEvent
      ? 'invalid'
      : standFetchState.requestKey === fetchRequestKey
        ? standFetchState.status === 'idle'
          ? 'loading'
          : standFetchState.status
        : 'loading';
  const stands = standFetchState.requestKey === fetchRequestKey ? standFetchState.stands : [];

  const canUseOperatorSession = loadState === 'ready' && !!eventId && hasSessionForEvent;

  function openPasswordDialog(stand: Stand) {
    setSelectedStand(stand);
    setPassword('');
    setLoginError(null);
  }

  function closePasswordDialog() {
    if (loggingInStandId) return;
    setSelectedStand(null);
    setPassword('');
    setLoginError(null);
  }

  async function authenticateStand(stand: Stand, accessPassword?: string) {
    if (!eventId || !hasSessionForEvent) return;

    setLoggingInStandId(stand._id);
    setLoginError(null);

    try {
      await loginOperator(stand._id, accessPassword);
      navigate(paths.operator.stand(eventId, stand._id));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        if (stand.requiresPassword) {
          setSelectedStand(stand);
          setLoginError(WRONG_PASSWORD_OR_LINK_MESSAGE);
        } else {
          clearOperatorCredential();
          setSelectedStand(null);
          setInvalidLinkMessage(LINK_EXPIRED_MESSAGE);
          setStandFetchState({
            requestKey: fetchRequestKey,
            status: 'invalid',
            stands: [],
          });
        }
        return;
      }
      setSelectedStand(stand);
      setLoginError(LOGIN_FAILED_MESSAGE);
    } finally {
      setLoggingInStandId(null);
    }
  }

  function handleStandClick(stand: Stand) {
    if (!canUseOperatorSession || loggingInStandId) return;
    if (loggedInStands[stand._id]) {
      navigate(paths.operator.stand(eventId, stand._id));
      return;
    }
    if (stand.requiresPassword) {
      openPasswordDialog(stand);
      return;
    }
    void authenticateStand(stand);
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStand || loggingInStandId) return;

    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setLoginError('Enter the stand password.');
      return;
    }

    void authenticateStand(selectedStand, trimmedPassword);
  }

  function navigateToSystemDashboard(path: string) {
    if (!canUseOperatorSession) return;
    navigate(path);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loadState === 'invalid' && (
          <StatePanel
            title="Invalid operator link"
            message={
              invalidLinkMessage ??
              'Open the operator dashboard from the event link provided by the organizer.'
            }
          />
        )}

        {loadState === 'error' && (
          <StatePanel
            title="Stands could not be loaded"
            message="Check whether the backend is running and try the operator link again."
          />
        )}

        {loadState === 'loading' && <LoadingGrid />}

        {loadState === 'ready' && eventId && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectionTile
                icon={<PickupIcon className="h-6 w-6" />}
                meta="Orders ready for handoff"
                onClick={() => navigateToSystemDashboard(paths.operator.pickupDashboard(eventId))}
                title="Pick Up"
              />
              {CASHIER_ENABLED_PLACEHOLDER && (
                <SelectionTile
                  icon={<CashierIcon className="h-6 w-6" />}
                  meta="Manual orders and cash payments"
                  onClick={() =>
                    navigateToSystemDashboard(paths.operator.cashierDashboard(eventId))
                  }
                  title="Cashier"
                />
              )}

              {stands.map((stand) => (
                <SelectionTile
                  icon={<StandIcon className="h-6 w-6" />}
                  key={stand._id}
                  loggedIn={Boolean(loggedInStands[stand._id])}
                  locked={stand.requiresPassword}
                  loading={loggingInStandId === stand._id}
                  meta={stand.location.locationName ?? 'Stand dashboard'}
                  onClick={() => handleStandClick(stand)}
                  title={stand.standName}
                />
              ))}
            </div>

            {stands.length === 0 && (
              <div className="mt-6 rounded-lg border-2 border-dashed border-border bg-surface px-4 py-10 text-center">
                <p className="text-sm font-medium text-text">No stands configured yet</p>
                <p className="mt-1 text-sm text-text-muted">
                  Pick Up and Cashier are available, but this event has no stand dashboards.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <PasswordDialog
        error={loginError}
        isBusy={!!loggingInStandId}
        onClose={closePasswordDialog}
        onPasswordChange={setPassword}
        onSubmit={handlePasswordSubmit}
        password={password}
        stand={selectedStand}
      />
    </div>
  );
}

function SelectionTile({
  icon,
  loggedIn = false,
  locked = false,
  loading = false,
  meta,
  onClick,
  title,
}: {
  icon: ReactNode;
  loggedIn?: boolean;
  locked?: boolean;
  loading?: boolean;
  meta: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className="group min-h-36 rounded-lg border border-border bg-surface p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-70"
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-[var(--color-button-text)]">
          {icon}
        </span>
        {loggedIn ? (
          <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            Logged in
          </span>
        ) : locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-muted">
            <LockIcon className="h-3.5 w-3.5" />
            Password
          </span>
        ) : null}
      </span>
      <span className="mt-5 block text-lg font-semibold text-text">
        {loading ? 'Signing in…' : title}
      </span>
      <span className="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
        {!locked && !loggedIn && title !== 'Pick Up' && title !== 'Cashier' && (
          <PinIcon className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{meta}</span>
      </span>
    </button>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          className="min-h-36 animate-pulse rounded-lg border border-border bg-surface p-5 shadow-sm"
          key={index}
        >
          <div className="h-12 w-12 rounded-lg bg-surface-muted" />
          <div className="mt-5 h-5 w-2/3 rounded bg-surface-muted" />
          <div className="mt-3 h-4 w-1/2 rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

function StatePanel({ message, title }: { message: string; title: string }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <LockIcon className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">{message}</p>
    </section>
  );
}

function PasswordDialog({
  error,
  isBusy,
  onClose,
  onPasswordChange,
  onSubmit,
  password,
  stand,
}: {
  error: string | null;
  isBusy: boolean;
  onClose: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  stand: Stand | null;
}) {
  useEffect(() => {
    if (!stand) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, stand]);

  if (!stand) return null;

  return (
    <div className="fixed inset-0 z-[1100] overflow-y-auto bg-black/40" role="presentation">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <section
          aria-labelledby="stand-password-title"
          aria-modal="true"
          className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
          role="dialog"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <LockIcon className="h-6 w-6" />
          </div>
          <h2 id="stand-password-title" className="mt-5 text-xl font-semibold text-text">
            Enter stand password
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            {stand.standName} requires a password before the operator dashboard opens.
          </p>

          <form className="mt-5 space-y-5" onSubmit={onSubmit}>
            <PasswordTextField
              autoFocus
              disabled={isBusy}
              error={error}
              id="operator-stand-password"
              label="Stand Password"
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Enter password"
              value={password}
            />

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button disabled={isBusy} onClick={onClose} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={isBusy} type="submit">
                {isBusy ? 'Signing in…' : 'Open Stand'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
