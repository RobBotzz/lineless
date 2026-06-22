import { useMemo } from 'react';

import type { StandQueueMetric } from '@/api/eventControlCenter';
import type { Stand } from '@/types/stand';
import { OperationalCanvas } from '../components/OperationalCanvas';

type StandDisplay = Pick<Stand, '_id' | 'standName'>;

type QueueStandPerformanceEntry = StandQueueMetric & {
  standName: string;
};

export function QueueStandPerformance({
  standNameById,
  standQueues,
  stands,
}: {
  standNameById: Map<string, string>;
  standQueues: StandQueueMetric[];
  stands: StandDisplay[];
}) {
  const visibleEntries = useMemo(() => {
    const queueByStandId = new Map(standQueues.map((queue) => [queue.standId, queue]));
    const knownStandIds = new Set(stands.map((stand) => stand._id));
    const entries: QueueStandPerformanceEntry[] = [
      ...stands.map((stand) => {
        const queue = queueByStandId.get(stand._id);

        return {
          standId: stand._id,
          standName: stand.standName,
          queueLength: queue?.queueLength ?? 0,
          averageWaitMinutes: queue?.averageWaitMinutes ?? 0,
          alert: queue?.alert ?? false,
        };
      }),
      ...standQueues
        .filter((queue) => !knownStandIds.has(queue.standId))
        .map((queue) => ({
          ...queue,
          standName: standNameById.get(queue.standId) ?? 'Unknown booth',
        })),
    ];

    return (entries.length > 0 ? entries : []).sort((left, right) => {
      if (right.queueLength !== left.queueLength) {
        return right.queueLength - left.queueLength;
      }
      return right.averageWaitMinutes - left.averageWaitMinutes;
    });
  }, [standNameById, standQueues, stands]);
  const maxQueueLength = useMemo(
    () => Math.max(...visibleEntries.map((entry) => entry.queueLength), 1),
    [visibleEntries],
  );

  if (visibleEntries.length === 0) {
    return (
      <OperationalCanvas
        title="No stands configured"
        message="Queue and wait metrics will appear as soon as booths are added."
      />
    );
  }

  return (
    <div className="space-y-3">
      {visibleEntries.map((entry) => (
        <QueueStandPerformanceRow
          entry={entry}
          key={entry.standId}
          maxQueueLength={maxQueueLength}
        />
      ))}
    </div>
  );
}

function QueueStandPerformanceRow({
  entry,
  maxQueueLength,
}: {
  entry: QueueStandPerformanceEntry;
  maxQueueLength: number;
}) {
  const queueWidth =
    entry.queueLength > 0 ? Math.max(6, (entry.queueLength / maxQueueLength) * 100) : 2;

  return (
    <div
      className={[
        'grid gap-4 rounded-lg border p-4 transition md:grid-cols-[minmax(10rem,0.8fr)_minmax(16rem,1.5fr)_auto] md:items-center',
        entry.alert ? 'border-danger/30 bg-danger/5' : 'border-border bg-background',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={[
              'h-2.5 w-2.5 shrink-0 rounded-full',
              entry.alert
                ? 'bg-danger shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-danger)_12%,transparent)]'
                : 'bg-success shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-success)_12%,transparent)]',
            ].join(' ')}
          />
          <h3 className="truncate font-semibold text-text">{entry.standName}</h3>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {entry.alert ? 'Alert threshold reached' : 'No active queue alert'}
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-text-muted">Queue depth</span>
          <span className="font-semibold text-text">
            {entry.queueLength} open item{entry.queueLength === 1 ? '' : 's'}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-muted shadow-inner">
          <div
            className={['h-full rounded-full', entry.alert ? 'bg-danger' : 'bg-accent'].join(' ')}
            style={{
              opacity: entry.queueLength > 0 ? 1 : 0.18,
              width: `${queueWidth}%`,
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="text-sm font-medium text-text-muted md:hidden">Avg. Wait Time</span>
        <span
          className={[
            'shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold',
            entry.alert
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-border bg-surface text-text',
          ].join(' ')}
        >
          Avg. Wait Time: {entry.averageWaitMinutes}m
        </span>
      </div>
    </div>
  );
}
