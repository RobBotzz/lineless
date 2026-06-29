import { publish } from "../../lib/realtimeBus";
import { EventControlCenterSettings } from "./settings.model";

let stream: ReturnType<typeof EventControlCenterSettings.watch> | null = null;

type SettingsChange = {
  documentKey?: { _id?: unknown };
  fullDocument?: { _id?: unknown } | null;
};

export function watchEventControlCenterSettingsChanges(): void {
  const s = EventControlCenterSettings.watch([], {
    fullDocument: "updateLookup",
  });
  stream = s;

  s.on("change", (rawChange) => {
    const change = rawChange as SettingsChange;
    const eventId = change.fullDocument?._id ?? change.documentKey?._id;
    if (typeof eventId === "string") {
      publish("eventControlCenterSettings.changed", { eventId });
    }
  });

  s.on("error", (err) => {
    console.error(
      "Event control center settings change stream error — restarting:",
      err
    );
    void s.close().catch(() => undefined);
    setTimeout(() => watchEventControlCenterSettingsChanges(), 1000);
  });
}

export async function stopWatchingEventControlCenterSettingsChanges(): Promise<void> {
  await stream?.close();
  stream = null;
}
