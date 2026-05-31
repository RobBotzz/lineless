import express from "express";
import cookieParser from "cookie-parser";
import accountRouter from "./modules/accounts/routes";
import eventsRouter from "./modules/events/routes";
import { eventStandsRouter, standsRouter } from "./modules/stands/routes";

const app = express();

app.use(express.json());
app.use(cookieParser());

// Health-Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/account", accountRouter);
app.use("/api/events", eventsRouter);
app.use("/api/events/:eventId/stands", eventStandsRouter);
app.use("/api/stands", standsRouter);

export { app };
