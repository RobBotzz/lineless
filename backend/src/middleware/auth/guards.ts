import type { Request, Response, NextFunction } from "express";
import { authenticateOrganizerToken } from "./organizer";
import { authenticateOperatorToken } from "./operator";
import { authenticateAttendeeRequest } from "./attendee";
import { authenticateOperatorAccessKeyRequest } from "./operatorAccessKey";
import { getBearerToken } from "./requestCredentials";

type AuthAttempt = (req: Request) => boolean | Promise<boolean>;

function tryOrganizer(req: Request): boolean {
  const token = getBearerToken(req);
  if (!token) return false;

  try {
    req.organizer = authenticateOrganizerToken(token);
    return true;
  } catch {
    return false;
  }
}

function tryOperator(req: Request): boolean {
  const token = getBearerToken(req);
  if (!token) return false;

  try {
    req.operator = authenticateOperatorToken(token);
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

async function tryOperatorAccessKey(req: Request): Promise<boolean> {
  try {
    req.operatorLink = await authenticateOperatorAccessKeyRequest(req);
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

export const authOrganizer = anyOf(tryOrganizer);
export const authOperator = anyOf(tryOperator);
export const authOperatorLink = anyOf(tryOperatorAccessKey);
export const authAttendee = anyOf(tryAttendee);
export const authOrganizerOrAttendee = anyOf(tryOrganizer, tryAttendee);
export const authOperatorOrAttendee = anyOf(tryOperator, tryAttendee);
export const authOrganizerOrOperator = anyOf(tryOrganizer, tryOperator);
export const authOrganizerOrOperatorOrAttendee = anyOf(
  tryOrganizer,
  tryOperator,
  tryAttendee
);
export const authOrganizerOrAttendeeOrEventLink = anyOf(
  tryOrganizer,
  tryAttendee,
  tryOperatorAccessKey
);
