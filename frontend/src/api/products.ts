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

export function updateProductStock(productId: string, productStock: number): Promise<Product> {
  return apiFetch<Product>(`/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify({ productStock }),
    auth: 'organizer',
  });
}

export function deleteProduct(productId: string): Promise<void> {
  return apiFetch<void>(`/products/${productId}`, {
    method: 'DELETE',
    auth: 'organizer',
  });
}

export function pauseProduct(productId: string): Promise<Product> {
  return apiFetch<Product>(`/products/${productId}/pause`, {
    method: 'POST',
    auth: 'organizer',
  });
}

export function resumeProduct(productId: string): Promise<Product> {
  return apiFetch<Product>(`/products/${productId}/resume`, {
    method: 'POST',
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
