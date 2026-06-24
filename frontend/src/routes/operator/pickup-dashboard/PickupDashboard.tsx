import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { PICKUP_BOARD_EVENT, pickupBoardStreamPath } from '@/api/pickupBoard';
import { CheckCircleIcon, HourglassCircleIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { useSSE } from '@/hooks/useSSE';
import { cn } from '@/lib/utils';
import { paths } from '@/paths';
import {
  isPickupBoard,
  type PickupBoard,
  type PickupBoardItem,
  type PickupBoardStand,
} from '@/types/pickupBoard';
import { useOperatorNavbarActions } from '../operatorNavbarActions';

type StandFilter = 'all' | string;

export default function PickupDashboard() {
  const { eventId } = useParams();
  const { setNavbarActions } = useOperatorNavbarActions();
  const [board, setBoard] = useState<PickupBoard | null>(null);
  const [selectedStand, setSelectedStand] = useState<StandFilter>('all');
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(1);
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

    const topPauseMs = 1200;
    let pauseUntil = 0;

    const scrollToTop = () => {
      const scrollingElement = getScrollingElement();

      scrollingElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'auto' });
      pauseUntil = Date.now() + topPauseMs;
    };

    scrollToTop();

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

      if (scrollingElement.scrollTop >= maxScrollTop - autoScrollSpeed) {
        scrollToTop();
        return;
      }

      scrollingElement.scrollTop = Math.min(
        scrollingElement.scrollTop + autoScrollSpeed,
        maxScrollTop,
      );
    }, 35);

    return () => window.clearInterval(scrollInterval);
  }, [
    autoScrollSpeed,
    canAutoScroll,
    getScrollingElement,
    isAutoScrollEnabled,
    updateCanAutoScroll,
  ]);

  useEffect(() => {
    setNavbarActions({
      right: canAutoScroll ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {isAutoScrollEnabled && (
            <div className="flex h-10 items-center overflow-hidden rounded-md border border-border bg-surface shadow-sm">
              <button
                aria-label="Decrease auto scroll speed"
                className="h-10 w-10 text-lg font-semibold text-text transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
                disabled={autoScrollSpeed === 1}
                onClick={() => setAutoScrollSpeed((speed) => Math.max(1, speed - 1))}
                type="button"
              >
                -
              </button>
              <span className="flex h-10 min-w-10 items-center justify-center border-x border-border px-3 text-xs font-semibold text-text-muted">
                {autoScrollSpeed}x
              </span>
              <button
                aria-label="Increase auto scroll speed"
                className="h-10 w-10 text-lg font-semibold text-text transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
                disabled={autoScrollSpeed === 5}
                onClick={() => setAutoScrollSpeed((speed) => Math.min(5, speed + 1))}
                type="button"
              >
                +
              </button>
            </div>
          )}

          <button
            aria-pressed={isAutoScrollEnabled}
            className={cn(
              'h-10 rounded-md border px-4 text-sm font-semibold shadow-sm transition-colors',
              isAutoScrollEnabled
                ? 'border-accent bg-accent text-primary-foreground'
                : 'border-border bg-surface text-text hover:bg-surface-muted',
            )}
            onClick={() => setIsAutoScrollEnabled((current) => !current)}
            type="button"
          >
            {isAutoScrollEnabled ? 'Stop auto scroll' : 'Start auto scroll'}
          </button>
        </div>
      ) : undefined,
    });

    return () => setNavbarActions({});
  }, [autoScrollSpeed, canAutoScroll, isAutoScrollEnabled, setNavbarActions]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BackButton to={eventId ? paths.operator.root(eventId) : paths.home}>Back</BackButton>

          <label className="w-full sm:w-auto">
            <span className="sr-only">Filter by stand</span>
            <select
              className="h-10 w-full min-w-44 cursor-pointer rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text shadow-sm outline-none transition-colors hover:bg-surface-muted focus:border-accent sm:w-auto"
              onChange={(event) => setSelectedStand(event.target.value)}
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
            'text-sm font-bold uppercase tracking-wide',
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
      <p className="mt-4 truncate font-mono text-3xl font-bold tracking-tight text-text">
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
