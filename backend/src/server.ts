// Einstiegspunkt: DB verbinden und Server starten
import { app } from "./app";
import { config } from "./config/config";
import { connectDB } from "./lib/db";
import { watchOrderChanges } from "./modules/orders/changeStream";
import { watchProductChanges } from "./modules/products/changeStream";

async function start(): Promise<void> {
  await connectDB();
  // Feed the realtime bus from MongoDB change streams (drives the SSE streams).
  watchOrderChanges();
  watchProductChanges();
  app.listen(config.port, () => {
    console.log(`Server läuft auf Port ${config.port}`);
  });
}

start().catch((err) => {
  console.error("Start fehlgeschlagen:", err);
  process.exit(1);
});
