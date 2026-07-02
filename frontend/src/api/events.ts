import { apiFetch } from './client';
import type { Event, PublicEventInfo, UpdateEventInput } from '../types/event';

export interface CreateEventInput {
  name: string;
}

export function getEvents(): Promise<Event[]> {
  return apiFetch<Event[]>('/events', { auth: 'organizer' });
}

export function getEvent(eventId: string): Promise<Event> {
  return apiFetch<Event>(`/events/${eventId}`, { auth: 'organizer' });
}

export function getAttendeeEvent(eventId: string): Promise<Event> {
  return apiFetch<Event>(`/events/${eventId}`, { auth: 'attendee', eventId });
}

// No auth — works for any event status. Used to show gate pages before a session exists.
export function getEventPublicInfo(eventId: string): Promise<PublicEventInfo> {
  return apiFetch<PublicEventInfo>(`/events/${eventId}/public-info`, { auth: 'public' });
}

export function createEvent(input: CreateEventInput): Promise<Event> {
  return apiFetch<Event>('/events', {
    method: 'POST',
    body: JSON.stringify(input),
    auth: 'organizer',
  });
}

export function updateEvent(eventId: string, patch: UpdateEventInput): Promise<void> {
  return apiFetch<void>(`/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    auth: 'organizer',
  });
}

// Uploads (or replaces) the event logo — multipart/form-data, single field
// "image". Returns the updated event (branding.logoUrl now points at the served
// logo). The browser sets the multipart boundary, so no Content-Type is forced.
export function uploadEventLogo(eventId: string, file: File): Promise<Event> {
  const formData = new FormData();
  formData.append('image', file);
  return apiFetch<Event>(`/events/${eventId}/logo`, {
    method: 'PUT',
    body: formData,
    auth: 'organizer',
  });
}

// Removes the uploaded event logo. Returns the updated event.
export function deleteEventLogo(eventId: string): Promise<Event> {
  return apiFetch<Event>(`/events/${eventId}/logo`, {
    method: 'DELETE',
    auth: 'organizer',
  });
}

export function startEvent(eventId: string): Promise<void> {
  return apiFetch<void>(`/events/${eventId}/start`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function stopEvent(eventId: string): Promise<void> {
  return apiFetch<void>(`/events/${eventId}/stop`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function completeEvent(eventId: string): Promise<void> {
  return apiFetch<void>(`/events/${eventId}/complete`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function deleteEvent(eventId: string): Promise<void> {
  return apiFetch<void>(`/events/${eventId}`, {
    method: 'DELETE',
    auth: 'organizer',
  });
}
