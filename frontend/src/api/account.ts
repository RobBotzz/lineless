import { apiFetch } from './client';
import type { Account, LoginInput, SignupInput, UpdateAccountInput } from '../types/account';

// Login/signup return the JWT in the response body (no cookie).
interface AuthResponse {
  message: string;
  token: string;
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/account/login', {
    method: 'POST',
    body: JSON.stringify(input),
    auth: 'public',
  });
}

export function signup(input: SignupInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/account/signup', {
    method: 'POST',
    body: JSON.stringify(input),
    auth: 'public',
  });
}

export function getAccountInfo(): Promise<{ account: Account }> {
  return apiFetch<{ account: Account }>('/account/info', { auth: 'organizer' });
}

type OrganizerAccountPatch = Pick<UpdateAccountInput, 'firstName' | 'lastName'>;

export interface OrganizerAccountUpdateResponse {
  message: string;
  account: Account;
}

export interface UpdateOrganizerPasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface OrganizerPasswordUpdateResponse {
  message: string;
  token?: string;
}

export function updateOrganizerAccount(
  patch: OrganizerAccountPatch,
): Promise<OrganizerAccountUpdateResponse> {
  return apiFetch<OrganizerAccountUpdateResponse>('/account/update', {
    method: 'PATCH',
    body: JSON.stringify(patch),
    auth: 'organizer',
  });
}

export function updateOrganizerPassword(
  input: UpdateOrganizerPasswordInput,
): Promise<OrganizerPasswordUpdateResponse> {
  return apiFetch<OrganizerPasswordUpdateResponse>('/account/password', {
    method: 'PATCH',
    body: JSON.stringify(input),
    auth: 'organizer',
  });
}
