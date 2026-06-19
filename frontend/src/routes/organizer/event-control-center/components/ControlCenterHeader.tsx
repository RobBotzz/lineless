import { BackButton } from '@/components/shared';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { SseStatus } from '@/hooks/useSSE';

export function ControlCenterHeader({
  backTo,
  eventName,
  lastUpdatedAt,
  streamError,
  streamStatus,
}: {
  backTo: string;
  eventName: string;
  lastUpdatedAt: Date;
  streamError: Error | null;
  streamStatus: SseStatus;
}) {
  return (
    <>
      <BackButton to={backTo}>Event Configuration</BackButton>

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="text-2xl font-bold">{eventName || 'Untitled Event'}</CardTitle>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-muted">
              <span>
                Last updated:{' '}
                <span className="font-medium tabular-nums text-text">
                  {lastUpdatedAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
              <span className="hidden text-border sm:inline">|</span>
              <ConnectionStatusBadge error={streamError} status={streamStatus} />
            </div>
          </div>
        </CardHeader>
      </Card>
    </>
  );
}

function ConnectionStatusBadge({ error, status }: { error: Error | null; status: SseStatus }) {
  const config =
    status === 'open'
      ? { label: 'Live', className: 'text-success', dot: 'bg-success' }
      : status === 'connecting'
        ? { label: 'Connecting', className: 'text-accent', dot: 'bg-accent' }
        : status === 'error'
          ? { label: 'Reconnecting', className: 'text-danger', dot: 'bg-danger' }
          : { label: 'Idle', className: 'text-text-muted', dot: 'bg-border' };

  return (
    <span
      className={['inline-flex items-center gap-2 font-medium', config.className].join(' ')}
      title={error?.message}
    >
      <span className={['h-2 w-2 rounded-full', config.dot].join(' ')} />
      {config.label}
    </span>
  );
}
