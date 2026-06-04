import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { apiFetch, ApiError } from '@/api/client';
import type { Event, UpdateEventInput } from '@/types/event';
import type { Stand, CreateStandInput, UpdateStandInput } from '@/types/stand';
import type { Product, CreateProductInput, UpdateProductInput } from '@/types/product';

export type EventActionResult = { ok: true } | { ok: false; error: string };

export type EventConfigurationLoaderData = {
  event: Event;
  stands: Stand[];
  // Products keyed by their stand id.
  productsByStand: Record<string, Product[]>;
};

export async function eventConfigurationLoader({
  params,
}: LoaderFunctionArgs): Promise<EventConfigurationLoaderData> {
  const [event, stands] = await Promise.all([
    apiFetch<Event>(`/events/${params.eventId}`),
    apiFetch<Stand[]>(`/events/${params.eventId}/stands`),
  ]);
  // Fetch each stand's products in parallel, then index by stand id.
  const productLists = await Promise.all(
    stands.map((stand) => apiFetch<Product[]>(`/stands/${stand._id}/products`)),
  );
  const productsByStand: Record<string, Product[]> = {};
  stands.forEach((stand, i) => {
    productsByStand[stand._id] = productLists[i];
  });
  return { event, stands, productsByStand };
}

// Lifecycle + settings mutations. useFetcher revalidates the loader on success,
// so the component re-renders with the fresh event (e.g. updated status).
export async function eventConfigurationAction({
  request,
  params,
}: ActionFunctionArgs): Promise<EventActionResult> {
  const eventId = params.eventId;
  const body = (await request.json()) as
    | { intent: 'start' | 'stop' }
    | { intent: 'save'; patch: UpdateEventInput }
    | { intent: 'createStand'; patch: CreateStandInput }
    | { intent: 'updateStand'; standId: string; patch: UpdateStandInput }
    | { intent: 'deleteStand'; standId: string }
    | { intent: 'createProduct'; standId: string; patch: CreateProductInput }
    | { intent: 'updateProduct'; productId: string; patch: UpdateProductInput }
    | { intent: 'deleteProduct'; productId: string };

  try {
    switch (body.intent) {
      case 'start':
        await apiFetch(`/events/${eventId}/start`, { method: 'POST' });
        break;
      case 'stop':
        await apiFetch(`/events/${eventId}/stop`, { method: 'POST' });
        break;
      case 'save':
        await apiFetch(`/events/${eventId}`, {
          method: 'PATCH',
          body: JSON.stringify(body.patch ?? {}),
        });
        break;
      case 'createStand':
        await apiFetch(`/events/${eventId}/stands`, {
          method: 'POST',
          body: JSON.stringify(body.patch),
        });
        break;
      case 'updateStand':
        await apiFetch(`/stands/${body.standId}`, {
          method: 'PATCH',
          body: JSON.stringify(body.patch),
        });
        break;
      case 'deleteStand':
        await apiFetch(`/stands/${body.standId}`, {
          method: 'DELETE',
        });
        break;
      case 'createProduct':
        await apiFetch(`/stands/${body.standId}/products`, {
          method: 'POST',
          body: JSON.stringify(body.patch),
        });
        break;
      case 'updateProduct':
        await apiFetch(`/products/${body.productId}`, {
          method: 'PATCH',
          body: JSON.stringify(body.patch),
        });
        break;
      case 'deleteProduct':
        await apiFetch(`/products/${body.productId}`, {
          method: 'DELETE',
        });
        break;
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    return { ok: false, error: message };
  }
}
