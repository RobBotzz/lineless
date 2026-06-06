import type { Request, Response, NextFunction } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config/config";
import {
  getBearerToken,
  readRequiredStringClaim,
  verifyJwtPayload,
} from "./auth/requestCredentials";

const TOKEN_EXPIRATION = config.jwt.expiresIn as SignOptions["expiresIn"];

export function generateOperatorToken(standId: string): string {
  if (!standId) {
    throw new Error("Cannot generate token: missing standId");
  }

  return jwt.sign({ tokenType: "OPERATOR", standId }, config.jwt.secret, {
    expiresIn: TOKEN_EXPIRATION,
  });
}

export function authenticateOperatorToken(token: string): { standId: string } {
  const payload = verifyJwtPayload(token);
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
