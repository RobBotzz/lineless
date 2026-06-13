import { createHmac, randomBytes } from "node:crypto";
import { config } from "../config/config";

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(rawToken: string): string {
  return createHmac("sha256", config.auth.jwt.secret)
    .update(rawToken)
    .digest("hex");
}
