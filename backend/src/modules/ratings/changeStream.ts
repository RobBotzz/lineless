import { Rating, type RatingDoc } from "./model";
import { publish } from "../../lib/realtimeBus";

let stream: ReturnType<typeof Rating.watch> | null = null;
type ChangeWithFullDocument<T> = { fullDocument?: T | null };

// Watch rating writes so every current and future review path updates live ECC
// subscribers through the same change-stream pattern as orders and products.
export function watchRatingChanges(): void {
  const s = Rating.watch<RatingDoc>([], { fullDocument: "updateLookup" });
  stream = s;

  s.on("change", (change) => {
    const fullDocument = (change as ChangeWithFullDocument<RatingDoc>)
      .fullDocument;
    if (fullDocument) publish("rating.changed", fullDocument);
  });

  s.on("error", (err) => {
    console.error("Rating change stream error — restarting:", err);
    void s.close().catch(() => undefined);
    setTimeout(() => watchRatingChanges(), 1000);
  });
}

export async function stopWatchingRatingChanges(): Promise<void> {
  await stream?.close();
  stream = null;
}
