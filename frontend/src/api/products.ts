import { apiFetch } from './client';
import type { CreateProductInput, Product, UpdateProductInput } from '../types/product';

export function getStandProducts(standId: string): Promise<Product[]> {
  return apiFetch<Product[]>(`/stands/${standId}/products`, { auth: 'organizer' });
}

export function getAttendeeStandProducts(eventId: string, standId: string): Promise<Product[]> {
  return apiFetch<Product[]>(`/stands/${standId}/products`, { auth: 'attendee', eventId });
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

// Availability control, scoped to the operator's stand. Status is its own explicit
// transition (not PATCH); the backend 409s if the product is already in that state.
// LIVE -> PAUSED: attendees can no longer order this product.
export function pauseProductAsOperator(productId: string, standId: string): Promise<void> {
  return apiFetch<void>(`/products/${productId}/pause`, {
    method: 'POST',
    auth: 'operator',
    standId,
  });
}

// PAUSED -> LIVE: the product becomes orderable again.
export function resumeProductAsOperator(productId: string, standId: string): Promise<void> {
  return apiFetch<void>(`/products/${productId}/resume`, {
    method: 'POST',
    auth: 'operator',
    standId,
  });
}
