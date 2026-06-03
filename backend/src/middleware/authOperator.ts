import type { Request, Response, NextFunction } from "express";
import {
  getBearerToken,
  readRequiredStringClaim,
  verifyJwtPayload,
} from "./auth/requestCredentials";

interface OperatorTokenPayload {
  tokenType: "OPERATOR";
  standId: string;
}

function parseOperatorPayload(token: string): OperatorTokenPayload {
  const payload = verifyJwtPayload(token);
  const tokenType = payload["tokenType"] as unknown;
  const standId = readRequiredStringClaim(payload, "standId");

  if (tokenType !== "OPERATOR") {
    throw new Error("Invalid operator token payload");
  }

  return { tokenType, standId };
}

export function authenticateOperatorToken(token: string): { standId: string } {
  const payload = parseOperatorPayload(token);
  return { standId: payload.standId };
}

export function operatorMatchesRouteStand(
  req: Request,
  operator: { standId: string }
): boolean {
  const routeStandId = req.params["standId"];
  return (
    typeof routeStandId !== "string" ||
    routeStandId.length === 0 ||
    routeStandId === operator.standId
  );
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
    if (!operatorMatchesRouteStand(req, operator)) {
      res.status(403).json({ error: "Operator token does not match stand" });
      return;
    }

    req.operator = operator;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired operator token" });
  }
}
