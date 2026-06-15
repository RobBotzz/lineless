import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import stripeWebhookRouter from "./modules/payments/routes";
import cashPaymentsRouter from "./modules/payments/cashPayments.routes";
import tabsRouter from "./modules/tabs/routes";
import ordersRouter from "./modules/orders/routes";
import accountRouter from "./modules/accounts/routes";
import eventsRouter from "./modules/events/routes";
import sessionsRouter from "./modules/sessions/routes";
import { eventStandsRouter, standsRouter } from "./modules/stands/routes";
import { standProductsRouter, productsRouter } from "./modules/products/routes";
import { operatorRouter } from "./modules/operator/routes";
import { openapiSpec } from "./docs/openapi";

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

// Health-Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Swagger-UI
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Resource-based
app.use("/api/account", accountRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/events/:eventId/stands", eventStandsRouter);
app.use("/api/stands/:standId/products", standProductsRouter);
app.use("/api/stands", standsRouter);
app.use("/api/products", productsRouter);
app.use("/api/tabs", tabsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/cash-payments", cashPaymentsRouter);

// View-based
app.use("/api/operator", operatorRouter);

export { app };
