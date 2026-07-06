import { Event } from "../events/model";
import { AttendeeSession } from "./model";
import {
  AttendeeSessionInvalidError,
  SessionEventNotFoundError,
} from "./errors";
import type { CreateSessionInput, SetSessionEmailInput } from "./types";

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
    email: input.email ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  return {
    sessionId: session._id,
    eventId: session.eventId,
    expiresAt: session.expiresAt,
  };
}

// Sets/updates the email on an active session — called at checkout. The session
// is already authenticated by the attendee middleware, so we only need to write.
export async function setAttendeeSessionEmail(
  sessionId: string,
  input: SetSessionEmailInput
): Promise<{ email: string }> {
  const result = await AttendeeSession.updateOne(
    { _id: sessionId, status: "active", expiresAt: { $gt: new Date() } },
    { email: input.email }
  );
  if (result.matchedCount === 0) {
    throw new AttendeeSessionInvalidError();
  }
  return { email: input.email };
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

  // Session stays valid once the event has gone live — guests keep their session
  // after an event is stopped so they can still view orders and receive fulfillments.
  // A DRAFT event was never open to attendees, so its sessions must never validate;
  // enforcing that here (not just at creation) keeps the invariant local to this
  // check rather than relying on createAttendeeSession's ACTIVE gate alone.
  const event = await Event.findOne({
    _id: session.eventId,
    status: { $ne: "DRAFT" },
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
