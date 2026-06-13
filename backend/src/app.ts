import express from "express";
import swaggerUi from "swagger-ui-express";
import accountRouter from "./modules/accounts/routes";
import eventsRouter from "./modules/events/routes";
import sessionsRouter from "./modules/sessions/routes";
import { eventStandsRouter, standsRouter } from "./modules/stands/routes";
import { standProductsRouter, productsRouter } from "./modules/products/routes";
import { ordersRouter } from "./modules/orders/routes";
import { operatorRouter } from "./modules/operator/routes";
import { openapiSpec } from "./docs/openapi";

const app = express();

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
app.use("/api/orders", ordersRouter);

// View-based
app.use("/api/operator", operatorRouter);

export { app };
