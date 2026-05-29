// Einstiegspunkt: DB verbinden und Server starten
import { app } from "./app";
import { config } from "./config/config";
import { connectDB } from "./lib/db";

async function start(): Promise<void> {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`Server läuft auf Port ${config.port}`);
  });
}

start().catch((err) => {
  console.error("Start fehlgeschlagen:", err);
  process.exit(1);
});
