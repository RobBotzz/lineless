import { Event, type EventDoc } from "./model";
import { EventNotFoundError, EventStateError } from "./errors";
import type { CreateEventInput, UpdateEventInput } from "./types";

export async function createEvent(
  accountId: string,
  input: CreateEventInput
): Promise<EventDoc> {
  return Event.create({
    accountId: accountId,
    name: input.name,
    locationId: input.locationId,
    plannedDate: input.plannedDate,
    ratingsEnabled: input.ratingsEnabled,
    cashierEnabled: input.cashierEnabled,
    offlineOrdersEnabled: input.offlineOrdersEnabled,
    branding: input.branding,
  });
}

export async function listEvents(accountId: string): Promise<EventDoc[]> {
  return Event.find({ accountId: accountId, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean();
}

export async function getEvent(
  eventId: string,
  accountId: string
): Promise<EventDoc> {
  const event = await Event.findOne({
    _id: eventId,
    accountId: accountId,
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
  return event;
}

async function findActiveEvent(eventId: string, accountId: string) {
  const event = await Event.findOne({
    _id: eventId,
    accountId: accountId,
    deletedAt: null,
  });
  if (!event) throw new EventNotFoundError();
  return event;
}

export async function updateEvent(
  eventId: string,
  accountId: string,
  patch: UpdateEventInput
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId, accountId);
  if (patch.name !== undefined) event.name = patch.name;
  if (patch.locationId !== undefined) event.locationId = patch.locationId;
  if (patch.plannedDate !== undefined) event.plannedDate = patch.plannedDate;
  if (patch.ratingsEnabled !== undefined) {
    event.ratingsEnabled = patch.ratingsEnabled;
  }
  if (patch.cashierEnabled !== undefined) {
    event.cashierEnabled = patch.cashierEnabled;
  }
  if (patch.offlineOrdersEnabled !== undefined) {
    event.offlineOrdersEnabled = patch.offlineOrdersEnabled;
  }
  if (patch.branding) {
    if (patch.branding.primaryColor !== undefined) {
      event.branding.primaryColor = patch.branding.primaryColor;
    }
    if (patch.branding.secondaryColor !== undefined) {
      event.branding.secondaryColor = patch.branding.secondaryColor;
    }
    if (patch.branding.logoUrl !== undefined) {
      event.branding.logoUrl = patch.branding.logoUrl;
    }
  }
  await event.save();
  return event;
}

export async function startEvent(
  eventId: string,
  accountId: string
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId, accountId);
  if (event.status === "ACTIVE") {
    throw new EventStateError("Event is already active");
  }
  if (event.status === "STOPPED") {
    throw new EventStateError("A stopped event cannot be restarted");
  }
  event.status = "ACTIVE";
  event.startedAt = new Date();
  await event.save();
  return event;
}

export async function stopEvent(
  eventId: string,
  accountId: string
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId, accountId);
  if (event.status !== "ACTIVE") {
    throw new EventStateError("Only an active event can be stopped");
  }
  event.status = "STOPPED";
  event.stoppedAt = new Date();
  await event.save();
  return event;
}

export async function softDeleteEvent(
  eventId: string,
  accountId: string
): Promise<void> {
  const event = await findActiveEvent(eventId, accountId);
  event.deletedAt = new Date();
  await event.save();
}
