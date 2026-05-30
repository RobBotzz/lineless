import express from "express";
import { eventsRouter } from "./modules/events/routes";

const app = express();

app.use(express.json());

// Health-Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/events", eventsRouter);

export { app };
