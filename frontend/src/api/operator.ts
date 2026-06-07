import { setOperatorToken } from '@/auth/keychain';
import { apiFetch } from './client';

export interface OperatorLoginInput {
  standId: string;
  accessPassword: string;
}

export interface OperatorLoginResponse {
  token: string;
  standId: string;
}

export async function loginOperator(input: OperatorLoginInput): Promise<OperatorLoginResponse> {
  const response = await apiFetch<OperatorLoginResponse>('/operator/login', {
    method: 'POST',
    body: JSON.stringify(input),
    auth: 'public',
  });
  setOperatorToken(response.token, response.standId);
  return response;
}
