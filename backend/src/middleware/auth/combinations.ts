import type { Request, Response, NextFunction } from "express";
import { authenticateAccountToken } from "../authAccount";
import { getAttendeeSessionId } from "../authAttendee";
import {
  authenticateOperatorToken,
  operatorMatchesRouteStand,
} from "../authOperator";
import { getBearerToken } from "./requestCredentials";

type AuthAttempt = (req: Request) => boolean;

function tryAccount(req: Request): boolean {
  const token = getBearerToken(req);
  if (!token) return false;

  try {
    const account = authenticateAccountToken(token);
    req.account = account;
    req.user = account;
    return true;
  } catch {
    return false;
  }
}

function tryOperator(req: Request): boolean {
  const token = getBearerToken(req);
  if (!token) return false;

  try {
    const operator = authenticateOperatorToken(token);
    if (!operatorMatchesRouteStand(req, operator)) return false;

    req.operator = operator;
    return true;
  } catch {
    return false;
  }
}

function tryAttendee(req: Request): boolean {
  const sessionId = getAttendeeSessionId(req);
  if (!sessionId) return false;

  req.attendee = { sessionId };
  return true;
}

function anyOf(...attempts: AuthAttempt[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (attempts.some((attempt) => attempt(req))) {
      next();
      return;
    }

    res.status(401).json({ error: "Authentication required" });
  };
}

export const authAccountOrOperator = anyOf(tryAccount, tryOperator);
export const authAccountOrAttendee = anyOf(tryAccount, tryAttendee);
export const authOperatorOrAttendee = anyOf(tryOperator, tryAttendee);
export const authAccountOrOperatorOrAttendee = anyOf(
  tryAccount,
  tryOperator,
  tryAttendee
);
