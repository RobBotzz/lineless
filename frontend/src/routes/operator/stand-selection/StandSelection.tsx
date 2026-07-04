import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import { loginOperator } from '@/api/stands';
import { clearOperatorCredential, getCredential } from '@/auth/keychain';
import { Button } from '@/components/ui/button';
import { PasswordTextField } from '@/components/ui/password-text-field';
import {
  ArrowRightIcon,
  CashierIcon,
  LockIcon,
  PickupIcon,
  PinIcon,
  StandIcon,
} from '@/components/icons';
import { paths } from '@/paths';
import { hasCoordinates } from '@/types/location';
import type { Stand } from '@/types/stand';
import { operatorCashierStandQueryOptions, operatorStandsQueryOptions } from '../operatorQueries';

// Shown when the cashier endpoint reports the cashier as unavailable (403/404).
const CASHIER_DISABLED_MESSAGE =
  'The cashier is disabled for this event. The organizer must enable it in the event settings to allow manual orders and cash payments.';

const LINK_EXPIRED_MESSAGE = 'Link expired. Please reopen the operator link.';
const LOGIN_FAILED_MESSAGE = 'Login failed. Please try again.';
const WRONG_PASSWORD_OR_LINK_MESSAGE = 'Wrong password or invalid link.';

type LoadState = 'loading' | 'ready' | 'invalid' | 'error';
type CashierTileState = 'available' | 'loading' | 'unavailable';

