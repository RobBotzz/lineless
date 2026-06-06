import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { config } from "../config/config";

const SIGN_OPTIONS: SignOptions = {
  algorithm: config.jwt.algorithm,
  expiresIn: config.jwt.expiresIn as SignOptions["expiresIn"],
};

export function signJwt(payload: Record<string, unknown>): string {
  return jwt.sign(payload, config.jwt.secret, SIGN_OPTIONS);
}

export function verifyJwt(token: string): JwtPayload {
  const payload = jwt.verify(token, config.jwt.secret, {
    algorithms: [config.jwt.algorithm],
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
