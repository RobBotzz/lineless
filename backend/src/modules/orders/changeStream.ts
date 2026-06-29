import { Order, type OrderDoc } from "./model";
import { publish } from "../../lib/realtimeBus";

type ChangeWithFullDocument<T> = { fullDocument?: T | null };

let stream: ReturnType<typeof Order.watch> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectDelay = 1_000;
const MAX_RECONNECT_DELAY = 30_000;

export function watchOrderChanges(): void {
  // Cancel any pending retry so a manual call doesn't stack with an auto-retry.
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectDelay = 1_000;
  startWatch();
}

function startWatch(): void {
  void stream?.close().catch(() => undefined);
  const s = Order.watch<OrderDoc>([], { fullDocument: "updateLookup" });
  stream = s;

  s.on("change", (change) => {
    reconnectDelay = 1_000; // successful event — reset backoff
    const fullDocument = (change as ChangeWithFullDocument<OrderDoc>)
      .fullDocument;
    if (fullDocument) publish("order.changed", fullDocument);
  });

  s.on("error", (err) => {
    console.error(
      "Order change stream error — restarting in",
      reconnectDelay,
      "ms:",
      err
    );
    void s.close().catch(() => undefined);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      startWatch();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  });
}

export async function stopWatchingOrderChanges(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  await stream?.close();
  stream = null;
}
