import { apiFetch, ApiError } from './client';
import { addOperatorStand, getCredential } from '../auth/keychain';
import type { CreateStandInput, Stand, UpdateStandInput } from '../types/stand';

export function getEventStands(eventId: string): Promise<Stand[]> {
  return apiFetch<Stand[]>(`/events/${eventId}/stands`, { auth: 'organizer' });
}

export function getOperatorStands(eventId: string): Promise<Stand[]> {
  return apiFetch<Stand[]>(`/events/${eventId}/stands`, { auth: 'operator-link' });
}

export function getAttendeeStands(eventId: string): Promise<Stand[]> {
  return apiFetch<Stand[]>(`/events/${eventId}/stands`, { auth: 'attendee', eventId });
}

export function getOperatorStand(standId: string): Promise<Stand> {
  return apiFetch<Stand>(`/stands/${standId}`, { auth: 'operator', standId });
}

export interface OperatorLoginResponse {
  token: string;
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
  // Persist the stand's token so the device can switch back without re-login.
  addOperatorStand(response.standId, response.token);
  return response;
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

export function deleteStand(standId: string): Promise<void> {
  return apiFetch<void>(`/stands/${standId}`, {
    method: 'DELETE',
    auth: 'organizer',
  });
}
