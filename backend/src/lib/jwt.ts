import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { config } from "../config/config";

// There is no default lifetime here — lifetimes live with their identity type
// in config.auth, so every caller states the lifetime of the token it issues.
export function signJwt(
  payload: Record<string, unknown>,
  options: { expiresIn: string }
): string {
  return jwt.sign(payload, config.auth.jwt.secret, {
    algorithm: config.auth.jwt.algorithm,
    expiresIn: options.expiresIn as SignOptions["expiresIn"],
  });
}

export function verifyJwt(token: string): JwtPayload {
  const payload = jwt.verify(token, config.auth.jwt.secret, {
    algorithms: [config.auth.jwt.algorithm],
  });
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
