import { Event, EVENT_STATUS, type EventDoc } from "./model";
import { EventNotFoundError, EventStateError } from "./errors";
import type { CreateEventInput, UpdateEventInput } from "./types";

export async function createEvent(input: CreateEventInput): Promise<EventDoc> {
  return Event.create({
    accountId: input.accountId,
    name: input.name,
    location: input.location,
    startsAt: input.startsAt,
    ratingsEnabled: input.ratingsEnabled,
  });
}

export async function listEvents(): Promise<EventDoc[]> {
  return Event.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
}

export async function getEvent(eventId: string): Promise<EventDoc> {
  const event = await Event.findOne({ _id: eventId, deletedAt: null }).lean();
  if (!event) throw new EventNotFoundError();
  return event;
}

async function findActiveEvent(eventId: string) {
  const event = await Event.findOne({ _id: eventId, deletedAt: null });
  if (!event) throw new EventNotFoundError();
  return event;
}

export async function updateEvent(
  eventId: string,
  patch: UpdateEventInput
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId);
  if (patch.name !== undefined) event.name = patch.name;
  if (patch.location !== undefined) event.location = patch.location;
  if (patch.startsAt !== undefined) event.startsAt = patch.startsAt;
  if (patch.ratingsEnabled !== undefined) {
    event.ratingsEnabled = patch.ratingsEnabled;
  }
  await event.save();
  return event;
}

export async function startEvent(eventId: string): Promise<EventDoc> {
  const event = await findActiveEvent(eventId);
  if (event.status === EVENT_STATUS.ACTIVE) {
    throw new EventStateError("Event is already active");
  }
  if (event.status === EVENT_STATUS.STOPPED) {
    throw new EventStateError("A stopped event cannot be restarted");
  }
  event.status = EVENT_STATUS.ACTIVE;
  event.startedAt = new Date();
  await event.save();
  return event;
}

export async function stopEvent(eventId: string): Promise<EventDoc> {
  const event = await findActiveEvent(eventId);
  if (event.status !== EVENT_STATUS.ACTIVE) {
    throw new EventStateError("Only an active event can be stopped");
  }
  event.status = EVENT_STATUS.STOPPED;
  event.stoppedAt = new Date();
  await event.save();
  return event;
}

export async function softDeleteEvent(eventId: string): Promise<void> {
  const event = await findActiveEvent(eventId);
  event.deletedAt = new Date();
  await event.save();
}
