import { apiFetch } from './client';
import type { CreateProductInput, Product, UpdateProductInput } from '../types/product';

export function getStandProducts(standId: string): Promise<Product[]> {
  return apiFetch<Product[]>(`/stands/${standId}/products`, { auth: 'organizer' });
}

export function getAttendeeStandProducts(eventId: string, standId: string): Promise<Product[]> {
  return apiFetch<Product[]>(`/stands/${standId}/products`, { auth: 'attendee', eventId });
}

export function getOperatorStandProducts(standId: string): Promise<Product[]> {
  return apiFetch<Product[]>(`/stands/${standId}/products`, { auth: 'operator', standId });
}

// Event-wide LIVE catalog for the cashier (its operator token is stand-scoped,
// so standId selects the credential while eventId scopes the catalog).
export function getOperatorEventProducts(eventId: string, standId: string): Promise<Product[]> {
  return apiFetch<Product[]>(`/events/${eventId}/products`, { auth: 'operator', standId });
}

export function createProduct(standId: string, patch: CreateProductInput): Promise<void> {
  return apiFetch<void>(`/stands/${standId}/products`, {
    method: 'POST',
    body: JSON.stringify(patch),
    auth: 'organizer',
  });
}

export function updateProduct(productId: string, patch: UpdateProductInput): Promise<void> {
  return apiFetch<void>(`/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    auth: 'organizer',
  });
}

export function deleteProduct(productId: string): Promise<void> {
  return apiFetch<void>(`/products/${productId}`, {
    method: 'DELETE',
    auth: 'organizer',
  });
}
