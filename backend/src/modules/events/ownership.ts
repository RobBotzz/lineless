import { Event } from "./model";
import { EventNotFoundError, EventStateError } from "./errors";

// Guards that `eventId` exists and belongs to `accountId`. A non-existent OR
// a not-owned event both surface as EventNotFoundError — we deliberately do not
// leak the existence of events owned by other accounts.
//
// Shared across modules whose resources hang off an event (stands, and later
// products via their stand's eventId).
export async function verifyEventOwnership(
  eventId: string,
  accountId: string
): Promise<void> {
  const event = await Event.findOne({
    _id: eventId,
    accountId,
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
}

// Like verifyEventOwnership, but additionally rejects a COMPLETED event. A
// completed event is immutable: neither its own configuration nor its stands or
// products may be changed anymore. Used by every organizer-facing mutation that
// hangs off an event, so the immutability is enforced in one place.
export async function verifyMutableEventOwnership(
  eventId: string,
  accountId: string
): Promise<void> {
  const event = await Event.findOne({
    _id: eventId,
    accountId,
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
  if (event.status === "COMPLETED") {
    throw new EventStateError("A completed event cannot be modified");
  }
}

export function assertSessionOwnsEvent(
  urlEventId: string,
  sessionEventId: string
): void {
  if (urlEventId !== sessionEventId) {
    throw new EventNotFoundError();
  }
}

export async function verifyActiveEvent(eventId: string): Promise<void> {
  const event = await Event.findOne({
    _id: eventId,
    status: "ACTIVE",
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
}

// Operators may work an event in any lifecycle state — before it goes live
// (setup), while it is live, and after it has ended (wind-down/reconciliation).
// Only a missing or deleted event is rejected; the status is not restricted.
export async function verifyOperableEvent(eventId: string): Promise<void> {
  const event = await Event.findOne({
    _id: eventId,
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
}

// Like verifyOperableEvent, but rejects a COMPLETED event. Operators may still
// work a STOPPED event (wind-down/fulfilment), but a completed event is terminal
// and immutable — so operator-driven mutations (e.g. product pause/resume) are
// rejected here while operator reads keep using verifyOperableEvent.
export async function verifyMutableOperableEvent(
  eventId: string
): Promise<void> {
  const event = await Event.findOne({
    _id: eventId,
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
  if (event.status === "COMPLETED") {
    throw new EventStateError("A completed event cannot be modified");
  }
}

// Validates the operator link key for any non-deleted event, regardless of
// status. The status gate (DRAFT/ACTIVE allowed, STOPPED rejected) lives in the
// service layer, where a proper error code can be returned — the auth guard
// using this swallows thrown errors into a generic 401.
export async function verifyOperatorAccessKey(
  eventId: string,
  key: string
): Promise<void> {
  const event = await Event.findOne({
    _id: eventId,
    deletedAt: null,
  }).lean();
  if (!event || event.operatorAccessKey !== key) {
    throw new EventNotFoundError();
  }
}
