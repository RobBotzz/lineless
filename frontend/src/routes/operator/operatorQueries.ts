import { queryOptions, skipToken } from '@tanstack/react-query';

import { getOperatorStand, getOperatorStands } from '@/api/stands';

// Keys are pure data identity (no auth credential) — the keychain supplies the
// credential at fetch time via apiFetch's auth mode.
export const operatorQueryKeys = {
  all: ['operator'] as const,
  stands: (eventId: string) => [...operatorQueryKeys.all, 'stands', eventId] as const,
  stand: (standId: string) => [...operatorQueryKeys.all, 'stand', standId] as const,
};

// Stand metadata is effectively static during a session; avoid refetching on
// every mount/focus.
const STAND_STALE_TIME = 5 * 60 * 1000;

export function operatorStandsQueryOptions(eventId: string | null | undefined) {
  return queryOptions({
    queryKey: operatorQueryKeys.stands(eventId ?? ''),
    queryFn: eventId ? () => getOperatorStands(eventId) : skipToken,
    staleTime: STAND_STALE_TIME,
  });
}

export function operatorStandQueryOptions(standId: string | null | undefined) {
  return queryOptions({
    queryKey: operatorQueryKeys.stand(standId ?? ''),
    queryFn: standId ? () => getOperatorStand(standId) : skipToken,
    staleTime: STAND_STALE_TIME,
  });
}
