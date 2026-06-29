import { Product, type ProductDoc } from "./model";
import { publish } from "../../lib/realtimeBus";

let stream: ReturnType<typeof Product.watch> | null = null;
type ProductChange = {
  fullDocument?: ProductDoc | null;
  operationType?: string;
  updateDescription?: {
    removedFields?: string[];
    updatedFields?: Record<string, unknown>;
  };
};

function onlyRatingAggregateChanged(change: ProductChange): boolean {
  if (change.operationType !== "update") return false;
  const fields = [
    ...Object.keys(change.updateDescription?.updatedFields ?? {}),
    ...(change.updateDescription?.removedFields ?? []),
  ];
  const ratingFields = new Set(["ratingCount", "ratingSum"]);
  return (
    fields.some((field) => ratingFields.has(field)) &&
    fields.every((field) => ratingFields.has(field) || field === "updatedAt")
  );
}

// Watch the products collection and publish every insert/update onto the realtime
// bus. Mirrors watchOrderChanges: any path that persists a product change — a
// future pause/resume/terminate, soft-delete, name/stock/price edits, or a newly
// created product — is captured here without explicit publish() calls at each
// write site. Requires MongoDB running as a replica set.
export function watchProductChanges(): void {
  const s = Product.watch<ProductDoc>([], { fullDocument: "updateLookup" });
  stream = s;

  s.on("change", (rawChange) => {
    const change = rawChange as ProductChange;
    const product = change.fullDocument;
    if (!product) return;

    publish("product.changed", product);
    if (!onlyRatingAggregateChanged(change)) {
      publish("product.catalog.changed", product);
    }
  });

  // A dropped change stream silently stops all live updates — re-establish it.
  s.on("error", (err) => {
    console.error("Product change stream error — restarting:", err);
    void s.close().catch(() => undefined);
    setTimeout(() => watchProductChanges(), 1000);
  });
}

export async function stopWatchingProductChanges(): Promise<void> {
  await stream?.close();
  stream = null;
}
