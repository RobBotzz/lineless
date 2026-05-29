// Stand-Zugang für Operator
import type { Request, Response, NextFunction } from "express";

export function authStand(req: Request, res: Response, next: NextFunction): void {
  const standToken = req.headers["x-stand-token"];
  if (!standToken) {
    res.status(401).json({ error: "Kein Stand-Token" });
    return;
  }

  // TODO: Stand-Token validieren und req.stand setzen
  next();
}
