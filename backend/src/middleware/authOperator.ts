import type { Request, Response, NextFunction } from "express";
import { readRequiredStringClaim, verifyJwt } from "../lib/jwt";
import { getBearerToken } from "./auth/requestCredentials";

export function authenticateOperatorToken(token: string): { standId: string } {
  const payload = verifyJwt(token);
  if (payload["tokenType"] !== "OPERATOR") {
    throw new Error("Invalid operator token payload");
  }

  return { standId: readRequiredStringClaim(payload, "standId") };
}

export function authOperator(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  try {
    const operator = authenticateOperatorToken(token);
    req.operator = operator;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired operator token" });
  }
}
