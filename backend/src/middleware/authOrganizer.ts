import type { Request, Response, NextFunction } from "express";
import {
  getBearerToken,
  readRequiredStringClaim,
  verifyJwtPayload,
} from "./auth/requestCredentials";

export function authenticateOrganizerToken(token: string): {
  accountId: string;
} {
  const payload = verifyJwtPayload(token);
  if (payload["tokenType"] !== "ORGANIZER") {
    throw new Error("Invalid organizer token payload");
  }

  return { accountId: readRequiredStringClaim(payload, "sub") };
}

// Verifies the organizer JWT and attaches the authenticated organizer to req.
// Rejects with 401 if the token is missing, malformed, invalid or expired.
export function authOrganizer(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = getBearerToken(req);
  if (!token) {
    res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
    return;
  }

  try {
    const organizer = authenticateOrganizerToken(token);
    req.organizer = organizer;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
