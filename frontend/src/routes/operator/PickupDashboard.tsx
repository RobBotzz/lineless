import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { BackButton } from '../../components/shared';
import { paths } from '../../paths';
import { useOperatorNavbarActions } from './operatorNavbarActions';

type PickupOrderItem = {
  orderNumber: string;
};

type StandId = 'stand-1' | 'stand-2' | 'stand-3' | 'stand-4';
type StandFilter = 'all' | StandId;

type StandPreview = {
  id: StandId;
  title: string;
  inLine: PickupOrderItem[];
  readyForPickup: PickupOrderItem[];
};

const exampleOrder: PickupOrderItem = {
  orderNumber: 'LL-018',
};

const standPreviews: StandPreview[] = [
  {
    id: 'stand-1',
    title: 'Stand 1',
    inLine: [],
    readyForPickup: [exampleOrder],
  },
  {
    id: 'stand-2',
    title: 'Stand 2',
    inLine: [],
    readyForPickup: [],
  },
  {
    id: 'stand-3',
    title: 'Stand 3',
    inLine: [],
    readyForPickup: [],
  },
  {
    id: 'stand-4',
    title: 'Stand 4',
    inLine: [],
    readyForPickup: [],
  },
];

export default function PickupDashboard() {
  const { eventId } = useParams();
  const { setNavbarActions } = useOperatorNavbarActions();
  const [selectedStand, setSelectedStand] = useState<StandFilter>('all');
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(1);
  const visibleStands = standPreviews.filter(
    (stand) => selectedStand === 'all' || stand.id === selectedStand,
  );

  useEffect(() => {
    if (!isAutoScrollEnabled) {
      return undefined;
    }

    const topPauseMs = 1200;
    let pauseUntil = 0;

    const getScrollingElement = () => document.scrollingElement ?? document.documentElement;

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
  }, [autoScrollSpeed, isAutoScrollEnabled]);

  useEffect(() => {
    setNavbarActions({
      right: (
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
            className={`h-10 rounded-md border px-4 text-sm font-semibold shadow-sm transition-colors ${
              isAutoScrollEnabled
                ? 'border-accent bg-accent text-primary-foreground'
                : 'border-border bg-surface text-text hover:bg-surface-muted'
            }`}
            onClick={() => setIsAutoScrollEnabled((current) => !current)}
            type="button"
          >
            {isAutoScrollEnabled ? 'Stop auto scroll' : 'Start auto scroll'}
          </button>
        </div>
      ),
    });

    return () => setNavbarActions({});
  }, [autoScrollSpeed, eventId, isAutoScrollEnabled, setNavbarActions]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BackButton to={eventId ? paths.operator.root(eventId) : paths.operator.index}>
            Back
          </BackButton>

          <label>
            <span className="sr-only">Filter by stand</span>
            <select
              className="h-10 min-w-44 cursor-pointer rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text shadow-sm outline-none transition-colors hover:bg-surface-muted focus:border-accent"
              onChange={(event) => setSelectedStand(event.target.value as StandFilter)}
              value={selectedStand}
            >
              <option value="all">All Stands</option>
              {standPreviews.map((stand) => (
                <option key={stand.id} value={stand.id}>
                  {stand.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-6">
          {visibleStands.map((stand) => (
            <StandSection key={stand.id} stand={stand} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StandSection({ stand }: { stand: StandPreview }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-text">{stand.title}</h2>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-text-muted">
          {stand.inLine.length + stand.readyForPickup.length} item
          {stand.inLine.length + stand.readyForPickup.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatusLane title="In Line" orders={stand.inLine} />
        <StatusLane title="Ready for Pickup" orders={stand.readyForPickup} />
      </div>
    </section>
  );
}

function StatusLane({ title, orders }: { title: string; orders: PickupOrderItem[] }) {
  return (
    <div className="min-h-72 rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-text">{title}</h3>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-muted">
          {orders.length}
        </span>
      </div>
      <div className="mt-4 min-h-44 rounded-md bg-surface p-3">
        {orders.length > 0 ? (
          <ul className="flex flex-wrap gap-3">
            {orders.map((order) => (
              <PickupOrderCard key={order.orderNumber} orderItem={order} />
            ))}
          </ul>
        ) : (
          <EmptyLaneState />
        )}
      </div>
    </div>
  );
}

function EmptyLaneState() {
  return (
    <div className="flex min-h-44 items-center justify-center px-4 text-center text-sm font-medium text-text-muted">
      No orders in this lane.
    </div>
  );
}

function PickupOrderCard({ orderItem }: { orderItem: PickupOrderItem }) {
  return (
    <li className="flex h-16 w-28 items-center justify-center rounded-md border border-border bg-background text-center shadow-sm">
      <span className="text-lg font-bold tracking-tight text-text">{orderItem.orderNumber}</span>
    </li>
  );
}
