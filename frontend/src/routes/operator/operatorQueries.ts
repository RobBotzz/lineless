import { getOperatorStand, getOperatorStands } from '@/api/stands';

export const operatorQueryKeys = {
  all: ['operator'] as const,
  stands: (eventId: string, operatorAccessKey: string) =>
    [...operatorQueryKeys.all, 'stands', eventId, operatorAccessKey] as const,
  stand: (standId: string) => [...operatorQueryKeys.all, 'stand', standId] as const,
};

export function operatorStandsQueryOptions(eventId: string, operatorAccessKey: string) {
  return {
    queryKey: operatorQueryKeys.stands(eventId, operatorAccessKey),
    queryFn: () => getOperatorStands(eventId),
  };
}

export function operatorStandQueryOptions(standId: string) {
  return {
    queryKey: operatorQueryKeys.stand(standId),
    queryFn: () => getOperatorStand(standId),
  };
}
