import { apiFetch } from './client';
import type { Event, UpdateEventInput } from '../types/event';

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

export function deleteEvent(eventId: string): Promise<void> {
  return apiFetch<void>(`/events/${eventId}`, {
    method: 'DELETE',
    auth: 'organizer',
  });
}