export default function StandSelection() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const operatorSession = getCredential('operator');
  const hasSessionForEvent = !!eventId && operatorSession?.eventId === eventId;
  const loggedInStands = hasSessionForEvent ? operatorSession.stands : {};
  const operatorAccessKey = hasSessionForEvent ? operatorSession.operatorAccessKey : null;

  const operatorStandsQuery = useQuery({
    ...operatorStandsQueryOptions(eventId),
    enabled: hasSessionForEvent && !!operatorAccessKey,
  });
  // The cashier has its own endpoint (it's excluded from the stand list). A 403/404
  // here means "disabled/none" — we still show the tile, just greyed out.
  const cashierStandQuery = useQuery({
    ...operatorCashierStandQueryOptions(eventId),
    enabled: hasSessionForEvent && !!operatorAccessKey,
  });
  const [selectedStand, setSelectedStand] = useState<Stand | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [invalidLinkMessage, setInvalidLinkMessage] = useState<string | null>(null);
  const loginMutation = useMutation({
    mutationFn: ({ accessPassword, stand }: { accessPassword?: string; stand: Stand }) =>
      loginOperator(stand._id, accessPassword),
    onSuccess: (_response, { stand }) => {
      if (!eventId) return;
      navigate(
        stand.standType === 'CASHIER'
          ? paths.operator.cashier(eventId)
          : paths.operator.stand(eventId, stand._id),
      );
    },
    onError: (error: unknown, { stand }) => {
      if (error instanceof ApiError && error.status === 401) {
        if (stand.requiresPassword) {
          setSelectedStand(stand);
          setLoginError(WRONG_PASSWORD_OR_LINK_MESSAGE);
        } else {
          clearOperatorCredential();
          setSelectedStand(null);
          setInvalidLinkMessage(LINK_EXPIRED_MESSAGE);
        }
        return;
      }

      setSelectedStand(stand);
      setLoginError(LOGIN_FAILED_MESSAGE);
    },
  });
  const loggingInStandId = loginMutation.isPending ? loginMutation.variables?.stand._id : null;

  let loadState: LoadState = 'ready';
  if (!hasSessionForEvent) {
    loadState = 'invalid';
  } else if (operatorStandsQuery.isPending) {
    loadState = 'loading';
  } else if (operatorStandsQuery.isError) {
    const { error } = operatorStandsQuery;
    loadState =
      error instanceof ApiError && (error.status === 401 || error.status === 404)
        ? 'invalid'
        : 'error';
  }
  const stands = operatorStandsQuery.data ?? [];
  // The cashier never appears in the stand list (backend excludes it); the
  // dedicated query decides its tile state: active when enabled, greyed when
  // disabled/missing (403/404), loading until it resolves.
  const productStands = stands.filter((stand) => stand.standType !== 'CASHIER');
  const cashierState: CashierTileState = cashierStandQuery.data
    ? 'available'
    : cashierStandQuery.isError
      ? 'unavailable'
      : 'loading';

  const canUseOperatorSession = loadState === 'ready' && !!eventId && hasSessionForEvent;

  function openPasswordDialog(stand: Stand) {
    setSelectedStand(stand);
    setPassword('');
    setLoginError(null);
  }

  const closePasswordDialog = useCallback(() => {
    if (loggingInStandId) return;
    setSelectedStand(null);
    setPassword('');
    setLoginError(null);
  }, [loggingInStandId]);

  function authenticateStand(stand: Stand, accessPassword?: string) {
    if (!eventId || !hasSessionForEvent) return;

    setLoginError(null);
    loginMutation.mutate({ stand, accessPassword });
  }

  function handleStandClick(stand: Stand) {
    if (!canUseOperatorSession || loggingInStandId) return;
    if (loggedInStands[stand._id]) {
      navigate(
        stand.standType === 'CASHIER'
          ? paths.operator.cashier(eventId)
          : paths.operator.stand(eventId, stand._id),
      );
      return;
    }
    if (stand.requiresPassword) {
      openPasswordDialog(stand);
      return;
    }
    authenticateStand(stand);
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStand || loggingInStandId) return;

    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setLoginError('Enter the stand password.');
      return;
    }

    authenticateStand(selectedStand, trimmedPassword);
  }

  function navigateToSystemDashboard(path: string) {
    if (!canUseOperatorSession) return;
    navigate(path);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8">
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
          <div className="space-y-8">
            <header>
              <h1 className="text-3xl font-bold tracking-tight text-text">Operator Console</h1>
              <p className="mt-2 text-base text-text-muted">
                Open a stand’s live board, or jump straight to pickup and cashier.
              </p>
            </header>

            <section>
              <SectionLabel>Tools</SectionLabel>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <SelectionTile
                  icon={<PickupIcon className="h-5 w-5" />}
                  meta="Orders ready for handoff"
                  onClick={() => navigateToSystemDashboard(paths.operator.pickupDashboard(eventId))}
                  title="Pick Up"
                />
                <CashierTile
                  stand={cashierStandQuery.data ?? null}
                  state={cashierState}
                  loggedIn={Boolean(
                    cashierStandQuery.data && loggedInStands[cashierStandQuery.data._id],
                  )}
                  loading={Boolean(
                    cashierStandQuery.data && loggingInStandId === cashierStandQuery.data._id,
                  )}
                  onClick={() => cashierStandQuery.data && handleStandClick(cashierStandQuery.data)}
                />
              </div>
            </section>

            <section>
              <SectionLabel count={productStands.length}>Stands</SectionLabel>
              {productStands.length > 0 ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {productStands.map((stand) => (
                    <StandSelectionTile
                      key={stand._id}
                      loggedIn={Boolean(loggedInStands[stand._id])}
                      loading={loggingInStandId === stand._id}
                      onClick={() => handleStandClick(stand)}
                      stand={stand}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border-2 border-dashed border-border bg-surface px-4 py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted text-text-muted">
                    <StandIcon className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-text">No stands configured yet</p>
                  <p className="mt-1 text-sm text-text-muted">
                    The tools above are available, but this event has no stand dashboards.
                  </p>
                </div>
              )}
            </section>
          </div>
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

function SectionLabel({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{children}</h2>
      {typeof count === 'number' && (
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-text-muted">
          {count}
        </span>
      )}
    </div>
  );
}

function getStandLocationLabel(stand: Stand) {
  const locationName = stand.location.locationName?.trim();
  if (locationName) return locationName;
  if (hasCoordinates(stand.location)) {
    return `${stand.location.yCoordinate}, ${stand.location.xCoordinate}`;
  }
  return null;
}

function StandSelectionTile({
  loggedIn,
  loading,
  onClick,
  stand,
}: {
  loggedIn: boolean;
  loading: boolean;
  onClick: () => void;
  stand: Stand;
}) {
  const locationLabel = getStandLocationLabel(stand);

  return (
    <SelectionTile
      icon={<StandIcon className="h-5 w-5" />}
      loggedIn={loggedIn}
      locked={stand.requiresPassword}
      loading={loading}
      meta={locationLabel}
      metaIcon={locationLabel ? <PinIcon className="h-4 w-4 shrink-0" /> : null}
      onClick={onClick}
      title={stand.standName}
    />
  );
}

// When available, the cashier is a stand like any other — same tile with a status
// chip + "Open", and the same login/password flow. Otherwise it's a greyed, dashed
// card: "Checking availability…" while loading, and on hover an explanation when
// the cashier is disabled (403/404).
function CashierTile({
  stand,
  state,
  loggedIn,
  loading,
  onClick,
}: {
  stand: Stand | null;
  state: CashierTileState;
  loggedIn: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  if (state === 'available' && stand) {
    const locationLabel = getStandLocationLabel(stand);
    return (
      <SelectionTile
        icon={<CashierIcon className="h-5 w-5" />}
        loggedIn={loggedIn}
        locked={stand.requiresPassword}
        loading={loading}
        meta={locationLabel ?? 'Manual orders and cash payments'}
        metaIcon={locationLabel ? <PinIcon className="h-4 w-4 shrink-0" /> : null}
        onClick={onClick}
        title="Cashier"
      />
    );
  }

  const unavailable = state === 'unavailable';
  return (
    <div
      className={[
        'group relative flex min-h-32 items-center gap-4 overflow-hidden rounded-lg border border-dashed border-border bg-surface p-4',
        state === 'loading' ? 'animate-pulse' : '',
      ].join(' ')}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted">
        <CashierIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-text-muted">Cashier</span>
        {unavailable ? (
          <span className="mt-1 inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-muted">
            Not available
          </span>
        ) : (
          <span className="mt-0.5 block text-sm text-text-muted">Checking availability…</span>
        )}
      </span>

      {/* Explanation fades in while the cursor is over the tile (hover only). */}
      {unavailable && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-surface p-4 text-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <p className="text-sm leading-6 text-text-muted">{CASHIER_DISABLED_MESSAGE}</p>
        </div>
      )}
    </div>
  );
}

function SelectionTile({
  icon,
  loggedIn = false,
  locked = false,
  loading = false,
  meta,
  metaIcon = null,
  onClick,
  title,
}: {
  icon: ReactNode;
  loggedIn?: boolean;
  locked?: boolean;
  loading?: boolean;
  meta?: string | null;
  metaIcon?: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className="group flex min-h-32 min-w-0 flex-col rounded-lg border border-border bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-70"
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      {/* Fixed-height zones (icon · title · meta · footer) so every tile is laid
          out identically whether or not it has a badge or a meta line. */}
      <span className="flex h-10 shrink-0 items-start justify-between gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-button-text">
          {icon}
        </span>
        {loggedIn ? (
          <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
            Logged in
          </span>
        ) : locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
            <LockIcon className="h-3.5 w-3.5" />
            Password
          </span>
        ) : null}
      </span>

      <span
        className="mt-3 line-clamp-2 min-w-0 shrink-0 text-base font-semibold leading-6 text-text [overflow-wrap:anywhere]"
        title={title}
      >
        {loading ? 'Signing in…' : title}
      </span>

      {/* Always reserved so cards align regardless of whether a meta line exists. */}
      <span className="mt-1.5 flex h-5 min-w-0 shrink-0 items-center gap-1.5 text-sm text-text-muted">
        {meta ? (
          <>
            {metaIcon}
            <span className="truncate">{meta}</span>
          </>
        ) : null}
      </span>

      <span className="mt-auto flex items-center justify-end pt-2 text-xs font-semibold text-text-muted transition-colors group-hover:text-accent">
        <span className="inline-flex items-center gap-1">
          Open
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </button>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          className="h-32 animate-pulse rounded-lg border border-border bg-surface p-4 shadow-sm"
          key={index}
        >
          <div className="h-10 w-10 rounded-lg bg-surface-muted" />
          <div className="mt-3 h-5 w-2/3 rounded bg-surface-muted" />
          <div className="mt-2 h-4 w-1/2 rounded bg-surface-muted" />
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
    <div className="fixed inset-0 z-1100 overflow-y-auto bg-black/40" role="presentation">
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
          <p className="mt-2 text-sm leading-6 text-text-muted [overflow-wrap:anywhere]">
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
