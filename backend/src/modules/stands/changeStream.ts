import { Stand, type StandDoc } from "./model";
import { publish } from "../../lib/realtimeBus";

let stream: ReturnType<typeof Stand.watch> | null = null;
type ChangeWithFullDocument<T> = { fullDocument?: T | null };

// Watch the stands collection and publish every insert/update onto the realtime
// bus. This keeps Event Control Center snapshots fresh for pause/resume changes
// without explicit publish() calls in each stand write path.
export function watchStandChanges(): void {
  const s = Stand.watch<StandDoc>([], { fullDocument: "updateLookup" });
  stream = s;

  s.on("change", (change) => {
    const fullDocument = (change as ChangeWithFullDocument<StandDoc>)
      .fullDocument;
    if (fullDocument) publish("stand.changed", fullDocument);
  });

  s.on("error", (err) => {
    console.error("Stand change stream error — restarting:", err);
    void s.close().catch(() => undefined);
    setTimeout(() => watchStandChanges(), 1000);
  });
}

export async function stopWatchingStandChanges(): Promise<void> {
  await stream?.close();
  stream = null;
}
