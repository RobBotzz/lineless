import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { PICKUP_BOARD_EVENT, pickupBoardStreamPath } from '@/api/pickupBoard';
import { CheckCircleIcon, HourglassCircleIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { useSSE } from '@/hooks/useSSE';
import { cn } from '@/lib/utils';
import { paths } from '@/paths';
import {
  isPickupBoard,
  type PickupBoard,
  type PickupBoardItem,
  type PickupBoardStand,
} from '@/types/pickupBoard';

type StandFilter = 'all' | string;

const AUTO_SCROLL_SPEEDS = [
  { label: 'Slow', pixelStep: 1 },
  { label: 'Medium', pixelStep: 4 },
  { label: 'Fast', pixelStep: 14 },
] as const;

export default function PickupDashboard() {
  const { eventId } = useParams();
  const [board, setBoard] = useState<PickupBoard | null>(null);
  const [selectedStand, setSelectedStand] = useState<StandFilter>('all');
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false);
  const [isAutoScrollDialogOpen, setIsAutoScrollDialogOpen] = useState(false);
  const [autoScrollSpeedIndex, setAutoScrollSpeedIndex] = useState(0);
  const [canAutoScroll, setCanAutoScroll] = useState(false);

  const handleMessage = useCallback(({ event, data }: { event: string; data: unknown }) => {
    if (event !== PICKUP_BOARD_EVENT) return;
    if (!isPickupBoard(data)) {
      console.warn('Ignoring malformed pickup board frame', data);
      return;
    }
    setBoard(data);
  }, []);

  const { status } = useSSE({
    path: eventId ? pickupBoardStreamPath(eventId) : null,
    auth: 'operator-link',
    eventId,
    onMessage: handleMessage,
  });

  const stands = board?.stands ?? [];
  const selectedStandExists =
    selectedStand === 'all' || stands.some((stand) => stand.standId === selectedStand);
  const activeStandFilter = selectedStandExists ? selectedStand : 'all';
  const visibleStands = stands.filter(
    (stand) => activeStandFilter === 'all' || stand.standId === activeStandFilter,
  );

  const getScrollingElement = useCallback(
    () => document.scrollingElement ?? document.documentElement,
    [],
  );

  const updateCanAutoScroll = useCallback(() => {
    const scrollingElement = getScrollingElement();
    const hasScrollableOverflow = scrollingElement.scrollHeight > scrollingElement.clientHeight + 1;

    setCanAutoScroll(hasScrollableOverflow);

    if (!hasScrollableOverflow) {
      setIsAutoScrollEnabled(false);
      setIsAutoScrollDialogOpen(false);
    }
  }, [getScrollingElement]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(updateCanAutoScroll);

    const resizeObserver = new ResizeObserver(updateCanAutoScroll);
    resizeObserver.observe(document.body);

    window.addEventListener('resize', updateCanAutoScroll);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanAutoScroll);
    };
  }, [activeStandFilter, board, updateCanAutoScroll, visibleStands.length]);

  useEffect(() => {
    if (!isAutoScrollEnabled || !canAutoScroll) {
      return undefined;
    }

    const stopAutoScroll = () => setIsAutoScrollEnabled(false);
    const topPauseMs = 1200;
    const autoScrollStep =
      AUTO_SCROLL_SPEEDS[autoScrollSpeedIndex]?.pixelStep ?? AUTO_SCROLL_SPEEDS[0].pixelStep;
    let pauseUntil = 0;

    const scrollToTop = () => {
      const scrollingElement = getScrollingElement();

      scrollingElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'auto' });
      pauseUntil = Date.now() + topPauseMs;
    };

    scrollToTop();
    const clickListenerFrame = window.requestAnimationFrame(() => {
      window.addEventListener('click', stopAutoScroll);
    });

    const scrollInterval = window.setInterval(() => {
      if (Date.now() < pauseUntil) {
        return;
      }

      const scrollingElement = getScrollingElement();
      const maxScrollTop = scrollingElement.scrollHeight - scrollingElement.clientHeight;

      if (maxScrollTop <= 0) {
        updateCanAutoScroll();
        return;
      }

      if (scrollingElement.scrollTop >= maxScrollTop - autoScrollStep) {
        scrollToTop();
        return;
      }

      scrollingElement.scrollTop = Math.min(
        scrollingElement.scrollTop + autoScrollStep,
        maxScrollTop,
      );
    }, 35);

    return () => {
      window.clearInterval(scrollInterval);
      window.cancelAnimationFrame(clickListenerFrame);
      window.removeEventListener('click', stopAutoScroll);
    };
  }, [
    autoScrollSpeedIndex,
    canAutoScroll,
    getScrollingElement,
    isAutoScrollEnabled,
    updateCanAutoScroll,
  ]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BackButton to={eventId ? paths.operator.root(eventId) : paths.home}>
            Operator Console
          </BackButton>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {canAutoScroll && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {!isAutoScrollEnabled && (
                  <button
                    className="h-10 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text shadow-sm transition-colors hover:bg-surface-muted"
                    onClick={() => setIsAutoScrollDialogOpen(true)}
                    type="button"
                  >
                    Start auto scroll
                  </button>
                )}
              </div>
            )}

            <label>
              <span className="sr-only">Filter by stand</span>
              <select
                className="h-10 min-w-44 cursor-pointer rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text shadow-sm outline-none transition-colors hover:bg-surface-muted focus:border-accent"
                onChange={(event) => setSelectedStand(event.target.value as StandFilter)}
                value={activeStandFilter}
              >
                <option value="all">All Stands</option>
                {stands.map((stand) => (
                  <option key={stand.standId} value={stand.standId}>
                    {stand.standName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {isAutoScrollDialogOpen && (
          <AutoScrollDialog
            onCancel={() => setIsAutoScrollDialogOpen(false)}
            onStart={() => {
              setIsAutoScrollDialogOpen(false);
              setIsAutoScrollEnabled(true);
            }}
            onSpeedChange={setAutoScrollSpeedIndex}
            speedIndex={autoScrollSpeedIndex}
          />
        )}

        {!board && status === 'error' && (
          <StatePanel
            title="Pickup board unavailable"
            message="The live pickup board could not connect. Check the operator link and backend connection."
          />
        )}

        {!board && status !== 'error' && <LoadingBoard />}

        {board && stands.length === 0 && (
          <StatePanel
            title="No product stands yet"
            message="Pickup will show ready orders as soon as this event has product stands and paid orders."
          />
        )}

        {board && stands.length > 0 && visibleStands.length === 0 && (
          <StatePanel
            title="No stand selected"
            message="Choose another stand or switch back to all stands."
          />
        )}

        {board && visibleStands.length > 0 && (
          <div className="space-y-5">
            {visibleStands.map((stand) => (
              <StandSection key={stand.standId} stand={stand} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AutoScrollDialog({
  speedIndex,
  onSpeedChange,
  onStart,
  onCancel,
}: {
  speedIndex: number;
  onSpeedChange: (speedIndex: number) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 px-4 py-8"
      onClick={onCancel}
      role="presentation"
    >
      <section
        aria-describedby="auto-scroll-dialog-description"
        aria-labelledby="auto-scroll-dialog-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
      >
        <div className="text-center">
          <h2 id="auto-scroll-dialog-title" className="text-xl font-semibold text-text">
            Start auto scroll
          </h2>
          <p id="auto-scroll-dialog-description" className="mt-3 text-sm leading-6 text-text-muted">
            You can stop auto scroll at any time by clicking anywhere on the page.
          </p>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-text">Speed</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {AUTO_SCROLL_SPEEDS.map((speed, index) => (
              <button
                aria-pressed={speedIndex === index}
                className={cn(
                  'h-10 rounded-md border px-3 text-sm font-semibold transition-colors',
                  speedIndex === index
                    ? 'border-accent bg-accent text-button-text'
                    : 'border-border bg-background text-text hover:bg-surface-muted',
                )}
                key={speed.label}
                onClick={() => onSpeedChange(index)}
                type="button"
              >
                {speed.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex gap-3">
          <Button className="flex-1" onClick={onCancel} size="lg" variant="secondary">
            Cancel
          </Button>
          <Button autoFocus className="flex-1" onClick={onStart} size="lg">
            Start
          </Button>
        </div>
      </section>
    </div>
  );
}

function StandSection({ stand }: { stand: PickupBoardStand }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h2 className="truncate text-2xl font-bold tracking-tight text-text">{stand.standName}</h2>
        {stand.standStatus === 'PAUSED' && (
          <span className="rounded-full bg-warning/20 px-2.5 py-1 text-xs font-semibold text-text">
            Paused
          </span>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_1px_minmax(0,0.85fr)] xl:gap-y-0">
        <StatusLane
          title="In Line"
          intent="line"
          orders={stand.inLine}
          emptyMessage="No orders waiting at this stand."
        />
        <div aria-hidden="true" className="h-px bg-border xl:h-auto xl:w-px xl:self-stretch" />
        <StatusLane
          title="Ready for Pickup"
          intent="ready"
          orders={stand.readyForPickup}
          emptyMessage="No orders ready right now."
        />
      </div>
    </section>
  );
}

function StatusLane({
  title,
  intent,
  orders,
  emptyMessage,
}: {
  title: string;
  intent: 'ready' | 'line';
  orders: PickupBoardItem[];
  emptyMessage: string;
}) {
  return (
    <div className="min-h-80">
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            'text-base font-bold uppercase tracking-wide',
            intent === 'ready' ? 'text-success' : 'text-text-muted',
          )}
        >
          {title}
        </h3>
      </div>

      <div className="mt-4 min-h-72">
        {orders.length > 0 ? (
          <ul
            className={cn(
              'grid content-start justify-start gap-3',
              intent === 'line'
                ? 'grid-cols-1 sm:grid-cols-[repeat(2,13rem)] lg:grid-cols-[repeat(3,13rem)]'
                : 'grid-cols-1 sm:grid-cols-[repeat(2,13rem)]',
            )}
          >
            {orders.map((order) => (
              <PickupOrderCard key={order.itemId} intent={intent} orderItem={order} />
            ))}
          </ul>
        ) : (
          <EmptyLaneState message={emptyMessage} />
        )}
      </div>
    </div>
  );
}

function PickupOrderCard({
  orderItem,
  intent,
}: {
  orderItem: PickupBoardItem;
  intent: 'ready' | 'line';
}) {
  return (
    <li
      className={cn(
        'flex min-h-28 min-w-0 flex-col justify-between rounded-md border bg-background p-4 shadow-sm',
        'h-28 w-52',
        intent === 'ready' ? 'border-success/40 ring-1 ring-success/10' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{orderItem.productName}</p>
        </div>
      </div>
      <p className="mt-4 truncate font-sans text-3xl font-extrabold tabular-nums tracking-normal text-text">
        #{orderItem.orderNumber}
      </p>
    </li>
  );
}

function EmptyLaneState({ message }: { message: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center text-sm font-medium text-text-muted">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-text-muted">
        {message.toLowerCase().includes('ready') ? (
          <CheckCircleIcon className="h-5 w-5" />
        ) : (
          <HourglassCircleIcon className="h-5 w-5" />
        )}
      </span>
      <span>{message}</span>
    </div>
  );
}

function LoadingBoard() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[0, 1].map((index) => (
        <div key={index} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="h-6 w-40 animate-pulse rounded bg-surface-muted" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="h-72 animate-pulse rounded-lg bg-surface-muted" />
            <div className="h-72 animate-pulse rounded-lg bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatePanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-12 text-center shadow-sm">
      <p className="text-base font-semibold text-text">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-muted">{message}</p>
    </div>
  );
}
