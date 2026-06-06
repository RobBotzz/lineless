import type { Request } from "express";
import { validateAttendeeSession } from "../../modules/sessions/service";

const ATTENDEE_SESSION_HEADER = "X-Attendee-Session-ID";

// Reads the attendee session header and validates it against the stored
// session. The session/event lookup itself lives in the sessions service.
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
