import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config/config";

interface AccountTokenPayload {
  sub: string;
  email: string;
}

// Verifies the organizer JWT and attaches the authenticated account to req.user.
// Rejects with 401 if the token is missing, malformed, invalid or expired.
export function authAccount(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as AccountTokenPayload;
    req.user = { accountId: payload.sub };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
