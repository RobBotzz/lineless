import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Request } from "express";
import { config } from "../../config/config";

const BEARER_PREFIX = "Bearer ";

export function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith(BEARER_PREFIX)) return null;
  return header.slice(BEARER_PREFIX.length);
}

export function verifyJwtPayload(token: string): JwtPayload {
  const payload = jwt.verify(token, config.jwt.secret);
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid token payload");
  }

  return payload;
}

export function readRequiredStringClaim(
  payload: JwtPayload,
  claim: string
): string {
  const value = payload[claim] as unknown;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing or invalid ${claim} claim`);
  }

  return value;
}
