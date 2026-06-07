import type { Request } from "express";

const BEARER_PREFIX = "Bearer ";

export function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith(BEARER_PREFIX)) return null;
  return header.slice(BEARER_PREFIX.length);
}
