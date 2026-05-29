import express from "express";

const app = express();

app.use(express.json());

// Health-Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// TODO: Modul-Routen registrieren
// app.use("/accounts", accountsRouter);
// app.use("/users", usersRouter);
// ...

export { app };
