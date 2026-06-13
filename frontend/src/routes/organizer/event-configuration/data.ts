import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';

import { ApiError } from '@/api/client';
import { deleteEvent, getEvent, startEvent, stopEvent, updateEvent } from '@/api/events';
import { createProduct, deleteProduct, getStandProducts, updateProduct } from '@/api/products';
import { createStand, deleteStand, getEventStands, updateStand } from '@/api/stands';
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
  const eventId = params.eventId as string;
  const [event, stands] = await Promise.all([getEvent(eventId), getEventStands(eventId)]);
  // Fetch each stand's products in parallel, then index by stand id.
  const productLists = await Promise.all(stands.map((stand) => getStandProducts(stand._id)));
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
}: ActionFunctionArgs): Promise<EventActionResult | Response> {
  const eventId = params.eventId as string;
  const body = (await request.json()) as
    | { intent: 'start' | 'stop' }
    | { intent: 'save'; patch: UpdateEventInput }
    | { intent: 'createStand'; patch: CreateStandInput }
    | { intent: 'updateStand'; standId: string; patch: UpdateStandInput }
    | { intent: 'deleteStand'; standId: string }
    | { intent: 'createProduct'; standId: string; patch: CreateProductInput }
    | { intent: 'updateProduct'; productId: string; patch: UpdateProductInput }
    | { intent: 'deleteProduct'; productId: string }
    | { intent: 'deleteEvent' };

  try {
    switch (body.intent) {
      case 'start':
        await startEvent(eventId);
        break;
      case 'stop':
        await stopEvent(eventId);
        break;
      case 'save':
        await updateEvent(eventId, body.patch ?? {});
        break;
      case 'createStand':
        await createStand(eventId, body.patch);
        break;
      case 'updateStand':
        await updateStand(body.standId, body.patch);
        break;
      case 'deleteStand':
        await deleteStand(body.standId);
        break;
      case 'createProduct':
        await createProduct(body.standId, body.patch);
        break;
      case 'updateProduct':
        await updateProduct(body.productId, body.patch);
        break;
      case 'deleteProduct':
        await deleteProduct(body.productId);
        break;
      case 'deleteEvent':
        {
          const event = await getEvent(eventId);
          if (event.status !== 'DRAFT') {
            return { ok: false, error: 'Only draft events can be deleted.' };
          }
        }
        await deleteEvent(eventId);
        return redirect('/organizer');
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    return { ok: false, error: message };
  }
}
