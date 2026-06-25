// Einstiegspunkt: DB verbinden und Server starten
import { app } from "./app";
import { config } from "./config/config";
import { connectDB } from "./lib/db";
import { watchOrderChanges } from "./modules/orders/changeStream";
import { watchProductChanges } from "./modules/products/changeStream";
import { watchRatingChanges } from "./modules/ratings/changeStream";
import { watchStandChanges } from "./modules/stands/changeStream";
import { checkoutDueTabs } from "./modules/tabs/service";

const TAB_CHECKOUT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function scheduleTabCheckoutSweep(): void {
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    checkoutDueTabs()
      .catch((err) => console.error("Tab checkout sweep failed:", err))
      .finally(() => {
        running = false;
      });
  }, TAB_CHECKOUT_SWEEP_INTERVAL_MS);
}

async function start(): Promise<void> {
  await connectDB();
  // Feed the realtime bus from MongoDB change streams (drives the SSE streams).
  watchOrderChanges();
  watchProductChanges();
  watchRatingChanges();
  watchStandChanges();
  scheduleTabCheckoutSweep();
  app.listen(config.port, () => {
    console.log(`Server läuft auf Port ${config.port}`);
  });
}

start().catch((err) => {
  console.error("Start fehlgeschlagen:", err);
  process.exit(1);
});
