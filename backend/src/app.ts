import express from "express";
import accountRouter from "./modules/accounts/routes";
import eventsRouter from "./modules/events/routes";
import { standsRouter, eventStandsRouter } from "./modules/stands/routes";

const app = express();

app.use(express.json());

// Health-Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/account", accountRouter);
app.use("/events", eventsRouter);
app.use("/events/:eventId/stands", eventStandsRouter);
app.use("/stands", standsRouter);

export { app };
