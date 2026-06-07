import { apiFetch } from './client';
import type { CreateStandInput, Stand, UpdateStandInput } from '../types/stand';

export function getEventStands(eventId: string): Promise<Stand[]> {
  return apiFetch<Stand[]>(`/events/${eventId}/stands`, { auth: 'organizer' });
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
