import { Product, type ProductDoc } from "./model";
import { publish } from "../../lib/realtimeBus";

let stream: ReturnType<typeof Product.watch> | null = null;

// Watch the products collection and publish every insert/update onto the realtime
// bus. Mirrors watchOrderChanges: any path that persists a product change — a
// future pause/resume/terminate, soft-delete, name/stock/price edits, or a newly
// created product — is captured here without explicit publish() calls at each
// write site. Requires MongoDB running as a replica set.
export function watchProductChanges(): void {
  const s = Product.watch<ProductDoc>([], { fullDocument: "updateLookup" });
  stream = s;

  s.on("change", (change) => {
    if ("fullDocument" in change && change.fullDocument) {
      publish("product.changed", change.fullDocument as ProductDoc);
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
