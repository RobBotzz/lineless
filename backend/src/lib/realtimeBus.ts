import { EventEmitter } from "events";
import type { OrderDoc } from "../modules/orders/model";
import type { ProductDoc } from "../modules/products/model";

// In-process publish/subscribe for realtime domain events. Services publish after
// a mutation; SSE endpoints subscribe and fan changes out to connected clients.
// Keeping the bus independent of both sides means a new producer (e.g. a MongoDB
// change stream) or a new consumer can be added without touching the others.
//
// Note: in-process only — works for a single backend instance. Scaling to several
// instances would need a shared transport (change stream or Redis pub/sub) behind
// the same publish()/subscribe() API.
interface RealtimeEvents {
  "order.changed": OrderDoc;
  "product.changed": ProductDoc;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(0); // many operator dashboards may subscribe concurrently

export function publish<K extends keyof RealtimeEvents>(
  topic: K,
  payload: RealtimeEvents[K]
): void {
  emitter.emit(topic, payload);
}

// Returns an unsubscribe function — call it in the SSE onClose cleanup.
export function subscribe<K extends keyof RealtimeEvents>(
  topic: K,
  listener: (payload: RealtimeEvents[K]) => void
): () => void {
  emitter.on(topic, listener);
  return () => emitter.off(topic, listener);
}
