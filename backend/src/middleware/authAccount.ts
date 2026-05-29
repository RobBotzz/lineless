//JWT Checking
import type { Request, Response, NextFunction } from "express";

export function authAccount(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Kein Token" });
    return;
  }

  // TODO: Token verifizieren (jwt.verify) und req.account setzen
  next();
}
