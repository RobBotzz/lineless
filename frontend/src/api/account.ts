import { apiFetch } from './client';
import type { Account, LoginInput, SignupInput, UpdateAccountInput } from '../types/account';

// Login/signup return the access JWT plus a rotating refresh token in the
// response body (no cookie).
export interface AuthResponse {
  message: string;
  token: string;
  refreshToken: string;
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

// Trades a valid refresh token for a fresh access/refresh pair. Authenticated
// by the refresh token itself (the access token may already be expired), so
// this is a 'public' call. The presented refresh token is rotated server-side.
export function refreshOrganizerSession(refreshToken: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/account/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    auth: 'public',
  });
}

// Revokes the refresh token (and its whole rotation family). Idempotent.
export function logoutOrganizer(refreshToken: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/account/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
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

// A password change logs the account out everywhere else, so the backend
// issues a fresh access/refresh pair for the current device.
export interface OrganizerPasswordUpdateResponse {
  message: string;
  token: string;
  refreshToken: string;
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
