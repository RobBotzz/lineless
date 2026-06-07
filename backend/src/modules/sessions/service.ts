import { Event } from "../events/model";
import { AttendeeSession } from "./model";
import {
  AttendeeSessionInvalidError,
  SessionEventNotFoundError,
} from "./errors";
import type { CreateSessionInput } from "./types";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface AttendeeSessionResult {
  sessionId: string;
  eventId: string;
  expiresAt: Date;
}

export async function createAttendeeSession(
  input: CreateSessionInput
): Promise<AttendeeSessionResult> {
  const event = await Event.findOne({
    _id: input.eventId,
    status: "ACTIVE",
    deletedAt: null,
  }).lean();
  if (!event) {
    throw new SessionEventNotFoundError();
  }

  const session = await AttendeeSession.create({
    eventId: input.eventId,
    status: "active",
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  return {
    sessionId: session._id,
    eventId: session.eventId,
    expiresAt: session.expiresAt,
  };
}

export async function validateAttendeeSession(
  sessionId: string
): Promise<AttendeeSessionResult> {
  const session = await AttendeeSession.findOne({
    _id: sessionId,
    status: "active",
    expiresAt: { $gt: new Date() },
  }).lean();

  if (!session) {
    throw new AttendeeSessionInvalidError();
  }

  const event = await Event.findOne({
    _id: session.eventId,
    status: "ACTIVE",
    deletedAt: null,
  }).lean();
  if (!event) {
    throw new AttendeeSessionInvalidError();
  }

  return {
    sessionId: session._id,
    eventId: session.eventId,
    expiresAt: session.expiresAt,
  };
}
