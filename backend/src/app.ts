import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { eventsRouter } from "./modules/events/routes";
import stripeWebhookRouter from "./modules/payments/routes";
import tabsRouter from "./modules/tabs/routes";
import ordersRouter from "./modules/orders/routes";

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

// Raw body needed for Stripe signature verification in production.
// In dev, falls back to express.json() so Bruno can send plain JSON.
app.use(
  "/webhooks/stripe",
  (req, res, next) => {
    if (process.env["NODE_ENV"] === "production") {
      express.raw({ type: "application/json" })(req, res, next);
    } else {
      express.json()(req, res, next);
    }
  },
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
