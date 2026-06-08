import { setOperatorToken } from '@/auth/keychain';
import type { Stand } from '@/types/stand';
import { apiFetch } from './client';

export interface OperatorLoginInput {
  standId: string;
  operatorAccessKey: string;
  accessPassword?: string;
}

export interface OperatorLoginResponse {
  token: string;
  standId: string;
}

export async function listOperatorStands(
  eventId: string,
  operatorAccessKey: string,
): Promise<Stand[]> {
  return apiFetch<Stand[]>(`/events/${eventId}/stands`, {
    auth: 'public',
    headers: {
      'X-Operator-Access-Key': operatorAccessKey,
    },
  });
}

export async function loginOperator(input: OperatorLoginInput): Promise<OperatorLoginResponse> {
  const response = await apiFetch<OperatorLoginResponse>('/stands/login', {
    method: 'POST',
    body: JSON.stringify(input),
    auth: 'public',
  });
  setOperatorToken(response.token, response.standId);
  return response;
}
