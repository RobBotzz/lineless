import type { Request, Response, NextFunction } from "express";
import { config } from "../config/config";
import { getCookie } from "./auth/requestCredentials";

export function getAttendeeSessionId(req: Request): string | null {
  return getCookie(req, config.sessionCookieName);
}

export function authAttendee(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const sessionId = getAttendeeSessionId(req);
  if (!sessionId) {
    res.status(401).json({ error: "No attendee session found" });
    return;
  }

  req.attendee = { sessionId };
  next();
}
