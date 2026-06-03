import type { Request, Response, NextFunction } from "express";
import {
  getBearerToken,
  readRequiredStringClaim,
  verifyJwtPayload,
} from "./auth/requestCredentials";

interface AccountTokenPayload {
  sub: string;
}

function parseAccountPayload(token: string): AccountTokenPayload {
  const payload = verifyJwtPayload(token);
  return { sub: readRequiredStringClaim(payload, "sub") };
}

export function authenticateAccountToken(token: string): { accountId: string } {
  const payload = parseAccountPayload(token);
  return { accountId: payload.sub };
}

// Verifies the organizer JWT and attaches the authenticated account to req.
// Rejects with 401 if the token is missing, malformed, invalid or expired.
export function authAccount(
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
    const account = authenticateAccountToken(token);
    req.account = account;
    req.user = account;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
