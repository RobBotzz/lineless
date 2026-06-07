import { Event } from "./model";
import { EventNotFoundError } from "./errors";

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

export async function verifyOperatorAccessKey(
  eventId: string,
  key: string
): Promise<void> {
  const event = await Event.findOne({
    _id: eventId,
    status: "ACTIVE",
    deletedAt: null,
  }).lean();
  if (!event || event.operatorAccessKey !== key) {
    throw new EventNotFoundError();
  }
}
