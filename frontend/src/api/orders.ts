import { apiFetch } from './client';
import type { Order } from '../types/order';

export function getAttendeeOrders(eventId: string): Promise<Order[]> {
  return apiFetch<Order[]>('/orders', { auth: 'attendee', eventId });
}
