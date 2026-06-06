import type { Request, Response, NextFunction } from "express";
import { validateAttendeeSession } from "../modules/sessions/service";

const ATTENDEE_SESSION_HEADER = "X-Attendee-Session-ID";

export async function authenticateAttendeeRequest(req: Request): Promise<{
  sessionId: string;
  eventId: string;
}> {
  const sessionId = req.get(ATTENDEE_SESSION_HEADER);
  if (!sessionId) {
    throw new Error("No attendee session found");
  }

  return validateAttendeeSession(sessionId);
}

export async function authAttendee(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    req.attendee = await authenticateAttendeeRequest(req);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired attendee session" });
  }
}
