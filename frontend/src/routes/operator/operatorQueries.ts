import { queryOptions, skipToken } from '@tanstack/react-query';

import { getOperatorStands } from '@/api/stands';

export const operatorQueryKeys = {
  all: ['operator'] as const,
  stands: (eventId: string) => [...operatorQueryKeys.all, 'stands', eventId] as const,
};

export function operatorStandsQueryOptions(eventId: string | null | undefined) {
  return queryOptions({
    queryKey: operatorQueryKeys.stands(eventId ?? ''),
    queryFn: eventId ? () => getOperatorStands(eventId) : skipToken,
  });
}
