import type { Request, Response, NextFunction } from "express";
import { authenticateOrganizerToken } from "../authOrganizer";
import { authenticateAttendeeRequest } from "../authAttendee";
import { authenticateOperatorToken } from "../authOperator";
import { getBearerToken } from "./requestCredentials";

type AuthAttempt = (req: Request) => boolean | Promise<boolean>;

function tryOrganizer(req: Request): boolean {
  const token = getBearerToken(req);
  if (!token) return false;

  try {
    const organizer = authenticateOrganizerToken(token);
    req.organizer = organizer;
    return true;
  } catch {
    return false;
  }
}

function tryOperator(req: Request): boolean {
  const token = getBearerToken(req);
  if (!token) return false;

  try {
    const operator = authenticateOperatorToken(token);
    req.operator = operator;
    return true;
  } catch {
    return false;
  }
}

async function tryAttendee(req: Request): Promise<boolean> {
  try {
    req.attendee = await authenticateAttendeeRequest(req);
    return true;
  } catch {
    return false;
  }
}

function anyOf(...attempts: AuthAttempt[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    for (const attempt of attempts) {
      if (await attempt(req)) {
        next();
        return;
      }
    }

    res.status(401).json({ error: "Authentication required" });
  };
}

export const authOrganizerOrAttendee = anyOf(tryOrganizer, tryAttendee);
export const authOrganizerOrOperator = anyOf(tryOrganizer, tryOperator);
export const authOrganizerOrOperatorOrAttendee = anyOf(
  tryOrganizer,
  tryOperator,
  tryAttendee
);
