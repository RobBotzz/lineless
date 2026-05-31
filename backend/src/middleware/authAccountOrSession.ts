import jwt from "jsonwebtoken";
import { config } from "../config/config";
import type { Request, Response, NextFunction } from "express";

// Allows either an organizer (Bearer JWT) or an attendee (session cookie) through.
// Sets req.user if the JWT path is taken.
export function authAccountOrSession(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length);
    try {
      const payload = jwt.verify(token, config.jwt.secret) as {
        sub: string;
        email: string;
      };
      req.user = { accountId: payload.sub };
      return next();
    } catch {
      // fall through to session check
    }
  }

  const sessionId = req.cookies?.["sessionId"] as string | undefined;
  if (sessionId) {
    return next();
  }

  res.status(401).json({ error: "Authentication required" });
}
