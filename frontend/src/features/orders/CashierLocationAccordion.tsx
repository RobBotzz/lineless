import { useState } from 'react';

import { ChevronDownIcon, PinIcon } from '@/components/icons';
import { StaticLocationMap } from '@/components/location/StaticLocationMap';
import { resolveLocationName } from '@/types/location';

import { useCashierStandLocation } from './useCashierStandLocation';

interface CashierLocationAccordionProps {
  eventId: string;
}

// Collapsible "where do I pay" section for the Payment Pending page. Renders
// nothing until the cashier stand's location is known, and nothing at all if
// no location has been set (or the cashier is disabled, or the fetch fails) —
// there's nothing useful to show without one.
export function CashierLocationAccordion({ eventId }: CashierLocationAccordionProps) {
  const [open, setOpen] = useState(false);

  const { cashierStand, position } = useCashierStandLocation(eventId);

  if (!cashierStand || !position) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-text"
      >
        <span className="flex items-center gap-2 font-semibold">
          <PinIcon className="h-5 w-5" />
          Cashier Stand Location
        </span>
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-text [overflow-wrap:anywhere]">
            {resolveLocationName(cashierStand.location.locationName, cashierStand.standName)}
          </p>
          <StaticLocationMap lat={position[0]} lng={position[1]} />
        </div>
      ) : null}
    </section>
  );
}
