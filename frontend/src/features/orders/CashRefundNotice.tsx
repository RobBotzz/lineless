import { useState } from 'react';

import { ChevronDownIcon, RefundIcon } from '@/components/icons';
import { StaticLocationMap } from '@/components/location/StaticLocationMap';

import { useCashierStandLocation } from './useCashierStandLocation';

interface CashRefundNoticeProps {
  eventId: string;
}

// Shown on the track-order page for cash orders that have a cancelled item.
// The refund message always renders (that's the important part); when the
// cashier stand has a location it doubles as an expandable accordion revealing
// the map, so the attendee knows where to collect the refund.
export function CashRefundNotice({ eventId }: CashRefundNoticeProps) {
  const [open, setOpen] = useState(false);

  const { cashierStand, position } = useCashierStandLocation(eventId);

  const message = (
    <span className="flex items-center gap-2 text-left text-sm font-medium text-text">
      <RefundIcon className="h-5 w-5 shrink-0 text-warning" />
      Cancelled items can be refunded at the cashier.
    </span>
  );

  return (
    <section className="rounded-xl border border-warning/40 bg-warning/10 p-4 shadow-sm">
      {cashierStand && position ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2"
          >
            {message}
            <ChevronDownIcon
              className={`h-4 w-4 shrink-0 text-warning transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {open ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-text">
                {cashierStand.location.locationName ?? cashierStand.standName}
              </p>
              <StaticLocationMap lat={position[0]} lng={position[1]} />
            </div>
          ) : null}
        </>
      ) : (
        message
      )}
    </section>
  );
}
