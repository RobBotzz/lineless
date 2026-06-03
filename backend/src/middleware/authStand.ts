import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config/config";

interface StandTokenPayload {
  typ: "protected_stand" | "unprotected_stand";
  sub: string;
  eventId: string;
}

function isJwtPayload(payload: string | JwtPayload): payload is JwtPayload {
  return typeof payload === "object" && payload !== null;
}

function parseStandPayload(payload: string | JwtPayload): StandTokenPayload {
  if (!isJwtPayload(payload)) {
    throw new Error("Invalid stand token payload");
  }

  const typ = payload["typ"] as unknown;
  const sub = payload["sub"] as unknown;
  const eventId = payload["eventId"] as unknown;

  if (
    (typ !== "protected_stand" && typ !== "unprotected_stand") ||
    typeof sub !== "string" ||
    typeof eventId !== "string"
  ) {
    throw new Error("Invalid stand token payload");
  }

  return {
    typ,
    sub,
    eventId,
  };
}

export function authStand(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  try {
    // Middleware-only scope: stand tokens use the existing JWT secret until a
    // dedicated stand-token issuer/config is introduced.
    const decoded = jwt.verify(
      header.slice("Bearer ".length),
      config.jwt.secret
    );
    const payload = parseStandPayload(decoded);
    req.stand = {
      standId: payload.sub,
      eventId: payload.eventId,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired stand token" });
  }
}
