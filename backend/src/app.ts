import express from "express";
import accountRouter from "./modules/accounts/routes";
import eventsRouter from "./modules/events/routes";
import locationsRouter from "./modules/locations/routes";

const app = express();

app.use(express.json());

// Health-Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/account", accountRouter);
app.use("/api/events", eventsRouter);
app.use("/api/locations", locationsRouter);

export { app };
