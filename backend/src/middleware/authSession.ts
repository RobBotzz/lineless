// Cookie Session Checking
import type { Request, Response, NextFunction } from "express";

export function authSession(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.["sessionId"];
  if (!sessionId) {
    res.status(401).json({ error: "Keine Session" });
    return;
  }

  // TODO: Session validieren und req.session setzen
  next();
}
