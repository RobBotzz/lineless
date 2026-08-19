import { eventLogoSrc, type PublicEventInfo } from '@/types/event';
import { BrandingProvider } from '@/features/branding/BrandingContext';
import { BrandLogo } from '@/features/branding/BrandLogo';

import { ATTENDEE_WIDTH } from './column';

function EventGateShell({
  event,
  children,
}: {
  event: PublicEventInfo;
  children: React.ReactNode;
}) {
  return (
    <BrandingProvider branding={event.branding}>
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className={`w-full ${ATTENDEE_WIDTH} space-y-6 text-center`}>
          <BrandLogo logoSrc={eventLogoSrc(event)} />
          <h1 className="text-2xl font-semibold text-text">{event.name}</h1>
          {children}
        </div>
      </div>
    </BrandingProvider>
  );
}

export function EventComingSoonGate({ event }: { event: PublicEventInfo }) {
  return (
    <EventGateShell event={event}>
      <p className="text-text-muted">
        {event.plannedDate
          ? `This event starts on ${new Date(event.plannedDate).toLocaleDateString()}.`
          : 'This event has not started yet.'}
      </p>
      <p className="text-sm text-text-muted">
        Check back once the event is live to place your order.
      </p>
    </EventGateShell>
  );
}

export function EventStoppedGate({ event }: { event: PublicEventInfo }) {
  return (
    <EventGateShell event={event}>
      <p className="text-text-muted">This event is not accepting new orders.</p>
      <p className="text-sm text-text-muted">
        Operators are still fulfilling orders that were placed before the event closed.
      </p>
    </EventGateShell>
  );
}

export function EventCompletedGate({ event }: { event: PublicEventInfo }) {
  return (
    <EventGateShell event={event}>
      <p className="text-text-muted">This event has ended.</p>
      <p className="text-sm text-text-muted">Thank you for attending!</p>
    </EventGateShell>
  );
}
