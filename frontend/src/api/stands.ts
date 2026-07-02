import { apiFetch, ApiError } from './client';
import { addOperatorStand, getCredential } from '../auth/keychain';
import type { CreateStandInput, Stand, UpdateStandInput } from '../types/stand';

export function getEventStands(eventId: string): Promise<Stand[]> {
  return apiFetch<Stand[]>(`/events/${eventId}/stands`, { auth: 'organizer' });
}

export function getOperatorStands(eventId: string): Promise<Stand[]> {
  return apiFetch<Stand[]>(`/events/${eventId}/stands`, { auth: 'operator-link' });
}

export function getOperatorCashierStand(eventId: string): Promise<Stand> {
  return apiFetch<Stand>(`/events/${eventId}/stands/cashier-stand`, { auth: 'operator-link' });
}

export function getAttendeeStands(eventId: string): Promise<Stand[]> {
  return apiFetch<Stand[]>(`/events/${eventId}/stands`, { auth: 'attendee', eventId });
}

// The cashier stand is hidden from the attendee stand list (system-managed,
// reached directly), so it needs its own lookup — used for showing its
// location on the pending-payment page.
export function getCashierStandForAttendee(eventId: string): Promise<Stand> {
  return apiFetch<Stand>(`/events/${eventId}/stands/cashier-stand`, { auth: 'attendee', eventId });
}

export function getOperatorStand(standId: string): Promise<Stand> {
  return apiFetch<Stand>(`/stands/${standId}`, { auth: 'operator', standId });
}

export interface OperatorLoginResponse {
  token: string;
  refreshToken: string;
  standId: string;
}

export async function loginOperator(
  standId: string,
  accessPassword?: string,
): Promise<OperatorLoginResponse> {
  const session = getCredential('operator');
  if (!session) throw new ApiError(401, 'No operator session — reopen the stand link.');
  const response = await apiFetch<OperatorLoginResponse>(`/stands/${standId}/login`, {
    method: 'POST',
    body: JSON.stringify({ operatorAccessKey: session.operatorAccessKey, accessPassword }),
    auth: 'public',
  });
  // Persist the stand's token pair so the device can switch back without re-login.
  addOperatorStand(response.standId, response.token, response.refreshToken);
  return response;
}

// Trades a valid operator refresh token for a fresh access/refresh pair. The
// refresh token is scoped to this stand and rotated server-side; authenticated
// by the refresh token itself, so it is a 'public' call.
export function refreshOperatorSession(
  standId: string,
  refreshToken: string,
): Promise<OperatorLoginResponse> {
  return apiFetch<OperatorLoginResponse>(`/stands/${standId}/refresh`, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    auth: 'public',
  });
}

// Revokes the operator refresh token (and its whole rotation family). Idempotent.
export function logoutOperator(
  standId: string,
  refreshToken: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/stands/${standId}/logout`, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    auth: 'public',
  });
}

export function createStand(eventId: string, patch: CreateStandInput): Promise<void> {
  return apiFetch<void>(`/events/${eventId}/stands`, {
    method: 'POST',
    body: JSON.stringify(patch),
    auth: 'organizer',
  });
}

export function updateStand(standId: string, patch: UpdateStandInput): Promise<void> {
  return apiFetch<void>(`/stands/${standId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    auth: 'organizer',
  });
}

export function pauseStand(standId: string): Promise<Stand> {
  return apiFetch<Stand>(`/stands/${standId}/pause`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function resumeStand(standId: string): Promise<Stand> {
  return apiFetch<Stand>(`/stands/${standId}/resume`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function deleteStand(standId: string): Promise<void> {
  return apiFetch<void>(`/stands/${standId}`, {
    method: 'DELETE',
    auth: 'organizer',
  });
}
