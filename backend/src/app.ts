import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { eventsRouter } from "./modules/events/routes";
import { stripeWebhookRouter } from "./modules/payments/routes";
import { tabsRouter } from "./modules/tabs/routes";
import { ordersRouter } from "./modules/orders/routes";

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

app.use(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookRouter
);

app.use(express.json());
app.use(cookieParser());

// Health-Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/events", eventsRouter);
app.use("/tabs", tabsRouter);
app.use("/orders", ordersRouter);

export { app };
