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
