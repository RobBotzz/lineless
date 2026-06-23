import { Order, type OrderDoc } from "./model";
import { publish } from "../../lib/realtimeBus";

let stream: ReturnType<typeof Order.watch> | null = null;
type ChangeWithFullDocument<T> = { fullDocument?: T | null };

// Watch the orders collection and publish every insert/update onto the realtime
// bus. This replaces explicit publish() calls at each write site: any path that
// persists an order change — operator transitions, instant-item release, payment
// confirmation, a future webhook, even a manual DB edit — is captured here.
// Requires MongoDB running as a replica set.
export function watchOrderChanges(): void {
  const s = Order.watch<OrderDoc>([], { fullDocument: "updateLookup" });
  stream = s;

  s.on("change", (change) => {
    const fullDocument = (change as ChangeWithFullDocument<OrderDoc>)
      .fullDocument;
    if (fullDocument) publish("order.changed", fullDocument);
  });

  // A dropped change stream silently stops all live updates — re-establish it.
  s.on("error", (err) => {
    console.error("Order change stream error — restarting:", err);
    void s.close().catch(() => undefined);
    setTimeout(() => watchOrderChanges(), 1000);
  });
}

export async function stopWatchingOrderChanges(): Promise<void> {
  await stream?.close();
  stream = null;
}
