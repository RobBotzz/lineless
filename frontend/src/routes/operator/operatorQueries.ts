import { queryOptions, skipToken } from '@tanstack/react-query';

import { getOperatorCashierStand, getOperatorStand, getOperatorStands } from '@/api/stands';

export const operatorQueryKeys = {
  all: ['operator'] as const,
  stands: (eventId: string) => [...operatorQueryKeys.all, 'stands', eventId] as const,
  stand: (standId: string) => [...operatorQueryKeys.all, 'stand', standId] as const,
  cashierStand: (eventId: string) => [...operatorQueryKeys.all, 'cashier-stand', eventId] as const,
};

export function operatorStandsQueryOptions(eventId: string | null | undefined) {
  return queryOptions({
    queryKey: operatorQueryKeys.stands(eventId ?? ''),
    queryFn: eventId ? () => getOperatorStands(eventId) : skipToken,
  });
}

export function operatorStandQueryOptions(standId: string | null | undefined) {
  return queryOptions({
    queryKey: operatorQueryKeys.stand(standId ?? ''),
    queryFn: standId ? () => getOperatorStand(standId) : skipToken,
  });
}

export function operatorCashierStandQueryOptions(eventId: string | null | undefined) {
  return queryOptions({
    queryKey: operatorQueryKeys.cashierStand(eventId ?? ''),
    queryFn: eventId ? () => getOperatorCashierStand(eventId) : skipToken,
    // 403 (cashier disabled) and 404 (none) are expected "unavailable" states —
    // treat them as a result, not a transient failure to retry.
    retry: false,
  });
}
