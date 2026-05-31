import { apiFetch } from './client';
import type { Account, LoginInput, SignupInput } from '../types/account';

// Login/signup return the JWT in the response body (no cookie).
interface AuthResponse {
  message: string;
  token: string;
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/account/login', {
    method: 'POST',
    body: JSON.stringify(input),
    auth: false,
  });
}

export function signup(input: SignupInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/account/signup', {
    method: 'POST',
    body: JSON.stringify(input),
    auth: false,
  });
}

export function getAccountInfo(): Promise<{ account: Account }> {
  return apiFetch<{ account: Account }>('/account/info');
}
