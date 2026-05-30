import express from "express";
import accountRouter from "./modules/accounts/routes";
const app = express();

app.use(express.json());

// Health-Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Account Route
app.use("/api/account", accountRouter);


// TODO: Modul-Routen registrieren
// app.use("/accounts", accountsRouter);
// app.use("/users", usersRouter);
// ...

export { app };
