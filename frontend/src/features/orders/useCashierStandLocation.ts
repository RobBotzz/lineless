import { useQuery } from '@tanstack/react-query';

import { getCashierStandForAttendee } from '@/api/stands';
import { hasCoordinates, toLatLng } from '@/types/location';

// Shared by CashRefundNotice and CashierLocationAccordion: both need the
// attendee's cashier stand and its map position, differing only in how they
// render it.
export function useCashierStandLocation(eventId: string) {
  const cashierStandQuery = useQuery({
    queryKey: ['attendee-cashier-stand', eventId],
    queryFn: () => getCashierStandForAttendee(eventId),
    retry: false,
  });

  const cashierStand = cashierStandQuery.data ?? null;
  const position =
    cashierStand && hasCoordinates(cashierStand.location) ? toLatLng(cashierStand.location) : null;

  return { cashierStand, position };
}
