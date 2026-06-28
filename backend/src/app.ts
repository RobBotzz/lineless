import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import stripeWebhookRouter from "./modules/payments/routes";
import tabsRouter from "./modules/tabs/routes";
import { ordersRouter, cashPaymentsRouter } from "./modules/orders/routes";
import accountRouter from "./modules/accounts/routes";
import eventsRouter from "./modules/events/routes";
import sessionsRouter from "./modules/sessions/routes";
import { eventStandsRouter, standsRouter } from "./modules/stands/routes";
import {
  standProductsRouter,
  productsRouter,
  eventProductsRouter,
} from "./modules/products/routes";
import {
  orderRatingsRouter,
  productRatingsRouter,
} from "./modules/ratings/routes";
import { operatorRouter } from "./modules/operator/routes";
import { eventControlCenterRouter } from "./modules/eventControlCenter/routes";
import { openapiSpec } from "./docs/openapi";

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

// Stripe signature verification recomputes the HMAC over the exact bytes Stripe
// sent, so the webhook body must stay a raw Buffer — never JSON-parsed — for
// both real Stripe (CLI/production) and Bruno. This must precede express.json().
app.use(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
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
app.use("/api/events/:eventId/event-control-center", eventControlCenterRouter);
app.use("/api/events/:eventId/stands", eventStandsRouter);
app.use("/api/events/:eventId/products", eventProductsRouter);
app.use("/api/stands/:standId/products", standProductsRouter);
app.use("/api/stands", standsRouter);
app.use("/api/products/:productId/ratings", productRatingsRouter);
app.use("/api/products", productsRouter);
app.use("/api/tabs", tabsRouter);
app.use("/api/orders/:orderId/products/:productId/ratings", orderRatingsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/cash-payments", cashPaymentsRouter);

// View-based
app.use("/api/operator", operatorRouter);

export { app };
