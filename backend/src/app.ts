import express from "express";
import cookieParser from "cookie-parser";
import accountRouter from "./modules/accounts/routes";
import eventsRouter from "./modules/events/routes";

const app = express();

app.use(express.json());
app.use(cookieParser());

// Health-Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/account", accountRouter);
app.use("/api/events", eventsRouter);

export { app };
